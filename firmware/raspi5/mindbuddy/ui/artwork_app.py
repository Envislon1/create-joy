"""MindBuddy Pi 5 touch UI — artwork edition.

Renders the *shipped* MindBuddy artwork (the same PNG/MP4 set the web
/tft-simulator uses) on the Pi's TFT and maps taps through the region table
in `screens.py`, so the device screen matches the simulator page for page.

Assets live in `CFG.ui_assets` (default ./assets) with the exact simulator
file names, e.g. `home_page_wifi_mobile_auto_bat4.png`. Fetch them once with:

    python3 firmware/tools/fetch_pi_assets.py --out firmware/raspi5/assets

Missing artwork never crashes the UI: the page falls back to a plain dark
plate with the page name, and the touch regions still work.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import pygame

from . import screens as S
from .theme import (AMBER, BG, CARD, FAINT, INK, OK, PURPLE, RED, SHADE, SUB,
                    WHITE, font)

log = logging.getLogger("ui")


@dataclass
class UiState:
    user_name: str = "there"
    mode: str = "ANXIETY"
    mood: str = "OKAY"
    exercise: str = "RANDOM"
    voice: str = "Default"
    language: str = "en"
    pipeline: str = "auto"
    backend: str = "local"
    dnd: bool = False
    listening: bool = False
    thinking: bool = False
    speaking: bool = False
    online: bool = False
    wifi: bool = False
    mobile: bool = False
    battery: int = 100
    charging: bool = False
    clock: str = "--:--"
    volume: int = 70
    muted: bool = False
    sos_active: bool = False
    meds: list[dict] = field(default_factory=list)
    chat: list[tuple[str, str]] = field(default_factory=list)
    pending: str = ""
    music_playing: bool = False
    music_title: str = "Nothing playing"
    music_artist: str = ""
    music_source: str = "radio"
    caregiver_name: str = "Caregiver"
    caregiver_number: str = ""
    call_peer: str = ""
    toast: str = ""
    toast_at: float = 0.0
    dial: str = ""
    chrome_only: bool = False


class ArtworkUI:
    """Blocking pygame UI. Call :meth:`run` from the main thread."""

    SPLASH_SECS = 6.0

    def __init__(self, assets_dir: str, on_event: Callable[[dict], None],
                 fullscreen: bool = True, size: tuple[int, int] | None = None,
                 rotate: int = 0, cursor: bool = False):
        self.assets = Path(assets_dir).expanduser()
        self.on_event = on_event
        self.fullscreen = fullscreen
        self.req_size = size
        self.rotate = rotate % 360
        self.cursor = cursor
        self.state = UiState()
        self.page = "splash"
        self._stack: list[str] = []
        self._stop = False
        self._scr: pygame.Surface | None = None
        self._canvas: pygame.Surface | None = None
        self._cache: dict[str, pygame.Surface | None] = {}
        self._offset = (0, 0)
        self._sc = 1.0
        self._boot_at = time.time()
        self._sos_down: float | None = None

    # ------------------------------------------------------------ lifecycle
    def run(self):
        pygame.init()
        pygame.font.init()
        flags = pygame.FULLSCREEN if self.fullscreen else 0
        self._scr = pygame.display.set_mode(self.req_size or (0, 0), flags)
        pygame.display.set_caption("MindBuddy")
        pygame.mouse.set_visible(self.cursor)
        self._layout()
        clock = pygame.time.Clock()
        while not self._stop:
            self._events()
            self._tick()
            self._draw()
            clock.tick(30)
        pygame.quit()

    def stop(self):
        self._stop = True

    def _layout(self):
        sw, sh = self._scr.get_size()
        dw, dh = ((S.SCREEN_H, S.SCREEN_W) if self.rotate in (90, 270)
                  else (S.SCREEN_W, S.SCREEN_H))
        self._sc = max(1.0, min(sw / dw, sh / dh))
        self._canvas = pygame.Surface(
            (int(S.SCREEN_W * self._sc), int(S.SCREEN_H * self._sc))).convert()
        self._offset = ((sw - int(dw * self._sc)) // 2, (sh - int(dh * self._sc)) // 2)

    # --------------------------------------------------------------- assets
    def _exists(self, name: str) -> bool:
        return (self.assets / name).exists() or (self.assets / self._still(name)).exists()

    @staticmethod
    def _still(name: str) -> str:
        """MP4 artwork ships with a PNG still of the same stem."""
        return name[:-4] + ".png" if name.endswith(".mp4") else name

    def _image(self, name: str) -> pygame.Surface | None:
        key = f"{name}@{int(self._sc * 100)}"
        if key in self._cache:
            return self._cache[key]
        surf = None
        for candidate in (name, self._still(name)):
            path = self.assets / candidate
            if path.suffix.lower() in (".png", ".jpg", ".jpeg", ".bmp") and path.exists():
                try:
                    img = pygame.image.load(str(path)).convert()
                    surf = pygame.transform.smoothscale(img, self._canvas.get_size())
                except Exception as e:  # pragma: no cover - hardware path
                    log.warning("asset %s failed: %s", candidate, e)
                break
        if surf is None:
            log.warning("artwork missing: %s (put it in %s)", name, self.assets)
        self._cache[key] = surf
        return surf

    # --------------------------------------------------------------- events
    def _events(self):
        for e in pygame.event.get():
            if e.type == pygame.QUIT:
                self._stop = True
            elif e.type == pygame.KEYDOWN and e.key in (pygame.K_ESCAPE, pygame.K_q):
                self._stop = True
            elif e.type in (pygame.MOUSEBUTTONDOWN, pygame.FINGERDOWN):
                p = self._pos(e)
                if p:
                    self._on_tap(p)

    def _pos(self, e):
        if e.type in (pygame.FINGERDOWN, pygame.FINGERUP):
            sw, sh = self._scr.get_size()
            raw = (int(e.x * sw), int(e.y * sh))
        else:
            raw = e.pos
        x = (raw[0] - self._offset[0]) / self._sc
        y = (raw[1] - self._offset[1]) / self._sc
        if self.rotate == 90:
            x, y = y, S.SCREEN_H - x
        elif self.rotate == 180:
            x, y = S.SCREEN_W - x, S.SCREEN_H - y
        elif self.rotate == 270:
            x, y = S.SCREEN_W - y, x
        if 0 <= x < S.SCREEN_W and 0 <= y < S.SCREEN_H:
            return int(x), int(y)
        return None

    def _tick(self):
        if self.page == "splash" and time.time() - self._boot_at > self.SPLASH_SECS:
            self.page = "home"

    def emit(self, msg: dict):
        try:
            self.on_event(msg)
        except Exception:
            log.exception("ui event handler failed")

    def toast(self, text: str):
        self.state.toast = text
        self.state.toast_at = time.time()

    def goto(self, page: str):
        if page != self.page:
            self._stack.append(self.page)
            self.page = page

    def back(self):
        self.page = self._stack.pop() if self._stack else "home"

    def home(self):
        self._stack.clear()
        self.page = "home"

    # ----------------------------------------------------------- tap router
    def _on_tap(self, pos):
        x, y = pos
        for rid, rx, ry, rw, rh in S.regions(self.page):
            if rx <= x < rx + rw and ry <= y < ry + rh:
                self._action(rid)
                return

    def _action(self, rid: str):
        s = self.state
        page = self.page
        if rid == "back":
            self.back()
            return
        if rid == "skip":
            self.home()
            return

        if page == "home":
            if rid == "mode":
                self.goto("mode")
            elif rid == "mood":
                self.goto("mood")
            elif rid == "exercise":
                self.goto("exercise")
            elif rid == "settings":
                self.goto("settings")
            elif rid == "music":
                self.goto("music")
            elif rid == "keypad":
                self.goto("keypad")
            elif rid == "meds":
                self.emit({"type": "meds_request"})
                self.toast("Medication reminders")
            return

        if page == "mode":
            s.mode = rid
            self.emit({"type": "mode_set", "mode": rid})
            self.toast(rid.title())
            return

        if page == "mood":
            s.mood = rid
            self.emit({"type": "mood_set", "mood": rid})
            self.toast(f"Mood: {rid.title()}")
            return

        if page == "exercise":
            s.exercise = rid
            self.emit({"type": "exercise_set", "category": rid})
            self.toast("Starting exercise…")
            return

        if page == "settings":
            if rid == "volume":
                s.volume = 100 if s.volume >= 100 else min(100, s.volume + 10)
                self.emit({"type": "volume_set", "volume": s.volume})
                self.toast(f"Volume {s.volume}%")
            else:
                self.goto(rid)
            return

        if page == "pipeline":
            s.pipeline = rid
            self._cache.clear()
            self.emit({"type": "pipeline_set", "pipeline": rid})
            self.toast(f"Pipeline: {rid}")
            return

        if page == "voice":
            s.voice = rid
            self.emit({"type": "voice_set", "voice": S.VOICE_ID.get(rid, "af_heart")})
            self.toast(f"Voice: {rid}")
            return

        if page == "dnd":
            s.dnd = rid == "on"
            self.emit({"type": "dnd_set", "dnd": s.dnd})
            self.toast("Do Not Disturb " + ("on" if s.dnd else "off"))
            return

        if page == "music":
            if rid == "playpause":
                s.music_playing = not s.music_playing
                self.emit({"type": "music_cmd", "cmd": "toggle"})
            return

        if page == "keypad":
            if rid.startswith("key:"):
                s.dial = (s.dial + rid[4:])[:15]
            elif rid == "clear":
                s.dial = ""
            elif rid == "backspace":
                s.dial = s.dial[:-1]
            elif rid == "save":
                if s.dial:
                    self.emit({"type": "contact_saved", "name": "Contact", "number": s.dial})
                    self.toast("Number saved")
            elif rid == "call":
                if s.dnd:
                    self.toast("DND is on")
                elif s.dial:
                    s.call_peer = s.dial
                    self.emit({"type": "call_dial", "number": s.dial})
                    self.goto("calling")
            return

        if page in ("calling", "connected"):
            if rid == "hangup":
                self.emit({"type": "call_hangup"})
                self.home()
            return

        if page == "incoming":
            if rid == "answer":
                self.emit({"type": "call_answer"})
                self.page = "connected"
            elif rid == "reject":
                self.emit({"type": "call_hangup"})
                self.home()
            return

    # -------------------------------------------------------- link messages
    def on_message(self, m: dict):
        s = self.state
        t = m.get("type")
        if t == "chat_user":
            s.chat.append(("user", m.get("text", "")))
        elif t in ("chat_ai", "chat_ai_final"):
            s.pending = ""
            s.chat.append(("ai", m.get("text", "")))
            # MB Chat opens by itself whenever MindBuddy answers.
            if self.page not in ("calling", "connected", "incoming"):
                self.goto("chat")
        elif t == "chat_pending":
            s.pending = m.get("text", "thinking…")
            if self.page not in ("calling", "connected", "incoming"):
                self.goto("chat")
        elif t == "state":
            s.listening = bool(m.get("listening"))
            s.thinking = bool(m.get("thinking"))
            s.speaking = bool(m.get("speaking"))
            s.backend = m.get("backend", s.backend)
        elif t == "mode":
            s.mode = (m.get("mode") or s.mode).upper()
            self._cache.clear()
        elif t == "language":
            s.language = m.get("language", s.language)
        elif t == "volume":
            s.volume = int(m.get("volume", s.volume))
        elif t == "meds":
            s.meds = list(m.get("items") or [])
        elif t == "music_state":
            s.music_playing = bool(m.get("playing"))
            s.music_title = m.get("title") or "Nothing playing"
            s.music_artist = m.get("artist") or ""
        elif t == "time":
            s.clock = m.get("hhmm", s.clock)
        elif t == "power":
            s.battery = int(m.get("battery", s.battery))
            s.charging = bool(m.get("charging"))
        elif t == "net_status":
            s.online = bool(m.get("online"))
            s.wifi = bool(m.get("wifi", s.online))
            s.mobile = bool(m.get("mobile", s.mobile))
        elif t == "sos_state":
            s.sos_active = bool(m.get("active"))
        elif t == "contact":
            s.caregiver_name = m.get("name", s.caregiver_name)
            s.caregiver_number = m.get("number", s.caregiver_number)
        elif t == "call_incoming":
            s.call_peer = m.get("from", "")
            self.page = "incoming"
        elif t == "call_answered":
            self.page = "connected"
        elif t == "call_ended":
            self.home()
        elif t == "alarm":
            self.toast(m.get("label", "Medication time"))
        elif t == "error":
            self.toast(m.get("msg", "error"))

    # ---------------------------------------------------------------- paint
    def _s(self, v) -> int:
        return int(round(v * self._sc))

    def _font(self, kind, size):
        return font(kind, max(8, int(round(size * self._sc))))

    def _text(self, txt, pos, kind="bold", size=11, color=INK, mid=False, right=False):
        surf = self._font(kind, size).render(str(txt), True, color)
        r = surf.get_rect()
        px, py = self._s(pos[0]), self._s(pos[1])
        if mid:
            r.center = (px, py)
        elif right:
            r.topright = (px, py)
        else:
            r.topleft = (px, py)
        self._canvas.blit(surf, r)

    def _plate(self, rect, color=(0, 0, 0), alpha=150, radius=8):
        x, y, w, h = [self._s(v) for v in rect]
        box = pygame.Surface((w, h), pygame.SRCALPHA)
        pygame.draw.rect(box, (*color, alpha), (0, 0, w, h), border_radius=radius)
        self._canvas.blit(box, (x, y))

    def _draw(self):
        s = self.state
        c = self._canvas
        c.fill(BG)
        bg = self._image(S.page_asset(self.page, s, self._exists))
        if bg:
            c.blit(bg, (0, 0))
        else:
            self._text(self.page.upper(), (S.SCREEN_W / 2, S.SCREEN_H / 2),
                       "bold", 18, SUB, mid=True)
            self._text("artwork missing on SD/assets folder",
                       (S.SCREEN_W / 2, S.SCREEN_H / 2 + 22), "sans", 8, FAINT, mid=True)

        painter = getattr(self, f"_overlay_{self.page}", None)
        if painter:
            painter(s)
        self._overlay_toast(s)

        view = pygame.transform.rotate(c, -self.rotate) if self.rotate else c
        self._scr.fill(SHADE)
        self._scr.blit(view, self._offset)
        pygame.display.flip()

    # -------- per-page live overlays (artwork already carries the chrome) --
    def _overlay_home(self, s):
        self._text(s.clock, (S.SCREEN_W / 2, 12), "bold", 10, WHITE, mid=True)
        if s.meds:
            self._text(f"MED {self._next_med(s)}", (S.SCREEN_W - 8, 6), "mono", 7,
                       AMBER, right=True)

    def _overlay_chat(self, s):
        f = self._font("sans", 9)
        lines: list[tuple[str, str]] = []
        for role, text in s.chat[-8:]:
            for ln in self._wrap(text, f, int(200 * self._sc)):
                lines.append((role, ln))
        if s.pending:
            lines.append(("ai", s.pending))
        y = 268
        for role, ln in reversed(lines):
            if y < 70:
                break
            surf = f.render(ln, True, WHITE if role == "user" else INK)
            w = surf.get_width() / self._sc + 16
            x = S.SCREEN_W - 12 - w if role == "user" else 12
            self._plate((x, y - 20, w, 20), PURPLE if role == "user" else CARD,
                        200 if role == "user" else 170)
            self._canvas.blit(surf, (self._s(x + 8), self._s(y - 15)))
            y -= 23

    def _overlay_keypad(self, s):
        self._plate((24, 24, 232, 34), (0, 0, 0), 140)
        self._text(s.dial or "Enter number", (S.SCREEN_W / 2, 41), "mono", 16,
                   INK if s.dial else FAINT, mid=True)

    def _overlay_calling(self, s):
        self._text(s.call_peer or s.dial or s.caregiver_number,
                   (S.SCREEN_W / 2, 150), "mono", 15, WHITE, mid=True)

    def _overlay_connected(self, s):
        self._text(s.call_peer or s.dial, (S.SCREEN_W / 2, 150), "mono", 15, WHITE, mid=True)

    def _overlay_incoming(self, s):
        self._text(s.call_peer or "Unknown", (S.SCREEN_W / 2, 150), "mono", 15, WHITE, mid=True)

    def _overlay_music(self, s):
        self._plate((20, 262, 240, 40), (0, 0, 0), 150)
        self._text(s.music_title[:28], (S.SCREEN_W / 2, 276), "bold", 10, INK, mid=True)
        self._text(s.music_artist[:32] or ("playing" if s.music_playing else "paused"),
                   (S.SCREEN_W / 2, 292), "sans", 8, SUB, mid=True)

    def _overlay_toast(self, s):
        if not s.toast or time.time() - s.toast_at > 2.5:
            return
        f = self._font("bold", 10)
        surf = f.render(s.toast, True, WHITE)
        w = surf.get_width() / self._sc + 24
        x = (S.SCREEN_W - w) / 2
        self._plate((x, 288, w, 24), (0, 0, 0), 190, radius=12)
        self._canvas.blit(surf, surf.get_rect(
            center=(self._s(S.SCREEN_W / 2), self._s(300))))

    @staticmethod
    def _next_med(s) -> str:
        items = [m for m in s.meds if m.get("enabled", True)]
        if not items:
            return ""
        now = time.localtime()
        cur = now.tm_hour * 60 + now.tm_min
        best = min(items, key=lambda m: ((int(m.get("hour", 0)) * 60 +
                                          int(m.get("minute", 0))) - cur) % 1440)
        return f"{int(best.get('hour', 0)):02d}:{int(best.get('minute', 0)):02d}"

    @staticmethod
    def _wrap(text: str, f, width: int) -> list[str]:
        out, line = [], ""
        for word in str(text).split():
            trial = (line + " " + word).strip()
            if f.size(trial)[0] <= width:
                line = trial
            else:
                if line:
                    out.append(line)
                line = word
        if line:
            out.append(line)
        return out or [""]
