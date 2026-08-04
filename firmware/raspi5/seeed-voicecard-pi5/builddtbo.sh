#!/bin/sh
DTC_FLAGS="-b 0 -Wno-unit_address_vs_reg -I dts -O dtb"

dtc -@ $DTC_FLAGS -o seeed-2mic-voicecard.dtbo      seeed-2mic-voicecard-overlay.dts
dtc -@ $DTC_FLAGS -o seeed-4mic-voicecard.dtbo      seeed-4mic-voicecard-overlay.dts
dtc -@ $DTC_FLAGS -o seeed-8mic-voicecard.dtbo      seeed-8mic-voicecard-overlay.dts
dtc -@ $DTC_FLAGS -o seeed-4mic-voicecard-pi5.dtbo  seeed-4mic-voicecard-pi5-overlay.dts
