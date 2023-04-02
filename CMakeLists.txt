cmake_minimum_required (VERSION 3.0)
project(HDR2JPGs)

if (WIN32) 
set (DEFINES  ${DEFINES}
-D"_CRT_SECURE_NO_DEPRECATE"  
-D"_SCL_SECURE_NO_DEPRECATE" 
-D"_CRT_SECURE_NO_WARNINGS"
)
else()
add_compile_options(-fPIC)
endif()

add_definitions(${DEFINES})

add_executable(HDRCompress HDRCompress.cpp) 
add_executable(HDRDecompress HDRDecompress.cpp)

