#!/usr/bin/env python3
"""
MindBuddy — TFT asset converter.

Turns the artwork in `MindBuddy Assets/TFT Assets/` (PNG / JPG / GIF) into
LVGL v9 binary images (`.bin`, RGB565) laid out exactly the way the firmware
expects them on the microSD card:

    SD:/mindbuddy/
        splash.bin  home1.bin  home2.bin  ai.bin
        music.bin   keypad.bin calling.bin
        icons/
            back.bin  net.bin   nonet.bin  play.bin  pause.bin
            batlow.bin bat25.bin bat50.bin bat75.bin bat100.bin batchg.bin

Usage
-----
    python3 firmware/tools/convert_assets.py \
        --src "MindBuddy Assets/TFT Assets" \
        --out /Volumes/MINDBUDDY/mindbuddy

    # or build a folder locally and copy it to the card yourself
    python3 firmware/tools/convert_assets.py --out build/sdcard/mindbuddy

Options
-------
    --width/--height   panel size (default 240x320 — the ILI9341 portrait panel)
    --no-swap          write little-endian RGB565 instead of byte-swapped.
                       Use this ONLY if your panel shows correct geometry but
                       wrong colours (blue/orange inverted).

Requires Pillow:  pip install pillow
"""

from __future__ import annotations

import argparse
import struct
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required:  pip install pillow")

# LVGL v9 colour format id for RGB565
LV_COLOR_FORMAT_RGB565 = 0x12
LV_IMAGE_HEADER_MAGIC = 0x19

# Full-screen backgrounds: <output name> : [candidate source names]
BACKGROUNDS = {
    "splash":  ["splash"],
    "home1":   ["home1", "home"],
    "home2":   ["home2"],
    "ai":      ["ai", "chat"],
    "music":   ["music"],
    "keypad":  ["keypad", "dial"],
    "calling": ["calling", "call"],
}

# Icons keep their own size (they are composited over the background).
ICONS = [
    "back", "net", "nonet", "play", "pause",
    "batlow", "bat25", "bat50", "bat75", "bat100", "batchg",
]

EXTS = (".png", ".gif", ".jpg", ".jpeg", ".bmp", ".webp")


def find_source(root: Path, stem: str) -> Path | None:
    """Case-insensitive, extension-agnostic search anywhere under `root`."""
    target = stem.lower()
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in EXTS and path.stem.lower() == target:
            return path
    return None


def to_lvgl_bin(img: Image.Image, swap: bool) -> bytes:
    img = img.convert("RGB")
    w, h = img.size
    stride = w * 2
    header = struct.pack(
        "<BBHHHHH",
        LV_IMAGE_HEADER_MAGIC,
        LV_COLOR_FORMAT_RGB565,
        0,          # flags
        w,
        h,
        stride,
        0,          # reserved
    )
    out = bytearray(header)
    for r, g, b in img.getdata():
        px = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
        out += struct.pack(">H" if swap else "<H", px)
    return bytes(out)


def composite_frames(img: Image.Image) -> list[Image.Image]:
    """Flatten an animated GIF into a list of complete RGB frames.

    A GIF stores most frames as a small delta patch over the previous one, and
    many exported animations start with an empty (transparent / black) frame.
    Reading `img.convert("RGB")` straight after `seek()` therefore gives a
    black or blank picture — which is exactly what the splash and home pages
    showed on the panel. Painting each patch onto a persistent canvas gives the
    picture the viewer actually sees.
    """
    total = getattr(img, "n_frames", 1)
    canvas = Image.new("RGBA", img.size, (0, 0, 0, 255))
    frames: list[Image.Image] = []
    for i in range(total):
        img.seek(i)
        patch = img.convert("RGBA")
        canvas = Image.alpha_composite(canvas, patch)
        frames.append(canvas.convert("RGB"))
    return frames


def frame_score(frame: Image.Image) -> int:
    """Rough "how much is on this frame" measure — used to drop blank frames."""
    small = frame.resize((32, 32), Image.BILINEAR)
    px = list(small.getdata())
    lo = min(sum(p) for p in px)
    hi = max(sum(p) for p in px)
    return hi - lo


def prepare(frame: Image.Image, size: tuple[int, int] | None) -> Image.Image:
    if size and frame.size != size:
        return frame.resize(size, Image.LANCZOS)
    return frame


def convert(src: Path, dst: Path, swap: bool, size: tuple[int, int] | None) -> None:
    img = Image.open(src)
    if getattr(img, "is_animated", False):
        # Pick the busiest frame rather than frame 0 — animated artwork often
        # opens on an empty frame.
        frames = composite_frames(img)
        frame = max(frames, key=frame_score)
    else:
        frame = img
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(to_lvgl_bin(prepare(frame, size), swap))
    print(f"  {src.name:<24} -> {dst.relative_to(dst.parents[1])}  ({dst.stat().st_size / 1024:.0f} KB)")


def convert_animated(src: Path, dst: Path, swap: bool,
                     size: tuple[int, int] | None, max_frames: int) -> int:
    """Animated GIF -> name.bin, name_f01.bin, name_f02.bin ...

    The firmware cycles those frames with a timer (see mb_ui.inc), so no GIF
    decoder has to be linked into the ESP32 build. Frame 0 keeps the plain
    name, which means a firmware that ignores animation still shows artwork.
    """
    img = Image.open(src)
    if not getattr(img, "is_animated", False) or max_frames <= 1:
        convert(src, dst, swap, size)
        return 1

    frames = composite_frames(img)
    # Drop the blank lead-in frames so the first thing the panel shows is real
    # artwork (this is why splash.bin was pure black).
    best = max(frame_score(f) for f in frames)
    frames = [f for f in frames if frame_score(f) >= best * 0.35] or frames

    total = len(frames)
    # Even sampling so a 60-frame GIF still fits the SD card / RAM budget.
    n = min(max_frames, total)
    picks = sorted(dict.fromkeys(
        round(i * (total - 1) / max(n - 1, 1)) for i in range(n)
    ))
    stem = dst.stem
    dst.parent.mkdir(parents=True, exist_ok=True)
    # Remove stale frames from an earlier run with a higher --frames value.
    for old in dst.parent.glob(f"{stem}_f*.bin"):
        old.unlink()
    written = 0
    for i, frame_no in enumerate(picks):
        out = dst if i == 0 else dst.with_name(f"{stem}_f{i:02d}.bin")
        out.write_bytes(to_lvgl_bin(prepare(frames[frame_no], size), swap))
        written += 1
    print(f"  {src.name:<24} -> {stem}.bin +{written - 1} frames "
          f"({written * dst.stat().st_size / 1024:.0f} KB total)")
    return written


def main() -> int:
    ap = argparse.ArgumentParser(description="Convert MindBuddy TFT artwork to LVGL .bin")
    ap.add_argument("--src", default="MindBuddy Assets/TFT Assets",
                    help="folder containing the artwork (searched recursively)")
    ap.add_argument("--out", required=True, help="output folder, e.g. /Volumes/CARD/mindbuddy")
    ap.add_argument("--width", type=int, default=240)
    ap.add_argument("--height", type=int, default=320)
    ap.add_argument("--no-swap", action="store_true", help="little-endian RGB565")
    ap.add_argument("--frames", type=int, default=8,
                    help="max frames to export per animated GIF (1 = static first frame only)")
    args = ap.parse_args()

    src_root = Path(args.src)
    if not src_root.is_dir():
        return print(f"source folder not found: {src_root}") or 2
    out_root = Path(args.out)
    swap = not args.no_swap
    panel = (args.width, args.height)

    missing: list[str] = []

    print(f"backgrounds -> {panel[0]}x{panel[1]} RGB565{' (byte-swapped)' if swap else ''}")
    for name, candidates in BACKGROUNDS.items():
        found = next((p for c in candidates if (p := find_source(src_root, c))), None)
        if not found:
            missing.append(name)
            continue
        convert_animated(found, out_root / f"{name}.bin", swap, panel, args.frames)

    print("icons -> native size")
    for name in ICONS:
        found = find_source(src_root, name)
        if not found:
            missing.append(f"icons/{name}")
            continue
        convert(found, out_root / "icons" / f"{name}.bin", swap, None)


    if missing:
        print("\nMISSING (firmware falls back to drawn shapes for these):")
        for m in missing:
            print(f"  - {m}")
    print(f"\nDone. Copy the '{out_root.name}' folder to the SD card root.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
