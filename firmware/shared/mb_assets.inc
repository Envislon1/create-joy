// ============================================================
//  MindBuddy — SD card asset layer (shared by LilyGo + DevKit)
// ============================================================
//  Included by each board's src/ui/ui.cpp AFTER the board has
//  defined its SPI/SD pin macros. Provides:
//
//    mb_assets::begin()      mount the card, register LVGL drive 'S'
//    mb_assets::ready()      true when the card mounted
//    mb_assets::path(name)   -> "S:/mindbuddy/<name>"  (nullptr if no card)
//
//  Card layout is documented in firmware/shared/SD_CARD_GUIDE.md.
//  Every image is an LVGL binary image (.bin) produced by
//  firmware/tools/convert_assets.py, so no PNG/GIF decoder has to be
//  linked in and RAM use stays predictable on the non-PSRAM DevKit.
#pragma once

#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include <lvgl.h>

// ---- Board hooks (override in config.h / platformio.ini) ----
#ifndef MB_SD_CS
#define MB_SD_CS -1          // -1 disables the SD layer entirely
#endif
#ifndef MB_SD_SCK
#define MB_SD_SCK -1         // -1 = reuse the already-initialised SPI bus
#endif
#ifndef MB_SD_MISO
#define MB_SD_MISO -1
#endif
#ifndef MB_SD_MOSI
#define MB_SD_MOSI -1
#endif
#ifndef MB_SD_FREQ
#define MB_SD_FREQ 20000000
#endif
#ifndef MB_ASSET_DIR
#define MB_ASSET_DIR "/mindbuddy"
#endif

namespace mb_assets {

static bool s_ready = false;
static char s_path_buf[64];

// ---------- LVGL filesystem driver backed by Arduino SD ----------
static void* fs_open(lv_fs_drv_t*, const char* path, lv_fs_mode_t mode) {
  if (mode != LV_FS_MODE_RD) return nullptr;
  // LVGL hands us the path WITHOUT the "S:" prefix, e.g. "/mindbuddy/x.bin".
  File f = SD.open(path, FILE_READ);
  if (!f) return nullptr;
  File* heap = new File(f);
  return heap;
}

static lv_fs_res_t fs_close(lv_fs_drv_t*, void* fp) {
  File* f = (File*)fp;
  if (!f) return LV_FS_RES_INV_PARAM;
  f->close();
  delete f;
  return LV_FS_RES_OK;
}

static lv_fs_res_t fs_read(lv_fs_drv_t*, void* fp, void* buf, uint32_t btr, uint32_t* br) {
  File* f = (File*)fp;
  if (!f) return LV_FS_RES_INV_PARAM;
  *br = f->read((uint8_t*)buf, btr);
  return LV_FS_RES_OK;
}

static lv_fs_res_t fs_seek(lv_fs_drv_t*, void* fp, uint32_t pos, lv_fs_whence_t whence) {
  File* f = (File*)fp;
  if (!f) return LV_FS_RES_INV_PARAM;
  uint32_t target = pos;
  if (whence == LV_FS_SEEK_CUR) target = f->position() + pos;
  else if (whence == LV_FS_SEEK_END) target = f->size() + pos;
  return f->seek(target) ? LV_FS_RES_OK : LV_FS_RES_UNKNOWN;
}

static lv_fs_res_t fs_tell(lv_fs_drv_t*, void* fp, uint32_t* pos) {
  File* f = (File*)fp;
  if (!f) return LV_FS_RES_INV_PARAM;
  *pos = f->position();
  return LV_FS_RES_OK;
}

static lv_fs_drv_t s_drv;

static bool try_sd_begin(uint32_t freq) {
  Serial.printf("[sd] SD.begin(freq=%lu)\n", (unsigned long)freq);
  bool ok = SD.begin(MB_SD_CS, SPI, freq);
  if (!ok) {
    Serial.printf("[sd] SD.begin(freq=%lu) FAILED\n", (unsigned long)freq);
    SD.end();
    delay(50);
    return false;
  }
  Serial.printf("[sd] SD.begin(freq=%lu) OK\n", (unsigned long)freq);
  return true;
}

// ---------- Public API ----------
inline bool ready() { return s_ready; }

inline bool begin() {
  if (s_ready) return true;
#if MB_SD_CS < 0
  Serial.println(F("[sd] disabled (MB_SD_CS not set) — using drawn UI"));
  return false;
#else
  Serial.println(F("[sd] initializing..."));
  Serial.printf("[sd] pins: CS=%d SCK=%d MISO=%d MOSI=%d freq=%lu\n",
                MB_SD_CS, MB_SD_SCK, MB_SD_MISO, MB_SD_MOSI, (unsigned long)MB_SD_FREQ);

  // The card shares the SPI bus with the TFT/touch controller on the DevKit
  // shield. Make sure every other SPI chip is deselected before SD.begin(),
  // otherwise the SD library can see bus garbage and fail during f_mount().
#ifdef TFT_CS
  pinMode(TFT_CS, OUTPUT);
  digitalWrite(TFT_CS, HIGH);
#endif
#ifdef TOUCH_CS
  pinMode(TOUCH_CS, OUTPUT);
  digitalWrite(TOUCH_CS, HIGH);
#endif
  pinMode(MB_SD_CS, OUTPUT);
  digitalWrite(MB_SD_CS, HIGH);
  delay(10);

#if MB_SD_SCK >= 0
  // Dedicated / explicitly pinned bus (ESP32-S3 FSPI). Safe to call twice —
  // the Arduino core ignores a second begin() on the same object.
  Serial.println(F("[sd] SPI.begin()"));
  SPI.begin(MB_SD_SCK, MB_SD_MISO, MB_SD_MOSI, MB_SD_CS);
#endif
  bool mounted = try_sd_begin(MB_SD_FREQ);
  if (!mounted && MB_SD_FREQ != 10000000UL) mounted = try_sd_begin(10000000UL);
  if (!mounted && MB_SD_FREQ != 4000000UL)  mounted = try_sd_begin(4000000UL);
  if (!mounted && MB_SD_FREQ != 1000000UL)  mounted = try_sd_begin(1000000UL);
  if (!mounted) {
    Serial.println(F("[sd] all SD.begin() attempts FAILED — card was not mounted"));
    Serial.println(F("[sd] check: SD_CS pin, FAT32/MBR format, 3V3 power, common GND, and short SPI wires"));
    return false;
  }
  uint8_t type = SD.cardType();
  if (type == CARD_NONE) {
    Serial.println(F("[sd] mounted bus but no card detected"));
    return false;
  }
  Serial.printf("[sd] card type=%u\n", type);
  Serial.printf("[sd] mounted, %llu MB\n", SD.cardSize() / (1024ULL * 1024ULL));

  if (!SD.exists(MB_ASSET_DIR)) {
    Serial.println(F("[sd] " MB_ASSET_DIR " missing — using drawn UI"));
    return false;
  }

  lv_fs_drv_init(&s_drv);
  s_drv.letter   = 'S';
  // A small read cache keeps the row-by-row streaming of a 150 KB background
  // from turning into thousands of 2-byte SPI reads.
  s_drv.cache_size = 512;
  s_drv.open_cb  = fs_open;
  s_drv.close_cb = fs_close;
  s_drv.read_cb  = fs_read;
  s_drv.seek_cb  = fs_seek;
  s_drv.tell_cb  = fs_tell;
  lv_fs_drv_register(&s_drv);

  s_ready = true;
  return true;
#endif
}

/** "home1.bin" -> "S:/mindbuddy/home1.bin". Returns nullptr with no card.
 *  The returned pointer is a shared scratch buffer: use it immediately
 *  (lv_image_set_src copies the string internally). */
inline const char* path(const char* name) {
  if (!s_ready) return nullptr;
  snprintf(s_path_buf, sizeof(s_path_buf), "S:%s/%s", MB_ASSET_DIR, name);
  return s_path_buf;
}

/** True when the named asset actually exists on the card. */
inline bool has(const char* name) {
  if (!s_ready) return false;
  char p[64];
  snprintf(p, sizeof(p), "%s/%s", MB_ASSET_DIR, name);
  return SD.exists(p);
}

/** Boot-time report: what is on the card and whether LVGL can actually read
 *  it. Run once from ui::begin() so a blank screen can be diagnosed from the
 *  serial monitor alone. */
inline void dump() {
  if (!s_ready) {
    Serial.println(F("[assets] NOT ready — every page will use the drawn fallback UI"));
    return;
  }
  static const char* kExpect[] = {
    "splash.bin", "home1.bin", "home2.bin", "ai.bin",
    "music.bin", "keypad.bin", "calling.bin",
    "icons/back.bin", "icons/net.bin", "icons/nonet.bin",
  };
  Serial.println(F("[assets] card contents:"));
  for (const char* name : kExpect) {
    char p[64];
    snprintf(p, sizeof(p), "%s/%s", MB_ASSET_DIR, name);
    File f = SD.open(p, FILE_READ);
    if (!f) { Serial.printf("  %-18s MISSING\n", name); continue; }
    uint8_t hdr[12] = {0};
    size_t n = f.read(hdr, sizeof(hdr));
    uint32_t sz = f.size();
    f.close();
    uint16_t w = n >= 12 ? (hdr[4] | (hdr[5] << 8)) : 0;
    uint16_t h = n >= 12 ? (hdr[6] | (hdr[7] << 8)) : 0;
    Serial.printf("  %-18s %6lu B  magic=0x%02X cf=0x%02X %ux%u%s\n",
                  name, (unsigned long)sz, hdr[0], hdr[1], w, h,
                  (hdr[0] == 0x19) ? "" : "  <-- BAD HEADER (re-run convert_assets.py)");
  }

  // Prove the LVGL 'S:' driver itself works — this is what lv_image_set_src uses.
  lv_fs_file_t lf;
  const char* probe = path("splash.bin");
  lv_fs_res_t r = lv_fs_open(&lf, probe, LV_FS_MODE_RD);
  if (r == LV_FS_RES_OK) {
    uint8_t b[12]; uint32_t br = 0;
    lv_fs_read(&lf, b, sizeof(b), &br);
    lv_fs_close(&lf);
    Serial.printf("[assets] lv_fs OK (%s, read %lu bytes)\n", probe, (unsigned long)br);
  } else {
    Serial.printf("[assets] lv_fs FAILED on %s (res=%d)\n", probe, (int)r);
  }
}

} // namespace mb_assets
