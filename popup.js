// Each row has a toggle (current hidden state) and a click-to-record
// shortcut editor. Toggle ON means "this element is currently hidden on
// the page". Storage is the single source of truth — content.js subscribes
// to the same keys so the toggle, the shortcut, and the page stay in sync.

const FEATURES = [
  {
    id: 'prompt',
    hiddenKey: 'prompt_hidden',
    shortcutKey: 'prompt_shortcut',
    defaultShortcut: { code: 'Semicolon', meta: true, ctrl: false, alt: false, shift: false },
  },
  {
    id: 'menus',
    hiddenKey: 'menus_hidden',
    shortcutKey: 'menus_shortcut',
    defaultShortcut: { code: 'Semicolon', meta: false, ctrl: false, alt: true, shift: false },
  },
];

const IS_MAC = navigator.platform.toUpperCase().includes('MAC');
const PURE_MODIFIERS = new Set([
  'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight',
]);

function formatCode(code) {
  return code
    .replace(/^Key/, '').replace(/^Digit/, '')
    .replace(/^Semicolon$/, ';').replace(/^Slash$/, '/')
    .replace(/^Comma$/, ',').replace(/^Period$/, '.')
    .replace(/^BracketLeft$/, '[').replace(/^BracketRight$/, ']')
    .replace(/^Backquote$/, '`').replace(/^Quote$/, "'")
    .replace(/^Minus$/, '-').replace(/^Equal$/, '=')
    .replace(/^Backslash$/, '\\')
    .replace(/^Space$/, '␣')
    .replace(/^Enter$/, '⏎')
    .replace(/^Tab$/, '⇥')
    .replace(/^ArrowLeft$/, '←').replace(/^ArrowRight$/, '→')
    .replace(/^ArrowUp$/, '↑').replace(/^ArrowDown$/, '↓');
}

function shortcutToKeys(s) {
  const keys = [];
  if (!s) return keys;
  // Apple-convention modifier order: Ctrl, Alt/Option, Shift, Cmd
  if (s.ctrl) keys.push(IS_MAC ? '⌃' : 'Ctrl');
  if (s.alt) keys.push(IS_MAC ? '⌥' : 'Alt');
  if (s.shift) keys.push(IS_MAC ? '⇧' : 'Shift');
  if (s.meta) keys.push(IS_MAC ? '⌘' : 'Win');
  if (s.code) keys.push(formatCode(s.code));
  return keys;
}

// Module-level: only one row can record at a time, since the popup window
// captures keystrokes globally and they need to route to the right row.
let recordingRow = null;

class Row {
  constructor(feature) {
    this.feature = feature;
    this.rowEl = document.querySelector(`.row[data-feature="${feature.id}"]`);
    this.bottomEl = this.rowEl.querySelector('.bottom');
    this.displayEl = this.rowEl.querySelector('.kbd-display');
    this.keycapsEl = this.rowEl.querySelector('.keycaps');
    this.errorEl = this.rowEl.querySelector('.kbd-error');
    this.toggleEl = this.rowEl.querySelector('.toggle-input');
    this.currentShortcut = feature.defaultShortcut;

    this.bottomEl.addEventListener('click', () => {
      if (this.isRecording()) this.stopRecording();
      else this.startRecording();
    });
    this.bottomEl.addEventListener('keydown', (e) => {
      if (this.isRecording()) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.startRecording();
      }
    });
    this.bottomEl.addEventListener('blur', () => {
      if (this.isRecording()) this.stopRecording();
    });
    // User flipped the toggle → write the new hidden state to storage.
    // content.js's storage listener will pick it up and update the page.
    this.toggleEl.addEventListener('change', () => {
      chrome.storage.sync.set({ [feature.hiddenKey]: this.toggleEl.checked });
    });
  }

  isRecording() { return recordingRow === this; }

  renderKeycaps(keys) {
    this.keycapsEl.innerHTML = '';
    for (const k of keys) {
      const cap = document.createElement('span');
      cap.className = 'keycap';
      cap.textContent = k;
      this.keycapsEl.appendChild(cap);
    }
  }

  showError(msg) {
    this.errorEl.textContent = msg;
    this.errorEl.classList.add('shown');
  }
  clearError() {
    this.errorEl.classList.remove('shown');
    this.errorEl.textContent = '';
  }

  flashSave() {
    this.displayEl.classList.remove('saved');
    void this.displayEl.offsetWidth;
    this.displayEl.classList.add('saved');
    setTimeout(() => this.displayEl.classList.remove('saved'), 1450);
  }

  suppressRingAfterSave() {
    this.bottomEl.classList.add('just-saved');
    setTimeout(() => this.bottomEl.classList.remove('just-saved'), 500);
  }

  startRecording() {
    if (recordingRow && recordingRow !== this) recordingRow.stopRecording();
    recordingRow = this;
    this.bottomEl.classList.add('recording', 'empty');
    this.keycapsEl.innerHTML = '';
    this.clearError();
    this.bottomEl.focus();
  }

  stopRecording() {
    if (recordingRow === this) recordingRow = null;
    this.bottomEl.classList.remove('recording', 'empty');
    this.clearError();
    this.renderKeycaps(shortcutToKeys(this.currentShortcut));
  }

  async saveShortcut(s) {
    this.currentShortcut = s;
    await chrome.storage.sync.set({ [this.feature.shortcutKey]: s });
    this.stopRecording();
    this.flashSave();
    this.suppressRingAfterSave();
  }

  attemptSave(s) {
    if (!s.meta && !s.ctrl && !s.alt && !s.shift) {
      this.showError(IS_MAC
        ? 'Add a modifier (⌘ ⌥ ⌃ ⇧)'
        : 'Add a modifier (Ctrl, Alt, or Shift)');
      return;
    }
    this.saveShortcut(s);
  }

  setShortcut(s) {
    this.currentShortcut = s;
    if (!this.isRecording()) this.renderKeycaps(shortcutToKeys(s));
  }

  setHidden(b) {
    this.toggleEl.checked = b;
  }
}

const rows = FEATURES.map((f) => new Row(f));
const rowById = Object.fromEntries(rows.map((r) => [r.feature.id, r]));

function shortcutMatches(e, s) {
  return s
    && e.code === s.code
    && !!e.metaKey === !!s.meta
    && !!e.ctrlKey === !!s.ctrl
    && !!e.altKey === !!s.alt
    && !!e.shiftKey === !!s.shift;
}

window.addEventListener('keydown', (e) => {
  if (recordingRow) {
    if (e.code === 'Escape') {
      e.preventDefault();
      recordingRow.stopRecording();
      return;
    }
    if (PURE_MODIFIERS.has(e.code)) {
      recordingRow.clearError();
      recordingRow.bottomEl.classList.remove('empty');
      recordingRow.renderKeycaps(shortcutToKeys({
        code: '',
        meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey,
      }));
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    recordingRow.attemptSave({
      code: e.code,
      meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey,
    });
    return;
  }

  // Not recording: shortcut fired while popup has focus. content.js never
  // sees it (popup window captures keystrokes), so we write the new hidden
  // state here. The storage listener updates the toggle.
  for (const row of rows) {
    if (shortcutMatches(e, row.currentShortcut)) {
      e.preventDefault();
      e.stopPropagation();
      chrome.storage.sync.set({ [row.feature.hiddenKey]: !row.toggleEl.checked });
      return;
    }
  }
}, true);

window.addEventListener('keyup', (e) => {
  if (!recordingRow) return;
  if (!PURE_MODIFIERS.has(e.code)) return;
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
    recordingRow.bottomEl.classList.remove('empty');
    recordingRow.renderKeycaps(shortcutToKeys({
      code: '',
      meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey,
    }));
  } else {
    recordingRow.bottomEl.classList.add('empty');
    recordingRow.keycapsEl.innerHTML = '';
  }
}, true);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const feature of FEATURES) {
    const row = rowById[feature.id];
    if (typeof changes[feature.hiddenKey]?.newValue === 'boolean') {
      row.setHidden(changes[feature.hiddenKey].newValue);
    }
    if (changes[feature.shortcutKey]?.newValue) {
      row.setShortcut({ ...feature.defaultShortcut, ...changes[feature.shortcutKey].newValue });
    }
  }
});

async function load() {
  const keys = FEATURES.flatMap((f) => [f.hiddenKey, f.shortcutKey]);
  const res = await chrome.storage.sync.get(keys);
  for (const feature of FEATURES) {
    const row = rowById[feature.id];
    row.setHidden(res[feature.hiddenKey] === true); // default false (visible)
    row.setShortcut(res[feature.shortcutKey] || feature.defaultShortcut);
  }
  requestAnimationFrame(() => {
    document.body.classList.remove('no-anim');
  });
}

load();
