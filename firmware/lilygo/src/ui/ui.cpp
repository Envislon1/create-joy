// MindBuddy — LilyGo T-A7670G-S3 board layer.
//
// Board-specific only: TFT_eSPI + XPT2046 bring-up, LVGL glue and the A7670
// modem hooks. Every page, touch region and behaviour lives in
// firmware/shared/mb_ui.inc, shared with the ESP32 DevKit bench board.
#include "ui/ui.h"
#include "config.h"
#include "net/modem.h"
#include <TFT_eSPI.h>
#include <XPT2046_Touchscreen.h>

// This board carries the A7670 modem: Call / SMS actions are live.
#define MB_HAS_MODEM 1

// ------------------ TFT + Touch ------------------
static TFT_eSPI tft = TFT_eSPI();
static XPT2046_Touchscreen ts(TOUCH_CS);

static lv_display_t* s_disp  = nullptr;
static lv_indev_t*   s_indev = nullptr;

// PSRAM board: two 40-row buffers give a smooth full-screen wallpaper blit.
static const uint32_t BUF_ROWS = 40;
alignas(16) static lv_color_t s_buf1[240 * BUF_ROWS];
alignas(16) static lv_color_t s_buf2[240 * BUF_ROWS];

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
  if (ts.tirqTouched() && ts.touched()) {
    TS_Point p = ts.getPoint();
    // XPT2046 raw -> 240x320 (portrait). Adjust cal as needed.
    int x = map(p.x, 200, 3900, 0, 240);
    int y = map(p.y, 200, 3900, 0, 320);
    data->point.x = constrain(x, 0, 239);
    data->point.y = constrain(y, 0, 319);
    data->state   = LV_INDEV_STATE_PRESSED;
  } else {
    data->state = LV_INDEV_STATE_RELEASED;
  }
}

// ------------------ Modem hooks ------------------
namespace mb_hooks {
inline bool dial(const char* number)                 { return modem_mgr::dial(number); }
inline void hangup()                                 { modem_mgr::hangup(); }
inline bool sendSms(const char* to, const char* txt) { return modem_mgr::sendSms(to, txt); }
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
  tft.setRotation(0);
  tft.fillScreen(TFT_BLACK);
  ts.begin();
  ts.setRotation(0);

  lv_init();
  lv_tick_set_cb((lv_tick_get_cb_t)millis);

  s_disp = lv_display_create(240, 320);
  lv_display_set_flush_cb(s_disp, disp_flush);
  lv_display_set_buffers(s_disp, s_buf1, s_buf2, sizeof(s_buf1), LV_DISPLAY_RENDER_MODE_PARTIAL);
  s_indev = lv_indev_create();
  lv_indev_set_type(s_indev, LV_INDEV_TYPE_POINTER);
  lv_indev_set_read_cb(s_indev, touch_read);
  Serial.println(F("[tft] initialized"));
}
