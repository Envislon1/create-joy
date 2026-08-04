#!/usr/bin/env bash
# MindBuddy Pi 5 — one-shot plug-and-play installer.
#   cd ~/MindBuddy/firmware/raspi5 && ./install.sh
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

echo "== 1/5 system packages"
sudo apt update
sudo apt install -y python3-venv python3-pip python3-dev libsdl2-2.0-0 \
  libsdl2-image-2.0-0 libsdl2-ttf-2.0-0 libportaudio2 portaudio19-dev \
  alsa-utils mpv ffmpeg fonts-dejavu-core i2c-tools python3-pil

echo "== 2/5 python environment"
[ -d .venv ] || python3 -m venv .venv
./.venv/bin/pip install --upgrade pip wheel
./.venv/bin/pip install -r requirements.txt

echo "== 3/5 screen + icon assets"
./.venv/bin/python ../tools/render_screens.py --out ./assets

echo "== 4/5 config"
[ -f .env ] || { cp .env.example .env; echo "   created .env — edit it before first run"; }
mkdir -p models

echo "== 5/5 optional Spotify Connect (librespot)"
if ! command -v librespot >/dev/null; then
  echo "   librespot not installed. For Spotify audio run:"
  echo "     curl -sSL https://sh.rustup.rs | sh -s -- -y && \\"
  echo "     cargo install librespot --no-default-features --features alsa-backend"
fi

echo
echo "Done. Start it with:"
echo "  ./.venv/bin/python -m mindbuddy.main"
echo "Install as a service:"
echo "  sudo cp systemd/mindbuddy.service /etc/systemd/system/ && sudo systemctl enable --now mindbuddy"
