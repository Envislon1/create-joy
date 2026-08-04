"""Pi 5 touch UI package (pygame).

Two renderers live here:

* `artwork_app.ArtworkUI` — the default. Blits the shipped MindBuddy artwork
  (identical to the web /tft-simulator) and maps taps with `screens.py`.
* `app.TouchUI` — the legacy fully vector-drawn UI, used automatically when
  no artwork is present in the assets folder.

Both speak exactly the same line-delimited JSON protocol as the LilyGo
firmware, so `MindBuddy._on_lg_msg` handles UI taps unchanged.
"""
from __future__ import annotations

import logging
from pathlib import Path

from .app import TouchUI as VectorUI, UiState  # noqa: F401
from .artwork_app import ArtworkUI  # noqa: F401

log = logging.getLogger("ui")


def has_artwork(assets_dir: str) -> bool:
    p = Path(assets_dir).expanduser()
    return p.is_dir() and any(p.glob("home_page_*.png"))


def TouchUI(assets_dir: str, on_event, **kw):  # noqa: N802 - factory keeps the old name
    """Return the artwork UI when the artwork is installed, else the vector UI."""
    if has_artwork(assets_dir):
        return ArtworkUI(assets_dir, on_event, **kw)
    log.warning("no artwork in %s - falling back to the vector UI "
                "(run firmware/tools/fetch_pi_assets.py)", assets_dir)
    return VectorUI(assets_dir, on_event, **kw)
