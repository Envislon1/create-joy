/* Minimal LVGL 9 config — 16-bit colour, no filesystem, no gpu.
   Enough for the MindBuddy TFT UI. */
#pragma once

// LVGL checks for this guard after including the config file. Without it,
// PlatformIO builds can emit repeated "Possible failure to include lv_conf.h"
// messages even when this file is present.
#define LV_CONF_H

#define LV_COLOR_DEPTH        16
#define LV_COLOR_16_SWAP      1

/* 96 KB overflows ESP32 DRAM once Wi-Fi + WiFiManager + TFT_eSPI + LVGL
   static buffers are all linked in (ld reports dram0_0_seg overflow by
   ~35 KB). 48 KB is what the sister LilyGo build uses and is enough for
   this UI now that box-shadows are disabled. */
#define LV_MEM_SIZE           (48U * 1024U)
#define LV_USE_LOG            1
#define LV_LOG_LEVEL          LV_LOG_LEVEL_WARN
#define LV_LOG_PRINTF         1

#define LV_TICK_CUSTOM        1
#define LV_TICK_CUSTOM_INCLUDE "Arduino.h"
#define LV_TICK_CUSTOM_SYS_TIME_EXPR (millis())

#define LV_FONT_MONTSERRAT_12 1
#define LV_FONT_MONTSERRAT_14 1
#define LV_FONT_MONTSERRAT_16 1
#define LV_FONT_MONTSERRAT_20 1
#define LV_FONT_MONTSERRAT_24 1
#define LV_FONT_MONTSERRAT_28 1
#define LV_FONT_DEFAULT       &lv_font_montserrat_14

#define LV_USE_FLEX           1
#define LV_USE_GRID           1
#define LV_USE_ANIMIMG        1
#define LV_USE_LABEL          1
#define LV_USE_BUTTON         1
#define LV_USE_IMAGE          1
#define LV_USE_LIST           1
#define LV_USE_MENU           1
#define LV_USE_MSGBOX         1
#define LV_USE_SLIDER         1
#define LV_USE_SWITCH         1
#define LV_USE_TEXTAREA       1
#define LV_USE_KEYBOARD       1
#define LV_USE_ROLLER         1
#define LV_USE_TABVIEW        1

/* Anti-aliased rounded corners / arcs allocate a temporary buffer via
   circ_calc_aa4(). On an ESP32 DevKit without PSRAM that allocation
   fails once Wi-Fi is up and asserts (cir_x != NULL). Disable the
   complex SW draw path — we don't use arcs and all radii are 0. */
#define LV_DRAW_SW_COMPLEX    0

/* --- SD-backed LVGL binary images (see firmware/shared/SD_CARD_GUIDE.md) ---
   A custom 'S:' filesystem driver is registered in mb_assets.inc, so the
   stock stdio/posix drivers stay off.

   LV_CACHE_DEF_SIZE MUST NOT be 0: LVGL 9's image decoder registers every
   opened image in the cache, and with a zero-byte cache lv_cache_add() fails,
   lv_image_decoder_open() returns INVALID and the image silently never draws
   (which is exactly the "icons/labels show, artwork doesn't" symptom).
   32 KB is plenty here because RAM_LOAD stays off — the entries hold only the
   decoder descriptor, the pixels are streamed off the card row by row. */
#define LV_USE_FS_STDIO       0
#define LV_USE_FS_POSIX       0
#define LV_CACHE_DEF_SIZE     (32U * 1024U)
#define LV_IMAGE_HEADER_CACHE_DEF_CNT 16
/* No PSRAM on this board — a full 240x320 frame (150 KB) would never fit in
   LV_MEM_SIZE, so keep streaming instead of loading whole images to RAM. */
#define LV_BIN_DECODER_RAM_LOAD 0
