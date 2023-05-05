#include <string>
#include <vector>
#include <cstdint>
#include <cstdio>
#include <algorithm>

#define PI 3.14159265359

#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image.h"
#include "stb_image_write.h"

struct Range
{
	float low[3];
	float high[3];
};


void get_range(int count, const float* hdr, Range& range)
{
	for (int i = 0; i < 3; i++)
	{
		range.low[i] = FLT_MAX;
		range.high[i] = -FLT_MAX;
	}	
	for (int i = 0; i < count * 3; i++)
	{
		float v = hdr[i];
		range.low[i % 3] = std::min(range.low[i % 3], v);
		range.high[i % 3] = std::max(range.high[i % 3], v);
	}
}

void get_std_dev(int count, const float* hdr, float std_dev[3])
{
	float acc_value2[3];

	for (int i = 0; i < 3; i++)
	{	
		acc_value2[i] = 0.0f;
	}

	for (int i = 0; i < count * 3; i++)
	{
		float v = hdr[i];
		acc_value2[i % 3] += v*v;
	}

	float div = 1.0f / (float)count;
	for (int i = 0; i < 3; i++)
	{
		std_dev[i] = sqrtf(acc_value2[i] * div);
	}
}

void quantize(int count, const float* hdr, const Range& range, uint8_t* ldr)
{
	for (int i = 0; i < count * 3; i++)
	{
		float v_in = hdr[i];
		float normalized = std::max(std::min((v_in - range.low[i % 3]) / (range.high[i % 3] - range.low[i % 3]), 1.0f), 0.0f);
		uint8_t v_out = uint8_t(normalized * 255.0f + 0.5f);
		ldr[i] = v_out;
	}
}

void quantize_logistic(int count, const float* hdr, float s_factors[3], uint8_t* ldr)
{
	for (int i = 0; i < count * 3; i++)
	{
		float v_in = hdr[i];
		float s = s_factors[i % 3];
		float norm = 1.0f / (1.0f + expf(-v_in / s));
		float lb = std::min(floorf(norm * 257.0f), 256.0f);
		uint8_t v_out;
		if (lb == 0.0f)
		{
			v_out = 0;
		}
		else if (lb == 256.0f)
		{
			v_out = 255;
		}
		else
		{
			float a = lb / 257.0f;
			float b= (lb + 1.0f) / 257.0f;
			float v_a = -s * logf((1.0f - a) / a);
			float v_b = -s * logf((1.0f - b) / b);
			if (v_in - v_a > v_b - v_in)
			{
				v_out = uint8_t(lb);
			}
			else
			{
				v_out = uint8_t(lb-1.0f);
			}
		}
		ldr[i] = v_out;
	}

}


void subtract(int count, float* hdr, const Range& range, const uint8_t* ldr)
{
	for (int i = 0; i < count*3; i++)
	{
		float v_hdr = hdr[i];
		uint8_t s_ldr = ldr[i];
		float normalized = float(s_ldr) / 255.0f;
		v_hdr -= normalized * (range.high[i % 3] - range.low[i % 3]) + range.low[i % 3];
		hdr[i] = v_hdr;
	}
}

void subtract_logistic(int count, float* hdr, float s_factors[3], uint8_t* ldr)
{
	for (int i = 0; i < count * 3; i++)
	{
		float v_hdr = hdr[i];
		uint8_t s_ldr = ldr[i];
		float s = s_factors[i % 3];
		float norm = ((float)s_ldr + 1.0f) / 257.0f;
		v_hdr -= -s * logf((1.0f - norm) / norm);
		hdr[i] = v_hdr;
	}
}

int main(int argc, char* argv[])
{
	if (argc < 2)
	{
		printf("HDRCompress input.hdr [output_prefix]\n");
		return 0;
	}

	std::string output_prefix = "level";

	if (argc > 2)
	{
		output_prefix = argv[2];
	}

	char fn_csv[64];
	sprintf(fn_csv, "%s.csv", output_prefix.c_str());
	FILE* fp = fopen(fn_csv, "w");

	int width;
	int height;
	int chn;
	float* hdr = stbi_loadf(argv[1], &width, &height, &chn, 3);

	int count = width * height;

	int max_level = 5;

	Range range0;
	get_range(count, hdr, range0);	

	std::vector<uint8_t> image_ldr(count * 3);
	quantize(count, hdr, range0, image_ldr.data());

	char fn_out[64];
	sprintf(fn_out, "%s%d.jpg", output_prefix.c_str(), 0);

	fprintf(fp, fn_out);
	fprintf(fp, ", %f, %f, %f", range0.low[0], range0.low[1], range0.low[2]);
	fprintf(fp, ", %f, %f, %f\n", range0.high[0], range0.high[1], range0.high[2]);

	stbi_write_jpg(fn_out, width, height, 3, image_ldr.data(), 80);
	{
		uint8_t* dec = stbi_load(fn_out, &width, &height, &chn, 3);
		memcpy(image_ldr.data(), dec, count * 3);
		stbi_image_free(dec);

		subtract(count, hdr, range0, image_ldr.data());
	}

	for (int i = 1; i <= max_level; i++)
	{
	
		float s[3];
		get_std_dev(count, hdr, s);
		printf("%d %f %f %f\n", i - 1, s[0], s[1], s[2]);

		float mul = sqrtf(3.0f) / float(PI);
		for (int j = 0; j < 3; j++)
		{
			s[j] *= mul;
		}

		quantize_logistic(count, hdr, s, image_ldr.data());

		sprintf(fn_out, "%s%d.jpg", output_prefix.c_str(), i);	
		fprintf(fp, fn_out);
		fprintf(fp, ", %f, %f, %f\n", s[0], s[1], s[2]);		

		stbi_write_jpg(fn_out, width, height, 3, image_ldr.data(), 80);

		{
			uint8_t* dec = stbi_load(fn_out, &width, &height, &chn, 3);
			memcpy(image_ldr.data(), dec, count * 3);
			stbi_image_free(dec);
			subtract_logistic(count, hdr, s, image_ldr.data());
		}
	}

	stbi_image_free(hdr);	

	fclose(fp);

	return 0;
}
