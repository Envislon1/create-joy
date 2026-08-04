#pragma once

// ---- Pi ↔ LilyGo UART link ----
#define LINK_TX_PIN 17
#define LINK_RX_PIN 18
#define LINK_BAUD   115200

// ---- Physical UI ----
#define TALK_BUTTON_PIN 0   // BOOT / user button (BACK on non-home pages, long-press = SOS)
#define LONG_PRESS_MS   1200

// ---- App identity ----
#define FW_VERSION "1.0.0"
#define DEFAULT_DEVICE_CODE "0000000000000000"
#define WM_AP_NAME "WUF-Setup"

// ---- Modem (A7670 / SIM7600 series) ----
#define TINY_GSM_MODEM_SIM7600
#define MODEM_UART_BAUD   115200
#define MODEM_TX_PIN      6
#define MODEM_RX_PIN      7
#define MODEM_PWRKEY_PIN  4
#define MODEM_RST_PIN     5

// ---- microSD card ----
// The TFT breakout's card slot rides the same FSPI bus as the panel
// (SCLK 12 / MISO 13 / MOSI 11) with a dedicated chip select. Change these
// if you wired the slot to its own bus; -1 disables the SD asset layer.
#define MB_SD_CS   15
#define MB_SD_SCK  12
#define MB_SD_MISO 13
#define MB_SD_MOSI 11
#define MB_SD_FREQ 20000000
