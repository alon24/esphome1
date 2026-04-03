#pragma once
#include "esphome/core/component.h"
#include "sdmmc_cmd.h"
#include "driver/spi_common.h"

namespace esphome {
namespace sd_card {

class SDCardComponent : public Component {
 public:
  void setup() override;
  void loop() override;
  void dump_config() override;
  float get_setup_priority() const override { return setup_priority::HARDWARE; }

  // Attempt to mount the SD card. Pass notify=true to set g_sd_newly_mounted
  // on success (used by the background poll so the UI can react).
  bool try_mount(bool notify = false);

  // Unmount and release the SPI bus so it can be re-initialised cleanly.
  void unmount();

  bool is_mounted() const { return mounted_; }

 private:
  bool mounted_     = false;
  bool spi_inited_  = false;
  sdmmc_card_t *card_ = nullptr;
  int  host_slot_   = -1;
  uint32_t last_poll_ms_ = 0;
  static constexpr uint32_t POLL_INTERVAL_MS = 2000;
};

// Singleton pointer set in setup()
extern SDCardComponent *g_sd_card;

// Set to true by the background poll when the card transitions
// unmounted → mounted. Consumed (cleared) by the UI layer (tab_sd_poll).
extern volatile bool g_sd_newly_mounted;

}  // namespace sd_card
}  // namespace esphome

// Free functions implemented in sd_card.cpp — declared here for consumers
// that can include this header directly.
bool sd_card_is_mounted();
bool sd_card_do_mount();
void sd_card_do_unmount();
