# MindBuddy — LilyGo 4G LTE (master)

Runs on the **LilyGo T-A7670G S3** (or T-SIM7600 variant) with the
**2.8" 320×240 resistive touch TFT (ILI9341 + XPT2046)**. This board is
the master: it owns the display UI (LVGL 9), the phone (calls + SMS),
Wi-Fi provisioning (WiFiManager), and the UART bridge to the
Raspberry Pi 5 that does the AI heavy lifting.

Wire protocol: see [`../shared/PROTOCOL.md`](../shared/PROTOCOL.md).

## Build

Uses **PlatformIO**.

```bash
cd firmware/lilygo
pio run
pio run -t upload
pio device monitor
```

Serial monitor is @ 115200. **The Pi ↔ LilyGo UART is on Serial1**
(not the USB serial), so monitoring USB does not interfere with the link.

## Wiring — Pi ↔ LilyGo

| LilyGo | Pi 5 GPIO | Signal |
|---|---|---|
| G17 (Serial1 TX) | GPIO15 (RXD) | LG→Pi |
| G18 (Serial1 RX) | GPIO14 (TXD) | Pi→LG |
| GND | GND | common |

Adjust `LINK_TX_PIN` / `LINK_RX_PIN` in `include/config.h` if you use a
different pair.

## UI pages (LVGL 9)

- **Splash** — WUF logo, firmware version, pairing code.
- **WiFi setup** — captive-portal instructions when WiFiManager is active.
- **Home** — clock, mode, network + AI-backend badges, big *Talk* button.
- **Chat** — scrolling user/AI bubbles fed by `chat_user` / `chat_ai_final`.
- **Modes** — Anxiety / Depression / PTSD / ADHD / Bipolar / Schizophrenia / General.
- **Medication** — list + add/edit reminders.
- **Music** — play / pause / next / prev + now-playing.
- **Dial pad** — full phone dialler + call log.
- **SMS** — inbox and compose.
- **Settings** — voice, volume 0–100, cloud toggle, factory reset.

Every screen is defined in `src/ui/pages/*.cpp`, registered in
`src/ui/ui.cpp`, and driven by state in `src/state.cpp` that mirrors what
comes in over UART.

## Talk button

The physical *Talk* button (BOOT / user button, pin defined in
`config.h`) doubles as **BACK** on any screen except Home — matching the
Healthco2Serial behaviour. Long-press = SOS.

## UI artwork (microSD)

Every page is the firmware twin of the web simulator at `/tft-simulator`, and
all of the artwork is streamed from a microSD card — chip select is GPIO15 (`MB_SD_CS`) on the shared FSPI bus.
Generate the card contents with:

```
python3 ../tools/convert_assets.py --src "../../MindBuddy Assets/TFT Assets" --out build/sdcard/mindbuddy
```

Full formatting, directory layout, wiring and troubleshooting steps are in
[`../shared/SD_CARD_GUIDE.md`](../shared/SD_CARD_GUIDE.md). Without a card the
firmware still boots and every page and touch region still works — it just draws
flat panels instead of the artwork.
