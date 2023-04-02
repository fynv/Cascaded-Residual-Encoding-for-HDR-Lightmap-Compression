#include <string>
#include <vector>
#include <cstdint>
#include <cstdio>
#include <algorithm>

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

	std::vector<std::string> filenames;
	std::vector<Range> ranges;

	int width;
	int height;
	int chn;
	float* hdr = stbi_loadf(argv[1], &width, &height, &chn, 3);

	int count = width * height;

	int max_level = 5;

	Range range0;
	get_range(count, hdr, range0);
	ranges.push_back(range0);

	std::vector<uint8_t> image_ldr(count * 3);
	quantize(count, hdr, range0, image_ldr.data());

	char fn_out[64];
	sprintf(fn_out, "%s%d.jpg", output_prefix.c_str(), 0);
	filenames.push_back(fn_out);
	stbi_write_jpg(fn_out, width, height, 3, image_ldr.data(), 80);

	for (int i = 1; i <= max_level; i++)
	{
		{
			uint8_t* dec = stbi_load(filenames[i - 1].c_str(), &width, &height, &chn, 3);
			memcpy(image_ldr.data(), dec, count * 3);
			stbi_image_free(dec);
		}

		subtract(count, hdr, ranges[i - 1], image_ldr.data());

		Range range1;
		get_range(count, hdr, range1);
		ranges.push_back(range1);

		quantize(count, hdr, range1, image_ldr.data());
		sprintf(fn_out, "%s%d.jpg", output_prefix.c_str(), i);
		filenames.push_back(fn_out);
		stbi_write_jpg(fn_out, width, height, 3, image_ldr.data(), 80);
	}

	stbi_image_free(hdr);

	sprintf(fn_out, "%s.csv", output_prefix.c_str());
	FILE* fp = fopen(fn_out, "w");
	for (int i = 0; i <= max_level; i++)
	{
		std::string fn = filenames[i];
		Range range = ranges[i];
		fprintf(fp, fn.c_str());
		fprintf(fp, ", %f, %f, %f", range.low[0], range.low[1], range.low[2]);
		fprintf(fp, ", %f, %f, %f\n", range.high[0], range.high[1], range.high[2]);
	}

	fclose(fp);

	return 0;
}
