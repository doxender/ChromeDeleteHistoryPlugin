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

document.addEventListener('DOMContentLoaded', async () => {
  paintMode(await getMode());
  $('clearAndClose').addEventListener('click', clearAndClose);
  $('autoMode').addEventListener('click', cycleMode);
});
