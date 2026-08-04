#!/usr/bin/env python3
"""Export the dark Pi 5 touch UI as separated layers.

Three layers are written, so a TFT can blit a static page background once and
then draw only the parts that change at runtime:

  screens/    static page backgrounds  (chrome only: cards, labels, frames)
  dynamic/    transparent runtime assets (icons, avatars, toggles, battery…)
  previews/   fully-composed reference renders (design review only)
  layout.json placement manifest (design-grid coords + pixel coords at scale)

    python3 firmware/tools/export_ui.py --out firmware/raspi5/assets/ui --scale 4
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "raspi5"))

import pygame  # noqa: E402
from mindbuddy.ui.app import HOME_TILES, TouchUI, UiState  # noqa: E402
from mindbuddy.ui.theme import (AMBER, CARD, CARD2, CYAN, DESIGN_H, DESIGN_W,  # noqa: E402
                                BG, FAINT, INK, LINE, OK, PURPLE, PURPLE2, RED,
                                SUB, TINT, WHITE)

PAGES = ["splash", "home", "chat", "modes", "mood", "pipeline", "keypad",
         "sms", "volume", "meds", "music", "voice"]


def demo_state() -> UiState:
    s = UiState()
    s.user_name = "Alex"
    s.mode, s.mood, s.pipeline, s.voice = "ANXIETY", "GOOD", "auto", "af_bella"
    s.online, s.battery, s.signal_bars, s.clock = True, 82, 3, "09:41"
    s.volume, s.muted = 70, False
    s.music_playing = True
    s.music_title, s.music_artist = "Still Lake", "Ambient Synth Engine"
    s.music_source = "radio"
    s.caregiver_name, s.caregiver_number = "Caregiver", "+15551234567"
    s.dial = "988"
    s.meds = [{"label": "Sertraline", "hour": 8, "minute": 0, "enabled": True},
              {"label": "Melatonin", "hour": 21, "minute": 30, "enabled": True},
              {"label": "Vitamin D", "hour": 8, "minute": 0, "enabled": False}]
    s.chat = [("ai", "Hi Alex, I'm here with you. How are you feeling this morning?"),
              ("user", "A bit anxious this morning."),
              ("ai", "That's okay. Let's take one slow breath together — in for four, out for six.")]
    return s


def chrome_state() -> UiState:
    """Empty state: painters draw page chrome only, no live values."""
    s = UiState()
    s.chrome_only = True
    s.user_name = ""
    s.mode = s.mood = s.pipeline = s.backend = s.voice = ""
    s.clock = ""
    s.battery = -1            # suppresses the whole live status bar
    s.signal_bars = 0
    s.music_title = s.music_artist = s.music_source = ""
    s.caregiver_name = s.caregiver_number = ""
    s.dial = ""
    s.meds, s.chat = [], []
    return s


# --------------------------------------------------------------- dynamic set
def dynamic_assets(ui: TouchUI, sc: float) -> dict[str, tuple]:
    """name -> (draw_fn(surface), design-grid box) for every runtime overlay."""
    d: dict[str, tuple] = {}

    def add(name, box, fn):
        d[name] = (fn, box)

    # home tile glyphs (32x32 design box, centred)
    for label, page, col in HOME_TILES:
        key = "sos" if page == "__sos__" else page
        filled = page in ("chat", "__sos__")
        add(f"icon_{label.lower()}", (0, 0, 32, 32),
            lambda c, k=key, cc=(WHITE if filled else col): ui._tile_glyph(c, k, (16, 16), cc))
        add(f"icon_{label.lower()}_accent", (0, 0, 32, 32),
            lambda c, k=key, cc=col: ui._tile_glyph(c, k, (16, 16), cc))

    # avatars
    def _avatar(c, r):
        ui._circle(c, TINT, (r, r), r)
        ui._circle(c, PURPLE, (r, r), r, 2)
        ui._circle(c, PURPLE2, (r, r), r * 0.4)
    add("avatar_lg", (0, 0, 40, 40), lambda c: _avatar(c, 20))
    add("avatar_sm", (0, 0, 22, 22), lambda c: _avatar(c, 11))

    # status bar pieces
    for n in range(5):
        def bars(c, n=n):
            for i in range(4):
                h = 3 + i * 2.5
                ui._rect(c, WHITE if i < n else (60, 70, 96), (i * 5, 15 - h, 3, h), 1)
        add(f"signal_{n}", (0, 0, 20, 16), bars)
    for lvl in (0, 25, 50, 75, 100):
        def batt(c, lvl=lvl, chg=False):
            w = 18 * lvl / 100
            col = CYAN if chg else (OK if lvl > 25 else RED)
            if w >= 1:
                ui._rect(c, col, (2, 2, w, 7), 2)
        add(f"battery_{lvl}", (0, 0, 22, 11), batt)
    add("battery_charging", (0, 0, 22, 11),
        lambda c: ui._rect(c, CYAN, (2, 2, 12, 7), 2))
    add("net_online", (0, 0, 20, 12), lambda c: ui._text(c, "4G", (0, 0), "bold", 8, WHITE))
    add("net_offline", (0, 0, 20, 12), lambda c: ui._text(c, "OFF", (0, 0), "bold", 8, FAINT))

    # toggles / radios / selection
    add("toggle_on", (0, 0, 40, 22), lambda c: ui._toggle(c, 0, 0, True))
    add("toggle_off", (0, 0, 40, 22), lambda c: ui._toggle(c, 0, 0, False))

    def radio(c, on):
        ui._circle(c, PURPLE if on else (70, 82, 110), (8, 8), 7, 0 if on else 2)
        if on:
            ui._circle(c, WHITE, (8, 8), 3)
    add("radio_on", (0, 0, 16, 16), lambda c: radio(c, True))
    add("radio_off", (0, 0, 16, 16), lambda c: radio(c, False))

    # transport
    add("play", (0, 0, 24, 24), lambda c: ui._poly(c, WHITE, [(6, 3), (6, 21), (20, 12)]))
    def pause(c):
        ui._rect(c, WHITE, (5, 3, 5, 18), 2)
        ui._rect(c, WHITE, (14, 3, 5, 18), 2)
    add("pause", (0, 0, 24, 24), pause)
    def nxt(c):
        ui._poly(c, INK, [(4, 3), (4, 19), (14, 11)])
        ui._rect(c, INK, (15, 3, 3, 16), 1)
    add("next", (0, 0, 20, 22), nxt)
    def prv(c):
        ui._poly(c, INK, [(16, 3), (16, 19), (6, 11)])
        ui._rect(c, INK, (2, 3, 3, 16), 1)
    add("prev", (0, 0, 20, 22), prv)
    def spk(c, muted):
        ui._poly(c, RED if muted else SUB,
                 [(0, 6), (0, 14), (6, 14), (12, 20), (12, 0), (6, 6)])
    add("speaker_on", (0, 0, 14, 20), lambda c: spk(c, False))
    add("speaker_muted", (0, 0, 14, 20), lambda c: spk(c, True))

    # slider knob
    def knob(c):
        ui._circle(c, WHITE, (9, 9), 9)
        ui._circle(c, PURPLE, (9, 9), 9, 2)
    add("slider_knob", (0, 0, 18, 18), knob)

    # mic / send
    def mic(c):
        ui._circle(c, PURPLE, (9, 9), 9)
        ui._rect(c, WHITE, (7, 5, 4, 7), 2)
    add("mic", (0, 0, 18, 18), mic)
    def send(c):
        ui._circle(c, PURPLE, (11, 11), 11)
        ui._poly(c, WHITE, [(7, 6), (17, 11), (7, 16)])
    add("send", (0, 0, 22, 22), send)

    # chat waveform (4 animation frames)
    for f in range(4):
        def wave(c, f=f):
            import math
            for i in range(44):
                a = abs(math.sin(i * 0.5 + f * 1.5)) * 8 + 1
                ui._line(c, PURPLE2 if i % 2 else CYAN,
                         (i * 6, 10 - a), (i * 6, 10 + a), 1.5)
        add(f"wave_{f}", (0, 0, 264, 20), wave)
    return d


# ------------------------------------------------------------------ manifest
def layout_manifest(sc: float) -> dict:
    tile = [{"name": label.lower(),
             "box": list(TouchUI._tile_rect(i)),
             "glyph": {"asset": f"icon_{label.lower()}", "center": [
                 TouchUI._tile_rect(i)[0] + TouchUI._tile_rect(i)[2] / 2,
                 TouchUI._tile_rect(i)[1] + 17]}}
            for i, (label, _p, _c) in enumerate(HOME_TILES)]
    return {
        "design": {"w": DESIGN_W, "h": DESIGN_H},
        "scale": sc,
        "note": "All coordinates are in the 280x320 design grid; multiply by "
                "'scale' for pixels in the exported PNGs.",
        "slots": {
            "statusbar": {
                "signal": [8, 5], "net": [32, 5], "clock": [DESIGN_W / 2, 11],
                "med": [196, 6], "battery_text": [240, 5], "battery": [246, 8],
            },
            "home": {"avatar": [14, 32], "greeting": [64, 56], "tiles": tile,
                     "mode_value": [22, 108], "mood_value": [154, 108]},
            "chat": {"avatar": [13, 29], "bubbles": [10, 74, 260, 152],
                     "wave": [8, 228], "send": [242, 274], "status": [DESIGN_W / 2, 238]},
            "meds": {"rows": [[10, 56 + i * 54, 260, 48] for i in range(4)],
                     "toggle": [214, 13]},
            "music": {"art": [92, 54, 96, 96], "transport": [140, 224],
                      "prev": [72, 226], "next": [208, 226],
                      "slider": [54, 269, 180, 8], "speaker": [30, 263]},
            "volume": {"value": [DESIGN_W / 2, 120], "slider": [40, 176, 200, 10]},
            "keypad": {"dial": [140, 48], "keys": [list(TouchUI._key_rect(i)) for i in range(12)]},
            "modes": {"rows": [[10, 52 + i * 36, 260, 32] for i in range(6)],
                      "radio": [250, 16]},
            "mood": {"cells": [list(TouchUI._mood_rect(i)) for i in range(7)]},
            "voice": {"rows": [[10, 50 + i * 30, 260, 26] for i in range(8)],
                      "play": [28, 13]},
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "..", "raspi5", "assets", "ui"))
    ap.add_argument("--scale", type=float, default=4.0)
    ap.add_argument("--no-previews", action="store_true")
    a = ap.parse_args()

    screens = os.path.join(a.out, "screens")
    dyn = os.path.join(a.out, "dynamic")
    prev = os.path.join(a.out, "previews")
    for p in (screens, dyn, prev):
        os.makedirs(p, exist_ok=True)

    pygame.init()
    pygame.font.init()
    w, h = int(DESIGN_W * a.scale), int(DESIGN_H * a.scale)
    pygame.display.set_mode((w, h))

    ui = TouchUI(assets_dir="", on_event=lambda _m: None, fullscreen=False, size=(w, h))
    ui._scr = pygame.display.get_surface()
    ui._sc = a.scale
    ui._canvas = pygame.Surface((w, h)).convert()
    ui._offset = (0, 0)
    ui._boot_at = time.time()

    def render(page: str, state: UiState) -> pygame.Surface:
        c = pygame.Surface((w, h)).convert()
        c.fill(BG)
        painter = getattr(ui, f"_paint_{page}", None)
        if painter is None:
            return c
        ui.page = page
        painter(c, state)
        if page != "splash":
            ui._paint_statusbar(c, state)
            ui._paint_nav(c, state)
        return c

    # 1. static backgrounds
    for page in PAGES:
        pygame.image.save(render(page, chrome_state()),
                          os.path.join(screens, f"{page}.png"))
        print(f"  screens/{page}.png")

    # 2. reference composites
    if not a.no_previews:
        demo = demo_state()
        for page in PAGES:
            pygame.image.save(render(page, demo), os.path.join(prev, f"{page}.png"))
        print(f"  previews/*.png ({len(PAGES)})")

    # 3. dynamic overlay assets (transparent)
    for name, (fn, box) in dynamic_assets(ui, a.scale).items():
        bw, bh = int(box[2] * a.scale), int(box[3] * a.scale)
        surf = pygame.Surface((bw, bh), pygame.SRCALPHA)
        fn(surf)
        pygame.image.save(surf, os.path.join(dyn, f"{name}.png"))
    print(f"  dynamic/*.png ({len(dynamic_assets(ui, a.scale))})")

    with open(os.path.join(a.out, "layout.json"), "w") as fh:
        json.dump(layout_manifest(a.scale), fh, indent=2)
    print("  layout.json")

    pygame.quit()
    print(f"\nDone -> {os.path.abspath(a.out)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
