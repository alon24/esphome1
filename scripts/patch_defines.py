Import("env")
import os

def patch_defines(source, target, env):
    defines_path = os.path.join(env.get("PROJECT_SRC_DIR"), "esphome/core/defines.h")
    if os.path.exists(defines_path):
        with open(defines_path, "r") as f:
            content = f.read()
        
        if "#define ESPHOME_LOOP_TASK_STACK_SIZE 32768" in content:
            new_content = content.replace("#define ESPHOME_LOOP_TASK_STACK_SIZE 32768", "#define ESPHOME_LOOP_TASK_STACK_SIZE 131072")
            with open(defines_path, "w") as f:
                f.write(new_content)
            print("Successfully patched ESPHOME_LOOP_TASK_STACK_SIZE to 131072 via PlatformIO script")
    else:
        print(f"defines.h not found at {defines_path}")

# Run the patch before compiling the main task file where the stack size is used
env.AddPreAction("$BUILD_DIR/src/esphome/core/main_task.c.o", patch_defines)
