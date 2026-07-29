// MindBuddy — ESP32 DevKit board layer.
//
// This file only owns the board-specific bits: TFT_eSPI bring-up, the LVGL
// display/indev glue and the (absent) modem hooks. Every page, touch region
// and behaviour lives in firmware/shared/mb_ui.inc so this board and the
// LilyGo board can never drift apart.
#include "ui/ui.h"
#include "config.h"
#include <TFT_eSPI.h>

// No cellular modem on the bench board.
#define MB_HAS_MODEM 0

// ------------------ TFT + Touch ------------------
static TFT_eSPI tft = TFT_eSPI();
// Touch is handled by TFT_eSPI's built-in getTouch() helper (TOUCH_CS is
// defined at build time in platformio.ini). We deliberately do NOT pull in
// the separate XPT2046_Touchscreen library because instantiating it on a
// second SPIClass against the same VSPI pins (18/19/23) fights the display
// driver and the panel goes blank/white.
//
// Calibration — run TFT_eSPI's Touch_calibrate example once per panel and
// paste the printed array here.
static uint16_t TOUCH_CAL[5] = { 321, 3547, 204, 3539, 2 };

static lv_display_t* s_disp  = nullptr;
static lv_indev_t*   s_indev = nullptr;

// Keep DRAM usage low — this board shares DRAM with Wi-Fi + WiFiManager.
static const uint32_t BUF_ROWS = 20;
alignas(16) static lv_color_t s_buf1[240 * BUF_ROWS];

static void disp_flush(lv_display_t* d, const lv_area_t* a, uint8_t* px) {
  uint32_t w = a->x2 - a->x1 + 1;
  uint32_t h = a->y2 - a->y1 + 1;
  tft.startWrite();
  tft.setAddrWindow(a->x1, a->y1, w, h);
  tft.pushPixels((uint16_t*)px, w * h);
  tft.endWrite();
  lv_display_flush_ready(d);
}

static void touch_read(lv_indev_t*, lv_indev_data_t* data) {
  uint16_t tx = 0, ty = 0;
  if (tft.getTouch(&tx, &ty, 40)) {
    data->point.x = constrain((int)tx, 0, 239);
    data->point.y = constrain((int)ty, 0, 319);
    data->state   = LV_INDEV_STATE_PRESSED;
  } else {
    data->state = LV_INDEV_STATE_RELEASED;
  }
}

// ------------------ Modem hooks (no radio here) ------------------
namespace mb_hooks {
inline bool dial(const char*)                 { return false; }
inline void hangup()                          {}
inline bool sendSms(const char*, const char*) { return false; }
}

// ------------------ Shared UI ------------------
#include "mb_ui.inc"

static void mb_board_display_init() {
  Serial.println(F("[tft] begin"));
  tft.begin();
  #ifdef TFT_BL
    pinMode(TFT_BL, OUTPUT);
    digitalWrite(TFT_BL, TFT_BACKLIGHT_ON);
  #endif
  tft.setRotation(0);   // 240 wide x 320 tall (portrait)
  // LVGL 9 renders RGB565 in native little-endian, but ILI9341 expects the
  // high byte first. Without this, every LVGL pushPixels() writes bytes in
  // the wrong order — on dark UI themes that often looks like a solid white
  // (or noisy) screen even though touch/pages are clearly working. Enabling
  // swap on the TFT side makes pushPixels swap bytes on the fly.
  tft.setSwapBytes(false);
  tft.fillScreen(TFT_BLACK);
  if (TOUCH_CAL[0] || TOUCH_CAL[1] || TOUCH_CAL[2] || TOUCH_CAL[3]) tft.setTouch(TOUCH_CAL);

  lv_init();
  lv_tick_set_cb((lv_tick_get_cb_t)millis);

  s_disp = lv_display_create(240, 320);
  lv_display_set_flush_cb(s_disp, disp_flush);
  lv_display_set_buffers(s_disp, s_buf1, nullptr, sizeof(s_buf1), LV_DISPLAY_RENDER_MODE_PARTIAL);
  s_indev = lv_indev_create();
  lv_indev_set_type(s_indev, LV_INDEV_TYPE_POINTER);
  lv_indev_set_read_cb(s_indev, touch_read);
  Serial.println(F("[tft] initialized"));
}
