#!/bin/bash
# Seeed voicecard (AC108 4-mic) installer, ported for Linux 6.12 - 6.18
# and Raspberry Pi 5 / Raspberry Pi OS Trixie.
set -e

if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)" 1>&2
   exit 1
fi

ver="0.4"
uname_r=$(uname -r)
cd "$(dirname "$(readlink -f "$0")")"

OVERLAYS=/boot/overlays
[ -d /boot/firmware/overlays ] && OVERLAYS=/boot/firmware/overlays
CONFIG=/boot/config.txt
[ -f /boot/firmware/config.txt ] && CONFIG=/boot/firmware/config.txt

if [ ! -d "$OVERLAYS" ]; then
  echo "$OVERLAYS not found - is this a Raspberry Pi?" 1>&2
  exit 1
fi

# Raspberry Pi 5 (BCM2712) needs the RP1 clock-consumer I2S block.
IS_PI5=0
grep -qi "Raspberry Pi 5" /proc/device-tree/model 2>/dev/null && IS_PI5=1
if [ $IS_PI5 = 1 ]; then
  CARD_OVERLAY=seeed-4mic-voicecard-pi5
else
  CARD_OVERLAY=seeed-4mic-voicecard
fi
echo "== target overlay: $CARD_OVERLAY (kernel $uname_r)"

# --- packages -------------------------------------------------------
if command -v apt >/dev/null; then
  apt update -y
  apt install -y dkms git i2c-tools libasound2-plugins device-tree-compiler \
                 "linux-headers-$uname_r" || \
  apt install -y dkms git i2c-tools libasound2-plugins device-tree-compiler \
                 linux-headers-rpi-2712 linux-headers-rpi-v8
fi

if [ ! -d "/lib/modules/$uname_r/build" ]; then
  echo "Error: kernel headers for $uname_r are missing." 1>&2
  echo "Install them (linux-headers-$uname_r) and re-run." 1>&2
  exit 1
fi

# --- build + install the modules via DKMS ---------------------------
mod=seeed-voicecard
if [[ -e /usr/src/$mod-$ver || -e /var/lib/dkms/$mod/$ver ]]; then
  dkms remove --force -m $mod -v $ver --all || true
  rm -rf /usr/src/$mod-$ver
fi
mkdir -p /usr/src/$mod-$ver
cp -a ./* /usr/src/$mod-$ver/
dkms add -m $mod -v $ver
dkms build -k "$uname_r" -m $mod -v $ver
dkms install --force -k "$uname_r" -m $mod -v $ver

# --- overlays -------------------------------------------------------
if command -v dtc >/dev/null; then ./builddtbo.sh; fi
cp -f ./*.dtbo "$OVERLAYS"/

# --- module autoload ------------------------------------------------
for m in snd-soc-seeed-voicecard snd-soc-ac108 snd-soc-wm8960; do
  grep -q "^$m$" /etc/modules || echo "$m" >> /etc/modules
done

# --- boot config ----------------------------------------------------
sed -i -e 's:^#dtparam=i2c_arm=on:dtparam=i2c_arm=on:g' "$CONFIG" || true
grep -q "^dtparam=i2c_arm=on" "$CONFIG" || echo "dtparam=i2c_arm=on" >> "$CONFIG"
if [ $IS_PI5 = 0 ]; then
  grep -q "^dtparam=i2s=on$" "$CONFIG" || echo "dtparam=i2s=on" >> "$CONFIG"
  grep -q "^dtoverlay=i2s-mmap$" "$CONFIG" || echo "dtoverlay=i2s-mmap" >> "$CONFIG"
fi
# drop any previous seeed overlay line, then add the right one
sed -i -e '/^dtoverlay=seeed-.*voicecard.*$/d' "$CONFIG"
echo "dtoverlay=$CARD_OVERLAY" >> "$CONFIG"

# --- alsa state / service -------------------------------------------
mkdir -p /etc/voicecard
cp -f ./*.conf  /etc/voicecard/
cp -f ./*.state /etc/voicecard/
cp -f seeed-voicecard /usr/bin/
cp -f seeed-voicecard.service /lib/systemd/system/
systemctl enable seeed-voicecard.service

echo "-------------------------------------------------------"
echo " Installed. Reboot, then check:"
echo "   arecord -l          # expect card seeed-4mic-voicecard"
echo "   sudo i2cdetect -y 1 # expect 3b"
echo "-------------------------------------------------------"
