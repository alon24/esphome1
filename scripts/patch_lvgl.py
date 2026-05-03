Import("env")
import os

def patch_now():
    project_dir = env.subst("$PROJECT_DIR")
    # Search for lv_conf.h in various locations
    potential_paths = [
        os.path.join(project_dir, "src", "lv_conf.h"),
        os.path.join(project_dir, ".esphome", "build", "grid-os-s3", "src", "lv_conf.h"),
        os.path.join(project_dir, ".esphome", "build", "esp32-display", "src", "lv_conf.h")
    ]
    
    for conf_path in potential_paths:
        if os.path.exists(conf_path):
            print(f"Patching {conf_path} to enable LVGL features...")
            with open(conf_path, "r") as f:
                content = f.read()
            
            changed = False
            if "#define LV_USE_CHART 0" in content:
                content = content.replace("#define LV_USE_CHART 0", "#define LV_USE_CHART 1")
                print("Successfully patched LV_USE_CHART to 1")
                changed = True
            
            if "#define LV_USE_TILEVIEW 0" in content:
                content = content.replace("#define LV_USE_TILEVIEW 0", "#define LV_USE_TILEVIEW 1")
                print("Successfully patched LV_USE_TILEVIEW to 1")
                changed = True

            if "#define LV_USE_GRID 0" in content:
                content = content.replace("#define LV_USE_GRID 0", "#define LV_USE_GRID 1")
                print("Successfully patched LV_USE_GRID to 1")
                changed = True

            if "#define LV_USE_FLEX 0" in content:
                content = content.replace("#define LV_USE_FLEX 0", "#define LV_USE_FLEX 1")
                print("Successfully patched LV_USE_FLEX to 1")
                changed = True

            if "#define LV_USE_MSGBOX 0" in content:
                content = content.replace("#define LV_USE_MSGBOX 0", "#define LV_USE_MSGBOX 1")
                print("Successfully patched LV_USE_MSGBOX to 1")
                changed = True

            if "#define LV_USE_TEXTAREA 0" in content:
                content = content.replace("#define LV_USE_TEXTAREA 0", "#define LV_USE_TEXTAREA 1")
                print("Successfully patched LV_USE_TEXTAREA to 1")
                changed = True

            if "#define LV_USE_KEYBOARD 0" in content:
                content = content.replace("#define LV_USE_KEYBOARD 0", "#define LV_USE_KEYBOARD 1")
                print("Successfully patched LV_USE_KEYBOARD to 1")
                changed = True

            if "#define LV_USE_BUTTONMATRIX 0" in content:
                content = content.replace("#define LV_USE_BUTTONMATRIX 0", "#define LV_USE_BUTTONMATRIX 1")
                print("Successfully patched LV_USE_BUTTONMATRIX to 1")
                changed = True

            if "#define LV_USE_TABLE 0" in content:
                content = content.replace("#define LV_USE_TABLE 0", "#define LV_USE_TABLE 1")
                print("Successfully patched LV_USE_TABLE to 1")
                changed = True

            if "#define LV_USE_LIST 0" in content:
                content = content.replace("#define LV_USE_LIST 0", "#define LV_USE_LIST 1")
                print("Successfully patched LV_USE_LIST to 1")
                changed = True

            if "#define LV_USE_MENU 0" in content:
                content = content.replace("#define LV_USE_MENU 0", "#define LV_USE_MENU 1")
                print("Successfully patched LV_USE_MENU to 1")
                changed = True

            # Enable Fonts
            for size in [12, 14, 16, 18, 20, 22, 24]:
                fdef = f"#define LV_FONT_MONTSERRAT_{size} 0"
                fpatch = f"#define LV_FONT_MONTSERRAT_{size} 1"
                if fdef in content:
                    content = content.replace(fdef, fpatch)
                    print(f"Successfully patched LV_FONT_MONTSERRAT_{size} to 1")
                    changed = True

            if "#define LV_USE_STB_IMAGE 0" in content:
                content = content.replace("#define LV_USE_STB_IMAGE 0", "#define LV_USE_STB_IMAGE 1")
                print("Successfully patched LV_USE_STB_IMAGE to 1")
                changed = True

            if changed:
                with open(conf_path, "w") as f:
                    f.write(content)

    # Disable conflicting LovyanGFX files
    pio_deps = os.path.join(project_dir, ".piolibdeps", "esp32-display", "LovyanGFX")
    if os.path.exists(pio_deps):
        # Walk through LovyanGFX and disable any file that might conflict
        for root, dirs, files in os.walk(pio_deps):
            for file in files:
                full_path = os.path.join(root, file)
                
                # Special handling for fonts and lvgl shims
                if "Fonts/lvgl" in root or "v1/lv_font" in root or (file == "lvgl.h" and "v1" in root):
                    if file.endswith((".c", ".cpp", ".h", ".hpp")):
                        with open(full_path, "r") as f:
                            content = f.read()
                        if not content.startswith("#if 0"):
                            print(f"Disabling conflicting file: {full_path}")
                            with open(full_path, "w") as f:
                                f.write("#if 0\n" + content + "\n#endif\n")
                
                # Special handling for lgfx_fonts.hpp
                if file == "lgfx_fonts.hpp":
                    with open(full_path, "r") as f:
                        lines = f.readlines()
                    
                    new_lines = []
                    in_lvgl_font = False
                    patched = False
                    for line in lines:
                        if ("struct LVGLfont" in line or "class LVGLfont" in line) and not line.strip().startswith("//") and not line.strip().startswith("#if 0"):
                            new_lines.append("#if 0\n")
                            new_lines.append(line)
                            in_lvgl_font = True
                            patched = True
                        elif in_lvgl_font and "};" in line:
                            new_lines.append(line)
                            new_lines.append("#endif\n")
                            in_lvgl_font = False
                        elif "extern const lgfx::LVGLfont" in line and not line.strip().startswith("//"):
                            new_lines.append("// " + line)
                            patched = True
                        elif "extern const lgfx::v1::LVGLfont" in line and not line.strip().startswith("//"):
                            new_lines.append("// " + line)
                            patched = True
                        else:
                            new_lines.append(line)
                    
                    if patched:
                        print(f"Patched lgfx_fonts.hpp to disable LVGLfont related code")
                        with open(full_path, "w") as f:
                            f.writelines(new_lines)
                
                # Special handling for lgfx_fonts.cpp
                if file == "lgfx_fonts.cpp":
                    with open(full_path, "r") as f:
                        lines = f.readlines()
                    
                    new_lines = []
                    in_lvgl_method = False
                    brace_count = 0
                    patched = False
                    
                    for line in lines:
                        # Comment out ANY line containing LVGLfont that isn't a method start
                        if "LVGLfont" in line and "LVGLfont::" not in line and not line.strip().startswith("//") and not line.strip().startswith("#if 0"):
                            new_lines.append("// " + line)
                            patched = True
                            continue

                        # Detect start of LVGLfont method
                        if "LVGLfont::" in line and "(" in line and not line.strip().startswith("//") and not line.strip().startswith("#if 0"):
                            new_lines.append("#if 0\n")
                            new_lines.append(line)
                            in_lvgl_method = True
                            brace_count = line.count('{') - line.count('}')
                            patched = True
                        elif in_lvgl_method:
                            new_lines.append(line)
                            brace_count += line.count('{') - line.count('}')
                            if brace_count <= 0:
                                new_lines.append("#endif\n")
                                in_lvgl_method = False
                        else:
                            new_lines.append(line)
                    
                    if patched:
                        print(f"Patched lgfx_fonts.cpp to disable LVGLfont code")
                        with open(full_path, "w") as f:
                            f.writelines(new_lines)

# Run immediately when script is loaded
patch_now()
