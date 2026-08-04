"""Audio input (LC Technology RPI_AC108 4-mic array, AC108 quad ADC over
I2S/TDM) and output (MAX98357A I2S).
Downmixes the 4 AC108 mic channels to mono @ 16 kHz for whisper.
"""
from __future__ import annotations
import queue, threading, logging
import numpy as np
import sounddevice as sd
import soundfile as sf

log = logging.getLogger("audio")


def resolve_device(spec: str, kind: str = "input"):
    """Map an ALSA-style spec ("plughw:seeed4micvoicec", "hw:1,0", "default")
    onto something PortAudio/sounddevice actually accepts.

    PortAudio does not understand ALSA plugin names, so we look the card up in
    the device list by name/substring and return its numeric index.
    """
    if spec in ("", None):
        return None
    if isinstance(spec, int) or str(spec).isdigit():
        return int(spec)

    want_in = kind == "input"
    # As-is first: works for plain PortAudio names and "default".
    try:
        sd.check_input_settings(device=spec) if want_in else sd.check_output_settings(device=spec)
        return spec
    except Exception:
        pass

    # Strip ALSA plugin prefixes and trailing ",0" subdevice.
    token = str(spec)
    for pfx in ("plughw:", "plug:", "hw:", "dsnoop:", "dmix:"):
        if token.startswith(pfx):
            token = token[len(pfx):]
            break
    token = token.split(",")[0].strip().lower()

    try:
        devices = sd.query_devices()
    except Exception as e:
        log.warning("could not query audio devices: %s", e)
        return spec

    def usable(d):
        return (d["max_input_channels"] if want_in else d["max_output_channels"]) > 0

    candidates = [(i, d) for i, d in enumerate(devices) if usable(d)]
    for i, d in candidates:
        if token and token in d["name"].lower().replace(" ", ""):
            log.info("resolved %s -> device %d (%s)", spec, i, d["name"])
            return i
    for i, d in candidates:
        if token and token[:12] in d["name"].lower():
            log.info("resolved %s -> device %d (%s)", spec, i, d["name"])
            return i
    if candidates:
        i, d = candidates[0]
        log.warning("no %s device matched %r - using %d (%s)", kind, spec, i, d["name"])
        return i
    log.error("no usable %s devices found", kind)
    return None

class AudioIO:
    def __init__(self, in_device: str, out_device: str, sr: int = 16000,
                 in_channels: int = 4):
        self.sr = sr; self.in_device = in_device; self.out_device = out_device
        # Resolved PortAudio device ids (lazily computed).
        self._in_id = None; self._out_id = None
        # AC108 exposes 4 TDM capture channels.
        self.in_channels = max(1, int(in_channels))
        self._q: queue.Queue[np.ndarray] = queue.Queue(maxsize=50)
        self._stream = None
        self._enabled = threading.Event(); self._enabled.set()
        self._volume = 0.7  # 0..1

    # ---------- device resolution ----------
    @property
    def in_id(self):
        if self._in_id is None:
            self._in_id = resolve_device(self.in_device, "input")
        return self._in_id

    @property
    def out_id(self):
        if self._out_id is None:
            self._out_id = resolve_device(self.out_device, "output")
        return self._out_id

    # ---------- input ----------
    def _cb(self, indata, frames, time_info, status):
        if status: log.debug("in status %s", status)
        if not self._enabled.is_set(): return
        # AC108 4-mic TDM → mono
        mono = indata.mean(axis=1) if indata.ndim == 2 and indata.shape[1] > 1 else indata.ravel()
        try: self._q.put_nowait(mono.astype(np.float32).copy())
        except queue.Full: pass

    def start_capture(self):
        # Try the requested channel count, then progressively simpler configs
        # so a partly-configured ac108 (or a plain USB mic) still works.
        attempts = []
        for ch in (self.in_channels, 4, 2, 1):
            if ch not in attempts: attempts.append(ch)
        last_err = None
        for ch in attempts:
            try:
                self._open_stream(ch)
                log.info("capture started on %s (%dch)", self.in_device, ch)
                return
            except Exception as e:
                last_err = e
                log.warning("capture at %dch failed: %s", ch, e)
        log.error("microphone unavailable (%s) - continuing without capture; "
                  "check `arecord -l` and ALSA_IN in .env", last_err)

    def _open_stream(self, channels: int):
        dev = self.in_id
        if dev is None:
            raise RuntimeError(f"no input device matching {self.in_device!r}")
        self._stream = sd.InputStream(
            device=dev, channels=channels, samplerate=self.sr,
            blocksize=int(self.sr * 0.03), dtype="float32", callback=self._cb,
        )
        self._stream.start()
        self.in_channels = channels


    def stop_capture(self):
        if self._stream:
            try: self._stream.stop(); self._stream.close()
            except Exception: pass
            self._stream = None

    def pause(self):  self._enabled.clear()
    def resume(self): self._enabled.set()
    def flush(self):
        with self._q.mutex: self._q.queue.clear()

    def read_seconds(self, secs: float) -> np.ndarray:
        want = int(self.sr * secs); buf = []
        while sum(len(b) for b in buf) < want:
            try: buf.append(self._q.get(timeout=1.0))
            except queue.Empty: break
        return np.concatenate(buf) if buf else np.zeros(0, dtype=np.float32)

    # ---------- output ----------
    def set_volume(self, v: int):
        self._volume = max(0.0, min(1.0, v / 100.0))

    def play_wav(self, path: str, blocking: bool = True):
        data, sr = sf.read(path, dtype="float32")
        if data.ndim == 1: data = data[:, None]
        data = data * self._volume
        try:
            sd.play(data, sr, device=self.out_id)
            if blocking: sd.wait()
        except Exception as e:
            log.error("playback failed (%s): %s", self.out_device, e)

    def play_pcm(self, pcm: np.ndarray, sr: int, blocking: bool = True):
        if pcm.dtype != np.float32:
            pcm = pcm.astype(np.float32) / (32768.0 if pcm.dtype == np.int16 else 1.0)
        try:
            sd.play(pcm * self._volume, sr, device=self.out_id)
            if blocking: sd.wait()
        except Exception as e:
            log.error("playback failed (%s): %s", self.out_device, e)

    def stop_playback(self):
        sd.stop()

    def beep(self, freq: float = 880, ms: int = 120):
        t = np.linspace(0, ms / 1000.0, int(self.sr * ms / 1000.0), False)
        tone = 0.3 * np.sin(2 * np.pi * freq * t).astype(np.float32)
        self.play_pcm(tone, self.sr, blocking=False)
