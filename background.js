'use strict';

const IDLE_SECONDS = 300;

const DATA_TO_REMOVE = {
  appcache: true,
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
  webSQL: true,
};

async function getMode() {
  const { autoMode = 'off' } = await chrome.storage.sync.get('autoMode');
  return autoMode;
}

async function clearAll() {
  await chrome.browsingData.remove({ since: 0 }, DATA_TO_REMOVE);
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

chrome.runtime.onStartup.addListener(async () => {
  const mode = await getMode();
  if (mode === 'close') {
    const { pendingClearOnClose } = await chrome.storage.local.get('pendingClearOnClose');
    if (pendingClearOnClose) {
      await clearAll();
      await chrome.storage.local.remove('pendingClearOnClose');
    }
  }
  applyIdleDetection(mode);
});

chrome.windows.onRemoved.addListener(async () => {
  const mode = await getMode();
  if (mode !== 'close') return;
  const remaining = await chrome.windows.getAll();
  if (remaining.length === 0) {
    try {
      await clearAll();
    } catch {
      await chrome.storage.local.set({ pendingClearOnClose: true });
    }
  } else {
    await chrome.storage.local.set({ pendingClearOnClose: true });
  }
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
