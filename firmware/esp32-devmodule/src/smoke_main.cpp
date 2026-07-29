#ifdef MIND_BUDDY_SMOKE_TEST

#include <Arduino.h>
#include <esp_system.h>

#ifdef MIND_BUDDY_TFT_SMOKE_TEST
#include <TFT_eSPI.h>

static TFT_eSPI tft = TFT_eSPI();
#endif

#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(LED_BUILTIN, OUTPUT);

  Serial.println();
  Serial.println(F("========================================"));
  Serial.println(F("[smoke] ESP32 DevKit booted"));
  Serial.printf("[smoke] reset_reason=%d\n", (int)esp_reset_reason());
  Serial.printf("[smoke] free_heap=%u\n", (unsigned)ESP.getFreeHeap());
  Serial.println(F("[smoke] LED should toggle once per second"));

#ifdef MIND_BUDDY_TFT_SMOKE_TEST
  Serial.println(F("[smoke] TFT_eSPI begin() ..."));
  tft.begin();
  tft.setRotation(0);
#ifdef TFT_BL
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, TFT_BACKLIGHT_ON);
  Serial.printf("[smoke] TFT_BL GPIO%d set to %s\n", TFT_BL, TFT_BACKLIGHT_ON == HIGH ? "HIGH" : "LOW");
#endif
  tft.fillScreen(TFT_RED);
  delay(500);
  tft.fillScreen(TFT_GREEN);
  delay(500);
  tft.fillScreen(TFT_BLUE);
  delay(500);
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextSize(2);
  tft.setCursor(12, 24);
  tft.println("MindBuddy");
  tft.setCursor(12, 54);
  tft.println("TFT OK");
  tft.setCursor(12, 94);
  tft.setTextSize(1);
  tft.println("Using current TFT_eSPI");
  tft.println("User_Setup.h");
  Serial.println(F("[smoke] TFT pattern drawn"));
#endif

  Serial.println(F("========================================"));
}

void loop() {
  static bool on = false;
  static uint32_t last = 0;

  uint32_t now = millis();
  if (now - last >= 1000) {
    last = now;
    on = !on;
    digitalWrite(LED_BUILTIN, on ? HIGH : LOW);
    Serial.printf("[smoke] up=%lus heap=%u led=%s\n",
                  (unsigned long)(now / 1000),
                  (unsigned)ESP.getFreeHeap(),
                  on ? "on" : "off");
  }
}

#endif