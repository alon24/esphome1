Import("env")
import os

STACK_SIZE = 131072

def patch_defines(source, target, env):
    defines_path = os.path.join(env.get("PROJECT_SRC_DIR"), "esphome/core/defines.h")
    if not os.path.exists(defines_path):
        print(f"patch_defines: defines.h not found at {defines_path}")
        return

    with open(defines_path, "r") as f:
        content = f.read()

    # Replace whatever value ESPHome generated with our desired stack size
    import re
    new_content, count = re.subn(
        r"(#define ESPHOME_LOOP_TASK_STACK_SIZE\s+)\d+",
        rf"\g<1>{STACK_SIZE}",
        content,
    )

    if count and new_content != content:
        with open(defines_path, "w") as f:
            f.write(new_content)
        print(f"patch_defines: ESPHOME_LOOP_TASK_STACK_SIZE → {STACK_SIZE}")
    else:
        print(f"patch_defines: already {STACK_SIZE}, no change")

# Pre-build hook runs once before any source files are compiled,
# so defines.h is stable for the entire parallel build.
env.AddPreAction("$BUILD_DIR", patch_defines)
