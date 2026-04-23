# Clear History &amp; Close

A minimal Chrome extension (Manifest V3) that wipes your browsing history, cache,
cookies, downloads, and local site data in one click — then closes Chrome.
Saved passwords and form-autofill data are **kept**.

## Features

- **One-click Clear &amp; Close** — wipes everything (except passwords &amp; form data) and exits Chrome.
- **Auto-Clear on Close** — clears when the last Chrome window is closed (with a
  next-startup fallback in case the service worker is torn down first).
- **Auto-Clear When Idle** — clears after 5 minutes of inactivity using the
  `chrome.idle` API.
- **Permissions requested at install time** so everything works immediately.

## What gets cleared

| Item | Cleared? |
|---|:-:|
| Browsing history | &#x2714; |
| Download history | &#x2714; |
| Cookies &amp; other site data | &#x2714; |
| Cached images &amp; files | &#x2714; |
| IndexedDB &amp; Cache Storage | &#x2714; |
| Local &amp; session storage | &#x2714; |
| Service workers, WebSQL, FileSystem | &#x2714; |
| **Saved passwords** | &#x2716; kept |
| **Autofill / form data** | &#x2716; kept |

## Install (developer / side-load)

1. `git clone` this repo.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.

## Install (Chrome Web Store)

Coming soon. See [`docs/CHROME_STORE.md`](docs/CHROME_STORE.md) for the publish checklist.

## How it works

- `manifest.json` — MV3 manifest, declares `browsingData`, `storage`, `idle`, `alarms`.
- `popup.html` / `popup.css` / `popup.js` — the popup UI (Clear &amp; Close button and auto-mode toggle).
- `background.js` — service worker: listens for window-close and idle events,
  handles messages from the popup, persists settings via `chrome.storage.sync`.
- `icons/` — 16 / 32 / 48 / 128 px PNGs.
- `tools/generate_icons.py` — regenerate icons (requires Pillow).

## Permissions explained

| Permission | Why |
|---|---|
| `browsingData` | Actually deleting the data. |
| `storage` | Remembering your auto-clear mode across sessions. |
| `idle` | Detecting when Chrome has been inactive for 5 minutes. |
| `alarms` | One-time "welcome" badge cleanup after install. |

No host permissions. No network access. Nothing is uploaded anywhere.

## Development

```bash
# Regenerate icons after editing the generator
python -m pip install Pillow
python tools/generate_icons.py
```

## License

MIT — see [LICENSE](LICENSE).

## Author

Dan Oxender &lt;dan.oxender@comtekglobal.com&gt;
