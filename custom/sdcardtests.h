#pragma once
#include <string>
#include <stdio.h>
#include "esphome/core/log.h"
#include "driver/gpio.h"
#include "esp_rom_sys.h"

// Absolute earliest log via ROM printf
struct BootLog {
    BootLog() { esp_rom_printf("\n\n[BOOT_ROM] >>> APP STAGE 1 START <<<\n\n"); }
} g_boot_log;

// Macsbug Pinned Layout
#define TEST_SD_PIN_CLK   (gpio_num_t)12
#define TEST_SD_PIN_MOSI  (gpio_num_t)11
#define TEST_SD_PIN_MISO  (gpio_num_t)13
#define TEST_SD_PIN_CS    (gpio_num_t)10

static std::string g_sd_content = "Bit-Bang Diagnostic Running...";

// Manual SPI delay for stability (10us)
inline void bb_delay() { esp_rom_delay_us(10); }

// Smallest possible bit-bang write
inline void bb_write(uint8_t data) {
    for (int i = 0; i < 8; i++) {
        gpio_set_level(TEST_SD_PIN_MOSI, (data & 0x80) ? 1 : 0);
        data <<= 1;
        bb_delay();
        gpio_set_level(TEST_SD_PIN_CLK, 1);
        bb_delay();
        gpio_set_level(TEST_SD_PIN_CLK, 0);
    }
}

// Smallest possible bit-bang read
inline uint8_t bb_read() {
    uint8_t data = 0;
    for (int i = 0; i < 8; i++) {
        data <<= 1;
        gpio_set_level(TEST_SD_PIN_CLK, 1);
        bb_delay();
        if (gpio_get_level(TEST_SD_PIN_MISO)) data |= 0x01;
        gpio_set_level(TEST_SD_PIN_CLK, 0);
        bb_delay();
    }
    return data;
}

inline bool sd_test_run() {
    ESP_LOGI("SD_BB", ">>> Starting Bit-Bang Hardware Probe (ESP-IDF) <<<");
    esp_rom_delay_us(100000); // 100ms
    
    // Disable Touch CS (GPIO 38)
    gpio_set_direction((gpio_num_t)38, GPIO_MODE_OUTPUT);
    gpio_set_level((gpio_num_t)38, 1);
    
    gpio_set_direction(TEST_SD_PIN_CLK, GPIO_MODE_OUTPUT);
    gpio_set_direction(TEST_SD_PIN_MOSI, GPIO_MODE_OUTPUT);
    gpio_set_direction(TEST_SD_PIN_CS, GPIO_MODE_OUTPUT);
    gpio_set_direction(TEST_SD_PIN_MISO, GPIO_MODE_INPUT);
    gpio_set_pull_mode(TEST_SD_PIN_MISO, GPIO_PULLUP_ONLY);
    
    gpio_set_level(TEST_SD_PIN_CS, 1);
    gpio_set_level(TEST_SD_PIN_CLK, 0);
    esp_rom_delay_us(10000);
    
    // 1. Send 80+ clock cycles to wake up the card
    ESP_LOGI("SD_BB", "Sending wake-up clocks...");
    for (int i = 0; i < 20; i++) bb_write(0xFF);
    
    // 2. Send CMD0 (Reset)
    ESP_LOGI("SD_BB", "Sending CMD0 (Reset)...");
    gpio_set_level(TEST_SD_PIN_CS, 0);
    bb_delay();
    bb_write(0x40); // CMD0
    bb_write(0x00); bb_write(0x00); bb_write(0x00); bb_write(0x00);
    bb_write(0x95); // CRC
    
    uint8_t response = 0xFF;
    for (int i = 0; i < 200; i++) {
        response = bb_read();
        if (response != 0xFF) break;
    }
    gpio_set_level(TEST_SD_PIN_CS, 1);
    bb_write(0xFF);

    if (response == 0x01) {
        ESP_LOGI("SD_BB", ">>> SUCCESS! Card responded with IDLE state (0x01). <<<");
        g_sd_content = "SUCCESS! Card responded (IDLE/0x01)\nHardware wiring is CORRECT!";
        return true;
    } else {
        ESP_LOGE("SD_BB", "Card response: 0x%02X (FAIL)", response);
        g_sd_content = "FAILURE. Response: " + std::to_string(response) + "\nCheck wiring/formatting.";
        return false;
    }
}
