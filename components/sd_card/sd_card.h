#pragma once
#include "esphome/core/component.h"

namespace esphome {
namespace sd_card {

class SDCardComponent : public Component {
 public:
  void setup() override;
  void dump_config() override;
  float get_setup_priority() const override { return setup_priority::HARDWARE; }
};

}  // namespace sd_card
}  // namespace esphome
