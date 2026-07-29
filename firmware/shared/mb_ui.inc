// ============================================================
//  MindBuddy — shared TFT UI (LilyGo + ESP32 DevKit)
// ============================================================
//  This file is the firmware twin of the web TFT simulator at
//  /tft-simulator. Every page, touch region and state transition here
//  matches the simulator 1:1, so what you click in the browser is what
//  the hardware does.
//
//  Included by each board's src/ui/ui.cpp, which must first provide:
//    - a TFT_eSPI + LVGL display/indev setup in mb_board_display_init()
//    - MB_HAS_MODEM  (1 = LilyGo with A7670, 0 = DevKit bench board)
//    - namespace mb_hooks { bool dial(const char*); void hangup();
//                           bool sendSms(const char*, const char*); }
//
//  Design notes
//  ------------
//  * The artwork was authored on a 280x320 canvas (MindBuddy Assets).
//    The panels are 240x320, so every X/width from the simulator is run
//    through SX(). Y/height are used unchanged.
//  * Backgrounds and icons come off the SD card as LVGL .bin images
//    (see firmware/shared/SD_CARD_GUIDE.md). With no card the UI still
//    works — it just draws flat coloured panels with the same layout and
//    the same touch regions, so bench testing never blocks on the card.
#pragma once

#include "state.h"
#include "link/link_bus.h"
#include "mb_assets.inc"

#ifndef MB_HAS_MODEM
#define MB_HAS_MODEM 0
#endif

// Artwork canvas -> panel width.
#define SX(v) ((int16_t)(((int32_t)(v) * 240) / 280))

// Board-provided display/touch bring-up.
static void mb_board_display_init();

// ------------------------------------------------------------------
//  RAM-backed phone book + SMS inbox (mirrors the simulator: cap 10)
// ------------------------------------------------------------------
struct MbContact { String name; String number; };
struct MbSms     { String from; String name; String body; bool read; uint32_t at; };

static MbContact s_contacts[10];
static int       s_contact_count = 0;
static MbSms     s_inbox[10];
static int       s_inbox_count = 0;

static int mb_unread() {
  int n = 0;
  for (int i = 0; i < s_inbox_count; ++i) if (!s_inbox[i].read) n++;
  return n;
}

static const char* mb_name_for(const char* number) {
  for (int i = 0; i < s_contact_count; ++i)
    if (s_contacts[i].number == number) return s_contacts[i].name.c_str();
  return nullptr;
}

static bool mb_save_contact(const char* name, const char* number) {
  if (!number || !*number) return false;
  for (int i = 0; i < s_contact_count; ++i)
    if (s_contacts[i].number == number) return false;   // already saved
  if (s_contact_count >= 10) return false;              // book full
  s_contacts[s_contact_count].name   = (name && *name) ? name : number;
  s_contacts[s_contact_count].number = number;
  s_contact_count++;
  return true;
}

// ------------------------------------------------------------------
//  Page objects
// ------------------------------------------------------------------
static lv_obj_t* p_splash  = nullptr;
static lv_obj_t* p_wifi    = nullptr;
static lv_obj_t* p_home    = nullptr;   // Home page 1 (tools)
static lv_obj_t* p_home2   = nullptr;   // Home page 2 (modes)
static lv_obj_t* p_chat    = nullptr;   // AI response page
static lv_obj_t* p_meds    = nullptr;
static lv_obj_t* p_music   = nullptr;
static lv_obj_t* p_dial    = nullptr;   // keypad page
static lv_obj_t* p_calling = nullptr;
static lv_obj_t* p_sms     = nullptr;
static lv_obj_t* p_set     = nullptr;
static lv_obj_t* p_lang    = nullptr;

// Widgets we refresh from state
static lv_obj_t* chat_list      = nullptr;
static lv_obj_t* chat_pending   = nullptr;
static lv_obj_t* chat_meta_lbl  = nullptr;
static lv_obj_t* home_time_lbl  = nullptr;
static lv_obj_t* home_net_img   = nullptr;
static lv_obj_t* home_bat_img   = nullptr;
static lv_obj_t* home_state_lbl = nullptr;
static lv_obj_t* home_med_lbl   = nullptr;
static lv_obj_t* home2_mode_lbl = nullptr;
static lv_obj_t* music_title_lbl= nullptr;
static lv_obj_t* music_pp_img   = nullptr;
static lv_obj_t* dial_num_lbl   = nullptr;
static lv_obj_t* call_num_lbl   = nullptr;
static lv_obj_t* sms_hdr_lbl    = nullptr;
static lv_obj_t* sms_list       = nullptr;
static lv_obj_t* meds_list      = nullptr;
static lv_obj_t* wifi_l1 = nullptr, *wifi_l2 = nullptr, *wifi_l3 = nullptr;

static String   s_dialed;
static ui::Page s_current = ui::Page::Splash;
static ui::Page s_prev    = ui::Page::Home;
static uint32_t s_splash_at = 0;

// ------------------------------------------------------------------
//  Style helpers (flat UI — no shadows/complex fills, see lv_conf.h)
// ------------------------------------------------------------------
static void flatten_part(lv_obj_t* obj, lv_part_t part) {
  lv_obj_set_style_radius(obj, 0, part);
  lv_obj_set_style_shadow_width(obj, 0, part);
  lv_obj_set_style_shadow_opa(obj, LV_OPA_TRANSP, part);
  lv_obj_set_style_shadow_spread(obj, 0, part);
}

static void disable_shadows(lv_obj_t* obj) {
  if (!obj) return;
  static const lv_part_t parts[] = {
    LV_PART_MAIN, LV_PART_SCROLLBAR, LV_PART_INDICATOR,
    LV_PART_KNOB, LV_PART_SELECTED, LV_PART_ITEMS, LV_PART_CURSOR
  };
  for (lv_part_t part : parts) flatten_part(obj, part);
  uint32_t n = lv_obj_get_child_count(obj);
  for (uint32_t i = 0; i < n; ++i) disable_shadows(lv_obj_get_child(obj, i));
}

/** Full-screen page container, optionally wallpapered from the SD card. */
static lv_obj_t* page_create(const char* bg_asset, uint32_t fallback_bg) {
  lv_obj_t* p = lv_obj_create(lv_screen_active());
  lv_obj_remove_style_all(p);
  lv_obj_set_size(p, 240, 320);
  lv_obj_set_pos(p, 0, 0);
  lv_obj_remove_flag(p, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(p, lv_color_hex(fallback_bg), 0);
  lv_obj_set_style_bg_opa(p, LV_OPA_COVER, 0);
  if (bg_asset && mb_assets::has(bg_asset)) {
    lv_obj_t* img = lv_image_create(p);
    lv_image_set_src(img, mb_assets::path(bg_asset));
    lv_obj_set_pos(img, 0, 0);
    lv_obj_remove_flag(img, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_move_background(img);
  }
  return p;
}

/** Icon from the card; returns nullptr when the asset is missing. */
static lv_obj_t* icon_create(lv_obj_t* parent, const char* asset, int x, int y) {
  if (!asset || !mb_assets::has(asset)) return nullptr;
  lv_obj_t* img = lv_image_create(parent);
  lv_image_set_src(img, mb_assets::path(asset));
  lv_obj_set_pos(img, x, y);
  lv_obj_remove_flag(img, LV_OBJ_FLAG_CLICKABLE);
  return img;
}

static void icon_swap(lv_obj_t* img, const char* asset) {
  if (!img || !asset || !mb_assets::has(asset)) return;
  lv_image_set_src(img, mb_assets::path(asset));
}

/** Invisible touch region laid over the artwork — the firmware twin of the
 *  green boxes in the simulator. `label` is only drawn when the background
 *  art is missing, so a card-less board is still usable. */
static lv_obj_t* touch_region(lv_obj_t* parent, int x, int y, int w, int h,
                              const char* label, lv_event_cb_t cb, void* user) {
  lv_obj_t* b = lv_button_create(parent);
  lv_obj_remove_style_all(b);
  lv_obj_set_pos(b, x, y);
  lv_obj_set_size(b, w, h);
  lv_obj_set_style_bg_opa(b, LV_OPA_TRANSP, 0);
  lv_obj_set_style_bg_color(b, lv_color_hex(0x2e8b57), LV_STATE_PRESSED);
  lv_obj_set_style_bg_opa(b, LV_OPA_30, LV_STATE_PRESSED);
  if (label && *label && !mb_assets::ready()) {
    lv_obj_set_style_bg_opa(b, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(b, lv_color_hex(0x16342a), 0);
    lv_obj_set_style_border_width(b, 1, 0);
    lv_obj_set_style_border_color(b, lv_color_hex(0x2e8b57), 0);
    lv_obj_t* l = lv_label_create(b);
    lv_label_set_text(l, label);
    lv_obj_set_style_text_color(l, lv_color_white(), 0);
    lv_obj_set_style_text_font(l, &lv_font_montserrat_12, 0);
    lv_obj_center(l);
  }
  if (user) lv_obj_set_user_data(b, user);
  lv_obj_add_event_cb(b, cb, LV_EVENT_CLICKED, nullptr);
  return b;
}

// ------------------------------------------------------------------
//  Popups (choice / slider / text) — the simulator's modal overlay
// ------------------------------------------------------------------
using MbPick = void (*)(int index, const char* value);
static MbPick     s_pick_cb = nullptr;
static const char** s_pick_opts = nullptr;
static lv_obj_t*  s_popup = nullptr;

static void popup_close() {
  if (s_popup) { lv_obj_delete(s_popup); s_popup = nullptr; }
  s_pick_cb = nullptr;
}

static lv_obj_t* popup_shell(const char* title) {
  popup_close();
  s_popup = lv_obj_create(lv_layer_top());
  lv_obj_remove_style_all(s_popup);
  lv_obj_set_size(s_popup, 240, 320);
  lv_obj_set_pos(s_popup, 0, 0);
  lv_obj_set_style_bg_color(s_popup, lv_color_hex(0x000000), 0);
  lv_obj_set_style_bg_opa(s_popup, LV_OPA_70, 0);
  lv_obj_remove_flag(s_popup, LV_OBJ_FLAG_SCROLLABLE);

  lv_obj_t* card = lv_obj_create(s_popup);
  lv_obj_set_size(card, 216, 250);
  lv_obj_align(card, LV_ALIGN_CENTER, 0, 0);
  lv_obj_set_style_radius(card, 0, 0);
  lv_obj_set_style_bg_color(card, lv_color_hex(0x111814), 0);
  lv_obj_set_style_bg_opa(card, LV_OPA_COVER, 0);
  lv_obj_set_style_border_width(card, 1, 0);
  lv_obj_set_style_border_color(card, lv_color_hex(0x2e8b57), 0);
  lv_obj_set_style_pad_all(card, 6, 0);

  lv_obj_t* t = lv_label_create(card);
  lv_label_set_text(t, title);
  lv_obj_set_style_text_color(t, lv_color_hex(0x7fe3b0), 0);
  lv_obj_set_style_text_font(t, &lv_font_montserrat_16, 0);
  lv_obj_align(t, LV_ALIGN_TOP_MID, 0, 0);
  return card;
}

static void popup_choice(const char* title, const char** options, int n, MbPick cb) {
  lv_obj_t* card = popup_shell(title);
  s_pick_cb = cb;
  s_pick_opts = options;

  lv_obj_t* list = lv_obj_create(card);
  lv_obj_remove_style_all(list);
  lv_obj_set_size(list, 200, 176);
  lv_obj_align(list, LV_ALIGN_TOP_MID, 0, 26);
  lv_obj_set_flex_flow(list, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(list, 4, 0);
  lv_obj_set_scroll_dir(list, LV_DIR_VER);

  for (int i = 0; i < n; ++i) {
    lv_obj_t* b = lv_button_create(list);
    lv_obj_set_size(b, 196, 30);
    lv_obj_set_style_radius(b, 0, 0);
    lv_obj_set_style_bg_color(b, lv_color_hex(0x1f2f27), 0);
    lv_obj_t* l = lv_label_create(b);
    lv_label_set_text(l, options[i]);
    lv_obj_center(l);
    lv_obj_set_user_data(b, (void*)(intptr_t)i);
    lv_obj_add_event_cb(b, [](lv_event_t* e) {
      int idx = (int)(intptr_t)lv_obj_get_user_data(lv_event_get_target_obj(e));
      MbPick cb = s_pick_cb;
      const char* v = s_pick_opts ? s_pick_opts[idx] : "";
      popup_close();
      if (cb) cb(idx, v);
    }, LV_EVENT_CLICKED, nullptr);
  }

  lv_obj_t* close = lv_button_create(card);
  lv_obj_set_size(close, 196, 30);
  lv_obj_align(close, LV_ALIGN_BOTTOM_MID, 0, 0);
  lv_obj_set_style_radius(close, 0, 0);
  lv_obj_set_style_bg_color(close, lv_color_hex(0x333333), 0);
  lv_obj_t* cl = lv_label_create(close); lv_label_set_text(cl, "Close"); lv_obj_center(cl);
  lv_obj_add_event_cb(close, [](lv_event_t*) { popup_close(); }, LV_EVENT_CLICKED, nullptr);

  disable_shadows(s_popup);
}

static void (*s_slider_cb)(int) = nullptr;

static void popup_slider(const char* title, int value, void (*cb)(int)) {
  lv_obj_t* card = popup_shell(title);
  s_slider_cb = cb;

  static lv_obj_t* val_lbl;
  val_lbl = lv_label_create(card);
  lv_label_set_text_fmt(val_lbl, "%d%%", value);
  lv_obj_set_style_text_color(val_lbl, lv_color_white(), 0);
  lv_obj_set_style_text_font(val_lbl, &lv_font_montserrat_28, 0);
  lv_obj_align(val_lbl, LV_ALIGN_CENTER, 0, -40);

  lv_obj_t* s = lv_slider_create(card);
  lv_slider_set_range(s, 0, 100);
  lv_slider_set_value(s, value, LV_ANIM_OFF);
  lv_obj_set_size(s, 190, 14);
  lv_obj_align(s, LV_ALIGN_CENTER, 0, 10);
  lv_obj_set_user_data(s, val_lbl);
  lv_obj_add_event_cb(s, [](lv_event_t* e) {
    lv_obj_t* sl = lv_event_get_target_obj(e);
    int v = lv_slider_get_value(sl);
    lv_label_set_text_fmt((lv_obj_t*)lv_obj_get_user_data(sl), "%d%%", v);
    if (s_slider_cb) s_slider_cb(v);
  }, LV_EVENT_VALUE_CHANGED, nullptr);

  lv_obj_t* close = lv_button_create(card);
  lv_obj_set_size(close, 196, 32);
  lv_obj_align(close, LV_ALIGN_BOTTOM_MID, 0, 0);
  lv_obj_set_style_radius(close, 0, 0);
  lv_obj_set_style_bg_color(close, lv_color_hex(0x2e8b57), 0);
  lv_obj_t* cl = lv_label_create(close); lv_label_set_text(cl, "Done"); lv_obj_center(cl);
  lv_obj_add_event_cb(close, [](lv_event_t*) { popup_close(); }, LV_EVENT_CLICKED, nullptr);

  disable_shadows(s_popup);
}

// Simple on-screen keyboard popup for contact names / SMS bodies.
static void (*s_text_cb)(const char*) = nullptr;
static lv_obj_t* s_text_area = nullptr;

static void popup_text(const char* title, const char* placeholder, uint32_t maxlen,
                       void (*cb)(const char*)) {
  lv_obj_t* card = popup_shell(title);
  lv_obj_set_size(card, 232, 290);
  s_text_cb = cb;

  s_text_area = lv_textarea_create(card);
  lv_textarea_set_placeholder_text(s_text_area, placeholder);
  lv_textarea_set_max_length(s_text_area, maxlen);
  lv_textarea_set_one_line(s_text_area, maxlen <= 24);
  lv_obj_set_size(s_text_area, 216, maxlen <= 24 ? 34 : 52);
  lv_obj_align(s_text_area, LV_ALIGN_TOP_MID, 0, 24);

  lv_obj_t* kb = lv_keyboard_create(card);
  lv_obj_set_size(kb, 216, 150);
  lv_obj_align(kb, LV_ALIGN_BOTTOM_MID, 0, -36);
  lv_keyboard_set_textarea(kb, s_text_area);

  lv_obj_t* ok = lv_button_create(card);
  lv_obj_set_size(ok, 104, 30);
  lv_obj_align(ok, LV_ALIGN_BOTTOM_RIGHT, 0, 0);
  lv_obj_set_style_radius(ok, 0, 0);
  lv_obj_set_style_bg_color(ok, lv_color_hex(0x2e8b57), 0);
  lv_obj_t* ol = lv_label_create(ok); lv_label_set_text(ol, "OK"); lv_obj_center(ol);
  lv_obj_add_event_cb(ok, [](lv_event_t*) {
    String v = s_text_area ? String(lv_textarea_get_text(s_text_area)) : String();
    void (*cb)(const char*) = s_text_cb;
    popup_close(); s_text_area = nullptr; s_text_cb = nullptr;
    if (cb) cb(v.c_str());
  }, LV_EVENT_CLICKED, nullptr);

  lv_obj_t* cancel = lv_button_create(card);
  lv_obj_set_size(cancel, 104, 30);
  lv_obj_align(cancel, LV_ALIGN_BOTTOM_LEFT, 0, 0);
  lv_obj_set_style_radius(cancel, 0, 0);
  lv_obj_set_style_bg_color(cancel, lv_color_hex(0x333333), 0);
  lv_obj_t* cl = lv_label_create(cancel); lv_label_set_text(cl, "Cancel"); lv_obj_center(cl);
  lv_obj_add_event_cb(cancel, [](lv_event_t*) {
    popup_close(); s_text_area = nullptr; s_text_cb = nullptr;
  }, LV_EVENT_CLICKED, nullptr);

  disable_shadows(s_popup);
}

// ------------------------------------------------------------------
//  Forward decls
// ------------------------------------------------------------------
static void build_splash();
static void build_wifi();
static void build_home();
static void build_home2();
static void build_chat();
static void build_meds();
static void build_music();
static void build_dial();
static void build_calling();
static void build_sms();
static void build_settings();
static void build_language();
static void refresh_home();
static void refresh_sms();
static void refresh_meds();
static void refresh_music();

// Option tables (identical to the simulator's).
static const char* OPT_TTS[]   = { "Kokoro TTS", "Piper TTS" };
static const char* OPT_TTSV[]  = { "kokoro", "piper" };
static const char* OPT_VOICE[] = { "Female", "Male" };
static const char* OPT_VOICEV[]= { "female", "male" };
static const char* OPT_PIPE[]  = { "Auto", "Online", "Offline" };
static const char* OPT_PIPEV[] = { "auto", "online", "offline" };
static const char* OPT_LANG[]  = { "English", "Pidgin", "Hausa", "Yoruba", "Igbo", "French" };
static const char* OPT_LANGV[] = { "en", "pcm", "ha", "yo", "ig", "fr" };
static const char* OPT_MOOD[]  = { "Great", "Good", "Okay", "Low", "Sad", "Angry", "Anxious" };

// ------------------------------------------------------------------
//  Splash
// ------------------------------------------------------------------
static void build_splash() {
  p_splash = page_create("splash.bin", 0x0b3d2e);
  if (!mb_assets::has("splash.bin")) {
    lv_obj_t* t = lv_label_create(p_splash);
    lv_label_set_text(t, "WUF\nMindBuddy");
    lv_obj_set_style_text_font(t, &lv_font_montserrat_28, 0);
    lv_obj_set_style_text_color(t, lv_color_white(), 0);
    lv_obj_set_style_text_align(t, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(t, LV_ALIGN_CENTER, 0, -30);
    lv_obj_t* fw = lv_label_create(p_splash);
    lv_label_set_text_fmt(fw, "fw %s", FW_VERSION);
    lv_obj_set_style_text_color(fw, lv_color_hex(0x8fbfa5), 0);
    lv_obj_align(fw, LV_ALIGN_BOTTOM_MID, 0, -8);
  }
  // Tap anywhere to skip, exactly like the simulator.
  touch_region(p_splash, 0, 0, 240, 320, "", [](lv_event_t*) {
    ui::goTo(ui::Page::Home);
  }, nullptr);
}

// ------------------------------------------------------------------
//  Wi-Fi captive-portal instructions
// ------------------------------------------------------------------
static void build_wifi() {
  p_wifi = page_create(nullptr, 0x0d1512);
  lv_obj_set_style_pad_all(p_wifi, 8, 0);

  lv_obj_t* h = lv_label_create(p_wifi);
  lv_label_set_text(h, "Wi-Fi Setup");
  lv_obj_set_style_text_font(h, &lv_font_montserrat_20, 0);
  lv_obj_set_style_text_color(h, lv_color_hex(0x7fe3b0), 0);
  lv_obj_align(h, LV_ALIGN_TOP_MID, 0, 6);

  lv_obj_t** slots[3] = { &wifi_l1, &wifi_l2, &wifi_l3 };
  for (int i = 0; i < 3; ++i) {
    *slots[i] = lv_label_create(p_wifi);
    lv_label_set_long_mode(*slots[i], LV_LABEL_LONG_WRAP);
    lv_obj_set_width(*slots[i], 216);
    lv_obj_set_style_text_color(*slots[i], lv_color_white(), 0);
    lv_obj_align(*slots[i], LV_ALIGN_TOP_LEFT, 6, 48 + i * 60);
  }
  ui::wifiSetPortalInfo(
    "1. Join Wi-Fi \"" WM_AP_NAME "\" on your phone",
    "2. The setup portal opens automatically",
    "3. Pick your network and enter the password");
}

// ------------------------------------------------------------------
//  Home page 1 — MESSAGE / MED / MUSIC / VOL / TTS / VOICE / SOS / next
// ------------------------------------------------------------------
static const char* battery_asset() {
  if (app_state::charging)      return "icons/batchg.bin";
  if (app_state::battery >= 88) return "icons/bat100.bin";
  if (app_state::battery >= 63) return "icons/bat75.bin";
  if (app_state::battery >= 38) return "icons/bat50.bin";
  if (app_state::battery >= 25) return "icons/bat25.bin";
  return "icons/batlow.bin";
}

static void build_home() {
  p_home = page_create("home1.bin", 0x0d1512);

  // --- status bar ---
  home_net_img = icon_create(p_home, app_state::online ? "icons/net.bin" : "icons/nonet.bin", SX(16), 4);
  home_bat_img = icon_create(p_home, battery_asset(), SX(228), 4);

  home_time_lbl = lv_label_create(p_home);
  lv_obj_set_style_text_color(home_time_lbl, lv_color_white(), 0);
  lv_obj_set_style_text_font(home_time_lbl, &lv_font_montserrat_14, 0);
  lv_label_set_text(home_time_lbl, "--:--");
  lv_obj_align(home_time_lbl, LV_ALIGN_TOP_MID, -20, 12);

  home_med_lbl = lv_label_create(p_home);
  lv_obj_set_style_text_color(home_med_lbl, lv_color_hex(0xffd479), 0);
  lv_obj_set_style_text_font(home_med_lbl, &lv_font_montserrat_12, 0);
  lv_label_set_text(home_med_lbl, "");
  lv_obj_align(home_med_lbl, LV_ALIGN_TOP_MID, 44, 14);

  home_state_lbl = lv_label_create(p_home);
  lv_obj_set_style_text_color(home_state_lbl, lv_color_hex(0xbfe7d0), 0);
  lv_obj_set_style_text_font(home_state_lbl, &lv_font_montserrat_12, 0);
  lv_label_set_long_mode(home_state_lbl, LV_LABEL_LONG_WRAP);
  lv_obj_set_width(home_state_lbl, 228);
  lv_obj_set_style_text_align(home_state_lbl, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_align(home_state_lbl, LV_ALIGN_TOP_MID, 0, 30);

  // --- touch grid (simulator coordinates) ---
  touch_region(p_home, SX(18), 62, SX(78), 78, "MESSAGE", [](lv_event_t*) {
    ui::goTo(ui::Page::Sms);
  }, nullptr);
  touch_region(p_home, SX(101), 62, SX(78), 78, "MED", [](lv_event_t*) {
    ui::goTo(ui::Page::Meds);
  }, nullptr);
  touch_region(p_home, SX(184), 62, SX(78), 78, "MUSIC", [](lv_event_t*) {
    ui::goTo(ui::Page::Music);
  }, nullptr);

  touch_region(p_home, SX(18), 148, SX(78), 78, "VOL", [](lv_event_t*) {
    popup_slider("Volume", app_state::volume, [](int v) {
      app_state::volume = v;
      link_bus::sendVolume(v);
    });
  }, nullptr);
  touch_region(p_home, SX(101), 148, SX(78), 78, "TTS", [](lv_event_t*) {
    popup_choice("TTS Engine", OPT_TTS, 2, [](int i, const char*) {
      app_state::tts_engine = OPT_TTSV[i];
      link_bus::sendTtsEngine(OPT_TTSV[i]);
      ui::toast(OPT_TTS[i]);
      app_state::notifyChanged();
    });
  }, nullptr);
  touch_region(p_home, SX(184), 148, SX(78), 78, "VOICE", [](lv_event_t*) {
    popup_choice("Voice", OPT_VOICE, 2, [](int i, const char*) {
      app_state::voice = OPT_VOICEV[i];
      link_bus::sendVoice(OPT_VOICEV[i]);
      ui::toast(OPT_VOICE[i]);
      app_state::notifyChanged();
    });
  }, nullptr);

  touch_region(p_home, SX(18), 244, SX(74), 62, "SOS", [](lv_event_t*) {
    app_state::sos_active = true;
    link_bus::sendSosTrigger("SOS button on TFT");
    ui::toast("SOS sent");
    app_state::notifyChanged();
    ui::goTo(ui::Page::Dial);
  }, nullptr);
  touch_region(p_home, SX(175), 250, SX(92), 55, "MODES >", [](lv_event_t*) {
    ui::goTo(ui::Page::Home2);
  }, nullptr);

  // Talk: the artwork's centre character doubles as the wake button.
  touch_region(p_home, SX(96), 244, SX(74), 62, "TALK", [](lv_event_t*) {
    link_bus::sendWake();
    ui::goTo(ui::Page::Chat);
  }, nullptr);
}

// ------------------------------------------------------------------
//  Home page 2 — pipeline / mood / chat + the six support modes
// ------------------------------------------------------------------
static void pick_mode(const char* m) {
  app_state::mode = m;
  link_bus::sendModeSet(m);
  ui::toast(m);
  app_state::notifyChanged();
}

static void build_home2() {
  p_home2 = page_create("home2.bin", 0x0d1512);

  icon_create(p_home2, "icons/back.bin", SX(10), 8);
  touch_region(p_home2, SX(6), 4, SX(62), 46, "BACK", [](lv_event_t*) {
    ui::goTo(ui::Page::Home);
  }, nullptr);

  home2_mode_lbl = lv_label_create(p_home2);
  lv_obj_set_style_text_color(home2_mode_lbl, lv_color_hex(0x7fe3b0), 0);
  lv_obj_set_style_text_font(home2_mode_lbl, &lv_font_montserrat_12, 0);
  lv_obj_align(home2_mode_lbl, LV_ALIGN_TOP_RIGHT, -6, 16);

  touch_region(p_home2, SX(15), 60, SX(78), 78, "PIPELINE", [](lv_event_t*) {
    popup_choice("Pipeline", OPT_PIPE, 3, [](int i, const char*) {
      app_state::pipeline   = OPT_PIPEV[i];
      app_state::cloud_pref = strcmp(OPT_PIPEV[i], "offline") != 0;
      link_bus::sendPipeline(OPT_PIPEV[i]);
      ui::toast(OPT_PIPE[i]);
      app_state::notifyChanged();
    });
  }, nullptr);
  touch_region(p_home2, SX(101), 60, SX(78), 78, "MOOD", [](lv_event_t*) {
    popup_choice("How do you feel?", OPT_MOOD, 7, [](int, const char* v) {
      link_bus::sendMoodSet(v);
      ui::toast("Mood logged");
    });
  }, nullptr);
  touch_region(p_home2, SX(187), 60, SX(78), 78, "CHAT", [](lv_event_t*) {
    link_bus::sendWake();
    ui::goTo(ui::Page::Chat);
  }, nullptr);

  struct ModeCell { const char* label; const char* value; int x; int y; };
  static const ModeCell cells[6] = {
    { "SCHIZO.",  "SCHIZOPHRENIA", 15,  143 },
    { "ADHD",     "ADHD",          101, 143 },
    { "ANXIETY",  "ANXIETY",       187, 143 },
    { "BIPOLAR",  "BIPOLAR",       15,  226 },
    { "PTSD",     "PTSD",          101, 226 },
    { "DEPRE.",   "DEPRESSION",    187, 226 },
  };
  for (const ModeCell& c : cells) {
    touch_region(p_home2, SX(c.x), c.y, SX(78), 78, c.label, [](lv_event_t* e) {
      pick_mode((const char*)lv_obj_get_user_data(lv_event_get_target_obj(e)));
    }, (void*)c.value);
  }

  // Long-lived extras that have no cell in the artwork: language + settings.
  touch_region(p_home2, SX(101), 8, SX(78), 40, "LANG", [](lv_event_t*) {
    ui::goTo(ui::Page::Language);
  }, nullptr);
  touch_region(p_home2, SX(187), 8, SX(78), 40, "SETUP", [](lv_event_t*) {
    ui::goTo(ui::Page::Settings);
  }, nullptr);
}

// ------------------------------------------------------------------
//  AI response page
// ------------------------------------------------------------------
static void build_chat() {
  p_chat = page_create("ai.bin", 0x0d1512);

  icon_create(p_chat, "icons/back.bin", SX(8), 8);
  touch_region(p_chat, SX(4), 4, SX(64), 48, "BACK", [](lv_event_t*) {
    ui::back();
  }, nullptr);

  chat_list = lv_obj_create(p_chat);
  lv_obj_remove_style_all(chat_list);
  lv_obj_set_size(chat_list, 228, 196);
  lv_obj_align(chat_list, LV_ALIGN_TOP_MID, 0, 58);
  lv_obj_set_flex_flow(chat_list, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(chat_list, 4, 0);
  lv_obj_set_scroll_dir(chat_list, LV_DIR_VER);

  chat_meta_lbl = lv_label_create(p_chat);
  lv_label_set_text(chat_meta_lbl, "");
  lv_obj_set_style_text_font(chat_meta_lbl, &lv_font_montserrat_12, 0);
  lv_obj_set_style_text_color(chat_meta_lbl, lv_color_hex(0x8fbfa5), 0);
  lv_obj_align(chat_meta_lbl, LV_ALIGN_BOTTOM_MID, 0, -44);

  lv_obj_t* talk = lv_button_create(p_chat);
  lv_obj_set_size(talk, 120, 34);
  lv_obj_align(talk, LV_ALIGN_BOTTOM_MID, 0, -4);
  lv_obj_set_style_radius(talk, 0, 0);
  lv_obj_set_style_bg_color(talk, lv_color_hex(0x2e8b57), 0);
  lv_obj_t* tl = lv_label_create(talk);
  lv_label_set_text(tl, LV_SYMBOL_AUDIO " Talk");
  lv_obj_center(tl);
  lv_obj_add_event_cb(talk, [](lv_event_t*) { link_bus::sendWake(); }, LV_EVENT_CLICKED, nullptr);
}

// ------------------------------------------------------------------
//  Medication page
// ------------------------------------------------------------------
static void build_meds() {
  p_meds = page_create(nullptr, 0x0d1512);

  icon_create(p_meds, "icons/back.bin", SX(8), 8);
  touch_region(p_meds, SX(4), 4, SX(64), 48, "BACK", [](lv_event_t*) {
    ui::back();
  }, nullptr);

  lv_obj_t* t = lv_label_create(p_meds);
  lv_label_set_text(t, "Medication");
  lv_obj_set_style_text_font(t, &lv_font_montserrat_16, 0);
  lv_obj_set_style_text_color(t, lv_color_hex(0x7fe3b0), 0);
  lv_obj_align(t, LV_ALIGN_TOP_LEFT, 54, 18);

  meds_list = lv_obj_create(p_meds);
  lv_obj_remove_style_all(meds_list);
  lv_obj_set_size(meds_list, 228, 250);
  lv_obj_align(meds_list, LV_ALIGN_TOP_MID, 0, 56);
  lv_obj_set_flex_flow(meds_list, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(meds_list, 4, 0);
  lv_obj_set_scroll_dir(meds_list, LV_DIR_VER);
  refresh_meds();
}

static void refresh_meds() {
  if (!meds_list) return;
  lv_obj_clean(meds_list);
  if (app_state::med_count == 0) {
    lv_obj_t* l = lv_label_create(meds_list);
    lv_label_set_long_mode(l, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(l, 220);
    lv_obj_set_style_text_color(l, lv_color_hex(0x9bb3a8), 0);
    lv_label_set_text(l, "No reminders yet.\nAdd them in the Mind Buddy web app -\nthey sync down through the Pi.");
    return;
  }
  for (int i = 0; i < app_state::med_count; ++i) {
    const MedItem& m = app_state::meds[i];
    lv_obj_t* row = lv_obj_create(meds_list);
    lv_obj_set_size(row, 224, 40);
    lv_obj_set_style_radius(row, 0, 0);
    lv_obj_set_style_pad_all(row, 4, 0);
    lv_obj_set_style_bg_color(row, m.enabled ? lv_color_hex(0x16342a) : lv_color_hex(0x1c1c1c), 0);
    lv_obj_set_style_border_width(row, 0, 0);
    lv_obj_remove_flag(row, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_t* l = lv_label_create(row);
    lv_label_set_text_fmt(l, "%02d:%02d  %s", m.hour, m.minute, m.label.c_str());
    lv_obj_set_style_text_color(l, lv_color_white(), 0);
    lv_obj_set_style_text_font(l, &lv_font_montserrat_14, 0);
    lv_obj_align(l, LV_ALIGN_LEFT_MID, 2, 0);
  }
  disable_shadows(meds_list);
}

// ------------------------------------------------------------------
//  Music page
// ------------------------------------------------------------------
static void build_music() {
  p_music = page_create("music.bin", 0x0d1512);

  icon_create(p_music, "icons/back.bin", SX(8), 8);
  touch_region(p_music, SX(4), 4, SX(64), 48, "BACK", [](lv_event_t*) {
    ui::back();
  }, nullptr);

  music_title_lbl = lv_label_create(p_music);
  lv_label_set_long_mode(music_title_lbl, LV_LABEL_LONG_SCROLL_CIRCULAR);
  lv_obj_set_width(music_title_lbl, 200);
  lv_obj_set_style_text_align(music_title_lbl, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_text_color(music_title_lbl, lv_color_white(), 0);
  lv_obj_align(music_title_lbl, LV_ALIGN_TOP_MID, 0, 196);

  // Play/pause artwork sits centred over the transport row (simulator: 114,237 51x51).
  music_pp_img = icon_create(p_music, app_state::music_playing ? "icons/pause.bin" : "icons/play.bin",
                             SX(114), 237);

  touch_region(p_music, SX(22), 240, SX(62), 58, "PREV", [](lv_event_t*) {
    link_bus::sendMusic("prev");
  }, nullptr);
  touch_region(p_music, SX(110), 240, SX(62), 58, "PLAY", [](lv_event_t*) {
    bool next_playing = !app_state::music_playing;
    link_bus::sendMusic(next_playing ? "play" : "pause");
    app_state::music_playing = next_playing;   // optimistic; Pi confirms
    refresh_music();
  }, nullptr);
  touch_region(p_music, SX(198), 240, SX(62), 58, "NEXT", [](lv_event_t*) {
    link_bus::sendMusic("next");
  }, nullptr);

  refresh_music();
}

static void refresh_music() {
  if (music_title_lbl)
    lv_label_set_text(music_title_lbl,
                      app_state::music_title.length() ? app_state::music_title.c_str()
                                                      : "Nothing playing");
  icon_swap(music_pp_img, app_state::music_playing ? "icons/pause.bin" : "icons/play.bin");
}

// ------------------------------------------------------------------
//  Keypad / dial page
// ------------------------------------------------------------------
static void dial_refresh() {
  if (dial_num_lbl) lv_label_set_text(dial_num_lbl, s_dialed.length() ? s_dialed.c_str() : " ");
}

static void dial_push(const char* k) {
  if (s_dialed.length() < 15) s_dialed += k;
  dial_refresh();
}

static void build_dial() {
  p_dial = page_create("keypad.bin", 0x0d1512);

  // Number readout (simulator: 22,32 200x32 white pill).
  lv_obj_t* pill = lv_obj_create(p_dial);
  lv_obj_set_size(pill, SX(200), 32);
  lv_obj_set_pos(pill, SX(22), 32);
  lv_obj_set_style_radius(pill, 0, 0);
  lv_obj_set_style_bg_color(pill, lv_color_hex(0xffffff), 0);
  lv_obj_set_style_border_width(pill, 0, 0);
  lv_obj_set_style_pad_all(pill, 0, 0);
  lv_obj_remove_flag(pill, LV_OBJ_FLAG_SCROLLABLE);
  dial_num_lbl = lv_label_create(pill);
  lv_obj_set_style_text_color(dial_num_lbl, lv_color_black(), 0);
  lv_obj_set_style_text_font(dial_num_lbl, &lv_font_montserrat_20, 0);
  lv_obj_center(dial_num_lbl);
  dial_refresh();

  // 3x4 digit grid — same geometry the simulator traces from Keypad Page.png.
  const int gridX = 22, gridY = 78, cellW = 54, cellH = 48, gapX = 6, gapY = 6;
  static const char* keys[12] = { "7","8","9", "4","5","6", "1","2","3", "X","0","<" };
  for (int i = 0; i < 12; ++i) {
    int col = i % 3, row = i / 3;
    int x = gridX + col * (cellW + gapX);
    int y = gridY + row * (cellH + gapY);
    touch_region(p_dial, SX(x), y, SX(cellW), cellH, keys[i], [](lv_event_t* e) {
      const char* k = (const char*)lv_obj_get_user_data(lv_event_get_target_obj(e));
      if (!strcmp(k, "X"))      { s_dialed = ""; dial_refresh(); }
      else if (!strcmp(k, "<")) { if (s_dialed.length()) s_dialed.remove(s_dialed.length() - 1); dial_refresh(); }
      else                      { dial_push(k); }
    }, (void*)keys[i]);
  }

  // Right column: back / save / call.
  const int rightX = 214;
  icon_create(p_dial, "icons/back.bin", SX(rightX) + 3, 92);
  touch_region(p_dial, SX(rightX), 90, SX(54), 48, "BACK", [](lv_event_t*) {
    ui::back();
  }, nullptr);

  touch_region(p_dial, SX(rightX), 158, SX(54), 44, "SAVE", [](lv_event_t*) {
    if (!s_dialed.length()) { ui::toast("Type a number first"); return; }
    popup_text("Save contact", "Contact name", 20, [](const char* name) {
      if (mb_save_contact(name, s_dialed.c_str())) {
        ui::toast("Contact saved");
        s_dialed = "";
        dial_refresh();
        refresh_sms();
      } else {
        ui::toast("Not saved (duplicate or 10/10)");
      }
    });
  }, nullptr);

  touch_region(p_dial, SX(rightX), 214, SX(54), 58, "CALL", [](lv_event_t*) {
    if (!s_dialed.length()) { ui::toast("Type a number first"); return; }
#if MB_HAS_MODEM
    if (!mb_hooks::dial(s_dialed.c_str())) { ui::toast("Modem busy"); return; }
#else
    ui::toast("No modem on this board");
#endif
    link_bus::sendCallAnswered(s_dialed.c_str());
    app_state::in_call  = true;
    app_state::call_from = s_dialed;
    ui::goTo(ui::Page::Calling);
  }, nullptr);
}

// ------------------------------------------------------------------
//  Calling page
// ------------------------------------------------------------------
static void build_calling() {
  p_calling = page_create("calling.bin", 0x0d1512);

  call_num_lbl = lv_label_create(p_calling);
  lv_obj_set_style_text_color(call_num_lbl, lv_color_white(), 0);
  lv_obj_set_style_text_font(call_num_lbl, &lv_font_montserrat_20, 0);
  lv_obj_set_style_text_align(call_num_lbl, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_width(call_num_lbl, 240);
  lv_obj_align(call_num_lbl, LV_ALIGN_TOP_MID, 0, 108);

  touch_region(p_calling, SX(100), 218, SX(82), 82, "HANG UP", [](lv_event_t*) {
#if MB_HAS_MODEM
    mb_hooks::hangup();
#endif
    link_bus::sendCallEnded();
    app_state::in_call = false;
    s_dialed = "";
    ui::goTo(ui::Page::Home);
  }, nullptr);
}

// ------------------------------------------------------------------
//  SMS page — inbox + phone book, Back button PNG top-left
// ------------------------------------------------------------------
static int  s_sms_target = -1;   // contact index being composed to

static void build_sms() {
  // No background artwork for SMS: we draw the list ourselves on black and
  // reserve the top 52px band for the Back button so nothing overlaps it.
  p_sms = page_create(nullptr, 0x07100c);

  icon_create(p_sms, "icons/back.bin", SX(6), 6);
  touch_region(p_sms, SX(4), 4, SX(44), 44, "BACK", [](lv_event_t*) {
    ui::back();
  }, nullptr);

  lv_obj_t* band = lv_obj_create(p_sms);
  lv_obj_set_size(band, 240 - SX(52), 52);
  lv_obj_set_pos(band, SX(52), 0);
  lv_obj_set_style_radius(band, 0, 0);
  lv_obj_set_style_bg_color(band, lv_color_hex(0x000000), 0);
  lv_obj_set_style_bg_opa(band, LV_OPA_70, 0);
  lv_obj_set_style_border_width(band, 0, 0);
  lv_obj_set_style_pad_all(band, 4, 0);
  lv_obj_remove_flag(band, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_move_foreground(band);

  sms_hdr_lbl = lv_label_create(band);
  lv_obj_set_style_text_color(sms_hdr_lbl, lv_color_hex(0x7fe3b0), 0);
  lv_obj_set_style_text_font(sms_hdr_lbl, &lv_font_montserrat_14, 0);
  lv_obj_align(sms_hdr_lbl, LV_ALIGN_LEFT_MID, 2, 0);

  sms_list = lv_obj_create(p_sms);
  lv_obj_remove_style_all(sms_list);
  lv_obj_set_size(sms_list, 232, 262);
  lv_obj_set_pos(sms_list, 4, 54);
  lv_obj_set_flex_flow(sms_list, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_row(sms_list, 4, 0);
  lv_obj_set_scroll_dir(sms_list, LV_DIR_VER);

  refresh_sms();
}

static void sms_section(const char* title) {
  lv_obj_t* l = lv_label_create(sms_list);
  lv_label_set_text(l, title);
  lv_obj_set_style_text_font(l, &lv_font_montserrat_12, 0);
  lv_obj_set_style_text_color(l, lv_color_hex(0x7d8f86), 0);
}

static void refresh_sms() {
  if (!sms_list) return;
  if (sms_hdr_lbl) {
    int u = mb_unread();
    if (u > 0) lv_label_set_text_fmt(sms_hdr_lbl, "SMS  %d new   %d/10", u, s_contact_count);
    else       lv_label_set_text_fmt(sms_hdr_lbl, "SMS   %d/10 saved", s_contact_count);
  }
  lv_obj_clean(sms_list);

  sms_section("INBOX");
  if (s_inbox_count == 0) {
    lv_obj_t* l = lv_label_create(sms_list);
    lv_label_set_text(l, "Inbox is empty.");
    lv_obj_set_style_text_color(l, lv_color_hex(0x60706a), 0);
    lv_obj_set_style_text_font(l, &lv_font_montserrat_12, 0);
  }
  for (int i = 0; i < s_inbox_count; ++i) {
    lv_obj_t* row = lv_button_create(sms_list);
    lv_obj_set_size(row, 224, 46);
    lv_obj_set_style_radius(row, 0, 0);
    lv_obj_set_style_pad_all(row, 4, 0);
    lv_obj_set_style_bg_color(row, s_inbox[i].read ? lv_color_hex(0x151b18) : lv_color_hex(0x16342a), 0);
    lv_obj_set_user_data(row, (void*)(intptr_t)i);
    lv_obj_add_event_cb(row, [](lv_event_t* e) {
      int idx = (int)(intptr_t)lv_obj_get_user_data(lv_event_get_target_obj(e));
      if (idx >= 0 && idx < s_inbox_count) s_inbox[idx].read = true;
      refresh_sms();
    }, LV_EVENT_CLICKED, nullptr);

    lv_obj_t* who = lv_label_create(row);
    lv_label_set_text_fmt(who, "%s%s",
                          s_inbox[i].name.length() ? s_inbox[i].name.c_str() : s_inbox[i].from.c_str(),
                          s_inbox[i].read ? "" : "  NEW");
    lv_obj_set_style_text_color(who, lv_color_hex(0x9be9c1), 0);
    lv_obj_set_style_text_font(who, &lv_font_montserrat_12, 0);
    lv_obj_align(who, LV_ALIGN_TOP_LEFT, 0, 0);

    lv_obj_t* body = lv_label_create(row);
    lv_label_set_long_mode(body, LV_LABEL_LONG_DOT);
    lv_obj_set_width(body, 214);
    lv_label_set_text(body, s_inbox[i].body.c_str());
    lv_obj_set_style_text_color(body, lv_color_hex(0xd8e6df), 0);
    lv_obj_set_style_text_font(body, &lv_font_montserrat_12, 0);
    lv_obj_align(body, LV_ALIGN_BOTTOM_LEFT, 0, 0);
  }

  sms_section("SAVED NUMBERS - TAP TO TEXT");
  if (s_contact_count == 0) {
    lv_obj_t* l = lv_label_create(sms_list);
    lv_label_set_long_mode(l, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(l, 220);
    lv_label_set_text(l, "No saved contacts yet. Dial a number on the keypad and tap SAVE.");
    lv_obj_set_style_text_color(l, lv_color_hex(0x60706a), 0);
    lv_obj_set_style_text_font(l, &lv_font_montserrat_12, 0);
  }
  for (int i = 0; i < s_contact_count; ++i) {
    lv_obj_t* row = lv_button_create(sms_list);
    lv_obj_set_size(row, 224, 42);
    lv_obj_set_style_radius(row, 0, 0);
    lv_obj_set_style_pad_all(row, 4, 0);
    lv_obj_set_style_bg_color(row, lv_color_hex(0x151b18), 0);
    lv_obj_set_user_data(row, (void*)(intptr_t)i);
    lv_obj_add_event_cb(row, [](lv_event_t* e) {
      s_sms_target = (int)(intptr_t)lv_obj_get_user_data(lv_event_get_target_obj(e));
      popup_text("Text contact", "Message (160)", 160, [](const char* body) {
        if (s_sms_target < 0 || s_sms_target >= s_contact_count || !body || !*body) return;
        const char* to = s_contacts[s_sms_target].number.c_str();
#if MB_HAS_MODEM
        bool ok = mb_hooks::sendSms(to, body);
        ui::toast(ok ? "SMS sent" : "SMS failed");
#else
        ui::toast("No modem on this board");
#endif
        link_bus::sendSmsSent(to, body);
      });
    }, LV_EVENT_CLICKED, nullptr);

    lv_obj_t* nm = lv_label_create(row);
    lv_label_set_text(nm, s_contacts[i].name.c_str());
    lv_obj_set_style_text_color(nm, lv_color_hex(0x9be9c1), 0);
    lv_obj_set_style_text_font(nm, &lv_font_montserrat_12, 0);
    lv_obj_align(nm, LV_ALIGN_TOP_LEFT, 0, 0);

    lv_obj_t* nu = lv_label_create(row);
    lv_label_set_text(nu, s_contacts[i].number.c_str());
    lv_obj_set_style_text_color(nu, lv_color_hex(0xc9d6cf), 0);
    lv_obj_set_style_text_font(nu, &lv_font_montserrat_12, 0);
    lv_obj_align(nu, LV_ALIGN_BOTTOM_LEFT, 0, 0);
  }
  disable_shadows(sms_list);
}

// ------------------------------------------------------------------
//  Settings + Language
// ------------------------------------------------------------------
static void build_settings() {
  p_set = page_create(nullptr, 0x0d1512);

  icon_create(p_set, "icons/back.bin", SX(8), 8);
  touch_region(p_set, SX(4), 4, SX(64), 48, "BACK", [](lv_event_t*) { ui::back(); }, nullptr);

  lv_obj_t* t = lv_label_create(p_set);
  lv_label_set_text(t, "Settings");
  lv_obj_set_style_text_font(t, &lv_font_montserrat_16, 0);
  lv_obj_set_style_text_color(t, lv_color_hex(0x7fe3b0), 0);
  lv_obj_align(t, LV_ALIGN_TOP_LEFT, 54, 18);

  struct Row { const char* label; lv_event_cb_t cb; };
  static const Row rows[] = {
    { "Volume",     [](lv_event_t*) { popup_slider("Volume", app_state::volume, [](int v) {
                        app_state::volume = v; link_bus::sendVolume(v); }); } },
    { "Pipeline",   [](lv_event_t*) { popup_choice("Pipeline", OPT_PIPE, 3, [](int i, const char*) {
                        app_state::pipeline = OPT_PIPEV[i];
                        app_state::cloud_pref = strcmp(OPT_PIPEV[i], "offline") != 0;
                        link_bus::sendPipeline(OPT_PIPEV[i]); app_state::notifyChanged(); }); } },
    { "TTS engine", [](lv_event_t*) { popup_choice("TTS Engine", OPT_TTS, 2, [](int i, const char*) {
                        app_state::tts_engine = OPT_TTSV[i];
                        link_bus::sendTtsEngine(OPT_TTSV[i]); app_state::notifyChanged(); }); } },
    { "Voice",      [](lv_event_t*) { popup_choice("Voice", OPT_VOICE, 2, [](int i, const char*) {
                        app_state::voice = OPT_VOICEV[i];
                        link_bus::sendVoice(OPT_VOICEV[i]); app_state::notifyChanged(); }); } },
    { "Language",   [](lv_event_t*) { ui::goTo(ui::Page::Language); } },
    { "Clear SOS",  [](lv_event_t*) { app_state::sos_active = false; link_bus::sendSosResolve();
                        ui::toast("SOS cleared"); app_state::notifyChanged(); } },
  };
  for (size_t i = 0; i < sizeof(rows) / sizeof(rows[0]); ++i) {
    lv_obj_t* b = lv_button_create(p_set);
    lv_obj_set_size(b, 224, 34);
    lv_obj_set_pos(b, 8, 58 + (int)i * 40);
    lv_obj_set_style_radius(b, 0, 0);
    lv_obj_set_style_bg_color(b, lv_color_hex(0x1f2f27), 0);
    lv_obj_t* l = lv_label_create(b);
    lv_label_set_text(l, rows[i].label);
    lv_obj_align(l, LV_ALIGN_LEFT_MID, 4, 0);
    lv_obj_add_event_cb(b, rows[i].cb, LV_EVENT_CLICKED, nullptr);
  }
}

static void build_language() {
  p_lang = page_create(nullptr, 0x0d1512);

  icon_create(p_lang, "icons/back.bin", SX(8), 8);
  touch_region(p_lang, SX(4), 4, SX(64), 48, "BACK", [](lv_event_t*) { ui::back(); }, nullptr);

  lv_obj_t* t = lv_label_create(p_lang);
  lv_label_set_text(t, "Reply language");
  lv_obj_set_style_text_font(t, &lv_font_montserrat_16, 0);
  lv_obj_set_style_text_color(t, lv_color_hex(0x7fe3b0), 0);
  lv_obj_align(t, LV_ALIGN_TOP_LEFT, 54, 18);

  for (int i = 0; i < 6; ++i) {
    lv_obj_t* b = lv_button_create(p_lang);
    lv_obj_set_size(b, 224, 34);
    lv_obj_set_pos(b, 8, 58 + i * 40);
    lv_obj_set_style_radius(b, 0, 0);
    lv_obj_set_style_bg_color(b, lv_color_hex(0x1f2f27), 0);
    lv_obj_t* l = lv_label_create(b);
    lv_label_set_text(l, OPT_LANG[i]);
    lv_obj_align(l, LV_ALIGN_LEFT_MID, 4, 0);
    lv_obj_set_user_data(b, (void*)(intptr_t)i);
    lv_obj_add_event_cb(b, [](lv_event_t* e) {
      int i = (int)(intptr_t)lv_obj_get_user_data(lv_event_get_target_obj(e));
      app_state::language = OPT_LANGV[i];
      link_bus::sendLanguageSet(OPT_LANGV[i]);
      ui::toast(OPT_LANG[i]);
      app_state::notifyChanged();
      ui::back();
    }, LV_EVENT_CLICKED, nullptr);
  }
}

// ------------------------------------------------------------------
//  State -> widget refresh
// ------------------------------------------------------------------
static void refresh_home() {
  icon_swap(home_net_img, app_state::online ? "icons/net.bin" : "icons/nonet.bin");
  icon_swap(home_bat_img, battery_asset());

  if (home_time_lbl)
    lv_label_set_text(home_time_lbl,
                      app_state::clock_hhmm.length() ? app_state::clock_hhmm.c_str() : "--:--");

  if (home_med_lbl) {
    int best = -1, best_min = 1 << 30;
    for (int i = 0; i < app_state::med_count; ++i) {
      if (!app_state::meds[i].enabled) continue;
      int mins = app_state::meds[i].hour * 60 + app_state::meds[i].minute;
      if (mins < best_min) { best_min = mins; best = i; }
    }
    if (best >= 0) lv_label_set_text_fmt(home_med_lbl, "MED %02d:%02d",
                                         app_state::meds[best].hour, app_state::meds[best].minute);
    else           lv_label_set_text(home_med_lbl, "");
  }

  if (home_state_lbl) {
    const char* act = app_state::sos_active ? "SOS ACTIVE"
                    : app_state::in_call    ? "IN CALL"
                    : app_state::listening  ? "listening"
                    : app_state::thinking   ? "thinking"
                    : app_state::speaking   ? "speaking"
                                            : "ready";
    if (app_state::last_reply_ms > 0)
      lv_label_set_text_fmt(home_state_lbl, "%s | %s | %s %s | %s %dms",
                            app_state::mode.c_str(), app_state::pipeline.c_str(),
                            app_state::tts_engine.c_str(), app_state::voice.c_str(),
                            act, app_state::last_reply_ms);
    else
      lv_label_set_text_fmt(home_state_lbl, "%s | %s | %s %s | %s",
                            app_state::mode.c_str(), app_state::pipeline.c_str(),
                            app_state::tts_engine.c_str(), app_state::voice.c_str(), act);
  }

  if (home2_mode_lbl)
    lv_label_set_text_fmt(home2_mode_lbl, "%s / %s",
                          app_state::mode.c_str(), app_state::language.c_str());

  if (chat_meta_lbl) {
    if (app_state::last_reply_ms > 0)
      lv_label_set_text_fmt(chat_meta_lbl, "%s - %s - %d ms",
                            app_state::pipeline.c_str(), app_state::backend.c_str(),
                            app_state::last_reply_ms);
    else
      lv_label_set_text_fmt(chat_meta_lbl, "%s - %s",
                            app_state::pipeline.c_str(), app_state::backend.c_str());
  }

  if (call_num_lbl)
    lv_label_set_text(call_num_lbl,
                      app_state::call_from.length() ? app_state::call_from.c_str() : "Unknown");

  refresh_music();
  refresh_meds();
}

static void hide_all() {
  lv_obj_t* pages[] = { p_splash, p_wifi, p_home, p_home2, p_chat, p_meds,
                        p_music, p_dial, p_calling, p_sms, p_set, p_lang };
  for (auto* p : pages) if (p) lv_obj_add_flag(p, LV_OBJ_FLAG_HIDDEN);
}

// ------------------------------------------------------------------
//  Public API
// ------------------------------------------------------------------
namespace ui {

void begin() {
  mb_board_display_init();

  // SD assets are optional: without a card we fall back to the drawn UI.
  mb_assets::begin();

  build_splash();
  build_wifi();
  build_home();
  disable_shadows(lv_screen_active());

  s_splash_at = millis();
  goTo(Page::Splash);
  app_state::onChange(refresh_home);
}

void tick() {
  lv_timer_handler();
  // Splash auto-advances after the 4.6 s animation, same as the simulator.
  if (s_current == Page::Splash && s_splash_at && millis() - s_splash_at > 4600) {
    s_splash_at = 0;
    goTo(Page::Home);
  }
}

Page current() { return s_current; }

void goTo(Page p) {
  if (p == s_current) return;
  if (s_current != Page::Splash && s_current != Page::WifiSetup) s_prev = s_current;
  s_current = p;
  popup_close();
  hide_all();

  lv_obj_t* target = nullptr;
  switch (p) {
    case Page::Splash:    target = p_splash; break;
    case Page::WifiSetup: target = p_wifi;   break;
    case Page::Home:      target = p_home; refresh_home(); break;
    case Page::Home2:     if (!p_home2)   { build_home2();    disable_shadows(p_home2); }   target = p_home2;   break;
    case Page::Chat:      if (!p_chat)    { build_chat();     disable_shadows(p_chat); }    target = p_chat;    break;
    case Page::Modes:     if (!p_home2)   { build_home2();    disable_shadows(p_home2); }   target = p_home2;   break;
    case Page::Language:  if (!p_lang)    { build_language(); disable_shadows(p_lang); }    target = p_lang;    break;
    case Page::Meds:      if (!p_meds)    { build_meds();     disable_shadows(p_meds); }    target = p_meds;    refresh_meds(); break;
    case Page::Music:     if (!p_music)   { build_music();    disable_shadows(p_music); }   target = p_music;   refresh_music(); break;
    case Page::Dial:      if (!p_dial)    { build_dial();     disable_shadows(p_dial); }    target = p_dial;    dial_refresh(); break;
    case Page::Calling:   if (!p_calling) { build_calling();  disable_shadows(p_calling); } target = p_calling; break;
    case Page::Sms:       if (!p_sms)     { build_sms();      disable_shadows(p_sms); }     target = p_sms;     refresh_sms(); break;
    case Page::Settings:  if (!p_set)     { build_settings(); disable_shadows(p_set); }     target = p_set;     break;
  }
  if (target) {
    disable_shadows(target);
    lv_obj_remove_flag(target, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(target);
  }
  Serial.printf("[ui] goTo page=%d heap=%u\n", (int)p, (unsigned)ESP.getFreeHeap());
}

void back() {
  if (s_popup) { popup_close(); return; }
  switch (s_current) {
    case Page::Home:
    case Page::Splash:
    case Page::WifiSetup:
      return;
    case Page::Home2:
      goTo(Page::Home);
      return;
    case Page::Language:
      goTo(Page::Settings);
      return;
    default:
      goTo(s_prev == s_current ? Page::Home : s_prev);
      return;
  }
}

// -------- chat --------
static void addBubble(const char* text, bool user) {
  if (!chat_list) return;
  lv_obj_t* row = lv_obj_create(chat_list);
  lv_obj_remove_style_all(row);
  lv_obj_set_size(row, lv_pct(100), LV_SIZE_CONTENT);
  lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(row, user ? LV_FLEX_ALIGN_END : LV_FLEX_ALIGN_START,
                        LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START);
  lv_obj_t* b = lv_obj_create(row);
  lv_obj_set_size(b, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
  lv_obj_set_style_bg_color(b, user ? lv_color_hex(0x2e8b57) : lv_color_hex(0x222a26), 0);
  lv_obj_set_style_bg_opa(b, LV_OPA_COVER, 0);
  lv_obj_set_style_radius(b, 0, 0);
  lv_obj_set_style_border_width(b, 0, 0);
  lv_obj_set_style_pad_all(b, 6, 0);
  lv_obj_t* l = lv_label_create(b);
  lv_label_set_long_mode(l, LV_LABEL_LONG_WRAP);
  lv_obj_set_width(l, 172);
  lv_label_set_text(l, text);
  lv_obj_set_style_text_color(l, lv_color_white(), 0);
  lv_obj_set_style_text_font(l, &lv_font_montserrat_12, 0);
  disable_shadows(row);
  lv_obj_scroll_to_view_recursive(row, LV_ANIM_ON);
}

void chatAppendUser(const char* text) {
  if (!p_chat) { build_chat(); disable_shadows(p_chat); lv_obj_add_flag(p_chat, LV_OBJ_FLAG_HIDDEN); }
  addBubble(text, true);
}
void chatAppendAi(const char* text) {
  if (!p_chat) { build_chat(); disable_shadows(p_chat); lv_obj_add_flag(p_chat, LV_OBJ_FLAG_HIDDEN); }
  chatClearPending();
  addBubble(text, false);
}
void chatSetPending(const char* text) {
  chatClearPending();
  if (!chat_list) return;
  chat_pending = lv_label_create(chat_list);
  lv_label_set_text(chat_pending, text);
  lv_obj_set_style_text_color(chat_pending, lv_color_hex(0x888888), 0);
  lv_obj_set_style_text_font(chat_pending, &lv_font_montserrat_12, 0);
}
void chatClearPending() {
  if (chat_pending) { lv_obj_delete(chat_pending); chat_pending = nullptr; }
}

// -------- SMS / contacts --------
void smsAddIncoming(const char* from, const char* text) {
  if (!from) from = "unknown";
  // Cap at 10: the shift below pushes the OLDEST entry off the end.
  if (s_inbox_count >= 10) s_inbox_count = 9;
  // newest first
  for (int i = s_inbox_count; i > 0; --i) s_inbox[i] = s_inbox[i - 1];
  const char* nm = mb_name_for(from);
  s_inbox[0].from = from;
  s_inbox[0].name = nm ? nm : "";
  s_inbox[0].body = text ? text : "";
  s_inbox[0].read = false;
  s_inbox[0].at   = millis();
  s_inbox_count++;
  refresh_sms();
  toast("New message");
}

bool addContact(const char* name, const char* number) {
  bool ok = mb_save_contact(name, number);
  if (ok) refresh_sms();
  return ok;
}

void showIncomingCall(const char* from) {
  app_state::in_call   = true;
  app_state::call_from = from ? from : "Unknown";
  goTo(Page::Calling);
}

void endCall() {
  app_state::in_call = false;
  if (s_current == Page::Calling) goTo(Page::Home);
}

void wifiSetPortalInfo(const char* a, const char* b, const char* c) {
  if (wifi_l1) lv_label_set_text(wifi_l1, a);
  if (wifi_l2) lv_label_set_text(wifi_l2, b);
  if (wifi_l3) lv_label_set_text(wifi_l3, c);
}

void toast(const char* text) {
  lv_obj_t* pop = lv_obj_create(lv_layer_top());
  lv_obj_set_size(pop, 200, 70);
  lv_obj_center(pop);
  lv_obj_set_style_radius(pop, 0, 0);
  lv_obj_set_style_bg_color(pop, lv_color_hex(0x111111), 0);
  lv_obj_set_style_bg_opa(pop, LV_OPA_COVER, 0);
  lv_obj_set_style_border_width(pop, 1, 0);
  lv_obj_set_style_border_color(pop, lv_color_hex(0x2e8b57), 0);
  lv_obj_set_style_shadow_width(pop, 0, 0);
  lv_obj_t* l = lv_label_create(pop);
  lv_label_set_long_mode(l, LV_LABEL_LONG_WRAP);
  lv_obj_set_width(l, 180);
  lv_label_set_text(l, text);
  lv_obj_set_style_text_color(l, lv_color_white(), 0);
  lv_obj_center(l);
  disable_shadows(pop);
  lv_timer_create([](lv_timer_t* tm) {
    lv_obj_t* o = (lv_obj_t*)lv_timer_get_user_data(tm);
    if (o) lv_obj_delete(o);
    lv_timer_delete(tm);
  }, 1500, pop);
}

} // namespace ui
