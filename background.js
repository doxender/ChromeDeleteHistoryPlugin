'use strict';

const IDLE_SECONDS = 300;

// Data types passed to chrome.browsingData.remove. Two notes:
// (1) `appcache` (removed Chrome 95) and `webSQL` (removed Chrome 122) are
//     intentionally OMITTED. Passing dead keys can cause the API to silently
//     skip work on adjacent live keys in some Chrome versions — exactly the
//     v0.1.1 bug where cookies + cache survived the close-time clear.
// (2) `formData` and `passwords` are explicitly false: this extension's
//     contract preserves saved form-autofill and saved passwords across
//     every clear, by design.
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

async function getMode() {
  const { autoMode = 'off' } = await chrome.storage.sync.get('autoMode');
  return autoMode;
}

// chrome.contentSettings types this extension resets on clear. These are
// the user's per-site exceptions (notification permissions, location
// grants, popup exceptions, etc.) — Chrome's UI groups them under the
// "Site Settings" bucket in the Clear-Browsing-Data dialog. Each type
// supported by chrome.contentSettings is enumerated here; entries that
// aren't supported in the current Chrome version are skipped silently.
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

async function clearContentSettings() {
  if (!chrome.contentSettings) return;
  await Promise.all(
    CONTENT_SETTINGS_TYPES.map(async (type) => {
      const api = chrome.contentSettings[type];
      if (!api?.clear) return;
      try {
        await api.clear({ scope: 'regular' });
      } catch {
        // Type unavailable in this Chrome build, or already empty.
      }
    })
  );
}

async function clearAll() {
  // originTypes:
  //   unprotectedWeb (default true) — regular websites
  //   protectedWeb               — websites installed as hosted apps. Without
  //                                this, a user with Gmail/Workspace installed
  //                                from chrome://apps keeps their cookies and
  //                                localStorage across clears (the "Hosted app
  //                                data" bucket in Chrome's UI).
  //   extension                  — this extension's own data; off so the user
  //                                doesn't lose their auto-mode preference.
  await chrome.browsingData.remove(
    {
      since: 0,
      originTypes: { unprotectedWeb: true, protectedWeb: true },
    },
    DATA_TO_REMOVE
  );

  // chrome.browsingData.remove() doesn't touch site-settings rules
  // (notification grants, location exceptions, etc.) — those live under
  // chrome.contentSettings and have to be reset separately.
  await clearContentSettings();

  await chrome.storage.local.set({ lastClearedAt: Date.now() });
}

async function closeAllWindows() {
  const wins = await chrome.windows.getAll();
  await Promise.all(wins.map((w) => chrome.windows.remove(w.id).catch(() => {})));
}

async function applyIdleDetection(mode) {
  if (mode === 'inactive') {
    chrome.idle.setDetectionInterval(IDLE_SECONDS);
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
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

// --- Auto-clear-on-close: design notes ---
//
// MV3 service workers cannot reliably finish async work during Chrome
// shutdown. chrome.browsingData.remove() initiates large SQLite/disk
// operations (cookies, cache) that the SW gets killed in the middle of.
// In v0.1.1 we tried-at-close + retry-on-startup, but if the in-flight
// clearAll() *appeared* to resolve before the SW died (history finished,
// cookies/cache mid-flight), we removed the pendingClearOnClose flag and
// the startup safety net never ran. Result: cookies + cache survived.
//
// v0.1.2 strategy:
//   1. On every onRemoved in close-mode, set pendingClearOnClose. (Flag
//      stays set until a successful, fully-completed startup clear.)
//   2. Best-effort fire-and-forget clear at close — if the SW survives
//      long enough, great; we don't depend on it. We never remove the
//      flag from the close path.
//   3. On runtime.onStartup, if pendingClearOnClose is set, run the
//      clear synchronously in a context where the SW is alive and not
//      racing with shutdown. Only remove the flag after that completes.
//      This is the guaranteed path.
//
// Net effect: data is always cleared, just possibly at next startup
// instead of at close. No partial-clear bug.

let closeBurstTimer = null;

chrome.runtime.onStartup.addListener(async () => {
  const mode = await getMode();
  const { pendingClearOnClose } = await chrome.storage.local.get('pendingClearOnClose');
  if (pendingClearOnClose) {
    try {
      await clearAll();
      await chrome.storage.local.remove('pendingClearOnClose');
    } catch {
      // Leave the flag set so the next startup retries.
    }
  }
  applyIdleDetection(mode);
});

chrome.windows.onRemoved.addListener(async () => {
  const mode = await getMode();
  if (mode !== 'close') return;

  // Always arm the startup safety net. This is the *guaranteed* path.
  await chrome.storage.local.set({ pendingClearOnClose: true });

  // Best-effort: try at close after the burst settles. Don't await, don't
  // touch the flag — startup will handle it whether or not this completes.
  if (closeBurstTimer) clearTimeout(closeBurstTimer);
  closeBurstTimer = setTimeout(async () => {
    closeBurstTimer = null;
    const remaining = await chrome.windows.getAll();
    if (remaining.length > 0) return; // not the last window
    clearAll().catch(() => { /* swallow — startup retries */ });
  }, 250);
});

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state !== 'idle' && state !== 'locked') return;
  const mode = await getMode();
  if (mode === 'inactive') {
    await clearAll();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'clearNow') {
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
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true;
});
