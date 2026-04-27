# Changelog

All notable changes to **Clear History &amp; Close** are documented here. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/) — pre-1.0 is alpha,
behavior may change.

## [0.1.4] — 2026-04-25

### Fixed
- **Auto-clear-on-close still left cookies on disk after v0.1.3.** Two
  compounding causes:
  1. Startup clear was gated on a `pendingClearOnClose` flag set by the
     `chrome.windows.onRemoved` handler. If that handler didn't run (Chrome
     continued running in background, the SW was evicted before the storage
     write committed, etc.), the flag stayed unset and the next-startup
     pass skipped clearing entirely.
  2. The bulk `chrome.browsingData.remove()` path can silently miss cookies
     for reasons that aren't fully understood from the extension side
     (suspect: MV3 SW eviction during the SQLite write).

  Fixes:
  - **Drop the flag dependency.** Every `chrome.runtime.onStartup` with
    mode=`close` now runs `clearAll()` unconditionally. The cost of an
    extra clear when nothing's accumulated is negligible.
  - **Belt-and-suspenders cookie path.** Added `nukeAllCookiesIndividually()`
    which enumerates the cookie store via `chrome.cookies.getAll({})` and
    removes each cookie individually. This uses a separate code path from
    `browsingData.remove`, so leftovers from the bulk path get caught.

### Added
- **`Last cleared: …` indicator in the popup footer.** Reads
  `chrome.storage.local.lastClearedAt` and renders relative time (e.g.,
  "cleared 2m ago"). If a clear didn't run, it shows "never cleared" — an
  immediate at-a-glance sanity check that lifecycle events fired.
- **Service-worker console logging.** Every critical path
  (`onStartup`, `onRemoved`, `clearAll`, `nukeAllCookiesIndividually`,
  `clearContentSettings`, `onMessage`) emits `[ClearHistory] …` lines to
  the SW console. Open `chrome://extensions` → click "Inspect views:
  service worker" on the extension card to read them. Critical for
  diagnosing future close-time issues.
- **`cookies` permission** + **`<all_urls>` host permission** added to
  `manifest.json`. Required by the new `chrome.cookies.remove` calls. The
  extension still injects no content scripts and makes no network requests.

### Note for users
- After upgrading you'll need to **reload the extension** at
  `chrome://extensions` so Chrome accepts the new `cookies` and
  `<all_urls>` permissions. Popup footer should read `v0.1.4 · alpha`.
- If the bug persists after this upgrade, open
  `chrome://extensions` → click the **"Inspect views: service worker"**
  link on the extension's card → switch to the **Console** tab → trigger a
  close, reopen Chrome, then read the `[ClearHistory]` log lines. They'll
  show whether `onStartup` fired, whether `clearAll` was called, how many
  cookies it found, how many it removed, and whether anything threw.

## [0.1.3] — 2026-04-25

### Fixed
- **Cookies and cached files of hosted apps survived every clear.** Chrome's
  `browsingData.remove()` defaults to `originTypes: { unprotectedWeb: true }`,
  which excludes any website the user has installed as a hosted app from
  `chrome://apps` (Gmail-as-app, Workspace apps, etc.). Their cookies and
  storage were treated as "protected" and never touched. Now passes
  `originTypes: { unprotectedWeb: true, protectedWeb: true }` so hosted-app
  data goes too. The extension's own storage (`originTypes.extension`)
  remains off so the user's auto-clear preference survives.

### Added
- **Site Settings reset on every clear.** The "Site Settings" bucket in
  Chrome's Clear-Browsing-Data dialog (per-site notification grants,
  location grants, camera/microphone permissions, popup exceptions,
  automatic-downloads exceptions, and so on) lives in `chrome.contentSettings`,
  not `chrome.browsingData`. Every clear (manual button, auto-on-close,
  auto-on-idle) now also calls `chrome.contentSettings.<type>.clear({scope:
  'regular'})` for every supported content-setting type. Types unavailable
  in the user's Chrome build are skipped silently.
- **`contentSettings` permission** added to `manifest.json`. Required for
  the Site Settings reset above. Justification mirrored in `PRIVACY.md`
  and `docs/CHROME_STORE.md`.

### Note for users
- After upgrading to 0.1.3 you'll need to **reload the extension** at
  `chrome://extensions` so Chrome picks up the new permission. The popup
  footer should read `v0.1.3 · alpha` once it's running.

## [0.1.2] — 2026-04-25

### Fixed
- **Cookies and cache survived auto-clear-on-close.** Two distinct bugs were
  combining to leave the most-sensitive data behind on close:

  1. `DATA_TO_REMOVE` passed `appcache: true` and `webSQL: true` to
     `chrome.browsingData.remove()`. Both APIs were removed from Chrome
     (AppCache in 95, WebSQL in 122). Passing dead keys is *supposed* to
     be a no-op, but in some Chrome versions it causes the API to silently
     skip work on adjacent live keys — exactly the failure pattern
     reported. Removed both keys.

  2. The v0.1.1 close handler tried `clearAll()` at close-time and removed
     the `pendingClearOnClose` startup-fallback flag if the call appeared
     to resolve. Under MV3 the service worker is killed mid-operation
     during Chrome shutdown: history (small write) finishes first and the
     Promise can resolve before cookies / cache (larger SQLite I/O)
     finish. v0.1.1 then cleared the flag, so the next-startup safety net
     never ran. Result: history wiped, cookies and cache survived.

### Changed
- **Auto-clear-on-close now relies on the next-startup pass for guaranteed
  completion**, with a best-effort fire-and-forget attempt at close-time.
  - At close: set `pendingClearOnClose`, kick off `clearAll()` without
    awaiting; never touch the flag from the close path.
  - At startup: if `pendingClearOnClose` is set, run `clearAll()`
    synchronously while the SW is alive and not racing shutdown. Only
    remove the flag after that resolves.
  - Net behavior: data is *always* gone, just possibly at next Chrome
    launch instead of at close. The most a user sees on disk between
    sessions is a few-minute window if they re-open Chrome quickly.
    Previously they could see partially-cleared data persist indefinitely.

### Unchanged
- `formData: false` and `passwords: false` — saved form-autofill and saved
  passwords are still preserved across every clear, by design.
- "Clear &amp; Close" popup button still does a full clear synchronously
  before initiating window close (no MV3 lifecycle race in that path).
- Idle-mode auto-clear unchanged.

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
