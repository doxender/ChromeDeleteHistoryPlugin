# Privacy Policy — Clear History &amp; Close

**Effective date:** 2026-04-25

## Summary

This extension does not collect, transmit, sell, or share any user data. All
processing happens locally in your browser.

## What the extension accesses

- **Browsing data** (history, cache, cookies, downloads, site storage,
  hosted-app data) — only in order to delete it at your request via the
  Chrome `browsingData` API. No data is read or inspected; it is erased
  directly.
- **Site settings** (per-site permission grants for notifications,
  location, camera, microphone, popups, etc.) — only in order to reset
  them on a clear, via the `chrome.contentSettings` API. The extension
  doesn't read which sites have which permissions; it just resets them
  to defaults when you clear.
- **Extension settings** — your chosen auto-clear mode is saved via
  `chrome.storage.sync` so it persists across Chrome restarts and (if you
  are signed into Chrome) syncs between your own devices. The only value
  stored is the string `"off"`, `"close"`, or `"inactive"`.
- **Idle state** — when you enable "Auto-Clear When Idle", the extension
  uses `chrome.idle` to notice when Chrome has been inactive for 5 minutes
  so it can trigger the clear action. Idle state is not recorded anywhere.

## What the extension does *not* do

- No network requests of any kind. The extension contains no `fetch`, `XHR`,
  analytics, telemetry, crash reporting, or third-party scripts.
- No host permissions — it cannot read or modify the content of any webpage.
- No data leaves your device. There is no server; there is no author-side
  logging.

## Permissions used

| Permission | Purpose |
|---|---|
| `browsingData` | Delete browsing data at your request. |
| `contentSettings` | Reset per-site permission grants (notifications, location, camera, etc.) — what Chrome's UI calls "Site Settings". |
| `storage` | Remember your auto-clear setting. |
| `idle` | Detect inactivity (only when "Auto-Clear When Idle" is on). |
| `alarms` | Clear the one-time welcome badge after install. |

## Changes to this policy

Any changes will be published in this file with an updated effective date.

## Contact

Dan Oxender — dan.oxender@comtekglobal.com
