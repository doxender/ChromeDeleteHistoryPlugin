# Install Clear History &amp; Close

You just unzipped a Chrome extension. Three minutes to working.

## 1. Unzip somewhere you'll keep it

Pick a folder you won't delete by accident — Chrome reads the extension straight from disk, so if you move or remove the folder later, the extension breaks.

Reasonable spots:

```
C:\Users\<you>\Documents\ChromeExtensions\ClearHistoryAndClose
```

or anywhere under your Documents folder is fine. **Don't** leave it in `Downloads` or `%TEMP%` — those get cleaned up.

## 2. Open Chrome's extensions page

```
chrome://extensions
```

(Paste that into Chrome's address bar.)

## 3. Turn on Developer mode

Toggle in the **top-right corner** of the page. Once on, three new buttons appear in the top-left.

## 4. Click "Load unpacked"

Navigate to the folder you unzipped in step 1 and select it. Chrome reads `manifest.json` from that folder and the extension appears in your list.

Chrome will prompt you once to grant the permissions the extension needs:

- **Read your browsing history** — so it can delete it
- **Manage your downloads** — so it can clear them
- **Access your data on all websites** — required by the cookies API to wipe cookies across every domain. The extension does **not** read web pages or make network requests; the host permission is scoped to the cookies API only.

Accept the prompt.

## 5. Pin the toolbar icon (optional, recommended)

Click the puzzle-piece icon in Chrome's toolbar → click the pushpin next to **Clear History &amp; Close** so the popup is one click away.

## 6. Use it

Click the icon. The popup gives you two buttons:

- **Clear &amp; Close** — wipes everything (history, cookies, cache, downloads, hosted-app data, site settings) and closes Chrome. Saved passwords and form-autofill are preserved.
- **Auto-Clear: …** — cycle button: `Off` → `On Close` → `When Idle` → `Off`. Picks when to auto-wipe. "On Close" wipes when the last Chrome window closes (next launch). "When Idle" wipes after 5 minutes of inactivity.

The footer shows the popup version and "cleared Xm ago" so you can confirm the last clear actually ran.

## Updates

- **From this zip again**: download the next version's zip from <https://github.com/doxender/ChromeDeleteHistoryPlugin/releases>, replace your unzipped folder's contents (or unzip to the same location, overwriting), then go back to `chrome://extensions` and click the **circular reload arrow** (↻) on the extension's card.
- Chrome will keep your auto-clear preference across updates (it's stored in `chrome.storage.sync`).

## Removing it

Same `chrome://extensions` page → **Remove** on the extension's card, then delete the folder.

## Troubleshooting

- **"Manifest file is missing or unreadable"** — you selected a folder that doesn't contain `manifest.json`. You probably picked the parent folder, or the zip extracted into a sub-folder. Re-check that the folder you selected has `manifest.json` directly inside it.
- **Permissions weren't requested or seem missing** — open `chrome://extensions`, click the extension's **Details**, scroll to "Permissions" and verify they're granted. If not, remove and re-add.
- **Cookies / cache / something didn't actually clear** — open `chrome://extensions` → click **"Inspect views: service worker"** under the extension's card → switch to the **Console** tab. Lines tagged `[ClearHistory]` will show what ran, what got cleared, and what (if anything) failed. File an issue with that log: <https://github.com/doxender/ChromeDeleteHistoryPlugin/issues>

## License &amp; privacy

MIT-licensed; see `LICENSE`. No data leaves your computer; see `PRIVACY.md` for the full statement.
