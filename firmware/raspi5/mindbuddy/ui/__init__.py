"""Pi 5 touch UI package (pygame).

The Raspberry Pi 5 is the master: it owns the touchscreen, the LLM, audio
and music. The LilyGo board is demoted to a radio peripheral (calls / SMS).

`TouchUI` speaks exactly the same line-delimited JSON protocol as the
LilyGo firmware, so `MindBuddy._on_lg_msg` handles UI taps unchanged.
"""
from .app import TouchUI, UiState  # noqa: F401
