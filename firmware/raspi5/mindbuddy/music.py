"""Music playback for the Pi 5: Spotify (online) + internet radio / local files.

Spotify uses librespot (Spotify Connect device) for audio plus the Web API
for transport control, so a Premium account streams straight to the Pi's
speaker. Radio and local files are played with mpv, which is also the
offline fallback whenever Spotify is unavailable.
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import threading
from typing import Callable

log = logging.getLogger("music")

DEFAULT_STATIONS = [
    ("Calm Radio Ambient", "http://streams.calmradio.com/api/39/128/stream"),
    ("SomaFM Drone Zone", "https://ice2.somafm.com/dronezone-128-mp3"),
    ("SomaFM Deep Space", "https://ice2.somafm.com/deepspaceone-128-mp3"),
    ("Nature Sounds", "https://streams.fluxfm.de/Chillhop/mp3-320/"),
]


class MusicPlayer:
    def __init__(self, alsa_out: str = "default",
                 spotify_user: str = "", spotify_pass: str = "",
                 spotify_client_id: str = "", spotify_client_secret: str = "",
                 spotify_refresh_token: str = "", device_name: str = "MindBuddy",
                 stations: list[tuple[str, str]] | None = None,
                 on_state: Callable[[dict], None] | None = None):
        self.alsa_out = alsa_out
        self.device_name = device_name
        self.stations = stations or DEFAULT_STATIONS
        self.on_state = on_state or (lambda _s: None)
        self.source = "radio"
        self.index = 0
        self.playing = False
        self._proc: subprocess.Popen | None = None
        self._librespot: subprocess.Popen | None = None
        self._lock = threading.Lock()
        self._sp = None
        self._sp_creds = (spotify_client_id, spotify_client_secret, spotify_refresh_token)
        self._librespot_creds = (spotify_user, spotify_pass)

    # ------------------------------------------------------------- public
    def start(self):
        if all(self._sp_creds) or all(self._librespot_creds):
            threading.Thread(target=self._start_spotify, daemon=True).start()

    def command(self, cmd: str, **kw):
        cmd = (cmd or "").lower()
        src = kw.get("source")
        if src and src != self.source:
            self.set_source(src)
        if cmd in ("play", "resume", "toggle"):
            self.play()
        elif cmd in ("pause", "stop"):
            self.pause()
        elif cmd == "next":
            self.skip(+1)
        elif cmd == "prev":
            self.skip(-1)
        elif cmd == "source":
            self.set_source(src or ("spotify" if self.source == "radio" else "radio"))
        elif cmd == "play_uri" and kw.get("uri"):
            self.play_spotify_uri(kw["uri"])

    def set_source(self, source: str):
        source = source if source in ("radio", "spotify") else "radio"
        if source == self.source:
            return
        self.pause()
        self.source = source
        self._emit()

    def play(self):
        if self.source == "spotify" and self._spotify():
            try:
                self._spotify().start_playback(device_id=self._device_id())
                self.playing = True
                self._emit()
                return
            except Exception as e:
                log.warning("spotify play failed (%s) — falling back to radio", e)
                self.source = "radio"
        self._play_radio()

    def pause(self):
        if self.source == "spotify" and self._spotify():
            try:
                self._spotify().pause_playback(device_id=self._device_id())
            except Exception as e:
                log.debug("spotify pause: %s", e)
        self._kill()
        self.playing = False
        self._emit()

    def skip(self, delta: int):
        if self.source == "spotify" and self._spotify():
            try:
                sp = self._spotify()
                (sp.next_track if delta > 0 else sp.previous_track)(device_id=self._device_id())
                self._emit()
                return
            except Exception as e:
                log.warning("spotify skip: %s", e)
        self.index = (self.index + delta) % max(1, len(self.stations))
        self._play_radio()

    def play_spotify_uri(self, uri: str):
        sp = self._spotify()
        if not sp:
            log.warning("no spotify credentials — ignoring %s", uri)
            return
        try:
            kw = {"context_uri": uri} if not uri.startswith("spotify:track") else {"uris": [uri]}
            sp.start_playback(device_id=self._device_id(), **kw)
            self.source = "spotify"
            self.playing = True
            self._emit()
        except Exception as e:
            log.warning("spotify uri play failed: %s", e)

    def stop(self):
        self._kill()
        if self._librespot and self._librespot.poll() is None:
            self._librespot.terminate()

    def state(self) -> dict:
        title, artist = self.now_playing()
        return {"type": "music_state", "playing": self.playing, "title": title,
                "artist": artist, "source": self.source}

    def now_playing(self) -> tuple[str, str]:
        if self.source == "spotify" and self._spotify():
            try:
                cur = self._spotify().current_playback()
                if cur and cur.get("item"):
                    it = cur["item"]
                    return it["name"], ", ".join(a["name"] for a in it.get("artists", []))
            except Exception:
                pass
            return "Spotify", ""
        if self.stations:
            return self.stations[self.index % len(self.stations)][0], "Internet radio"
        return "Nothing playing", ""

    # ------------------------------------------------------------ internals
    def _emit(self):
        try:
            self.on_state(self.state())
        except Exception:
            log.exception("music state callback failed")

    def _kill(self):
        with self._lock:
            if self._proc and self._proc.poll() is None:
                self._proc.terminate()
                try:
                    self._proc.wait(timeout=2)
                except Exception:
                    self._proc.kill()
            self._proc = None

    def _play_radio(self):
        if not self.stations:
            return
        url = self.stations[self.index % len(self.stations)][1]
        player = shutil.which("mpv") or shutil.which("ffplay")
        if not player:
            log.warning("neither mpv nor ffplay installed — cannot play radio")
            return
        self._kill()
        if player.endswith("mpv"):
            cmd = [player, "--no-video", "--really-quiet", f"--audio-device=alsa/{self.alsa_out}", url]
        else:
            cmd = [player, "-nodisp", "-autoexit", "-loglevel", "quiet", url]
        with self._lock:
            self._proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.playing = True
        self.source = "radio"
        self._emit()

    def _start_spotify(self):
        user, pw = self._librespot_creds
        librespot = shutil.which("librespot")
        if librespot and user and pw:
            try:
                self._librespot = subprocess.Popen(
                    [librespot, "--name", self.device_name, "--bitrate", "160",
                     "--backend", "alsa", "--device", self.alsa_out,
                     "--username", user, "--password", pw],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                log.info("librespot started as Spotify Connect device %r", self.device_name)
            except Exception as e:
                log.warning("librespot failed: %s", e)
        self._spotify()

    def _spotify(self):
        if self._sp is not None:
            return self._sp or None
        cid, secret, refresh = self._sp_creds
        if not all((cid, secret, refresh)):
            self._sp = False
            return None
        try:
            import spotipy
            from spotipy.oauth2 import SpotifyOAuth
            auth = SpotifyOAuth(client_id=cid, client_secret=secret,
                                redirect_uri=os.environ.get("SPOTIFY_REDIRECT_URI",
                                                            "http://localhost:8888/callback"),
                                scope="user-read-playback-state user-modify-playback-state",
                                open_browser=False, cache_path="/tmp/.mb-spotify-cache")
            token = auth.refresh_access_token(refresh)
            self._sp = spotipy.Spotify(auth=token["access_token"])
            log.info("spotify web api ready")
        except Exception as e:
            log.warning("spotify web api unavailable: %s", e)
            self._sp = False
        return self._sp or None

    def _device_id(self) -> str | None:
        sp = self._spotify()
        if not sp:
            return None
        try:
            for d in sp.devices().get("devices", []):
                if d.get("name") == self.device_name:
                    return d.get("id")
        except Exception:
            pass
        return None
