"""Shared palette + font helpers for the Pi 5 touch UI (dark theme)."""
from __future__ import annotations

import os
import pygame

# Core surfaces
BG = (11, 15, 26)          # page background
BG2 = (16, 22, 37)         # status / nav chrome
CARD = (24, 31, 51)        # standard card
CARD2 = (31, 40, 64)       # raised / pressed card
LINE = (46, 57, 84)        # hairline borders
SHADE = (6, 9, 16)         # letterbox fill

# Text
WHITE = (245, 248, 255)
INK = (233, 238, 248)      # primary text on dark
SUB = (139, 152, 178)      # secondary text
FAINT = (92, 104, 130)

# Accents
PURPLE = (124, 92, 255)    # primary action
PURPLE2 = (154, 128, 255)
BLUE = (124, 92, 255)      # legacy alias -> primary
BLUE2 = (98, 132, 255)
CYAN = (56, 199, 224)
OK = (34, 197, 126)
AMBER = (240, 172, 60)
RED = (233, 45, 78)
TINT = (36, 32, 68)        # subtle purple wash

DESIGN_W, DESIGN_H = 280, 320

_SANS = ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"]
_SANS_B = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
           "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]
_MONO = ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"]

_cache: dict[tuple[str, int], pygame.font.Font] = {}


def _pick(paths: list[str]) -> str | None:
    for p in paths:
        if os.path.isfile(p):
            return p
    return None


def font(kind: str, size: int) -> pygame.font.Font:
    key = (kind, size)
    if key in _cache:
        return _cache[key]
    path = _pick({"sans": _SANS, "bold": _SANS_B, "mono": _MONO}[kind])
    f = pygame.font.Font(path, size) if path else pygame.font.Font(None, size + 2)
    _cache[key] = f
    return f
