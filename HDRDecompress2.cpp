#include <string>
#include <vector>
#include <cstdio>

#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image.h"
#include "stb_image_write.h"

struct Range
{
	float low[3];
	float high[3];
};

void add(int count, float* hdr, const Range& range, const uint8_t* ldr)
{
	for (int i = 0; i < count * 3; i++)
	{
		float v_hdr = hdr[i];
		uint8_t s_ldr = ldr[i];
		float normalized = float(s_ldr) / 255.0f;
		v_hdr += normalized * (range.high[i % 3] - range.low[i % 3]) + range.low[i % 3];
		hdr[i] = v_hdr;
	}
}


void add_logistic(int count, float* hdr, float s_factors[3], uint8_t* ldr)
{
	for (int i = 0; i < count * 3; i++)
	{
		float v_hdr = hdr[i];
		uint8_t s_ldr = ldr[i];
		float s = s_factors[i % 3];
		float norm = ((float)s_ldr + 1.0f) / 257.0f;
		v_hdr += -s * logf((1.0f - norm) / norm);
		hdr[i] = v_hdr;
	}
}


int main(int argc, char* argv[])
{
	if (argc < 2)
	{
		printf("HDRDecompress input.csv [output.hdr]\n");
		return 0;
	}
	std::string fn_input = argv[1];
	std::string fn_output = "out.hdr";
	if (argc > 2)
	{
		fn_output = argv[2];
	}

	std::string path = ".";
	size_t pos = fn_input.find_last_of("\\/");
	if (pos != std::string::npos)
	{
		path = fn_input.substr(0, pos);
	} 		

	int width, height, chn;
	std::vector<float> recover;

	FILE* fp = fopen(fn_input.c_str(), "r");
	char line[256];
	fgets(line, 256, fp);
	char filename[64];
	{
		Range range;
		sscanf(line, "%[^,],%f,%f,%f,%f,%f,%f", filename, &range.low[0], &range.low[1], &range.low[2], &range.high[0], &range.high[1], &range.high[2]);
		std::string input_path = path + "/" + filename;
		uint8_t* dec = stbi_load(input_path.c_str(), &width, &height, &chn, 3);
		recover.resize(width * height * 3, 0.0f);
		add(width * height, recover.data(), range, dec);
		stbi_image_free(dec);
	}


	while (fgets(line, 256, fp))
	{		
		char filename[64];
		float s[3];
		int count = sscanf(line, "%[^,],%f,%f,%f", filename, &s[0], &s[1], &s[2]);
		if (count < 4) continue;
		
		std::string input_path = path + "/" + filename;
		uint8_t * dec = stbi_load(input_path.c_str(), &width, &height, &chn, 3);				
		add_logistic(width * height, recover.data(), s, dec);
		stbi_image_free(dec);
	}
	fclose(fp);

	stbi_write_hdr(fn_output.c_str(), width, height, 3, recover.data());

	return 0;
}