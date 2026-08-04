# seeed-voicecard (AC108 4-mic) — Raspberry Pi 5 / Linux 6.18 port

Ported build of the Seeed Voicecard driver for the **LC Technology
RPI_AC108 4-microphone array** on **Raspberry Pi 5 / Raspberry Pi OS
Trixie (Linux 6.12 – 6.18)**.

## Install

```bash
tar xzf seeed-voicecard-pi5.tar.gz
cd seeed-voicecard-pi5
sudo ./install.sh
sudo reboot
```

Verify after reboot:

```bash
sudo i2cdetect -y 1   # 3b  -> codec present
arecord -l            # card: seeed-4mic-voicecard, 4 channels
dmesg | grep -i ac108
arecord -D plughw:seeed4micvoicec -f S16_LE -r 16000 -c 4 -d 3 /tmp/t.wav
```

Then set in `firmware/raspi5/.env`:

```env
ALSA_IN=plughw:seeed4micvoicec
MIC_CHANNELS=4
```

## What was changed vs. upstream

All kernel-API differences are isolated in the new **`kernel-compat.h`**
shim, so the tree still builds on older kernels.

| Area | Old API | Ported to |
|---|---|---|
| PCM runtime index | `rtd->num` | `rtd->id` (`seeed_rtd_num()`) |
| CPU/codec DAI lookup | `asoc_rtd_to_cpu/codec()` | `snd_soc_rtd_to_cpu/codec()` |
| DAI activity | `dai->stream_active[x]` | `snd_soc_dai_stream_active(dai, x)` |
| Codec-to-codec params | `dai_link->params/num_params` | `c2c_params/num_c2c_params` |
| simple-card helpers | `asoc_simple_*` | `simple_util_*` (v6.7 rename) |
| daifmt parsing | `asoc_simple_parse_daifmt()` | local `seeed_parse_daifmt()` on `snd_soc_daifmt_parse_*()` |
| dailink naming | `asoc_simple_set_dailink_name()` | local `seeed_set_dailink_name()` (new upstream signature needs `simple_util_priv`) |
| Clock master flags | `SND_SOC_DAIFMT_CBM_CFM` / `CBS_CFS` | `SND_SOC_DAIFMT_CBP_CFP` / `CBC_CFC` |
| Mixer macro | `SOC_SINGLE_VALUE(reg,shift,max,inv,chip)` | `SOC_SINGLE_VALUE(reg,shift,0,max,inv,chip)` via `SEEED_SOC_SINGLE_VALUE()` |
| IRQ context test | `in_irq()` | `in_hardirq()` |
| i2c probe | `probe(client, id)` | `probe(client)` + `i2c_client_get_device_id()` |
| platform remove | `int remove()` | `void remove()` (v6.11) |
| headers | `linux/of_gpio.h` (deleted in v6.15) | removed |
| DKMS | back-to-v4.19/5.4/5.8 patches | dropped (they no longer apply) |

Files touched: `seeed-voicecard.c`, `ac108.c`, `ac101.c`, `wm8960.c`,
new `kernel-compat.h`, new `dkms.conf`, new `install.sh`.

## Raspberry Pi 5 device tree

The stock overlay targets `&i2s`, which on BCM2712 is the RP1
**clock-producer** block. The AC108 is the bit-clock/frame master, so the
Pi must be the clock *consumer*. The new
`seeed-4mic-voicecard-pi5-overlay.dts` targets `&i2s_clk_consumer`
(same GPIO18–21 pins) and is compiled to
`seeed-4mic-voicecard-pi5.dtbo`. `install.sh` detects the Pi 5 from
`/proc/device-tree/model` and writes `dtoverlay=seeed-4mic-voicecard-pi5`
to `config.txt` (and skips the bcm2835-only `dtparam=i2s=on` /
`i2s-mmap`).

## Troubleshooting

- **`dkms build` fails with missing headers** — install
  `linux-headers-$(uname -r)`; on Pi 5 that is the `rpi-2712` flavour.
- **Card missing but `i2cdetect` shows `3b`** — the overlay did not load:
  check `dtoverlay=seeed-4mic-voicecard-pi5` in `/boot/firmware/config.txt`
  and `sudo vcdbg log msg` / `dmesg | grep -i overlay`.
- **Capture is silent** — `alsamixer -c seeed4micvoicec`, unmute and raise
  the four AC108 ADC/PGA channels, then `sudo alsactl store`.

## Kernel 6.18 fixes (Aug 2026)

Build failures on `6.18.39+rpt-rpi-2712` were caused by three things:

1. `ac108.c` never included `kernel-compat.h`, so `SEEED_SOC_SINGLE_VALUE()`
   and `SEEED_I2C_PROBE_ARGS()` were undefined (`implicit declaration`,
   `initializer element is not constant`, `unknown type name`).
   The include is now added next to `ac10x.h`.
2. `snd_soc_of_get_dai_name()` gained an `index` argument in v6.7. Call sites
   now go through the new `seeed_of_get_dai_name()` shim.
3. `asoc_simple_parse_card_name()` was renamed to `simple_util_parse_card_name()`
   in v6.7 and takes a `struct simple_util_priv` this card driver does not use.
   `kernel-compat.h` now provides a local `seeed_parse_card_name()` equivalent.

Rebuild after pulling:

```bash
cd ~/Desktop/MindBuddy/firmware/raspi5/seeed-voicecard-pi5
sudo dkms remove seeed-voicecard/0.4 --all 2>/dev/null || true
sudo ./install.sh
sudo reboot
```
