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
# PowerShell
Compress-Archive -Path manifest.json,background.js,popup.html,popup.css,popup.js,icons -DestinationPath dist\clear-history-and-close-v0.1.3.zip -Force
```

Don't include: `tools/`, `docs/`, `.git/`, `README.md`, `PRIVACY.md`, `LICENSE`.
Only files the extension actually loads.

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
