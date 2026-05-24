// Renders the toolbar icon at runtime. Colored when at least one feature
// is currently hiding something on the page (i.e. the extension is doing
// its job right now), grey when both features are inactive. Wakes on
// chrome.storage.onChanged, redraws via OffscreenCanvas, and passes the
// resulting ImageData to chrome.action.setIcon.

const PROMPT_KEY = 'prompt_hidden';
const MENUS_KEY = 'menus_hidden';
const COLOR_ON = '#c69376';
const COLOR_OFF = '#8e8e93';  // iOS grey

function drawIcon(active, size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = Math.max(2, Math.round(size * 0.22));

  ctx.fillStyle = active ? COLOR_ON : COLOR_OFF;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, r);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(size * 0.72)}px -apple-system, "SF Pro Display", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', size / 2, size / 2 + Math.max(1, Math.round(size * 0.04)));

  return ctx.getImageData(0, 0, size, size);
}

async function updateIcon(active) {
  try {
    await chrome.action.setIcon({
      imageData: {
        16: drawIcon(active, 16),
        32: drawIcon(active, 32),
      },
    });
  } catch (e) {
    console.warn('[maximizer] setIcon failed', e);
  }
}

async function applyFromStorage() {
  const res = await chrome.storage.sync.get([PROMPT_KEY, MENUS_KEY]);
  const active = res[PROMPT_KEY] === true || res[MENUS_KEY] === true;
  await updateIcon(active);
}

chrome.runtime.onInstalled.addListener(applyFromStorage);
chrome.runtime.onStartup.addListener(applyFromStorage);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (PROMPT_KEY in changes || MENUS_KEY in changes) {
    applyFromStorage();
  }
});

applyFromStorage();
