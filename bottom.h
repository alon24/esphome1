        _cwifi_start_scan_bg(); // E4: non-blocking
    }, LV_EVENT_CLICKED, nullptr);

    // CONN button (blue)
    lv_obj_t *conn_btn = lv_obj_create(right);
    lv_obj_set_pos(conn_btn, 8 + btn_w + 8, btn_y);
    lv_obj_set_size(conn_btn, btn_w, 40);
    lv_obj_set_style_bg_color(conn_btn, lv_color_hex(0x003050), LV_STATE_DEFAULT);
    lv_obj_set_style_radius(conn_btn, 6, LV_STATE_DEFAULT);
    _panel_reset(conn_btn);

    lv_obj_t *conn_lbl = lv_label_create(conn_btn);
    lv_label_set_text(conn_lbl, "CONN");
    lv_obj_set_style_text_color(conn_lbl, lv_color_hex(0x00FFFF), LV_STATE_DEFAULT); // Electric Cyan
    lv_obj_set_style_text_font(conn_lbl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    _lbl_bg(conn_lbl, 0x003050);
    lv_obj_center(conn_lbl);

    lv_obj_add_flag(conn_btn, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(conn_btn, [](lv_event_t*) {
        _cwifi_kb_hide();
        if (!g_cwifi_ssid_ta || !g_cwifi_pass_ta || !g_cwifi_status_lbl) return;
        const char *ssid = lv_textarea_get_text(g_cwifi_ssid_ta);
        if (!ssid || !ssid[0]) { lv_label_set_text(g_cwifi_status_lbl, "Enter an SSID first"); return; }
        lv_label_set_text(g_cwifi_status_lbl, "Connecting...");
        lv_refr_now(NULL);
        void ui_set_connecting();
        ui_set_connecting();
        wifi_connect_from_ui(g_cwifi_ssid_ta, g_cwifi_pass_ta);
        lv_label_set_text(g_cwifi_status_lbl, "Connect requested — check header for IP");
    }, LV_EVENT_CLICKED, nullptr);

    // D7: Status label ────────────────────────────────────────────────────────
    g_cwifi_status_lbl = lv_label_create(right);
    lv_label_set_text(g_cwifi_status_lbl, "Scan for networks to begin");
    lv_obj_set_style_text_color(g_cwifi_status_lbl, lv_color_hex(0x00FFFF), LV_STATE_DEFAULT); // Vivid Cyan
    lv_obj_set_style_text_font(g_cwifi_status_lbl, &lv_font_montserrat_14, LV_STATE_DEFAULT);
    _lbl_bg(g_cwifi_status_lbl, 0x050505);
    lv_obj_set_pos(g_cwifi_status_lbl, 10, 194);
    lv_obj_set_width(g_cwifi_status_lbl, rw - 20);
    lv_label_set_long_mode(g_cwifi_status_lbl, LV_LABEL_LONG_WRAP);

    // Auto-populate saved SSID (7.2 Security Fix: do NOT prefill password)
    wifi_config_t conf;
    if (esp_wifi_get_config(WIFI_IF_STA, &conf) == ESP_OK && conf.sta.ssid[0]) {
        lv_textarea_set_text(g_cwifi_ssid_ta, (char*)conf.sta.ssid);
        lv_label_set_text(g_cwifi_status_lbl, "Saved SSID loaded");
    }

    // ── AP MODE SECTION (Below connection form) ──────────────────────────────
    lv_obj_add_flag(right, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scroll_dir(right, LV_DIR_VER);

    lv_obj_t *ap_sep = lv_obj_create(right);
    lv_obj_set_size(ap_sep, rw - 40, 2);
    lv_obj_set_pos(ap_sep, 20, 240);
    lv_obj_set_style_bg_color(ap_sep, lv_color_hex(0x222222), 0);
    _panel_reset(ap_sep);

    lv_obj_t *ap_hdr = lv_label_create(right);
    lv_label_set_text(ap_hdr, "STANDALONE AP SETTINGS");
    lv_obj_set_style_text_color(ap_hdr, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_text_font(ap_hdr, &lv_font_montserrat_14, 0);
    lv_obj_set_pos(ap_hdr, 10, 250);

    // AP SSID
    lv_obj_t *aps_hdr = lv_label_create(right);
    lv_label_set_text(aps_hdr, "AP SSID");
    lv_obj_set_style_text_color(aps_hdr, lv_color_hex(0xFF8800), 0);
    lv_obj_set_style_text_font(aps_hdr, &lv_font_montserrat_12, 0);
    lv_obj_set_pos(aps_hdr, 10, 275);

    lv_obj_t *ap_ssid_ta = lv_textarea_create(right);
    lv_textarea_set_text(ap_ssid_ta, g_ap_ssid);
    lv_textarea_set_one_line(ap_ssid_ta, true);
    lv_obj_set_pos(ap_ssid_ta, 8, 293);
    lv_obj_set_size(ap_ssid_ta, rw - 16, 38);
    lv_obj_set_style_bg_color(ap_ssid_ta, lv_color_hex(0x1a1a1a), 0);
    lv_obj_set_style_text_color(ap_ssid_ta, lv_color_hex(0xffffff), 0);
    lv_obj_set_style_border_width(ap_ssid_ta, 2, 0);
    lv_obj_set_style_border_color(ap_ssid_ta, lv_color_hex(0x444444), 0);
    lv_obj_set_style_radius(ap_ssid_ta, 6, 0);
    lv_obj_add_event_cb(ap_ssid_ta, [](lv_event_t *e) {
        lv_event_code_t c = lv_event_get_code(e);
        if (c == LV_EVENT_FOCUSED || c == LV_EVENT_CLICKED) _cwifi_kb_show((lv_obj_t*)lv_event_get_target(e));
        else if (c == LV_EVENT_DEFOCUSED) _cwifi_kb_hide();
    }, LV_EVENT_ALL, nullptr);

    // AP Password
    lv_obj_t *app_hdr = lv_label_create(right);
    lv_label_set_text(app_hdr, "AP PASSWORD");
    lv_obj_set_style_text_color(app_hdr, lv_color_hex(0xFF8800), 0);
    lv_obj_set_style_text_font(app_hdr, &lv_font_montserrat_12, 0);
    lv_obj_set_pos(app_hdr, 10, 341);

    lv_obj_t *ap_pass_ta = lv_textarea_create(right);
    lv_textarea_set_text(ap_pass_ta, g_ap_password);
    lv_textarea_set_one_line(ap_pass_ta, true);
    lv_textarea_set_password_mode(ap_pass_ta, true);
    lv_obj_set_pos(ap_pass_ta, 8, 359);
    lv_obj_set_size(ap_pass_ta, rw - 16, 38);
    lv_obj_set_style_bg_color(ap_pass_ta, lv_color_hex(0x1a1a1a), 0);
    lv_obj_set_style_text_color(ap_pass_ta, lv_color_hex(0xffffff), 0);
    lv_obj_set_style_border_width(ap_pass_ta, 2, 0);
    lv_obj_set_style_border_color(ap_pass_ta, lv_color_hex(0x444444), 0);
    lv_obj_set_style_radius(ap_pass_ta, 6, 0);
    lv_obj_add_event_cb(ap_pass_ta, [](lv_event_t *e) {
        lv_event_code_t c = lv_event_get_code(e);
        if (c == LV_EVENT_FOCUSED || c == LV_EVENT_CLICKED) _cwifi_kb_show((lv_obj_t*)lv_event_get_target(e));
        else if (c == LV_EVENT_DEFOCUSED) _cwifi_kb_hide();
    }, LV_EVENT_ALL, nullptr);

    // Save Button
    lv_obj_t *save_ap_btn = lv_obj_create(right);
    lv_obj_set_pos(save_ap_btn, 8, 410);
    lv_obj_set_size(save_ap_btn, rw - 16, 40);
    lv_obj_set_style_bg_color(save_ap_btn, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_radius(save_ap_btn, 6, 0);
    _panel_reset(save_ap_btn);
    lv_obj_t *save_lbl = lv_label_create(save_ap_btn);
    lv_label_set_text(save_lbl, "SAVE & APPLY AP");
    lv_obj_set_style_text_color(save_lbl, lv_color_hex(0x000000), 0);
    lv_obj_center(save_lbl);
    
    struct APParam { lv_obj_t *s; lv_obj_t *p; };
    static APParam params; params.s = ap_ssid_ta; params.p = ap_pass_ta;
    
    lv_obj_add_flag(save_ap_btn, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(save_ap_btn, [](lv_event_t *e) {
        _cwifi_kb_hide();
        APParam *p = (APParam*)lv_event_get_user_data(e);
        const char *ssid = lv_textarea_get_text(p->s);
        const char *pass = lv_textarea_get_text(p->p);
        
        if (ssid) strncpy(g_ap_ssid, ssid, 32);
        if (pass) strncpy(g_ap_password, pass, 64);
        g_ap_always_on = true; 
        
        wifi_apply_ap_settings(true, ssid, pass);
        system_settings_save();
        
        if (g_cwifi_status_lbl) {
            lv_label_set_text(g_cwifi_status_lbl, "AP MODE APPLIED & SAVED");
            lv_obj_set_style_text_color(g_cwifi_status_lbl, lv_color_hex(0x00FF00), 0);
        }
    }, LV_EVENT_CLICKED, &params);


    // D9: Floating keyboard — full screen width, anchored bottom ─────────────
    g_cwifi_keyboard = lv_keyboard_create(lv_screen_active());
    lv_obj_set_size(g_cwifi_keyboard, 800, 200);
    lv_obj_set_style_bg_color(g_cwifi_keyboard, lv_color_hex(0x111111), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_cwifi_keyboard, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_cwifi_keyboard, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    lv_obj_add_flag(g_cwifi_keyboard, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(g_cwifi_keyboard, [](lv_event_t*) { _cwifi_kb_hide(); }, LV_EVENT_READY, nullptr);
    lv_obj_add_event_cb(g_cwifi_keyboard, [](lv_event_t*) { _cwifi_kb_hide(); }, LV_EVENT_CANCEL, nullptr);
}
