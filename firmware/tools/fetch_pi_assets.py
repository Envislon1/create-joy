#!/usr/bin/env python3
"""Download the MindBuddy TFT artwork into the Raspberry Pi assets folder.

The artwork is stored with the web app (`src/assets/tft/hi/*.asset.json`);
each JSON carries the public URL of the real PNG/MP4. This script resolves
those URLs and writes the files with their original names into the folder the
Pi UI reads (`UI_ASSETS`, default `firmware/raspi5/assets`).

    python3 firmware/tools/fetch_pi_assets.py \
        --out firmware/raspi5/assets \
        --base https://littlestars1.lovable.app

Re-runs skip files that already exist unless --force is given.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import urlopen

REPO = Path(__file__).resolve().parents[2]
DEFAULT_SRC = REPO / "src" / "assets" / "tft" / "hi"
DEFAULT_OUT = REPO / "firmware" / "raspi5" / "assets"


def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch MindBuddy TFT artwork for the Pi")
    ap.add_argument("--src", default=str(DEFAULT_SRC), help="folder with *.asset.json")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="destination assets folder")
    ap.add_argument("--base", default="https://littlestars1.lovable.app",
                    help="site that serves the asset URLs")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    src = Path(args.src)
    out = Path(args.out)
    if not src.is_dir():
        print(f"source folder not found: {src}")
        return 2
    out.mkdir(parents=True, exist_ok=True)

    metas = sorted(src.glob("*.asset.json"))
    if not metas:
        print(f"no *.asset.json in {src}")
        return 2

    ok = skipped = failed = 0
    for meta in metas:
        try:
            data = json.loads(meta.read_text())
        except Exception as e:
            print(f"  !! {meta.name}: {e}")
            failed += 1
            continue
        name = data.get("original_filename") or meta.name.replace(".asset.json", "")
        dest = out / name
        if dest.exists() and not args.force:
            skipped += 1
            continue
        url = data.get("url") or ""
        if url.startswith("/"):
            url = urljoin(args.base.rstrip("/") + "/", url.lstrip("/"))
        try:
            with urlopen(url, timeout=60) as r:
                dest.write_bytes(r.read())
            print(f"  {name:<52} {dest.stat().st_size / 1024:.0f} KB")
            ok += 1
        except Exception as e:
            print(f"  !! {name}: {e}")
            failed += 1

    print(f"\ndone: {ok} downloaded, {skipped} already present, {failed} failed")
    print(f"assets folder: {out}")
    print("set UI_ASSETS in firmware/raspi5/.env if you move it elsewhere.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
