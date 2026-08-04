"""MindBuddy Pi 5 touch UI — dark, fully vector-drawn.

Everything on screen is drawn with pygame primitives at the *native* panel
resolution (no pre-rendered PNG page artwork, no upscaling), so text and
edges stay crisp on any display. Layout is authored in a 280x320 design
grid and multiplied by an integer-friendly scale factor at paint time.

Every tap is emitted as the same protocol message the LilyGo firmware sent,
e.g. ``{"type": "mode_set", "mode": "PTSD"}``. Incoming Pi->screen messages
are fed back in with :meth:`TouchUI.on_message`.
"""
from __future__ import annotations

import logging
import math
import os
import time
from dataclasses import dataclass, field
from typing import Callable

import pygame

from .theme import (AMBER, BG, BG2, BLUE2, CARD, CARD2, CYAN, DESIGN_H,
                    DESIGN_W, FAINT, INK, LINE, OK, PURPLE, PURPLE2, RED,
                    SHADE, SUB, TINT, WHITE, font)

log = logging.getLogger("ui")

MODES = ["ANXIETY", "PTSD", "SCHIZOPHRENIA", "DEPRESSION", "BIPOLAR", "ADHD"]
MODE_LABELS = {"SCHIZOPHRENIA": "SCHIZO SUPPORT"}
MOODS = ["GREAT", "GOOD", "OKAY", "LOW", "SAD", "ANGRY", "ANXIOUS"]
MOOD_COLORS = {"GREAT": OK, "GOOD": OK, "OKAY": CYAN, "LOW": AMBER,
               "SAD": BLUE2, "ANGRY": RED, "ANXIOUS": PURPLE}
PIPELINES = ["cloud", "local", "auto"]
PIPELINE_LABELS = {"cloud": "Cloud", "local": "Local", "auto": "Hybrid"}
VOICES = [("af_bella", "EN · female · warm"), ("af_sarah", "EN · female · calm"),
          ("af_nicole", "EN · female · soft"), ("af_sky", "EN · female · bright"),
          ("am_adam", "EN · male · steady"), ("am_michael", "EN · male · deep"),
          ("bf_emma", "UK · female · gentle"), ("bm_george", "UK · male · clinical")]
QUICK_SMS = ["I need you to call me now.", "I'm feeling unsafe.",
             "Panic attack — please come.", "Missed my medication."]
CHIPS = ["I feel anxious", "Ground me", "Call carer"]

HOME_TILES = [("Chat", "chat", PURPLE), ("Mood", "mood", CYAN),
              ("Music", "music", BLUE2), ("Meds", "meds", AMBER),
              ("Mode", "modes", OK), ("SOS", "__sos__", RED)]


@dataclass
class UiState:
    user_name: str = "there"
    mode: str = "ANXIETY"
    mood: str = "OKAY"
    language: str = "en"
    pipeline: str = "auto"
    backend: str = "local"
    voice: str = "af_bella"
    listening: bool = False
    thinking: bool = False
    speaking: bool = False
    online: bool = False
    battery: int = 100
    charging: bool = False
    clock: str = "--:--"
    signal_bars: int = 0
    volume: int = 70
    muted: bool = False
    sos_active: bool = False
    meds: list[dict] = field(default_factory=list)
    chat: list[tuple[str, str]] = field(default_factory=list)  # (role, text)
    pending: str = ""
    music_playing: bool = False
    music_title: str = "Nothing playing"
    music_artist: str = ""
    music_source: str = "radio"      # radio | spotify
    caregiver_name: str = "Caregiver"
    caregiver_number: str = ""
    toast: str = ""
    toast_at: float = 0.0
    dial: str = ""
    # When true the painters draw page chrome only (no live values, glyphs or
    # selections). Used to export static screen backgrounds that the runtime
    # then overlays dynamic assets onto.
    chrome_only: bool = False


class TouchUI:
    """Blocking pygame UI. Call :meth:`run` from the main thread."""

    def __init__(self, assets_dir: str, on_event: Callable[[dict], None],
                 fullscreen: bool = True, size: tuple[int, int] | None = None,
                 rotate: int = 0, cursor: bool = False):
        self.assets_dir = assets_dir
        self.on_event = on_event
        self.fullscreen = fullscreen
        self.req_size = size
        self.rotate = rotate % 360
        self.cursor = cursor
        self.state = UiState()
        self.page = "splash"
        self._page_stack: list[str] = []
        self._stop = False
        self._sos_down: float | None = None
        self._scr: pygame.Surface | None = None
        self._canvas: pygame.Surface | None = None
        self._icons: dict[str, pygame.Surface] = {}
        self._offset = (0, 0)
        self._sc = 1.0
        self._boot_at = time.time()

    # ------------------------------------------------------------ lifecycle
    def run(self):
        os.environ.setdefault("SDL_VIDEO_CENTERED", "1")
        pygame.init()
        pygame.font.init()
        flags = pygame.FULLSCREEN if self.fullscreen else 0
        size = self.req_size or (0, 0)
        self._scr = pygame.display.set_mode(size, flags)
        pygame.display.set_caption("MindBuddy")
        pygame.mouse.set_visible(self.cursor)
        self._compute_layout()
        clock = pygame.time.Clock()
        while not self._stop:
            self._events()
            self._tick()
            self._draw()
            clock.tick(30)
        pygame.quit()

    def stop(self):
        self._stop = True

    def _compute_layout(self):
        sw, sh = self._scr.get_size()
        dw, dh = (DESIGN_H, DESIGN_W) if self.rotate in (90, 270) else (DESIGN_W, DESIGN_H)
        self._sc = max(1.0, min(sw / dw, sh / dh))
        # Paint at native resolution: the canvas is the design grid multiplied
        # by the scale, so nothing is ever resampled on the way to the panel.
        self._canvas = pygame.Surface(
            (int(DESIGN_W * self._sc), int(DESIGN_H * self._sc))).convert()
        vw, vh = int(dw * self._sc), int(dh * self._sc)
        self._offset = ((sw - vw) // 2, (sh - vh) // 2)

    def _to_design(self, pos: tuple[int, int]) -> tuple[int, int] | None:
        x = (pos[0] - self._offset[0]) / self._sc
        y = (pos[1] - self._offset[1]) / self._sc
        if self.rotate == 90:
            x, y = y, DESIGN_H - x
        elif self.rotate == 180:
            x, y = DESIGN_W - x, DESIGN_H - y
        elif self.rotate == 270:
            x, y = DESIGN_W - y, x
        if 0 <= x < DESIGN_W and 0 <= y < DESIGN_H:
            return int(x), int(y)
        return None

    # --------------------------------------------------------------- events
    def _events(self):
        for e in pygame.event.get():
            if e.type == pygame.QUIT:
                self._stop = True
            elif e.type == pygame.KEYDOWN and e.key in (pygame.K_ESCAPE, pygame.K_q):
                self._stop = True
            elif e.type in (pygame.MOUSEBUTTONDOWN, pygame.FINGERDOWN):
                p = self._event_pos(e)
                if p:
                    self._on_down(p)
            elif e.type in (pygame.MOUSEBUTTONUP, pygame.FINGERUP):
                p = self._event_pos(e) or (0, 0)
                self._on_up(p)

    def _event_pos(self, e):
        if e.type in (pygame.FINGERDOWN, pygame.FINGERUP):
            sw, sh = self._scr.get_size()
            return self._to_design((int(e.x * sw), int(e.y * sh)))
        return self._to_design(e.pos)

    def _tick(self):
        if self.page == "splash" and time.time() - self._boot_at > 2.5:
            self.page = "home"
        if self._sos_down and time.time() - self._sos_down >= 2.0:
            self._sos_down = None
            self.emit({"type": "sos_trigger", "note": "Held SOS on Pi touchscreen"})
            self.toast("SOS sent")

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
            self._page_stack.append(self.page)
            self.page = page

    def back(self):
        self.page = self._page_stack.pop() if self._page_stack else "home"

    # ------------------------------------------------------------ hit tests
    @staticmethod
    def _in(p, x0, y0, x1, y1) -> bool:
        return x0 <= p[0] <= x1 and y0 <= p[1] <= y1

    def _on_down(self, p):
        s = self.state
        if self.page == "splash":
            self.page = "home"
            return
        # global back chevron (all pages except home)
        if self.page != "home" and self._in(p, 4, 24, 40, 50):
            self.back()
            return
        # global bottom nav
        if p[1] >= 298:
            if self._in(p, 96, 298, 128, 320):
                self.page = "home"
                self._page_stack.clear()
            elif self._in(p, 136, 298, 168, 320):
                self.goto("chat")
            elif self._in(p, 176, 298, 210, 320):
                self._sos_down = time.time()
                self.toast("Hold to send SOS…")
            return
        handler = getattr(self, f"_tap_{self.page}", None)
        if handler:
            handler(p, s)

    def _on_up(self, _p):
        self._sos_down = None

    # home ---------------------------------------------------------------
    @staticmethod
    def _tile_rect(i):
        return (10 + (i % 3) * 90, 148 + (i // 3) * 56, 80, 48)

    def _tap_home(self, p, s):
        for i, (_label, page, _col) in enumerate(HOME_TILES):
            x, y, w, h = self._tile_rect(i)
            if self._in(p, x, y, x + w, y + h):
                if page == "__sos__":
                    self._sos_down = time.time()
                    self.toast("Hold to send SOS…")
                else:
                    self.goto(page)
                return
        if self._in(p, 10, 84, 138, 136):
            self.goto("modes")
            return
        if self._in(p, 142, 84, 270, 136):
            self.goto("mood")
            return
        if self._in(p, 10, 262, 270, 292):
            self.emit({"type": "wake"})
            self.toast("Listening…")

    # modes / mood / pipeline / voice ------------------------------------
    def _tap_modes(self, p, s):
        for i, m in enumerate(MODES):
            y = 52 + i * 36
            if self._in(p, 10, y, 270, y + 32):
                s.mode = m
                self.emit({"type": "mode_set", "mode": m})
                self.toast(f"Mode: {m.title()}")
                return
        for i, name in enumerate(PIPELINES):
            x = 10 + i * 88
            if self._in(p, x, 282, x + 84, 282 + 26):
                s.pipeline = name
                self.emit({"type": "pipeline_set", "pipeline": name})
                self.toast(f"Pipeline: {PIPELINE_LABELS[name]}")
                return

    @staticmethod
    def _mood_rect(i):
        if i == 6:
            return (10, 206, 260, 44)
        return (10 + (i % 2) * 135, 56 + (i // 2) * 50, 125, 44)

    def _tap_mood(self, p, s):
        for i, m in enumerate(MOODS):
            x, y, w, h = self._mood_rect(i)
            if self._in(p, x, y, x + w, y + h):
                s.mood = m
                self.emit({"type": "mood_set", "mood": m})
                self.toast(f"Logged: {m.title()}")
                return

    def _tap_pipeline(self, p, s):
        for i, name in enumerate(PIPELINES):
            y = 60 + i * 60
            if self._in(p, 10, y, 270, y + 52):
                s.pipeline = name
                self.emit({"type": "pipeline_set", "pipeline": name})
                self.toast(f"Pipeline: {PIPELINE_LABELS[name]}")
                return

    def _tap_voice(self, p, s):
        for i, (name, _sub) in enumerate(VOICES):
            y = 50 + i * 30
            if self._in(p, 10, y, 270, y + 26):
                s.voice = name
                self.emit({"type": "voice_set", "voice": name})
                self.toast(f"Voice: {name}")
                return

    # chat ---------------------------------------------------------------
    def _tap_chat(self, p, s):
        if self._in(p, 236, 274, 270, 296):          # send / mic button
            self.emit({"type": "wake"})
            self.toast("Listening…")
            return
        if 248 <= p[1] <= 268:                        # quick chips
            x = 10
            for t in CHIPS:
                w = 18 + int(len(t) * 5.2)
                if x <= p[0] <= x + w:
                    if t == "Call carer":
                        self.goto("keypad")
                    else:
                        self.emit({"type": "text_prompt", "text": t})
                    return
                x += w + 6
        if self._in(p, 10, 274, 230, 296):            # input field -> voice
            self.emit({"type": "wake"})
            self.toast("Listening…")

    # keypad -------------------------------------------------------------
    @staticmethod
    def _key_rect(i):
        return (10 + (i % 3) * 88, 76 + (i // 3) * 40, 84, 36)

    def _tap_keypad(self, p, s):
        keys = "123456789*0#"
        for i, k in enumerate(keys):
            x, y, w, h = self._key_rect(i)
            if self._in(p, x, y, x + w, y + h):
                s.dial = (s.dial + k)[:16]
                return
        if self._in(p, 10, 240, 134, 272):
            s.dial = s.dial[:-1] if len(s.dial) > 1 else ""
            return
        if self._in(p, 146, 240, 270, 272):
            if s.dial:
                self.emit({"type": "call_dial", "number": s.dial})
                self.toast(f"Calling {s.dial}")
            return
        if self._in(p, 10, 278, 270, 294):
            if p[0] < 98:
                s.dial = "988"
            elif p[0] < 186:
                s.dial = s.caregiver_number or "988"
            else:
                s.dial = "911"

    # sms ----------------------------------------------------------------
    def _tap_sms(self, p, s):
        y = 110
        for text in QUICK_SMS:
            if self._in(p, 10, y, 270, y + 36):
                self.emit({"type": "sms_send", "to": s.caregiver_number, "text": text})
                self.toast("Message sent")
                return
            y += 42

    # volume ---------------------------------------------------------------
    def _tap_volume(self, p, s):
        if self._in(p, 24, 160, 256, 200):
            vol = int(max(0, min(100, (p[0] - 40) / 200 * 100)))
            s.volume = vol
            s.muted = False
            self.emit({"type": "volume_set", "volume": vol})
            return
        if self._in(p, 10, 216, 134, 248):
            s.muted = not s.muted
            self.emit({"type": "volume_set", "volume": 0 if s.muted else s.volume})
            return
        if self._in(p, 146, 216, 270, 248):
            self.emit({"type": "text_prompt", "text": "Say a short line so I can check the volume."})

    # meds ---------------------------------------------------------------
    def _tap_meds(self, p, s):
        for i in range(min(4, len(s.meds))):
            y = 56 + i * 54
            if self._in(p, 212, y + 12, 262, y + 38):
                item = dict(s.meds[i])
                item["enabled"] = not item.get("enabled", True)
                s.meds[i] = item
                self.emit({"type": "med_set", "index": i, **item})
                return
        if self._in(p, 10, 272, 270, 292):
            item = {"hour": 8, "minute": 0, "enabled": True, "label": "New reminder"}
            s.meds.append(item)
            self.emit({"type": "med_set", "index": len(s.meds) - 1, **item})
            self.toast("Alarm added — edit it in the app")

    # music --------------------------------------------------------------
    def _tap_music(self, p, s):
        if self._in(p, 112, 196, 168, 252):
            s.music_playing = not s.music_playing
            self.emit({"type": "music_cmd", "cmd": "play" if s.music_playing else "pause",
                       "source": s.music_source})
            return
        if self._in(p, 50, 204, 94, 248):
            self.emit({"type": "music_cmd", "cmd": "prev", "source": s.music_source})
            return
        if self._in(p, 186, 204, 230, 248):
            self.emit({"type": "music_cmd", "cmd": "next", "source": s.music_source})
            return
        if self._in(p, 34, 258, 262, 288):
            if p[0] < 46:
                s.muted = not s.muted
                self.emit({"type": "volume_set", "volume": 0 if s.muted else s.volume})
                return
            vol = int(max(0, min(100, (p[0] - 54) / 180 * 100)))
            s.volume = vol
            s.muted = False
            self.emit({"type": "volume_set", "volume": vol})
            return
        if self._in(p, 196, 26, 270, 50):
            s.music_source = "spotify" if s.music_source == "radio" else "radio"
            self.emit({"type": "music_cmd", "cmd": "source", "source": s.music_source})
            self.toast(f"Source: {s.music_source}")

    # ------------------------------------------------------- inbound state
    def on_message(self, m: dict):
        """Consume a Pi -> screen protocol message."""
        s = self.state
        t = m.get("type")
        if t == "state":
            s.listening = bool(m.get("listening"))
            s.thinking = bool(m.get("thinking"))
            s.speaking = bool(m.get("speaking"))
            s.backend = m.get("backend", s.backend)
            s.pipeline = m.get("pipeline", s.pipeline)
            s.pending = "Thinking…" if s.thinking else ""
        elif t == "chat_user":
            s.chat.append(("user", m.get("text", "")))
            s.chat[:] = s.chat[-20:]
        elif t == "chat_ai_final":
            s.chat.append(("ai", m.get("text", "")))
            s.chat[:] = s.chat[-20:]
            s.pending = ""
        elif t == "mode":
            s.mode = m.get("mode", s.mode)
        elif t == "language":
            s.language = m.get("language", s.language)
        elif t == "sos_state":
            s.sos_active = bool(m.get("active"))
        elif t == "volume":
            s.volume = int(m.get("volume", s.volume))
        elif t == "meds":
            s.meds = list(m.get("items") or [])
        elif t == "music_state":
            s.music_playing = bool(m.get("playing"))
            s.music_title = m.get("title") or "Nothing playing"
            s.music_artist = m.get("artist") or ""
            s.music_source = m.get("source", s.music_source)
        elif t == "time":
            s.clock = m.get("hhmm", s.clock)
        elif t == "power":
            s.battery = int(m.get("battery", s.battery))
            s.charging = bool(m.get("charging"))
        elif t == "net_status":
            s.online = bool(m.get("online"))
            s.signal_bars = 4 if s.online else 0
        elif t == "contact":
            s.caregiver_name = m.get("name", s.caregiver_name)
            s.caregiver_number = m.get("number", s.caregiver_number)
        elif t == "alarm":
            self.toast(m.get("label", "Medication time"))
            self.goto("meds")
        elif t == "error":
            self.toast(m.get("msg", "error"))

    # ------------------------------------------------------ paint helpers
    def _s(self, v) -> int:
        return int(round(v * self._sc))

    def _rect(self, c, color, rect, radius=0, width=0):
        x, y, w, h = rect
        pygame.draw.rect(
            c, color, (self._s(x), self._s(y), self._s(w), self._s(h)),
            max(1, self._s(width)) if width else 0,
            self._s(radius) if radius else 0)

    def _circle(self, c, color, center, r, width=0):
        pygame.draw.circle(c, color, (self._s(center[0]), self._s(center[1])),
                           self._s(r), max(1, self._s(width)) if width else 0)

    def _line(self, c, color, a, b, width=1):
        pygame.draw.line(c, color, (self._s(a[0]), self._s(a[1])),
                         (self._s(b[0]), self._s(b[1])), max(1, self._s(width)))

    def _poly(self, c, color, pts):
        pygame.draw.polygon(c, color, [(self._s(x), self._s(y)) for x, y in pts])

    def _font(self, kind, size):
        return font(kind, max(8, int(round(size * self._sc))))

    def _text(self, c, txt, pos, kind="sans", size=10, color=INK,
              center=False, right=False, mid=False):
        surf = self._font(kind, size).render(str(txt), True, color)
        r = surf.get_rect()
        px, py = self._s(pos[0]), self._s(pos[1])
        if mid:
            r.center = (px, py)
        elif center:
            r.midtop = (px, py)
        elif right:
            r.topright = (px, py)
        else:
            r.topleft = (px, py)
        c.blit(surf, r)
        return r

    def _card(self, c, rect, color=CARD, radius=10, border=LINE):
        self._rect(c, color, rect, radius)
        if border:
            self._rect(c, border, rect, radius, 1)

    def _pill(self, c, rect, label, color, active=False, size=9):
        x, y, w, h = rect
        self._rect(c, color if active else CARD2, rect, h / 2)
        self._text(c, label, (x + w / 2, y + h / 2), "bold", size,
                   WHITE if active else SUB, mid=True)

    def _toggle(self, c, x, y, on):
        self._rect(c, OK if on else (58, 68, 94), (x, y, 40, 22), 11)
        self._circle(c, WHITE, (x + (28 if on else 12), y + 11), 8)

    def _header(self, c, title, subtitle="", accent=PURPLE):
        # back chevron
        self._line(c, SUB, (22, 31), (14, 37), 2)
        self._line(c, SUB, (14, 37), (22, 43), 2)
        self._text(c, title, (34, 28), "bold", 14, INK)
        if subtitle:
            self._text(c, subtitle, (34, 45), "sans", 8, SUB)
        self._rect(c, accent, (0, 0, 0, 0))

    # --------------------------------------------------------------- paint
    def _draw(self):
        c = self._canvas
        c.fill(BG)
        painter = getattr(self, f"_paint_{self.page}", None)
        if painter:
            painter(c, self.state)
        if self.page != "splash":
            self._paint_statusbar(c, self.state)
            self._paint_nav(c, self.state)
        self._paint_toast(c, self.state)

        view = c
        if self.rotate:
            view = pygame.transform.rotate(c, -self.rotate)
        self._scr.fill(SHADE)
        self._scr.blit(view, self._offset)
        pygame.display.flip()

    def _paint_statusbar(self, c, s):
        self._rect(c, BG2, (0, 0, DESIGN_W, 22))
        self._line(c, LINE, (0, 22), (DESIGN_W, 22), 1)
        # Battery shell is static chrome; everything else is live data and is
        # skipped when the bar is painted as a background plate (battery < 0).
        self._rect(c, (90, 102, 130), (244, 6, 22, 11), 3, 1)
        self._rect(c, (90, 102, 130), (266, 9, 2.5, 5), 1)
        if s.battery < 0:
            return
        for i in range(4):
            h = 3 + i * 2.5
            col = WHITE if i < s.signal_bars else (60, 70, 96)
            self._rect(c, col, (8 + i * 5, 15 - h, 3, h), 1)
        self._text(c, "4G" if s.online else "OFF", (32, 5), "bold", 8,
                   WHITE if s.online else FAINT)
        self._text(c, s.clock, (DESIGN_W / 2, 11), "bold", 9, INK, mid=True)
        nxt = self._next_med(s)
        if nxt:
            self._text(c, f"MED {nxt}", (196, 6), "mono", 7, AMBER, right=True)
        self._text(c, f"{s.battery}%", (240, 5), "mono", 8, SUB, right=True)
        fillw = 18 * s.battery / 100
        col = CYAN if s.charging else (OK if s.battery > 25 else RED)
        if fillw >= 1:
            self._rect(c, col, (246, 8, fillw, 7), 2)

    def _paint_nav(self, c, s):
        self._rect(c, BG2, (0, 298, DESIGN_W, 22))
        self._line(c, LINE, (0, 298), (DESIGN_W, 298), 1)
        # home
        active = self.page == "home"
        self._poly(c, PURPLE if active else SUB,
                   [(112, 303), (121, 310), (103, 310)])
        self._rect(c, PURPLE if active else SUB, (107, 310, 10, 6), 1)
        # chat
        active = self.page == "chat"
        self._rect(c, PURPLE if active else SUB, (144, 303, 16, 11), 3)
        self._poly(c, PURPLE if active else SUB,
                   [(147, 314), (153, 314), (147, 318)])
        # sos
        self._rect(c, RED if not s.sos_active else (255, 90, 120), (176, 302, 34, 14), 7)
        self._text(c, "SOS", (193, 309), "bold", 8, WHITE, mid=True)

    @staticmethod
    def _next_med(s) -> str:
        items = [m for m in s.meds if m.get("enabled", True)]
        if not items:
            return ""
        now = time.localtime()
        cur = now.tm_hour * 60 + now.tm_min
        best = None
        for m in items:
            t = int(m.get("hour", 0)) * 60 + int(m.get("minute", 0))
            delta = (t - cur) % (24 * 60)
            if best is None or delta < best[0]:
                best = (delta, m)
        h, mi = int(best[1].get("hour", 0)), int(best[1].get("minute", 0))
        return f"{h:02d}:{mi:02d}"

    def _paint_toast(self, c, s):
        if not s.toast or time.time() - s.toast_at > 2.5:
            return
        f = self._font("bold", 10)
        surf = f.render(s.toast, True, WHITE)
        w = surf.get_width() / self._sc + 24
        x = (DESIGN_W - w) / 2
        self._rect(c, CARD2, (x, 264, w, 24), 12)
        self._rect(c, PURPLE, (x, 264, w, 24), 12, 1)
        c.blit(surf, surf.get_rect(center=(self._s(DESIGN_W / 2), self._s(276))))

    # ------------------------------------------------------- page painters
    def _paint_splash(self, c, s):
        c.fill(BG)
        self._circle(c, TINT, (DESIGN_W / 2, 128), 44)
        self._circle(c, PURPLE, (DESIGN_W / 2, 128), 44, 2)
        self._circle(c, PURPLE2, (DESIGN_W / 2, 128), 18)
        self._text(c, "MindBuddy", (DESIGN_W / 2, 196), "bold", 22, INK, center=True)
        self._text(c, "your calm companion", (DESIGN_W / 2, 224), "sans", 10, SUB, center=True)
        t = time.time() * 3
        for i in range(3):
            a = (math.sin(t + i * 0.8) + 1) / 2
            col = tuple(int(90 + 100 * a) for _ in range(3))
            self._circle(c, col, (DESIGN_W / 2 - 12 + i * 12, 258), 3)
        self._text(c, "starting services…", (DESIGN_W / 2, 282), "mono", 8, FAINT, center=True)

    def _paint_home(self, c, s):
        # greeting + avatar
        if not s.chrome_only:
            self._circle(c, TINT, (34, 52), 20)
            self._circle(c, PURPLE, (34, 52), 20, 2)
            self._circle(c, PURPLE2, (34, 52), 8)
        self._text(c, "Hi, I'm Buddy.", (64, 36), "bold", 15, INK)
        if s.user_name:
            self._text(c, f"How are you today, {s.user_name}?", (64, 56), "sans", 8, SUB)

        # mode + mood cards
        self._card(c, (10, 84, 128, 52))
        self._text(c, "MODE", (22, 94), "bold", 7, FAINT)
        self._text(c, MODE_LABELS.get(s.mode, s.mode)[:12], (22, 108), "bold", 13, PURPLE)
        self._card(c, (142, 84, 128, 52))
        self._text(c, "MOOD", (154, 94), "bold", 7, FAINT)
        self._text(c, s.mood, (154, 108), "bold", 13, MOOD_COLORS.get(s.mood, OK))

        # tiles
        for i, (label, page, col) in enumerate(HOME_TILES):
            x, y, w, h = self._tile_rect(i)
            filled = page in ("chat", "__sos__")
            self._rect(c, col if filled else CARD, (x, y, w, h), 10)
            if not filled:
                self._rect(c, LINE, (x, y, w, h), 10, 1)
            if not s.chrome_only:
                self._tile_glyph(c, page, (x + w / 2, y + 17), WHITE if filled else col)
            self._text(c, label, (x + w / 2, y + h - 14), "bold", 9,
                       WHITE if filled else INK, center=True)

        # talk bar
        self._rect(c, CARD2, (10, 262, 260, 30), 15)
        self._rect(c, PURPLE, (10, 262, 260, 30), 15, 1)
        self._circle(c, PURPLE, (28, 277), 9)
        self._rect(c, WHITE, (26, 273, 4, 7), 2)
        self._text(c, "Talk to Buddy now", (150, 277), "bold", 11, INK, mid=True)

    def _tile_glyph(self, c, page, ctr, col):
        x, y = ctr
        if page == "chat":
            self._rect(c, col, (x - 8, y - 6, 16, 11), 3)
            self._poly(c, col, [(x - 5, y + 5), (x + 1, y + 5), (x - 5, y + 10)])
        elif page == "mood":
            self._circle(c, col, (x, y), 8, 2)
            self._circle(c, col, (x - 3, y - 2), 1)
            self._circle(c, col, (x + 3, y - 2), 1)
            self._line(c, col, (x - 4, y + 3), (x + 4, y + 3), 1.5)
        elif page == "music":
            self._circle(c, col, (x - 4, y + 6), 3)
            self._rect(c, col, (x - 2, y - 8, 2, 14), 1)
            self._rect(c, col, (x - 2, y - 8, 10, 3), 1)
        elif page == "meds":
            self._rect(c, col, (x - 8, y - 7, 16, 14), 4, 2)
            self._line(c, col, (x, y - 3), (x, y + 3), 2)
            self._line(c, col, (x - 3, y), (x + 3, y), 2)
        elif page == "modes":
            self._circle(c, col, (x, y), 8, 2)
            self._line(c, col, (x, y - 4), (x, y), 2)
            self._line(c, col, (x, y), (x + 4, y + 2), 2)
        else:  # SOS
            self._poly(c, col, [(x, y - 9), (x + 9, y + 6), (x - 9, y + 6)])

    def _paint_modes(self, c, s):
        self._header(c, "Therapy Mode", "tap to switch Buddy's focus")
        for i, m in enumerate(MODES):
            y = 52 + i * 36
            active = m == s.mode
            self._rect(c, TINT if active else CARD, (10, y, 260, 32), 9)
            self._rect(c, PURPLE if active else LINE, (10, y, 260, 32), 9, 1)
            self._text(c, MODE_LABELS.get(m, m), (24, y + 16), "bold", 11,
                       WHITE if active else INK, mid=False)
            self._circle(c, PURPLE if active else (70, 82, 110), (250, y + 16), 7, 0 if active else 2)
            if active:
                self._circle(c, WHITE, (250, y + 16), 3)
        self._text(c, "PIPELINE", (12, 268), "bold", 7, FAINT)
        for i, name in enumerate(PIPELINES):
            self._pill(c, (10 + i * 88, 282, 84, 26), PIPELINE_LABELS[name],
                       PURPLE, active=(s.pipeline == name), size=10)

    def _paint_mood(self, c, s):
        self._header(c, "How do you feel?", "")
        for i, m in enumerate(MOODS):
            x, y, w, h = self._mood_rect(i)
            active = m == s.mood
            col = MOOD_COLORS.get(m, PURPLE)
            self._rect(c, col if active else CARD, (x, y, w, h), 10)
            if not active:
                self._rect(c, LINE, (x, y, w, h), 10, 1)
            self._text(c, m.title(), (x + w / 2, y + h / 2), "bold", 13,
                       WHITE if active else INK, mid=True)
        self._card(c, (10, 258, 260, 28), CARD2)
        if s.mood:
            self._text(c, f"Logged mood: {s.mood}", (140, 272), "bold", 10,
                       MOOD_COLORS.get(s.mood, OK), mid=True)

    def _paint_chat(self, c, s):
        # header
        if not s.chrome_only:
            self._circle(c, TINT, (24, 40), 11)
            self._circle(c, PURPLE, (24, 40), 11, 1.5)
            self._circle(c, PURPLE2, (24, 40), 4)
        self._text(c, "Buddy · online", (42, 30), "bold", 12, INK)
        if s.mode or s.pipeline:
            self._text(c, f"{s.mode.title()} · {PIPELINE_LABELS.get(s.pipeline, s.pipeline)}",
                       (42, 46), "sans", 8, SUB)
        self._line(c, LINE, (0, 60), (DESIGN_W, 60), 1)

        f = self._font("sans", 9)
        lines: list[tuple[str, str]] = []
        for role, text in s.chat[-10:]:
            wrapped = self._wrap(text, f, int(170 * self._sc))
            for j, ln in enumerate(wrapped):
                lines.append((role, ln))
        if s.pending:
            lines.append(("ai", s.pending))
        y = 226
        for role, ln in reversed(lines):
            if y < 74:
                break
            surf = f.render(ln, True, WHITE if role == "user" else INK)
            w = surf.get_width() / self._sc + 18
            if role == "user":
                rect = (DESIGN_W - 12 - w, y - 20, w, 20)
                self._rect(c, PURPLE, rect, 8)
            else:
                rect = (12, y - 20, w, 20)
                self._rect(c, CARD, rect, 8)
                self._rect(c, LINE, rect, 8, 1)
            c.blit(surf, (self._s(rect[0] + 9), self._s(rect[1] + 5)))
            y -= 23

        # live strip
        if s.listening or s.speaking:
            t = time.time() * 6
            for i in range(44):
                a = abs(math.sin(i * 0.5 + t)) * 8 + 1
                self._line(c, PURPLE2 if i % 2 else CYAN,
                           (10 + i * 6, 238 - a), (10 + i * 6, 238 + a), 1.5)
        elif s.backend:
            self._text(c, "Thinking…" if s.thinking else f"{s.backend.upper()} backend",
                       (DESIGN_W / 2, 238), "mono", 8, FAINT, mid=True)

        # chips
        x = 10
        for t in CHIPS:
            w = 18 + int(len(t) * 5.2)
            self._rect(c, CARD, (x, 248, w, 20), 10)
            self._rect(c, LINE, (x, 248, w, 20), 10, 1)
            self._text(c, t, (x + w / 2, 258), "sans", 8, SUB, mid=True)
            x += w + 6

        # composer
        self._rect(c, CARD, (10, 274, 220, 22), 11)
        self._rect(c, LINE, (10, 274, 220, 22), 11, 1)
        self._text(c, "Say something to Buddy…", (22, 285), "sans", 8, FAINT, mid=False)
        self._circle(c, PURPLE, (253, 285), 11)
        self._poly(c, WHITE, [(249, 280), (259, 285), (249, 290)])

    @staticmethod
    def _wrap(text: str, f: pygame.font.Font, width: int) -> list[str]:
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

    def _paint_pipeline(self, c, s):
        self._header(c, "AI Pipeline", "where Buddy thinks")
        for i, name in enumerate(PIPELINES):
            y = 60 + i * 60
            active = name == s.pipeline
            self._rect(c, TINT if active else CARD, (10, y, 260, 52), 10)
            self._rect(c, PURPLE if active else LINE, (10, y, 260, 52), 10, 1)
            self._circle(c, PURPLE if active else (70, 82, 110), (34, y + 26), 8,
                         0 if active else 2)
            self._text(c, PIPELINE_LABELS[name], (56, y + 12), "bold", 13, INK)
            self._text(c, {"cloud": "best quality · needs internet",
                           "local": "private · always available",
                           "auto": "local first, cloud when online"}[name],
                       (56, y + 30), "sans", 8, SUB)
        if s.backend:
            self._text(c, f"RASPI5 · {'ONLINE' if s.online else 'OFFLINE'} · {s.backend.upper()}",
                       (DESIGN_W / 2, 262), "mono", 9, OK if s.online else RED, mid=True)

    def _paint_keypad(self, c, s):
        self._card(c, (10, 28, 260, 40), CARD)
        self._text(c, s.dial or "Enter number", (140, 48), "mono", 18,
                   INK if s.dial else FAINT, mid=True)
        keys = "123456789*0#"
        subs = {"2": "ABC", "3": "DEF", "4": "GHI", "5": "JKL",
                "6": "MNO", "7": "PQRS", "8": "TUV", "9": "WXYZ"}
        for i, k in enumerate(keys):
            x, y, w, h = self._key_rect(i)
            self._rect(c, CARD, (x, y, w, h), 9)
            self._rect(c, LINE, (x, y, w, h), 9, 1)
            self._text(c, k, (x + w / 2, y + (14 if k in subs else 18)), "bold", 16, INK, mid=True)
            if k in subs:
                self._text(c, subs[k], (x + w / 2, y + 26), "mono", 6, FAINT, mid=True)
        self._rect(c, CARD2, (10, 240, 124, 32), 10)
        self._text(c, "Clear", (72, 256), "bold", 11, SUB, mid=True)
        self._rect(c, OK, (146, 240, 124, 32), 10)
        self._text(c, "Call", (208, 256), "bold", 12, WHITE, mid=True)
        for i, (label, col) in enumerate((("988", AMBER), (s.caregiver_name[:9], PURPLE),
                                          ("911", RED))):
            x = 10 + i * 88
            self._rect(c, CARD, (x, 278, 84, 16), 8)
            self._rect(c, col, (x, 278, 84, 16), 8, 1)
            self._text(c, label, (x + 42, 286), "bold", 8, col, mid=True)

    def _paint_sms(self, c, s):
        self._header(c, "Quick message", "sent to your caregiver")
        self._card(c, (10, 62, 260, 40))
        self._circle(c, PURPLE, (32, 82), 13)
        self._text(c, (s.caregiver_name or "JD")[:2].upper(), (32, 82), "bold", 10, WHITE, mid=True)
        self._text(c, s.caregiver_name, (54, 70), "bold", 11, INK)
        self._text(c, s.caregiver_number or "no number saved", (54, 86), "mono", 8, SUB)
        y = 110
        for text in QUICK_SMS:
            self._rect(c, CARD, (10, y, 260, 36), 9)
            self._rect(c, LINE, (10, y, 260, 36), 9, 1)
            self._text(c, text, (24, y + 18), "sans", 9, INK, mid=False)
            y += 42

    def _paint_volume(self, c, s):
        self._header(c, "Volume", "speaker output")
        if s.chrome_only:
            self._rect(c, CARD2, (40, 176, 200, 10), 5)
            return
        vol = 0 if s.muted else s.volume
        self._text(c, vol, (DESIGN_W / 2, 120), "bold", 42, PURPLE, mid=True)
        self._rect(c, CARD2, (40, 176, 200, 10), 5)
        w = 200 * vol / 100
        if w >= 1:
            self._rect(c, PURPLE, (40, 176, w, 10), 5)
        self._circle(c, WHITE, (40 + w, 181), 9)
        self._circle(c, PURPLE, (40 + w, 181), 9, 2)
        self._pill(c, (10, 216, 124, 32), "Mute" if not s.muted else "Unmute", RED, s.muted, 11)
        self._pill(c, (146, 216, 124, 32), "Test voice", PURPLE, False, 11)

    def _paint_meds(self, c, s):
        self._header(c, "Medication Alarms", "")
        nxt = self._next_med(s)
        self._text(c, f"Next {nxt}" if nxt else "No alarms", (268, 30), "bold", 9,
                   AMBER, right=True)
        for i in range(4):
            y = 56 + i * 54
            m = s.meds[i] if i < len(s.meds) else None
            self._rect(c, CARD if m else (18, 24, 40), (10, y, 260, 48), 10)
            self._rect(c, LINE, (10, y, 260, 48), 10, 1)
            if not m:
                if s.meds:
                    self._text(c, "Empty slot", (140, y + 24), "sans", 9, FAINT, mid=True)
                continue
            on = m.get("enabled", True)
            self._rect(c, PURPLE if on else (70, 82, 110), (10, y + 12, 4, 24), 2)
            self._text(c, m.get("label", "Reminder"), (26, y + 10), "bold", 12, INK)
            self._text(c, f"{int(m.get('hour', 0)):02d}:{int(m.get('minute', 0)):02d} · Daily",
                       (26, y + 28), "mono", 8, SUB)
            if not s.chrome_only:
                self._toggle(c, 214, y + 13, on)
        self._rect(c, PURPLE, (10, 272, 260, 20), 10)
        self._text(c, "+  Add Alarm", (140, 282), "bold", 10, WHITE, mid=True)

    def _paint_music(self, c, s):
        self._header(c, "Now Playing", "")
        if s.music_source:
            self._pill(c, (208, 28, 60, 18), s.music_source.title(), PURPLE, True, 8)
        # album art
        self._rect(c, CARD2, (92, 54, 96, 96), 14)
        self._rect(c, PURPLE, (92, 54, 96, 96), 14, 1)
        self._circle(c, PURPLE2, (140, 102), 26, 2)
        self._circle(c, PURPLE, (140, 102), 8)
        self._text(c, s.music_title[:24], (DESIGN_W / 2, 162), "bold", 13, INK, center=True)
        self._text(c, (s.music_artist or "MindBuddy Audio")[:30], (DESIGN_W / 2, 180),
                   "sans", 9, SUB, center=True)
        # transport
        self._circle(c, CARD, (72, 226), 20)
        self._circle(c, LINE, (72, 226), 20, 1)
        self._poly(c, INK, [(78, 218), (78, 234), (68, 226)])
        self._rect(c, INK, (65, 218, 3, 16), 1)
        self._circle(c, PURPLE, (140, 224), 26)
        if s.chrome_only:
            pass
        elif s.music_playing:
            self._rect(c, WHITE, (133, 214, 5, 20), 2)
            self._rect(c, WHITE, (143, 214, 5, 20), 2)
        else:
            self._poly(c, WHITE, [(134, 213), (134, 235), (152, 224)])
        self._circle(c, CARD, (208, 226), 20)
        self._circle(c, LINE, (208, 226), 20, 1)
        self._poly(c, INK, [(202, 218), (202, 234), (212, 226)])
        self._rect(c, INK, (213, 218, 3, 16), 1)
        # volume row
        if s.chrome_only:
            self._rect(c, CARD2, (54, 269, 180, 8), 4)
            return
        vol = 0 if s.muted else s.volume
        self._poly(c, SUB if not s.muted else RED,
                   [(30, 269), (30, 277), (36, 277), (42, 283), (42, 263), (36, 269)])
        self._rect(c, CARD2, (54, 269, 180, 8), 4)
        w = 180 * vol / 100
        if w >= 1:
            self._rect(c, PURPLE, (54, 269, w, 8), 4)
        self._circle(c, WHITE, (54 + w, 273), 7)
        self._circle(c, PURPLE, (54 + w, 273), 7, 2)
        self._text(c, vol, (262, 273), "mono", 9, SUB, mid=True)

    def _paint_voice(self, c, s):
        self._header(c, "AI TTS Voice", "")
        for i, (name, sub) in enumerate(VOICES):
            y = 50 + i * 30
            active = name == s.voice
            self._rect(c, TINT if active else CARD, (10, y, 260, 26), 8)
            self._rect(c, PURPLE if active else LINE, (10, y, 260, 26), 8, 1)
            self._circle(c, PURPLE if active else CARD2, (28, y + 13), 8)
            if not s.chrome_only:
                self._poly(c, WHITE if active else SUB,
                           [(25, y + 9), (25, y + 17), (32, y + 13)])
            self._text(c, name, (44, y + 5), "bold", 10, WHITE if active else INK)
            self._text(c, sub, (44, y + 16), "mono", 7, SUB if active else FAINT)