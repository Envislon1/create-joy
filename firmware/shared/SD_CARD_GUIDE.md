# MindBuddy — microSD card + TFT asset guide

The UI artwork (splash, both home pages, chat, music, keypad, calling and all
icons) is **not** compiled into the firmware. It lives on a microSD card and is
streamed by LVGL at runtime. That keeps the firmware small, lets you restyle the
device without reflashing, and is the only way the non-PSRAM ESP32 DevKit can
show full-screen artwork at all.

Both boards behave identically: **if there is no card, the firmware still boots
and every page still works** — it just draws flat coloured panels instead of the
artwork. Nothing is bricked by a missing or unreadable card.

---

## 1. Card requirements

| Item        | Requirement                                                        |
|-------------|--------------------------------------------------------------------|
| Type        | microSD or microSDHC, **≤ 32 GB** (SDXC/exFAT is not supported)     |
| Filesystem  | **FAT32**, MBR partition table (not GPT, not exFAT, not APFS)       |
| Allocation  | 32 KB cluster is fine; defaults are fine                            |
| Speed class | Class 10 / U1. Anything slower makes page transitions visibly crawl |
| Names       | Keep them lowercase; `mindbuddy/`, `home1.bin`, `icons/back.bin`    |

Format it first:

- **Windows** — right-click the drive → Format → File system **FAT32** → Quick format.
  (For cards over 32 GB Windows hides FAT32; use the official *SD Card Formatter*
  tool, or just use a smaller card.)
- **macOS** — Disk Utility → View → *Show All Devices* → select the **card**, not
  the volume → Erase → Format **MS-DOS (FAT)**, Scheme **Master Boot Record**.
- **Linux** — `sudo mkfs.vfat -F 32 -n MINDBUDDY /dev/sdX1`

---

## 2. Generate the assets

From the repository root, with Pillow installed (`pip install pillow`):

```bash
python3 firmware/tools/convert_assets.py \
  --src "MindBuddy Assets/TFT Assets" \
  --out build/sdcard/mindbuddy
```

The converter finds each source image by name (case-insensitive, any of
`.png .gif .jpg .bmp .webp`, animated GIFs use frame 1), scales the backgrounds
to the 240×320 panel, and writes LVGL v9 RGB565 binaries.

If colours come out right but everything is *inverted* (orange skin, blue
becomes brown), re-run with `--no-swap`.

---

## 3. Directory layout on the card

Copy the generated `mindbuddy` folder to the **root** of the card. The final
layout must be exactly:

```
/                       <- card root
└── mindbuddy/
    ├── splash.bin      Splash / boot screen
    ├── home1.bin       Home page 1  (message, meds, music, vol, TTS, voice, SOS)
    ├── home2.bin       Home page 2  (pipeline, mood, chat + six support modes)
    ├── ai.bin          Chat / AI response page
    ├── music.bin       Music player page
    ├── keypad.bin      Dial pad page
    ├── calling.bin     In-call page
    └── icons/
        ├── back.bin    Back arrow (top-left on every sub-page)
        ├── net.bin     Online
        ├── nonet.bin   Offline
        ├── play.bin
        ├── pause.bin
        ├── batlow.bin  < 25 %
        ├── bat25.bin   25–37 %
        ├── bat50.bin   38–62 %
        ├── bat75.bin   63–87 %
        ├── bat100.bin  ≥ 88 %
        └── batchg.bin  charging (overrides the level icons)
```

Anything else on the card is ignored. Do **not** nest `mindbuddy/` inside another
folder, and do not let macOS `.DS_Store` / `._` shadow files worry you — they are
skipped.

> macOS tip: after copying, run `dot_clean /Volumes/MINDBUDDY` and eject
> properly, otherwise the resource-fork twins can slow down directory scans.

---

## 4. Installing the card in the hardware

### 4.1 LilyGo T-A7670G-S3

1. **Power the board off and unplug USB.** Hot-inserting a card while the SPI
   bus is active is the most common cause of a corrupted card.
2. The TFT breakout carries the slot on the back. Contacts face the **PCB**;
   push until it clicks (push-push slot — press again to release; never pull).
3. Wiring (already set in `firmware/lilygo/include/config.h`) — the card shares
   the panel's SPI bus and only needs its own chip select:

   | SD pin | ESP32-S3 | Note                          |
   |--------|----------|-------------------------------|
   | SCK    | GPIO12   | shared with TFT SCLK          |
   | MISO   | GPIO13   | shared with TFT MISO          |
   | MOSI   | GPIO11   | shared with TFT MOSI          |
   | CS     | GPIO15   | **dedicated**, `MB_SD_CS`     |
   | VCC    | 3V3      | *not* 5 V                     |
   | GND    | GND      | common ground                 |

### 4.2 ESP32 DevKit-V1 bench board

Same story on VSPI (SCK 18 / MISO 19 / MOSI 23), with `MB_SD_CS` on **GPIO25**.
If your shield breaks the slot out to a different CS pin, change `MB_SD_CS` in
`firmware/esp32-devmodule/include/config.h` — that single define is all the
firmware needs.

### 4.3 If your slot has its own SPI bus

Set `MB_SD_SCK`, `MB_SD_MISO`, `MB_SD_MOSI` alongside `MB_SD_CS` in `config.h`.
When those are left undefined the firmware reuses the already-initialised bus.

---

## 5. Verifying it worked

Flash, open the serial monitor at 115200 and watch the boot lines:

```
[tft] begin
[tft] initialized
[sd] mounted, 15193 MB
[ui] assets: SD
```

Failure modes and what they mean:

| Serial line                                   | Cause / fix                                                        |
|-----------------------------------------------|--------------------------------------------------------------------|
| `[sd] disabled (MB_SD_CS not set)`            | `MB_SD_CS` is `-1` in `config.h`                                    |
| `[sd] mount FAILED`                           | Wrong CS pin, card not FAT32, 5 V on VCC, or bad/long jumper wires  |
| `[sd] no card detected`                       | Card not seated, or slot contacts dirty                             |
| `[sd] /mindbuddy missing`                     | Folder nested one level too deep, or misspelled/capitalised         |
| Mounts fine but pages are flat colours        | `.bin` files missing/misnamed, or `LV_CACHE_DEF_SIZE` is 0 in that board's `lv_conf.h` (must be non-zero or LVGL refuses to decode) |
| Artwork shows but colours are inverted        | Re-run the converter with `--no-swap`                               |

Lower `MB_SD_FREQ` to `10000000` if the card mounts intermittently on long
breadboard wiring.

---

## 6. Updating artwork later

Re-run the converter, drop the new `.bin` files on the card, power-cycle the
board. No reflash needed — the firmware reads the card on every boot.
