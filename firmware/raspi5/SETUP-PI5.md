# MindBuddy — Raspberry Pi 5 plug-and-play setup

The **Pi 5 is the master**: it owns the touchscreen UI, the LLM, STT/TTS,
medication alarms, Supabase sync and music. The **LilyGo board is now only a
radio peripheral** — calls, SMS and cellular status. If the LilyGo is
unplugged, everything except calls/SMS still works.

## 1. Flash and boot

Raspberry Pi OS **Trixie 64-bit (Desktop)** on a Pi 5, connected to your
DSI/HDMI touchscreen. Enable I2C and the header UART:

```bash
sudo raspi-config nonint do_i2c 0
sudo raspi-config nonint do_serial_hw 0
sudo raspi-config nonint do_serial_cons 1   # console OFF, port free for the LilyGo
```

## 2. Get the code and run the installer

```bash
git clone <your-repo> ~/MindBuddy
cd ~/MindBuddy/firmware/raspi5
./install.sh
```

The installer creates `.venv`, installs everything, **renders the screen and
icon assets into `firmware/raspi5/assets/`** and copies `.env.example` to
`.env`.

## 3. Assets — where they live

Already generated and committed:

```
firmware/raspi5/assets/
├── screens/   splash home modes mood chat pipeline keypad sms volume meds music voice  (280x320 PNG)
└── icons/     back home chat sos mic play pause next prev net nonet bat* spotify radio … (32x32 PNG)
```

Re-render at any time (edit colours/layout in `firmware/tools/render_screens.py`):

```bash
./.venv/bin/python ../tools/render_screens.py --out ./assets
```

The UI scales the 280x320 design to your panel and letterboxes it, so any
resolution works. Rotate with `UI_ROTATE=90|180|270` in `.env`.

## 4. Microphone + speaker

4-mic AC108 array: `cd seeed-voicecard-pi5 && sudo ./install.sh && sudo reboot`,
then check `arecord -l` and set `ALSA_IN` / `ALSA_OUT` in `.env`.

## 5. Models (LLM, STT, TTS)

```bash
cd ~/MindBuddy/firmware/raspi5/models
wget https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf -O llama-3.2-3b-instruct-q4_k_m.gguf
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
mkdir -p kokoro && cd kokoro
wget https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/kokoro-v0_19.onnx
wget https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/voices.bin
```

Cloud LLM (faster when online) is optional: put `GROQ_API_KEY` in `.env` and
leave `DEFAULT_PIPELINE=auto`.

## 6. Spotify music

1. Premium account required.
2. Spotify Connect audio device:
   ```bash
   curl -sSL https://sh.rustup.rs | sh -s -- -y
   cargo install librespot --no-default-features --features alsa-backend
   ```
3. In `.env` set `SPOTIFY_USERNAME` / `SPOTIFY_PASSWORD` (librespot playback)
   and, for transport control, a Web API app from
   <https://developer.spotify.com/dashboard>: `SPOTIFY_CLIENT_ID`,
   `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` (scopes
   `user-read-playback-state user-modify-playback-state`).

Without Spotify credentials the Music page plays curated internet radio via
`mpv` — tap the source badge (top right) to switch Radio ⇄ Spotify.

## 7. Run

```bash
cd ~/MindBuddy/firmware/raspi5
./.venv/bin/python -m mindbuddy.main            # foreground
sudo cp systemd/mindbuddy.service /etc/systemd/system/
sudo systemctl enable --now mindbuddy           # on boot
journalctl -u mindbuddy -f
```

Windowed dev run on a desktop: `UI_FULLSCREEN=0 UI_WIDTH=560 UI_HEIGHT=640`.

## 8. Touch map

| Page | Taps |
|---|---|
| Home | 6 tiles (Chat, Modes, Mood, Meds, Music, Voice), hold SOS card 2 s, bottom nav |
| Chat | mic = wake/listen, speaker = volume, quick chips, live waveform |
| Modes / Mood / Pipeline / Voice | tap a row to select (mirrored to Supabase) |
| Meds | toggle each alarm, `+ ADD ALARM` |
| Music | prev / play-pause / next, source badge toggles Spotify ⇄ Radio |
| Keypad / SMS | dial + call and quick caregiver alerts — relayed to the LilyGo |
| Any sub-page | back arrow, top-left |

Every tap emits the same JSON the LilyGo used to send (`mode_set`,
`mood_set`, `music_cmd`, `sos_trigger`, …), so the Pi handles UI and radio
input through one code path.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Blank window, log says "no screen artwork" | run the renderer (step 3) |
| `pygame.error: No available video device` | run on the desktop session, or `sudo usermod -aG video,render $USER` and re-login |
| UI upside down | `UI_ROTATE=180` |
| No mic | `arecord -l`, fix `ALSA_IN` |
| Spotify silent | `librespot` not installed or free account — falls back to radio |
| No calls/SMS | LilyGo unplugged or wrong `SERIAL_PORT` (Pi 5 = `/dev/ttyAMA10`) |
