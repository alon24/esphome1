#!/usr/bin/env python3
import os

defines_path = ".esphome/build/grid-os-s3/src/esphome/core/defines.h"

if os.path.exists(defines_path):
    with open(defines_path, "r") as f:
        content = f.read()
    
    if "#define ESPHOME_LOOP_TASK_STACK_SIZE 8192" in content:
        new_content = content.replace("#define ESPHOME_LOOP_TASK_STACK_SIZE 8192", "#define ESPHOME_LOOP_TASK_STACK_SIZE 65536")
        with open(defines_path, "w") as f:
            f.write(new_content)
        print("Successfully patched ESPHOME_LOOP_TASK_STACK_SIZE to 65536")
    else:
        print("ESPHOME_LOOP_TASK_STACK_SIZE already patched or not found")
else:
    print(f"File not found: {defines_path}")
