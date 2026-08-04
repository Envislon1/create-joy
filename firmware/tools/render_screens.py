#!/usr/bin/env python3
"""MindBuddy TFT asset renderer (Raspberry Pi 5 master UI).

Renders every 280x320 page background plus the icon set used by the Pi 5
pygame touch UI (firmware/raspi5/mindbuddy/ui).

    python3 firmware/tools/render_screens.py --out firmware/raspi5/assets

Output:
    <out>/screens/*.png   12 page backgrounds, 280x320 RGB
    <out>/icons/*.png     icon set, 32x32 RGBA

Only Pillow is required. Fonts are resolved from --fonts, then from the
usual system locations; if nothing is found the PIL bitmap font is used so
the render never hard-fails.
"""
from __future__ import annotations

import argparse
import math
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 280, 320

WHITE = (255, 255, 255)
INK = (16, 42, 66)
SUB = (104, 130, 152)
BLUE = (11, 99, 197)
BLUE2 = (30, 136, 229)
CYAN = (0, 184, 212)
TINT = (233, 243, 253)
LINE = (206, 224, 242)
OK = (22, 163, 110)
RED = (214, 45, 58)
AMBER = (230, 150, 20)

FONT_DIRS = [
    "/tmp/knowledge/skill/canvas-design/canvas-fonts",
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/truetype/liberation",
    "/Library/Fonts",
]
SANS_R = ["InstrumentSans-Regular.ttf", "DejaVuSans.ttf", "LiberationSans-Regular.ttf"]
SANS_B = ["InstrumentSans-Bold.ttf", "DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf"]
MONO_R = ["JetBrainsMono-Regular.ttf", "DejaVuSansMono.ttf", "LiberationMono-Regular.ttf"]
MONO_B = ["JetBrainsMono-Bold.ttf", "DejaVuSansMono-Bold.ttf", "LiberationMono-Bold.ttf"]

_extra_dirs: list[str] = []
_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def _find(names: list[str]) -> str | None:
    for d in _extra_dirs + FONT_DIRS:
        for n in names:
            p = os.path.join(d, n)
            if os.path.isfile(p):
                return p
    return None


def _font(names: list[str], size: int):
    key = (names[0], size)
    if key in _cache:
        return _cache[key]
    path = _find(names)
    f = ImageFont.truetype(path, size) if path else ImageFont.load_default()
    _cache[key] = f
    return f


R = lambda s: _font(SANS_R, s)      # noqa: E731
B = lambda s: _font(SANS_B, s)      # noqa: E731
M = lambda s: _font(MONO_R, s)      # noqa: E731
MB = lambda s: _font(MONO_B, s)     # noqa: E731


# ----------------------------------------------------------------- helpers
def new():
    im = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(im)
    for x in range(0, W, 10):
        d.line([(x, 24), (x, H)], fill=(247, 251, 255))
    for y in range(24, H, 10):
        d.line([(0, y), (W, y)], fill=(247, 251, 255))
    return im, d


def hgrad(d, y0, y1, c0, c1):
    for y in range(y0, y1):
        t = (y - y0) / max(1, (y1 - y0 - 1))
        d.line([(0, y), (W, y)], fill=tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3)))


def center(d, text, y, font, fill=INK, cx=W // 2):
    w = d.textlength(text, font=font)
    d.text((cx - w / 2, y), text, font=font, fill=fill)


def statusbar(d, clock="10:45", med="12:00", bars=4, batt=86, chg=False):
    """Static status-bar chrome. The Pi UI repaints this band live."""
    hgrad(d, 0, 22, BLUE, BLUE2)
    for i in range(4):
        h = 3 + i * 2.5
        x = 7 + i * 5
        c = WHITE if i < bars else (120, 175, 225)
        d.rectangle([x, 16 - h, x + 3, 16], fill=c)
    d.text((30, 5), "4G", font=B(9), fill=WHITE)
    d.text((48, 5), clock, font=MB(10), fill=WHITE)
    d.text((88, 6), "MED " + med, font=M(8), fill=(198, 226, 252))
    bx = 240
    d.rounded_rectangle([bx, 6, bx + 22, 16], 2, outline=WHITE, width=1)
    d.rectangle([bx + 23, 9, bx + 25, 13], fill=WHITE)
    fillw = int(20 * batt / 100)
    d.rectangle([bx + 1, 8, bx + 1 + fillw, 14], fill=(OK if not chg else CYAN))
    d.text((bx - 24, 5), f"{batt}%", font=M(9), fill=WHITE)


def titlebar(d, title, back=True):
    d.rectangle([0, 22, W, 48], fill=TINT)
    d.line([(0, 48), (W, 48)], fill=LINE)
    if back:
        d.polygon([(16, 35), (24, 29), (24, 41)], fill=BLUE)
        d.text((32, 28), title, font=B(14), fill=INK)
    else:
        d.text((14, 28), title, font=B(14), fill=INK)


def card(d, box, r=8, fill=WHITE, outline=LINE, width=1):
    d.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)


def pill(d, x, y, text, font, fg, bg, padx=8, pady=4):
    w = d.textlength(text, font=font)
    h = font.size if hasattr(font, "size") else 10
    d.rounded_rectangle([x, y, x + w + padx * 2, y + h + pady * 2], (h + pady * 2) // 2, fill=bg)
    d.text((x + padx, y + pady - 1), text, font=font, fill=fg)
    return w + padx * 2


def avatar(d, cx, cy, rr):
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=CYAN, width=2)
    d.ellipse([cx - rr + 6, cy - rr + 6, cx + rr - 6, cy + rr - 6], fill=TINT, outline=BLUE, width=1)
    pts = [(cx + (rr - 11) * math.cos(a), cy + (rr - 11) * math.sin(a)) for a in [0.6, 1.9, 3.2, 4.5, 5.8]]
    for p in pts:
        for q in pts:
            d.line([p, q], fill=(180, 210, 240))
    for p in pts:
        d.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], fill=BLUE)
    d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=CYAN)


# ----------------------------------------------------------------- screens
def screen_splash():
    im, d = new()
    hgrad(d, 0, H, (255, 255, 255), (226, 240, 254))
    for i in range(6):
        rr = 40 + i * 24
        d.ellipse([W // 2 - rr, 150 - rr, W // 2 + rr, 150 + rr], outline=(214, 232, 250))
    avatar(d, W // 2, 132, 42)
    center(d, "MINDBUDDY", 176, B(24), BLUE)
    center(d, "24/7  AI  MENTAL  HEALTH  COMPANION", 202, M(8), SUB)
    d.line([(70, 216), (210, 216)], fill=LINE)
    center(d, "CLINICAL  ·  PRIVATE  ·  ALWAYS  ON", 226, M(7), (150, 172, 192))
    d.rounded_rectangle([70, 262, 210, 270], 4, fill=(222, 236, 252))
    d.rounded_rectangle([70, 262, 168, 270], 4, fill=BLUE2)
    center(d, "initialising  pipeline", 282, M(8), SUB)
    center(d, "v2.4  ·  RASPI5  MASTER", 300, M(7), (170, 190, 208))
    return im


def screen_home():
    im, d = new()
    statusbar(d)
    titlebar(d, "MINDBUDDY", back=False)
    d.text((214, 30), "HOME", font=M(8), fill=SUB)
    card(d, [10, 56, 270, 124], 10, fill=TINT)
    avatar(d, 44, 90, 26)
    d.text((80, 86), "Mode", font=M(8), fill=SUB)
    d.text((174, 86), "Mood", font=M(8), fill=SUB)
    labels = [("CHAT", CYAN), ("MODES", BLUE), ("MOOD", OK),
              ("MEDS", AMBER), ("MUSIC", BLUE2), ("VOICE", (120, 90, 200))]
    for i, (t, c) in enumerate(labels):
        x = 10 + (i % 3) * 90
        y = 134 + (i // 3) * 58
        card(d, [x, y, x + 80, y + 48], 8)
        d.rounded_rectangle([x + 30, y + 8, x + 50, y + 22], 4, fill=c)
        center(d, t, y + 28, B(10), INK, cx=x + 40)
    card(d, [10, 252, 270, 286], 8, fill=(253, 236, 238), outline=(244, 196, 200))
    d.ellipse([20, 260, 44, 284], fill=RED)
    center(d, "SOS", 266, B(11), WHITE, cx=32)
    d.text((54, 258), "Emergency call & caregiver alert", font=R(10), fill=INK)
    d.text((54, 272), "Hold 2s to trigger", font=M(8), fill=SUB)
    d.rectangle([0, 296, W, 320], fill=TINT)
    d.line([(0, 296), (W, 296)], fill=LINE)
    for i, t in enumerate(["HOME", "CHAT", "SOS", "MENU"]):
        center(d, t, 303, B(9), BLUE if i == 0 else SUB, cx=35 + i * 70)
    return im


def screen_modes():
    im, d = new()
    statusbar(d)
    titlebar(d, "Therapy Mode")
    modes = [("ANXIETY", "Grounding & breath work"), ("PTSD", "Trauma-safe dialogue"),
             ("SCHIZOPHRENIA", "Reality anchoring support"), ("DEPRESSION", "Activation & warmth"),
             ("BIPOLAR", "Mood stability tracking"), ("ADHD", "Focus & task chunking")]
    y = 56
    for name, sub in modes:
        card(d, [10, y, 270, y + 38], 8)
        d.rounded_rectangle([10, y, 14, y + 38], 2, fill=(222, 234, 246))
        d.text((24, y + 6), name, font=B(12), fill=INK)
        d.text((24, y + 22), sub, font=R(9), fill=SUB)
        y += 42
    return im


def screen_mood():
    im, d = new()
    statusbar(d)
    titlebar(d, "How do you feel?")
    moods = [("GREAT", OK), ("GOOD", (60, 175, 120)), ("OKAY", BLUE2),
             ("LOW", (120, 140, 170)), ("SAD", (90, 110, 190)), ("ANGRY", RED)]
    for i, (t, c) in enumerate(moods):
        x = 10 + (i % 2) * 135
        y = 58 + (i // 2) * 54
        card(d, [x, y, x + 125, y + 46], 8)
        d.ellipse([x + 10, y + 13, x + 30, y + 33], outline=c, width=2)
        d.ellipse([x + 15, y + 19, x + 18, y + 22], fill=c)
        d.ellipse([x + 22, y + 19, x + 25, y + 22], fill=c)
        d.text((x + 40, y + 16), t, font=B(12), fill=INK)
    card(d, [10, 220, 270, 266], 8, fill=TINT, outline=BLUE)
    d.text((150, 240), "single tap logs", font=M(8), fill=SUB)
    d.text((14, 272), "Last 7 days", font=M(8), fill=SUB)
    return im


def screen_chat():
    im, d = new()
    statusbar(d)
    titlebar(d, "AI Companion")
    d.rectangle([0, 246, W, 268], fill=(246, 251, 255))
    x = 10
    for t in ["Breathe", "Ground me", "Call carer"]:
        x += pill(d, x, 274, t, M(9), BLUE, TINT) + 6
    d.rectangle([0, 296, W, 320], fill=TINT)
    d.line([(0, 296), (W, 296)], fill=LINE)
    d.rounded_rectangle([10, 300, 214, 316], 8, fill=WHITE, outline=LINE)
    d.text((18, 303), "Tap the mic to talk", font=R(10), fill=SUB)
    d.ellipse([222, 299, 240, 317], fill=BLUE)
    d.ellipse([248, 299, 266, 317], fill=CYAN)
    return im


def screen_pipeline():
    im, d = new()
    statusbar(d)
    titlebar(d, "Compute Pipeline")
    opts = [("CLOUD", "Fastest model · needs network", BLUE2),
            ("LOCAL", "On-device · fully private", OK),
            ("AUTO", "Prefers cloud, falls back local", BLUE)]
    y = 60
    for name, sub, c in opts:
        card(d, [10, y, 270, y + 56], 10)
        d.ellipse([22, y + 18, 42, y + 38], outline=c, width=2)
        d.text((56, y + 13), name, font=B(13), fill=INK)
        d.text((56, y + 32), sub, font=R(9), fill=SUB)
        y += 64
    card(d, [10, y + 4, 270, y + 52], 8, fill=(246, 251, 255))
    d.text((20, y + 12), "LINK STATUS", font=M(8), fill=SUB)
    return im


def screen_keypad():
    im, d = new()
    statusbar(d)
    titlebar(d, "Emergency Dialer")
    d.rounded_rectangle([10, 54, 270, 84], 8, fill=TINT, outline=LINE)
    keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]
    for i, k in enumerate(keys):
        x = 22 + (i % 3) * 84
        y = 92 + (i // 3) * 44
        d.ellipse([x, y, x + 38, y + 38], fill=WHITE, outline=LINE, width=1)
        center(d, k, y + 9, B(16), INK, cx=x + 19)
    d.rounded_rectangle([12, 268, 132, 292], 10, fill=OK)
    center(d, "CALL", 274, B(12), WHITE, cx=72)
    d.rounded_rectangle([148, 268, 268, 292], 10, fill=WHITE, outline=LINE)
    center(d, "CLEAR", 274, B(12), SUB, cx=208)
    x = 10
    for t, c in [("988", RED), ("CARER", BLUE), ("911", RED)]:
        x += pill(d, x, 298, t, B(9), WHITE, c) + 7
    return im


def screen_sms():
    im, d = new()
    statusbar(d)
    titlebar(d, "Message Caregiver")
    card(d, [10, 56, 270, 92], 8, fill=TINT)
    d.ellipse([20, 62, 44, 86], fill=BLUE2)
    d.text((14, 102), "QUICK ALERTS", font=M(8), fill=SUB)
    y = 116
    for t in ["I need you to call me now.", "I'm feeling unsafe.",
              "Panic attack — please come.", "Missed my medication."]:
        card(d, [10, y, 270, y + 32], 8)
        d.rounded_rectangle([10, y, 13, y + 32], 2, fill=BLUE2)
        d.text((22, y + 9), t, font=R(11), fill=INK)
        y += 38
    card(d, [10, y + 2, 270, y + 46], 8, fill=(250, 252, 255))
    d.text((20, y + 10), "Custom message…", font=R(10), fill=SUB)
    d.rounded_rectangle([186, y + 18, 262, y + 38], 8, fill=BLUE)
    center(d, "SEND SMS", y + 22, B(10), WHITE, cx=224)
    return im


def screen_volume():
    im, d = new()
    statusbar(d)
    titlebar(d, "Volume")
    d.rounded_rectangle([12, 60, 268, 120], 8, fill=(248, 251, 255), outline=LINE)
    d.rounded_rectangle([12, 130, 268, 190], 8, fill=(248, 251, 255), outline=LINE)
    ov = Image.new("RGBA", (W, H), (10, 30, 55, 150))
    im = Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([20, 96, 260, 232], 14, fill=WHITE, outline=BLUE, width=2)
    center(d, "VOLUME", 112, B(13), INK)
    d.rounded_rectangle([40, 176, 240, 186], 5, fill=(226, 238, 250))
    d.rounded_rectangle([40, 200, 132, 222], 8, fill=TINT)
    center(d, "MUTE", 205, B(10), BLUE, cx=86)
    d.rounded_rectangle([148, 200, 240, 222], 8, fill=BLUE)
    center(d, "TEST", 205, B(10), WHITE, cx=194)
    return im


def screen_meds():
    im, d = new()
    statusbar(d)
    titlebar(d, "Medication")
    card(d, [10, 56, 270, 108], 10, fill=TINT, outline=BLUE)
    d.text((22, 64), "NEXT DOSE", font=M(8), fill=SUB)
    d.text((176, 70), "in", font=M(8), fill=SUB)
    y = 118
    for _ in range(4):
        card(d, [10, y, 270, y + 38], 8)
        y += 42
    d.rounded_rectangle([10, y + 4, 270, y + 30], 8, fill=BLUE)
    center(d, "+  ADD ALARM", y + 10, B(11), WHITE)
    return im


def screen_music():
    im, d = new()
    statusbar(d)
    titlebar(d, "Calm Audio")
    d.rounded_rectangle([70, 58, 210, 166], 12, fill=TINT, outline=LINE)
    for i in range(5):
        rr = 20 + i * 10
        d.ellipse([140 - rr, 112 - rr, 140 + rr, 112 + rr], outline=(196, 222, 248))
    d.ellipse([124, 96, 156, 128], fill=BLUE2)
    d.ellipse([136, 108, 144, 116], fill=WHITE)
    for i in range(52):
        a = abs(math.sin(i * 0.4 + 1)) * 10 + 2
        d.line([(8 + i * 5.2, 222 - a), (8 + i * 5.2, 222 + a)], fill=CYAN if i % 3 else BLUE2)
    d.rounded_rectangle([16, 242, 264, 248], 3, fill=(226, 238, 250))
    d.polygon([(70, 282), (70, 304), (56, 293)], fill=INK)
    d.rectangle([52, 282, 56, 304], fill=INK)
    d.ellipse([120, 272, 160, 312], fill=BLUE)
    d.polygon([(210, 282), (210, 304), (224, 293)], fill=INK)
    d.rectangle([224, 282, 228, 304], fill=INK)
    return im


def screen_voice():
    im, d = new()
    statusbar(d)
    titlebar(d, "AI Voice")
    y = 54
    for _ in range(8):
        card(d, [10, y, 270, y + 28], 7)
        d.ellipse([232, y + 6, 250, y + 24], fill=TINT)
        d.polygon([(239, y + 11), (239, y + 19), (245, y + 15)], fill=BLUE)
        y += 31
    return im


SCREENS = {
    "splash": screen_splash, "home": screen_home, "modes": screen_modes,
    "mood": screen_mood, "chat": screen_chat, "pipeline": screen_pipeline,
    "keypad": screen_keypad, "sms": screen_sms, "volume": screen_volume,
    "meds": screen_meds, "music": screen_music, "voice": screen_voice,
}


# ------------------------------------------------------------------- icons
S = 32  # icon canvas


def _icon():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def ic_back():
    im, d = _icon()
    d.polygon([(20, 6), (20, 26), (8, 16)], fill=BLUE)
    return im


def ic_home():
    im, d = _icon()
    d.polygon([(16, 5), (28, 16), (4, 16)], fill=BLUE)
    d.rectangle([8, 16, 24, 27], fill=BLUE2)
    return im


def ic_chat():
    im, d = _icon()
    d.rounded_rectangle([4, 6, 28, 22], 6, fill=CYAN)
    d.polygon([(10, 22), (18, 22), (10, 28)], fill=CYAN)
    return im


def ic_sos():
    im, d = _icon()
    d.ellipse([3, 3, 29, 29], fill=RED)
    return im


def ic_mic():
    im, d = _icon()
    d.rounded_rectangle([12, 4, 20, 18], 4, fill=BLUE)
    d.arc([8, 12, 24, 24], 0, 180, fill=BLUE, width=2)
    d.line([(16, 24), (16, 28)], fill=BLUE, width=2)
    return im


def ic_mic_off():
    im = ic_mic()
    d = ImageDraw.Draw(im)
    d.line([(6, 6), (26, 26)], fill=RED, width=3)
    return im


def ic_play():
    im, d = _icon()
    d.polygon([(10, 6), (10, 26), (26, 16)], fill=BLUE)
    return im


def ic_pause():
    im, d = _icon()
    d.rectangle([9, 6, 14, 26], fill=BLUE)
    d.rectangle([18, 6, 23, 26], fill=BLUE)
    return im


def ic_next():
    im, d = _icon()
    d.polygon([(8, 6), (8, 26), (21, 16)], fill=INK)
    d.rectangle([22, 6, 25, 26], fill=INK)
    return im


def ic_prev():
    im, d = _icon()
    d.polygon([(24, 6), (24, 26), (11, 16)], fill=INK)
    d.rectangle([7, 6, 10, 26], fill=INK)
    return im


def ic_net():
    im, d = _icon()
    for i in range(4):
        h = 4 + i * 6
        d.rectangle([4 + i * 7, 28 - h, 8 + i * 7, 28], fill=OK)
    return im


def ic_nonet():
    im, d = _icon()
    for i in range(4):
        h = 4 + i * 6
        d.rectangle([4 + i * 7, 28 - h, 8 + i * 7, 28], fill=(200, 210, 220))
    d.line([(4, 28), (28, 4)], fill=RED, width=3)
    return im


def _batt(level: int, charging=False):
    im, d = _icon()
    d.rounded_rectangle([3, 10, 26, 23], 2, outline=INK, width=2)
    d.rectangle([27, 14, 30, 19], fill=INK)
    w = int(20 * level / 100)
    col = OK if level >= 40 else (AMBER if level >= 20 else RED)
    if charging:
        col = CYAN
    if w:
        d.rectangle([5, 12, 5 + w, 21], fill=col)
    if charging:
        d.polygon([(16, 10), (11, 18), (15, 18), (13, 24), (20, 15), (16, 15)], fill=WHITE)
    return im


def ic_plus():
    im, d = _icon()
    d.rectangle([14, 5, 18, 27], fill=WHITE)
    d.rectangle([5, 14, 27, 18], fill=WHITE)
    return im


def ic_check():
    im, d = _icon()
    d.ellipse([3, 3, 29, 29], fill=BLUE)
    d.line([(10, 17), (14, 22), (23, 10)], fill=WHITE, width=3)
    return im


def ic_pill():
    im, d = _icon()
    d.rounded_rectangle([4, 11, 28, 23], 6, fill=AMBER)
    d.line([(16, 11), (16, 23)], fill=WHITE, width=2)
    return im


def ic_heart():
    im, d = _icon()
    d.ellipse([5, 7, 17, 19], fill=RED)
    d.ellipse([15, 7, 27, 19], fill=RED)
    d.polygon([(6, 15), (26, 15), (16, 28)], fill=RED)
    return im


def ic_settings():
    im, d = _icon()
    d.ellipse([6, 6, 26, 26], outline=BLUE, width=3)
    d.ellipse([13, 13, 19, 19], fill=BLUE)
    return im


def ic_spotify():
    im, d = _icon()
    d.ellipse([2, 2, 30, 30], fill=(30, 215, 96))
    for i, (y, inset) in enumerate([(11, 6), (16, 8), (21, 10)]):
        d.arc([inset, y - 5, 32 - inset, y + 7], 200, 340, fill=WHITE, width=3 - i // 2)
    return im


def ic_radio():
    im, d = _icon()
    d.rounded_rectangle([3, 12, 29, 28], 3, fill=BLUE2)
    d.ellipse([17, 16, 26, 25], fill=WHITE)
    d.line([(8, 12), (20, 3)], fill=INK, width=2)
    return im


def ic_volume():
    im, d = _icon()
    d.polygon([(4, 12), (10, 12), (17, 5), (17, 27), (10, 20), (4, 20)], fill=BLUE)
    d.arc([16, 8, 26, 24], 300, 60, fill=BLUE, width=2)
    return im


def ic_wave():
    im, d = _icon()
    for i in range(7):
        a = abs(math.sin(i * 0.9)) * 11 + 2
        d.line([(4 + i * 4, 16 - a), (4 + i * 4, 16 + a)], fill=CYAN, width=2)
    return im


ICONS = {
    "back": ic_back, "home": ic_home, "chat": ic_chat, "sos": ic_sos,
    "mic": ic_mic, "mic_off": ic_mic_off, "play": ic_play, "pause": ic_pause,
    "next": ic_next, "prev": ic_prev, "net": ic_net, "nonet": ic_nonet,
    "plus": ic_plus, "check": ic_check, "pill": ic_pill, "heart": ic_heart,
    "settings": ic_settings, "spotify": ic_spotify, "radio": ic_radio,
    "volume": ic_volume, "wave": ic_wave,
    "bat0": lambda: _batt(5), "bat25": lambda: _batt(25), "bat50": lambda: _batt(50),
    "bat75": lambda: _batt(75), "bat100": lambda: _batt(100),
    "batchg": lambda: _batt(60, charging=True),
}


def main():
    ap = argparse.ArgumentParser(description="Render MindBuddy TFT screens + icons")
    ap.add_argument("--out", default="firmware/raspi5/assets", help="output directory")
    ap.add_argument("--fonts", default="", help="extra font directory")
    ap.add_argument("--scale", type=int, default=1, help="integer upscale (nearest)")
    args = ap.parse_args()

    if args.fonts:
        _extra_dirs.insert(0, args.fonts)

    sdir = os.path.join(args.out, "screens")
    idir = os.path.join(args.out, "icons")
    os.makedirs(sdir, exist_ok=True)
    os.makedirs(idir, exist_ok=True)

    for name, fn in SCREENS.items():
        im = fn()
        if args.scale > 1:
            im = im.resize((W * args.scale, H * args.scale), Image.NEAREST)
        im.save(os.path.join(sdir, f"{name}.png"))
    for name, fn in ICONS.items():
        fn().save(os.path.join(idir, f"{name}.png"))

    print(f"wrote {len(SCREENS)} screens -> {sdir}")
    print(f"wrote {len(ICONS)} icons   -> {idir}")


if __name__ == "__main__":
    main()
