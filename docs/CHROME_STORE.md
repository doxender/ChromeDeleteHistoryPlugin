# Chrome Web Store publish checklist

## Before you submit

- [ ] Bump `version` in `manifest.json` (store rejects duplicate versions).
- [ ] Verify icons render cleanly at 16/32/48/128 px. Regenerate with
      `python tools/generate_icons.py` if you tweak the design.
- [ ] Load the unpacked extension locally and run through:
  - Clear &amp; Close button works (data gone, Chrome closes).
  - Toggle cycles Off -> On Close -> When Idle -> Off.
  - Re-open popup — it remembers the current mode.
  - Reinstall — all permissions granted automatically at install.

## Zip the package

From the project root:

```bash
python tools/build-package.py
```

Reads the version from `manifest.json` and writes
`dist/clear-history-and-close-v<version>.zip` (gitignored). Includes the
runtime files (`manifest.json`, `background.js`, `popup.*`, `icons/`)
plus `INSTALL.md` (sideload instructions for end users), `LICENSE`, and
`PRIVACY.md`. Excludes `tools/`, `docs/`, `.github/`, `.git/`, and the
project-root `README.md` (which targets a GitHub-browser audience and
isn't useful inside the zip).

The same zip is suitable for **two distinct distribution channels**:

1. **Sideload distribution** — attach the zip to a GitHub Release; users
   download, unzip, and follow `INSTALL.md` to load unpacked at
   `chrome://extensions`. This is the channel for alpha / beta / pre-store
   builds.
2. **Chrome Web Store submission** — upload the same zip in the developer
   dashboard. Store reviewers ignore extra docs like `INSTALL.md` and
   `PRIVACY.md` inside the zip; they only validate the manifest and
   runtime behavior.

## Developer Dashboard steps

1. Go to <https://chrome.google.com/webstore/devconsole>.
2. Pay the one-time $5 developer fee if this is your first upload.
3. **New item** -> upload the zip from `dist/`.
4. Fill in store listing:
   - **Name:** Clear History &amp; Close
   - **Summary (132 chars max):** "One-click wipe of history, cookies, cache, downloads, hosted-app data &amp; site settings. Keeps passwords &amp; saved forms."
   - **Category:** Productivity (secondary: Privacy &amp; Security)
   - **Language:** English
   - **Screenshots (1280x800 or 640x400):** popup open, popup with auto-mode toggle lit, the "what gets cleared" panel expanded.
   - **Small promo tile (440x280):** logo + tagline.
   - **Icon (128x128):** `icons/icon128.png`
5. **Privacy tab:**
   - Single purpose: "Delete browsing data and close Chrome."
   - Justify each permission. The answers match [PRIVACY.md](../PRIVACY.md):
     - `browsingData` — core functionality, delete user-selected data types.
     - `contentSettings` — reset per-site permission grants ("Site Settings") on each clear.
     - `storage` — persist the user's auto-clear preference.
     - `idle` — trigger auto-clear after inactivity.
     - `alarms` — clear the one-time "NEW" badge after install.
   - Host permissions: none.
   - Data usage: certify "Does not collect user data."
   - Link to your hosted privacy policy (GitHub raw URL to `PRIVACY.md` is fine).
6. **Distribution:** Public, all regions (or restrict as you like).
7. Submit for review. First review typically 1-3 business days.

## After publish

- Add the store URL to README badges.
- Tag the release: `git tag v0.1.3 &amp;&amp; git push origin v0.1.3`.
