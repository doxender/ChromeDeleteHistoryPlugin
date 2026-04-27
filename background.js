'use strict';

const IDLE_SECONDS = 300;
const LOG = (...args) => console.log('[ClearHistory]', ...args);

// Data types passed to chrome.browsingData.remove. Notes:
// (1) `appcache` (removed Chrome 95) and `webSQL` (removed Chrome 122) are
//     intentionally OMITTED — passing dead keys can cause some Chrome builds
//     to silently skip work on adjacent live keys.
// (2) `formData` and `passwords` are explicitly false: this extension's
//     contract preserves saved form-autofill and saved passwords.
const DATA_TO_REMOVE = {
  cache: true,
  cacheStorage: true,
  cookies: true,
  downloads: true,
  fileSystems: true,
  formData: false,
  history: true,
  indexedDB: true,
  localStorage: true,
  passwords: false,
  serviceWorkers: true,
};

// chrome.contentSettings types this extension resets on clear. Each entry
// supported by the current Chrome build will be cleared; unsupported ones
// are skipped silently. Maps to Chrome's "Site Settings" UI bucket.
const CONTENT_SETTINGS_TYPES = [
  'cookies',
  'images',
  'javascript',
  'location',
  'plugins',
  'popups',
  'notifications',
  'fullscreen',
  'mouselock',
  'microphone',
  'camera',
  'unsandboxedPlugins',
  'automaticDownloads',
];

async function getMode() {
  const { autoMode = 'off' } = await chrome.storage.sync.get('autoMode');
  return autoMode;
}

async function clearContentSettings() {
  if (!chrome.contentSettings) {
    LOG('clearContentSettings: chrome.contentSettings unavailable, skipping');
    return;
  }
  const results = await Promise.all(
    CONTENT_SETTINGS_TYPES.map(async (type) => {
      const api = chrome.contentSettings[type];
      if (!api?.clear) return { type, ok: false, reason: 'unsupported' };
      try {
        await api.clear({ scope: 'regular' });
        return { type, ok: true };
      } catch (e) {
        return { type, ok: false, reason: String(e?.message || e) };
      }
    })
  );
  const cleared = results.filter((r) => r.ok).map((r) => r.type);
  const skipped = results.filter((r) => !r.ok);
  LOG('clearContentSettings: cleared', cleared.length, 'of', CONTENT_SETTINGS_TYPES.length, '— types:', cleared);
  if (skipped.length) LOG('clearContentSettings: skipped', skipped);
}

// Belt-and-suspenders cookie nuker: enumerate every cookie known to Chrome
// and remove it individually. chrome.cookies API uses a different code path
// than chrome.browsingData.remove, so if the bulk remove silently fails for
// cookies (which is what we're chasing in v0.1.4), this catches the leftovers.
async function nukeAllCookiesIndividually() {
  if (!chrome.cookies) {
    LOG('nukeAllCookiesIndividually: chrome.cookies unavailable, skipping');
    return { attempted: 0, removed: 0 };
  }
  const cookies = await chrome.cookies.getAll({});
  LOG('nukeAllCookiesIndividually: found', cookies.length, 'cookies before remove');
  let removed = 0;
  await Promise.all(
    cookies.map(async (c) => {
      // Reconstruct the URL the cookie applies to. domain may have a leading
      // dot for cross-subdomain cookies; strip it. path is required.
      const protocol = c.secure ? 'https' : 'http';
      const host = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
      const url = `${protocol}://${host}${c.path}`;
      try {
        const result = await chrome.cookies.remove({
          url,
          name: c.name,
          storeId: c.storeId,
        });
        if (result) removed++;
      } catch {
        // Some cookies may fail to remove (HostOnly + odd domain combos).
        // Move on; bulk path will catch most of them anyway.
      }
    })
  );
  const after = await chrome.cookies.getAll({});
  LOG('nukeAllCookiesIndividually: removed', removed, 'of', cookies.length, '— remaining:', after.length);
  return { attempted: cookies.length, removed, remaining: after.length };
}

async function clearAll() {
  const startedAt = Date.now();
  LOG('clearAll: starting');

  // 1. Bulk clear via chrome.browsingData.
  try {
    await chrome.browsingData.remove(
      {
        since: 0,
        originTypes: { unprotectedWeb: true, protectedWeb: true },
      },
      DATA_TO_REMOVE
    );
    LOG('clearAll: chrome.browsingData.remove resolved');
  } catch (e) {
    LOG('clearAll: chrome.browsingData.remove THREW', e?.message || e);
    // Don't return — try the cookies fallback anyway.
  }

  // 2. Belt-and-suspenders: nuke any cookies the bulk path missed.
  try {
    const cookieResult = await nukeAllCookiesIndividually();
    LOG('clearAll: cookie fallback done', cookieResult);
  } catch (e) {
    LOG('clearAll: cookie fallback THREW', e?.message || e);
  }

  // 3. Reset Site Settings (chrome.contentSettings is a separate API).
  try {
    await clearContentSettings();
  } catch (e) {
    LOG('clearAll: clearContentSettings THREW', e?.message || e);
  }

  // 4. Record timestamp so the popup can show "Last cleared: …".
  await chrome.storage.local.set({ lastClearedAt: Date.now() });

  const elapsed = Date.now() - startedAt;
  LOG('clearAll: done in', elapsed, 'ms');
}

async function closeAllWindows() {
  const wins = await chrome.windows.getAll();
  LOG('closeAllWindows: closing', wins.length, 'window(s)');
  await Promise.all(wins.map((w) => chrome.windows.remove(w.id).catch(() => {})));
}

async function applyIdleDetection(mode) {
  if (mode === 'inactive') {
    chrome.idle.setDetectionInterval(IDLE_SECONDS);
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  LOG('onInstalled fired', details.reason);
  const { autoMode } = await chrome.storage.sync.get('autoMode');
  if (!autoMode) await chrome.storage.sync.set({ autoMode: 'off' });

  if (details.reason === 'install') {
    chrome.action.setBadgeText({ text: 'NEW' });
    chrome.action.setBadgeBackgroundColor({ color: '#aa3adc' });
    chrome.alarms.create('clearBadge', { delayInMinutes: 2 });
  }

  applyIdleDetection(await getMode());
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'clearBadge') {
    chrome.action.setBadgeText({ text: '' });
  }
});

// --- Auto-clear-on-close: design notes (v0.1.4) ---
//
// MV3 service workers can't reliably finish async work during Chrome
// shutdown. v0.1.3 used a pendingClearOnClose flag set by
// chrome.windows.onRemoved and consumed by chrome.runtime.onStartup. If
// either event misfired (e.g., Chrome continued running in background, the
// SW was evicted before storage commit, the close handler didn't get
// scheduled), the flag stayed unset and the startup pass skipped clearing.
//
// v0.1.4: drop the flag dependency. **On every chrome.runtime.onStartup,
// unconditionally clear if mode === 'close'.** The cost of an extra clear
// when nothing's accumulated is negligible. The benefit is that the
// startup pass runs even if the close handler never fired or the flag
// never persisted. Best-effort at-close clear is preserved as a "maybe
// the SW survives long enough" win.

let closeBurstTimer = null;

chrome.runtime.onStartup.addListener(async () => {
  const mode = await getMode();
  LOG('onStartup fired, mode =', mode);
  if (mode === 'close') {
    LOG('onStartup: mode is close, running clearAll unconditionally');
    try {
      await clearAll();
    } catch (e) {
      LOG('onStartup: clearAll threw', e?.message || e);
    }
  }
  applyIdleDetection(mode);
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const mode = await getMode();
  LOG('onRemoved fired for window', windowId, '— mode =', mode);
  if (mode !== 'close') return;

  // Best-effort at-close clear. Schedule after a 250 ms debounce so a burst
  // of close events ("Close all windows") coalesces. If the SW survives long
  // enough, great. If not, the next chrome.runtime.onStartup will run a
  // guaranteed clear.
  if (closeBurstTimer) clearTimeout(closeBurstTimer);
  closeBurstTimer = setTimeout(async () => {
    closeBurstTimer = null;
    const remaining = await chrome.windows.getAll();
    LOG('onRemoved (debounced): remaining windows =', remaining.length);
    if (remaining.length > 0) return;
    LOG('onRemoved (debounced): last window — kicking off best-effort clearAll');
    clearAll().catch((e) => LOG('best-effort clearAll threw', e?.message || e));
  }, 250);
});

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state !== 'idle' && state !== 'locked') return;
  const mode = await getMode();
  if (mode === 'inactive') {
    LOG('idle.onStateChanged:', state, '— mode is inactive, clearing');
    await clearAll();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'clearNow') {
        LOG('onMessage: clearNow received');
        await clearAll();
        sendResponse({ ok: true });
      } else if (msg?.type === 'closeBrowser') {
        await closeAllWindows();
        sendResponse({ ok: true });
      } else if (msg?.type === 'autoModeChanged') {
        applyIdleDetection(msg.mode);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'unknown message' });
      }
    } catch (e) {
      LOG('onMessage handler threw', e?.message || e);
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true;
});
