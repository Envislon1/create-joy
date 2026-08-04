#pragma once

// ============================================================
//  MindBuddy — ESP32 DevKit (bench-test companion for the Pi 5)
// ============================================================
//  Same UART protocol as the LilyGo build (firmware/shared/PROTOCOL.md).
//  No cellular modem — Dial / SMS pages are inert (the buttons still
//  emit link messages but the Pi ignores anything the modem would need).
//  Wi-Fi + captive portal (WiFiManager) still work from the TFT.

// ---- Pi 5 <-> ESP32 UART link ----
// Pi 5 side:  TX = GPIO14, RX = GPIO15  (see PROTOCOL.md)
// ESP32 side: RX = GPIO16, TX = GPIO17  (Serial1, remapped)
#define LINK_TX_PIN 17
#define LINK_RX_PIN 16
#define LINK_BAUD   115200

// ---- Physical UI ----
// GPIO0 (onboard BOOT button) is NOT broken out to the header pins on this
// ESP32 DevKit variant, so we wire an external momentary button between
// GPIO27 and GND (uses the MCU's internal pull-up). GPIO27 is a safe,
// non-strapping general-purpose pin exposed on the header.
// Short-press: wake / back.  Long-press: SOS.
#define TALK_BUTTON_PIN 27
#define LONG_PRESS_MS   1200

// ---- App identity ----
#define FW_VERSION "1.0.0-dev"
#define DEFAULT_DEVICE_CODE "00000000"
#define WM_AP_NAME "WUF-Setup-Dev"
// ---- microSD card (TFT shield's on-board slot) ----
// The ILI9341 shield exposes the card on the SAME VSPI bus as the panel
// (SCK 18 / MISO 19 / MOSI 23) with its own chip select. Set to -1 to run
// without a card: the UI then draws flat panels instead of the artwork.
#define MB_SD_CS   25
#define MB_SD_FREQ 10000000
// The ILI9341 shield wires the microSD reader onto the same VSPI pins as the
// panel (SCK 18 / MISO 19 / MOSI 23). TFT_eSPI drives the panel through its
// own private SPIClass, so the Arduino global `SPI` bus is never begun and
// SD.begin() fails with "hard error in the low level disk I/O layer". Pin
// them here so mb_assets calls SPI.begin(SCK, MISO, MOSI, CS) before mount.
#define MB_SD_SCK  18
#define MB_SD_MISO 19
#define MB_SD_MOSI 23
