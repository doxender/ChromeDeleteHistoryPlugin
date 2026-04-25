# Changelog

All notable changes to **Clear History &amp; Close** are documented here. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/) — pre-1.0 is alpha,
behavior may change.

## [0.1.1] — 2026-04-25

### Fixed
- **Race-free auto-clear when "Close all windows" is invoked from the Windows
  taskbar** (right-click Chrome icon → "Close all windows", or Alt-F4 on the
  last of multiple windows). The original `chrome.windows.onRemoved` handler
  had three latent failure modes under that burst of close events:
  - Multiple handlers raced on `chrome.windows.getAll()` and could call
    `clearAll()` in parallel.
  - Handlers seeing `remaining > 0` returned without arming the startup
    fallback, so a service-worker death mid-burst silently lost the clear.
  - In-flight `clearAll()` could be interrupted by Chrome's own shutdown.

  Now: every `onRemoved` in close-mode immediately marks
  `pendingClearOnClose` (arms the startup fallback), then a 250 ms debounce
  coalesces the burst into a single `chrome.windows.getAll()` consultation,
  and a single in-flight promise prevents concurrent `clearAll()`.
  `pendingClearOnClose` is removed only after `clearAll()` resolves.

- **Stale `pendingClearOnClose` flag cleanup on startup.** If the user
  changed auto-mode away from `close` between sessions, the old startup
  handler left the flag dangling. Now it's cleared on startup regardless of
  current mode (it just doesn't trigger a clear if mode isn't `close`).

### Unchanged
- Closing a single tab does not trigger a clear.
- Closing one of several windows does not trigger a clear.
- Closing the last/only Chrome window still triggers the clear (now reliably
  even when "the last window" is "all of them at once").
- "Clear &amp; Close" popup button, idle-mode auto-clear, and the kept-data
  set (passwords, form autofill) are unchanged.

## [0.1.0] — 2026-04-23

First public alpha. Pushed to GitHub; not on the Chrome Web Store.

### Added
- **One-click Clear &amp; Close** popup button. Wipes browsing history, cache,
  cookies, downloads, IndexedDB, local/session storage, service workers,
  WebSQL, and FileSystem; preserves saved passwords and form-autofill.
- **Auto-clear modes** — single cycle button toggles Off → On Close → When
  Idle (5 minutes of inactivity, via `chrome.idle`).
- **Settings persist** via `chrome.storage.sync` so the chosen mode follows
  the user across Chrome sign-ins.
- **All four permissions requested at install time** (`browsingData`,
  `storage`, `idle`, `alarms`) so the extension works immediately without
  per-feature prompts.
- **Generated icon set** at 16, 32, 48, 128 px (cyan→magenta gradient
  clock face with a red diagonal slash). `tools/generate_icons.py` rebuilds.
- **Privacy policy** (`PRIVACY.md`) certifying no network calls, no data
  collection, no host permissions.
- **Chrome Web Store publish checklist** (`docs/CHROME_STORE.md`).
- MIT License.

### Project
- README with alpha banner, badges, install instructions (sideload via
  `chrome://extensions` → Load unpacked), and roadmap.
- Initial GitHub repo at <https://github.com/doxender/ChromeDeleteHistoryPlugin>,
  default branch `main`.
