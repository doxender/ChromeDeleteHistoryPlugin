# Clear History &amp; Close

![status: alpha](https://img.shields.io/badge/status-alpha-orange)
![version](https://img.shields.io/badge/version-0.1.4-blue)
![manifest](https://img.shields.io/badge/manifest-v3-brightgreen)
![license](https://img.shields.io/badge/license-MIT-lightgrey)

> &#x26A0;&#xFE0F; **Alpha — cake is not cooked yet.**
> This extension has **not** been published to the Chrome Web Store.
> APIs and UI may change. File bugs and feedback under [Issues](https://github.com/doxender/ChromeDeleteHistoryPlugin/issues).
> Release history in [CHANGELOG.md](CHANGELOG.md).

A minimal Chrome extension (Manifest V3) that wipes your browsing history, cache,
cookies, downloads, hosted-app data, site settings, and local site data in one
click — then closes Chrome. Saved passwords and form-autofill data are **kept**.

## Features

- **One-click Clear &amp; Close** — wipes everything (except passwords &amp; form data) and exits Chrome.
- **Auto-Clear on Close** — clears when the **last** Chrome window is closed.
  Single tabs and non-final windows do not trigger a clear; only the final
  window-removal does. Because Manifest V3 service workers can't reliably
  finish large I/O during Chrome shutdown, every Chrome startup with
  mode=`close` runs a guaranteed clear (no flag dependency — drops if Chrome
  was running in background or the close handler missed). A best-effort
  clear also fires at close-time; if it completes, fine, but the design
  doesn't depend on it. Net behavior: data is always gone, just possibly
  at next launch instead of at close.
- **Auto-Clear When Idle** — clears after 5 minutes of inactivity using the
  `chrome.idle` API.
- **Permissions requested at install time** so everything works immediately.

## What gets cleared

| Item | Cleared? |
|---|:-:|
| Browsing history | &#x2714; |
| Download history | &#x2714; |
| Cookies &amp; other site data | &#x2714; |
| **Hosted app data** (cookies / storage of apps installed from `chrome://apps`) | &#x2714; |
| Cached images &amp; files | &#x2714; |
| IndexedDB &amp; Cache Storage | &#x2714; |
| Local &amp; session storage | &#x2714; |
| Service workers &amp; FileSystem | &#x2714; |
| **Site Settings** (notification, location, camera, popup, etc. exceptions) | &#x2714; |
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

- `manifest.json` — MV3 manifest, declares `browsingData`, `contentSettings`, `cookies`, `storage`, `idle`, `alarms` and `<all_urls>` host permission.
- `popup.html` / `popup.css` / `popup.js` — the popup UI (Clear &amp; Close button and auto-mode toggle).
- `background.js` — service worker: listens for window-close and idle events,
  handles messages from the popup, persists settings via `chrome.storage.sync`.
- `icons/` — 16 / 32 / 48 / 128 px PNGs.
- `tools/generate_icons.py` — regenerate icons (requires Pillow).

## Permissions explained

| Permission | Why |
|---|---|
| `browsingData` | Deleting cookies, cache, history, downloads, site storage (bulk path). |
| `cookies` + `<all_urls>` host permission | Belt-and-suspenders: enumerate every cookie via `chrome.cookies.getAll({})` and remove individually, in case the bulk `browsingData` path silently misses any. No web pages are read; only the cookie store is touched. |
| `contentSettings` | Resetting per-site permission grants (notifications, location, camera) and other site-settings exceptions — Chrome's "Site Settings" bucket. |
| `storage` | Remembering your auto-clear mode across sessions. |
| `idle` | Detecting when Chrome has been inactive for 5 minutes. |
| `alarms` | One-time "welcome" badge cleanup after install. |

The `<all_urls>` host permission is required by `chrome.cookies.remove`; the extension does **not** read or modify webpage content (no content scripts declared). No network requests are made; nothing is uploaded.

## Development

```bash
# Regenerate icons after editing the generator
python -m pip install Pillow
python tools/generate_icons.py
```

## Roadmap

Pre-1.0 (things to finish before Chrome Web Store submission):

- [ ] Dogfood auto-clear on close &amp; idle across multi-window sessions
- [ ] Options page for configurable idle timeout (currently hardcoded at 5 min)
- [ ] Optional whitelist — domains whose cookies survive a clear
- [ ] Keyboard shortcut (e.g. Ctrl+Shift+Del-and-close)
- [ ] Localization (English only for now)
- [ ] Store listing: screenshots, promo tile, privacy-policy hosting
- [ ] First-install onboarding tab explaining what the toggle does

## Contributing

Happy to take PRs or issues. This is alpha — small, targeted patches are the
easiest to land. For bigger changes, open an issue first so we can sync on
scope.

## License

MIT — see [LICENSE](LICENSE).

## Author

Dan Oxender &lt;dan.oxender@comtekglobal.com&gt;
