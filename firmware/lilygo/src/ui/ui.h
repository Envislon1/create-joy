#pragma once
#include <lvgl.h>

namespace ui {
void begin();
void tick();

// Pages — 1:1 with the web TFT simulator (/tft-simulator).
//   Home     = Home page 1 (message / med / music / vol / tts / voice / SOS)
//   Home2    = Home page 2 (pipeline / mood / chat + six support modes)
//   Chat     = AI response page
//   Dial     = keypad page
//   Calling  = in-call page
// `Modes` is kept as an alias of Home2 so older call sites still compile.
enum class Page {
  Splash, WifiSetup, Home, Home2, Chat, Modes, Language,
  Meds, Music, Dial, Calling, Sms, Settings
};
void goTo(Page p);
Page current();
void back();  // used by the Talk button

// Chat helpers driven by link messages
void chatAppendUser(const char* text);
void chatAppendAi(const char* text);
void chatSetPending(const char* text);   // shows "thinking..." bubble
void chatClearPending();

// SMS / phone book (RAM only, max 10 entries each — same as the simulator)
void smsAddIncoming(const char* from, const char* text);
bool addContact(const char* name, const char* number);

// Call screen
void showIncomingCall(const char* from);
void endCall();

// Wifi setup screen text
void wifiSetPortalInfo(const char* line1, const char* line2, const char* line3);

// Small toast (used for errors)
void toast(const char* text);
}
