"""Build a versioned sideload zip for the Chrome extension.

Reads the version from manifest.json, packs the runtime files plus the
sideload-friendly INSTALL.md, LICENSE, and PRIVACY.md into

    dist/clear-history-and-close-v<version>.zip

Re-run after every version bump. Idempotent: overwrites an existing zip
of the same name.
"""
from __future__ import annotations
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "manifest.json"
DIST = ROOT / "dist"

# Files / folders to include in the zip. Order doesn't matter; deduped at
# pack time. Use forward-slash paths relative to project root; pathlib
# normalizes them on Windows.
INCLUDE_FILES = [
    "manifest.json",
    "background.js",
    "popup.html",
    "popup.css",
    "popup.js",
    "INSTALL.md",
    "LICENSE",
    "PRIVACY.md",
]
INCLUDE_DIRS = [
    "icons",
]

# Files explicitly excluded if they appear inside an included directory.
EXCLUDE_GLOBS = {
    "*.psd",       # source design files
    "*.svg",
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",
}


def read_version() -> str:
    with MANIFEST.open(encoding="utf-8") as f:
        return json.load(f)["version"]


def is_excluded(path: Path) -> bool:
    return any(path.match(pattern) for pattern in EXCLUDE_GLOBS)


def collect_files() -> list[Path]:
    files: set[Path] = set()
    for rel in INCLUDE_FILES:
        p = ROOT / rel
        if not p.is_file():
            print(f"WARNING: missing expected file: {rel}", file=sys.stderr)
            continue
        files.add(p)
    for rel in INCLUDE_DIRS:
        d = ROOT / rel
        if not d.is_dir():
            print(f"WARNING: missing expected dir: {rel}", file=sys.stderr)
            continue
        for child in d.rglob("*"):
            if child.is_file() and not is_excluded(child):
                files.add(child)
    return sorted(files)


def main() -> int:
    version = read_version()
    DIST.mkdir(exist_ok=True)
    out = DIST / f"clear-history-and-close-v{version}.zip"

    files = collect_files()
    if not files:
        print("nothing to pack", file=sys.stderr)
        return 1

    if out.exists():
        out.unlink()

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for f in files:
            arcname = f.relative_to(ROOT).as_posix()
            zf.write(f, arcname)

    size_kb = out.stat().st_size / 1024
    print(f"wrote {out}")
    print(f"  version: {version}")
    print(f"  files:   {len(files)}")
    print(f"  size:    {size_kb:.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
