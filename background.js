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
  const { pendingClearOnClose } = await chrome.storage.local.get('pendingClearOnClose');
  if (pendingClearOnClose) {
    if (mode === 'close') {
      try {
        await clearAll();
      } catch {
        // Leave the flag set so the next startup retries.
        applyIdleDetection(mode);
        return;
      }
    }
    // Cleared (or mode was changed away from 'close' while the flag was
    // pending) — either way the flag's job is done.
    await chrome.storage.local.remove('pendingClearOnClose');
  }
  applyIdleDetection(mode);
});

// --- Robust close-mode auto-clear (race-free against "Close all windows") ---
//
// Closing every Chrome window via the Windows taskbar (right-click ->
// "Close all windows", or Alt-F4-ing the last window in a multi-window
// session) fires chrome.windows.onRemoved in a tight burst. Without
// coalescing that produces three failure modes:
//
//   (a) Several handlers race on chrome.windows.getAll() and call
//       clearAll() in parallel, doubling the work and potentially
//       interleaving with Chrome's own shutdown.
//   (b) Each handler that sees remaining > 0 returns before arming the
//       startup fallback, so if the service worker is killed mid-burst
//       the clear is silently lost.
//   (c) The in-flight clearAll() may be interrupted if Chrome exits
//       before chrome.browsingData.remove() resolves.
//
// Strategy:
//   1. On every onRemoved in close-mode, immediately mark
//      pendingClearOnClose so runtime.onStartup will finish the job
//      if we die mid-burst.
//   2. Debounce 250 ms so a burst of close events coalesces into a
//      single attempt; we only consult chrome.windows.getAll() once
//      after the dust settles.
//   3. Coalesce concurrent attempts via a single in-flight promise.
//   4. Only clear pendingClearOnClose after clearAll resolves.

let closeBurstTimer = null;
let clearInFlight = null;

async function attemptCloseClear() {
  const remaining = await chrome.windows.getAll();
  if (remaining.length > 0) return; // user didn't actually close everything

  if (clearInFlight) return clearInFlight;
  clearInFlight = (async () => {
    try {
      await clearAll();
      await chrome.storage.local.remove('pendingClearOnClose');
    } catch {
      // Leave pendingClearOnClose set; runtime.onStartup will retry.
    } finally {
      clearInFlight = null;
    }
  })();
  return clearInFlight;
}

chrome.windows.onRemoved.addListener(async () => {
  const mode = await getMode();
  if (mode !== 'close') return;

  // Arm the startup fallback first so a mid-burst SW death is recoverable.
  await chrome.storage.local.set({ pendingClearOnClose: true });

  if (closeBurstTimer) clearTimeout(closeBurstTimer);
  closeBurstTimer = setTimeout(() => {
    closeBurstTimer = null;
    attemptCloseClear();
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
