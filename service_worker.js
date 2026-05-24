// Renders the toolbar icon at runtime so the color reflects the global
// "enabled" preference. Colored when on, grey when off. The service worker
// wakes on chrome.storage.onChanged, redraws via OffscreenCanvas, and
// passes the resulting ImageData to chrome.action.setIcon.

const ENABLED_KEY = 'enabled';
const COLOR_ON = '#c69376';
const COLOR_OFF = '#8e8e93';  // iOS grey

function drawIcon(enabled, size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = Math.max(2, Math.round(size * 0.22));

  // Background — rounded square in the state color
  ctx.fillStyle = enabled ? COLOR_ON : COLOR_OFF;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, r);
  ctx.fill();

  // White letter monogram identifying the extension.
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(size * 0.72)}px -apple-system, "SF Pro Display", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', size / 2, size / 2 + Math.max(1, Math.round(size * 0.04)));

  return ctx.getImageData(0, 0, size, size);
}

async function updateIcon(enabled) {
  try {
    await chrome.action.setIcon({
      imageData: {
        16: drawIcon(enabled, 16),
        32: drawIcon(enabled, 32),
      },
    });
  } catch (e) {
    console.warn('[maximizer] setIcon failed', e);
  }
}

async function applyFromStorage() {
  const res = await chrome.storage.sync.get([ENABLED_KEY]);
  await updateIcon(res[ENABLED_KEY] !== false); // default true
}

chrome.runtime.onInstalled.addListener(applyFromStorage);
chrome.runtime.onStartup.addListener(applyFromStorage);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (typeof changes[ENABLED_KEY]?.newValue === 'boolean') {
    updateIcon(changes[ENABLED_KEY].newValue);
  }
});

// On every cold-start of the service worker, also apply current state.
applyFromStorage();
