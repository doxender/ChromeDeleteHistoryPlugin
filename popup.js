'use strict';

const MODES = ['off', 'close', 'inactive'];
const LABELS = {
  off: 'Auto-Clear: Off',
  close: 'Auto-Clear: On Close',
  inactive: 'Auto-Clear: When Idle',
};

const $ = (id) => document.getElementById(id);

async function getMode() {
  const { autoMode = 'off' } = await chrome.storage.sync.get('autoMode');
  return MODES.includes(autoMode) ? autoMode : 'off';
}

async function setMode(mode) {
  await chrome.storage.sync.set({ autoMode: mode });
  await chrome.runtime.sendMessage({ type: 'autoModeChanged', mode }).catch(() => {});
}

function paintMode(mode) {
  const btn = $('autoMode');
  btn.dataset.mode = mode;
  $('modeLabel').textContent = LABELS[mode];
}

function setStatus(msg, cls = '') {
  const el = $('status');
  el.textContent = msg;
  el.className = 'status' + (cls ? ' ' + cls : '');
}

async function clearAndClose() {
  const btn = $('clearAndClose');
  btn.disabled = true;
  setStatus('Clearing…');
  try {
    const res = await chrome.runtime.sendMessage({ type: 'clearNow' });
    if (!res || !res.ok) throw new Error(res?.error || 'Unknown error');
    setStatus('Cleared. Closing…', 'ok');
    await chrome.runtime.sendMessage({ type: 'closeBrowser' });
  } catch (e) {
    btn.disabled = false;
    setStatus('Failed: ' + e.message, 'err');
  }
}

async function cycleMode() {
  const cur = await getMode();
  const next = MODES[(MODES.indexOf(cur) + 1) % MODES.length];
  await setMode(next);
  paintMode(next);
  setStatus(
    next === 'off' ? 'Auto-clear disabled.' :
    next === 'close' ? 'Will clear when Chrome closes.' :
    'Will clear when Chrome is idle (5 min).',
    'ok'
  );
}

function formatRelative(ms) {
  if (ms < 0 || !Number.isFinite(ms)) return 'never';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

async function paintLastClear() {
  const { lastClearedAt } = await chrome.storage.local.get('lastClearedAt');
  const el = $('lastClear');
  if (!lastClearedAt) {
    el.textContent = 'never cleared';
    return;
  }
  el.textContent = `cleared ${formatRelative(Date.now() - lastClearedAt)}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  paintMode(await getMode());
  await paintLastClear();
  $('clearAndClose').addEventListener('click', clearAndClose);
  $('autoMode').addEventListener('click', cycleMode);
});
