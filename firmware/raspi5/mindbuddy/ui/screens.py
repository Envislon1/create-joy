"""Screen map for the Pi 5 artwork UI — 1:1 with the web /tft-simulator.

Everything here is pure data: which artwork file backs each page, and where
the touch regions sit on the 280x320 design grid. `artwork_app.py` renders it
and emits the protocol messages.

Home-page correction (as requested):
    * the top-left big tile is MODE (it opens mode selection);
    * the old narrow "Mode" strip at the top is gone;
    * there is no manual MB-Chat tile — the chat page opens by itself when
      MindBuddy answers.
"""
from __future__ import annotations

SCREEN_W = 280
SCREEN_H = 320

MODES = ["ANXIETY", "DEPRESSION", "ADHD", "PTSD", "BIPOLAR", "SCHIZOPHRENIA"]
MOODS = ["GREAT", "GOOD", "OKAY", "LOW", "SAD", "ANGRY"]
EXERCISES = ["BREATHING", "MINDFULNESS", "STRESS", "POSITIVE", "SLEEP", "RANDOM"]
VOICES = ["Default", "Nicole", "Sarah", "Sky", "Bella", "Adam", "Michael", "Emma"]
PIPELINES = ["local", "cloud", "auto"]

MODE_ASSET = {
    "ANXIETY": "mode_selection_anxiety.png",
    "DEPRESSION": "mode_selection_depression.png",
    "ADHD": "mode_selection_adhd.png",
    "PTSD": "mode_selection_ptsd.png",
    "BIPOLAR": "mode_selection_bipolar.png",
    "SCHIZOPHRENIA": "mode_selection_schizo.png",
}
MOOD_ASSET = {
    "GREAT": "mood_great.png", "GOOD": "mood_good.png", "OKAY": "mood_okay.png",
    "LOW": "mood_low.png", "SAD": "mood_sad.png", "ANGRY": "mood_angry.png",
}
EXERCISE_ASSET = {
    "BREATHING": "exercise_breathing_exercises.png",
    "MINDFULNESS": "exercise_mindfulness_meditation.png",
    "STRESS": "exercise_stress_anxiety_relief.png",
    "POSITIVE": "exercise_positive_thinking_emotional_wellness.png",
    "SLEEP": "exercise_sleep_recovery.png",
    "RANDOM": "exercise_random_exercise.png",
}
VOICE_ASSET = {v: f"settings_page_voice_setting_{v.lower()}_voice.png" for v in VOICES}
PIPELINE_ASSET = {
    "local": "settings_page_local_pipeline.png",
    "cloud": "settings_page_cloud_pipeline.png",
    "auto": "settings_page_hybrid_pipeline.png",
}
# Kokoro voice ids behind the artwork names.
VOICE_ID = {
    "Default": "af_heart", "Nicole": "af_nicole", "Sarah": "af_sarah",
    "Sky": "af_sky", "Bella": "af_bella", "Adam": "am_adam",
    "Michael": "am_michael", "Emma": "bf_emma",
}


def battery_bucket(pct: int) -> str:
    if pct <= 10:
        return "batempty"
    if pct <= 30:
        return "bat1"
    if pct <= 55:
        return "bat2"
    if pct <= 80:
        return "bat3"
    return "bat4"


def home_asset(wifi: bool, mobile: bool, pipeline: str, battery: int,
               exists=lambda name: True) -> str:
    """Pick the shipped home artwork for the live radio/power condition."""
    w = "wifi" if wifi else "nowifi"
    m = "mobile" if mobile else "nomobile"
    p = pipeline if pipeline in ("local", "cloud", "auto") else "auto"
    order = ["batempty", "bat1", "bat2", "bat3", "bat4"]
    want = battery_bucket(battery)
    tries = [want] + [b for b in order if b != want]
    for pl in (p, "auto"):
        for b in tries:
            name = f"home_page_{w}_{m}_{pl}_{b}.png"
            if exists(name):
                return name
    return "home_page_wifi_mobile_auto_bat4.png"


def page_asset(page: str, st, exists=lambda name: True) -> str:
    """Background artwork file name for a page."""
    if page == "splash":
        return "home_page_splash.mp4"
    if page == "home":
        return home_asset(st.wifi, st.mobile, st.pipeline, st.battery, exists)
    if page == "mode":
        return MODE_ASSET.get(st.mode, "mode_selection_mode.png")
    if page == "mood":
        return MOOD_ASSET.get(st.mood, "mood_mood.png")
    if page == "exercise":
        return EXERCISE_ASSET.get(st.exercise, "exercise_random_exercise.png")
    if page == "settings":
        return "settings_page_settings.png"
    if page == "pipeline":
        return PIPELINE_ASSET.get(st.pipeline, "settings_page_hybrid_pipeline.png")
    if page == "voice":
        return VOICE_ASSET.get(st.voice, "settings_page_voice_setting_default_voice.png")
    if page == "dnd":
        return "settings_page_dnd_activated.png" if st.dnd else "settings_page_dnd_deactivated.png"
    if page == "wifi":
        return "settings_page_wifi_page.png"
    if page == "deviceconfig":
        return "settings_page_device_config.png"
    if page == "chat":
        return "other_pages_ai_response_animation.mp4"
    if page == "music":
        return "other_pages_music_is_playing.mp4" if st.music_playing else "other_pages_music_is_paused.mp4"
    if page == "keypad":
        return "other_pages_keypad.png"
    if page == "calling":
        return "other_pages_calling.png"
    if page == "incoming":
        return "other_pages_call_receive_page.png"
    if page == "connected":
        return "other_pages_call_connected_end_call_page.png"
    return "other_pages_home_page_model.png"


# region tuple: (id, x, y, w, h)
_HOME = [
    ("mode", 22, 64, 76, 76),
    ("meds", 104, 64, 76, 76),
    ("music", 181, 63, 77, 77),
    ("mood", 23, 146, 75, 75),
    ("settings", 104, 146, 76, 76),
    ("exercise", 181, 146, 77, 77),
    ("keypad", 99, 233, 82, 82),
]
_MODE = [
    ("back", 12, 105, 80, 80),
    ("BIPOLAR", 112, 35, 71, 71), ("SCHIZOPHRENIA", 193, 42, 71, 73),
    ("PTSD", 112, 120, 71, 71), ("ADHD", 193, 129, 71, 71),
    ("DEPRESSION", 112, 205, 71, 71), ("ANXIETY", 193, 212, 71, 73),
]
_MOOD = [
    ("back", 12, 105, 80, 80),
    ("GREAT", 112, 35, 71, 71), ("GOOD", 193, 43, 71, 72),
    ("OKAY", 112, 120, 71, 71), ("LOW", 193, 129, 71, 71),
    ("SAD", 112, 205, 71, 71), ("ANGRY", 193, 214, 71, 71),
]
_EXERCISE = [
    ("back", 18, 110, 68, 68),
    ("BREATHING", 104, 26, 172, 34), ("MINDFULNESS", 98, 70, 178, 34),
    ("STRESS", 104, 114, 172, 34), ("POSITIVE", 100, 162, 176, 48),
    ("SLEEP", 98, 226, 178, 34), ("RANDOM", 104, 266, 168, 28),
]
_SETTINGS = [
    ("back", 16, 108, 84, 84),
    ("pipeline", 112, 35, 71, 71), ("voice", 193, 44, 71, 71),
    ("volume", 112, 120, 71, 71), ("deviceconfig", 193, 129, 71, 71),
    ("wifi", 112, 205, 71, 71), ("dnd", 193, 214, 71, 71),
]
_PIPELINE = [
    ("back", 20, 70, 84, 84),
    ("local", 153, 39, 71, 71), ("cloud", 153, 124, 71, 72), ("auto", 153, 210, 71, 71),
]
_DND = [
    ("back", 18, 110, 78, 78),
    ("on", 126, 86, 78, 72), ("off", 126, 165, 72, 70),
]
_VOICE = [("back", 18, 110, 78, 78)] + [
    (name, x, y, 64, 64) for name, x, y in [
        ("Default", 118, 12), ("Nicole", 118, 87), ("Sarah", 118, 162), ("Sky", 118, 237),
        ("Bella", 198, 28), ("Adam", 198, 103), ("Michael", 198, 178), ("Emma", 198, 253),
    ]
]

_KEY_COLS = [29, 85, 141]
_KEY_ROWS = [74, 126, 177, 228]
_KEYPAD = []
for _r, _row in enumerate((["7", "8", "9"], ["4", "5", "6"], ["1", "2", "3"])):
    for _c, _k in enumerate(_row):
        _KEYPAD.append((f"key:{_k}", _KEY_COLS[_c], _KEY_ROWS[_r], 54, 50))
_KEYPAD += [
    ("clear", _KEY_COLS[0], _KEY_ROWS[3], 54, 50),
    ("key:0", _KEY_COLS[1], _KEY_ROWS[3], 54, 50),
    ("backspace", _KEY_COLS[2], _KEY_ROWS[3], 54, 50),
    ("back", 204, 94, 62, 44),
    ("call", 207, 154, 58, 58),
    ("save", 200, 226, 66, 44),
]


def regions(page: str) -> list[tuple[str, int, int, int, int]]:
    if page == "splash":
        return [("skip", 0, 0, SCREEN_W, SCREEN_H)]
    if page == "home":
        return list(_HOME)
    if page == "mode":
        return list(_MODE)
    if page == "mood":
        return list(_MOOD)
    if page == "exercise":
        return list(_EXERCISE)
    if page == "settings":
        return list(_SETTINGS)
    if page == "pipeline":
        return list(_PIPELINE)
    if page == "dnd":
        return list(_DND)
    if page == "voice":
        return list(_VOICE)
    if page in ("wifi", "deviceconfig"):
        return [("back", 16, 108, 84, 84)]
    if page == "chat":
        return [("back", 8, 6, 66, 46)]
    if page == "music":
        return [("back", 8, 6, 66, 46), ("playpause", 40, 90, 200, 150)]
    if page == "keypad":
        return list(_KEYPAD)
    if page == "calling":
        return [("hangup", 100, 236, 80, 70)]
    if page == "incoming":
        return [("answer", 26, 236, 80, 70), ("reject", 174, 236, 80, 70)]
    if page == "connected":
        return [("hangup", 100, 236, 80, 70)]
    return [("back", 8, 6, 66, 46)]
