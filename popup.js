const SHORTCUT_KEY = 'shortcut';
const ENABLED_KEY = 'enabled';
const DEFAULT_SHORTCUT = { code: 'Semicolon', meta: true, ctrl: false, alt: false, shift: false };

const toggleEl = document.getElementById('toggle-input');
const bottomEl = document.getElementById('bottom');
const displayEl = document.getElementById('kbd-display');
const keycapsEl = document.getElementById('keycaps');
const errorEl = document.getElementById('kbd-error');

const IS_MAC = navigator.platform.toUpperCase().includes('MAC');
const PURE_MODIFIERS = new Set([
  'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight',
]);

let currentShortcut = DEFAULT_SHORTCUT;
let recording = false;

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

function renderKeycaps(keys) {
  keycapsEl.innerHTML = '';
  for (const k of keys) {
    const cap = document.createElement('span');
    cap.className = 'keycap';
    cap.textContent = k;
    keycapsEl.appendChild(cap);
  }
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add('shown');
}
function clearError() {
  errorEl.classList.remove('shown');
  errorEl.textContent = '';
}

function flashSave() {
  // Force-restart the animation by re-adding the class
  displayEl.classList.remove('saved');
  void displayEl.offsetWidth;
  displayEl.classList.add('saved');
  setTimeout(() => displayEl.classList.remove('saved'), 1450);
}

// After a save, suppress the focus-ring for 500ms so the green flash plays
// uninterrupted. The CSS :hover rule then takes over: if the cursor is over
// the box when the timer fires, the ring is back; if not, it stays gone
// until the user hovers again. This is the same outcome as the earlier
// move+hovering logic, but without the brittle bottomEl.matches(':hover')
// check that could read false even when the cursor was over the box.
function suppressRingAfterSave() {
  bottomEl.classList.add('just-saved');
  setTimeout(() => bottomEl.classList.remove('just-saved'), 500);
}

function startRecording() {
  if (recording) return;
  recording = true;
  bottomEl.classList.add('recording', 'empty'); // empty → 'type' placeholder shows
  keycapsEl.innerHTML = '';
  clearError();
  bottomEl.focus();
}

function stopRecording() {
  recording = false;
  bottomEl.classList.remove('recording', 'empty');
  clearError();
  renderKeycaps(shortcutToKeys(currentShortcut));
}

async function saveShortcut(s) {
  currentShortcut = s;
  await chrome.storage.sync.set({ [SHORTCUT_KEY]: s });
  stopRecording();
  flashSave();
  suppressRingAfterSave();
}

function attemptSave(s) {
  // Validation: require at least one modifier so a bare letter can't fire on every keystroke
  if (!s.meta && !s.ctrl && !s.alt && !s.shift) {
    showError(IS_MAC
      ? 'Add a modifier (⌘ ⌥ ⌃ ⇧)'
      : 'Add a modifier (Ctrl, Alt, or Shift)');
    return;
  }
  saveShortcut(s);
}

function shortcutMatches(e, s) {
  return s
    && e.code === s.code
    && !!e.metaKey === !!s.meta
    && !!e.ctrlKey === !!s.ctrl
    && !!e.altKey === !!s.alt
    && !!e.shiftKey === !!s.shift;
}

window.addEventListener('keydown', (e) => {
  if (recording) {
    // Recording mode keydown handling
    if (e.code === 'Escape') {
      e.preventDefault();
      stopRecording();
      return;
    }
    if (PURE_MODIFIERS.has(e.code)) {
      clearError();
      bottomEl.classList.remove('empty'); // hide placeholder while a modifier is held
      renderKeycaps(shortcutToKeys({
        code: '',
        meta: e.metaKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
      }));
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    attemptSave({
      code: e.code,
      meta: e.metaKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
    });
    return;
  }
  // Not recording: if user fires the configured shortcut while the popup is
  // focused, flip the toggle here too — content.js never sees the keystroke
  // because the popup window captures it.
  if (shortcutMatches(e, currentShortcut)) {
    e.preventDefault();
    e.stopPropagation();
    const next = !toggleEl.checked;
    toggleEl.checked = next;
    chrome.storage.sync.set({ [ENABLED_KEY]: next });
  }
}, true);

window.addEventListener('keyup', (e) => {
  if (!recording) return;
  if (!PURE_MODIFIERS.has(e.code)) return;
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
    bottomEl.classList.remove('empty');
    renderKeycaps(shortcutToKeys({
      code: '',
      meta: e.metaKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
    }));
  } else {
    // All modifiers released — back to the 'type' placeholder
    bottomEl.classList.add('empty');
    keycapsEl.innerHTML = '';
  }
}, true);

bottomEl.addEventListener('click', () => {
  if (recording) stopRecording();
  else startRecording();
});
bottomEl.addEventListener('keydown', (e) => {
  if (recording) return;
  if (e.code === 'Enter' || e.code === 'Space') {
    e.preventDefault();
    startRecording();
  }
});
// If recording is active and focus leaves the bottom (e.g. user clicked the
// toggle), revert to the prior shortcut rather than leaving a "type…" field.
bottomEl.addEventListener('blur', () => {
  if (recording) stopRecording();
});

toggleEl.addEventListener('change', async () => {
  const enabled = toggleEl.checked;
  await chrome.storage.sync.set({ [ENABLED_KEY]: enabled });
});

// React if the enabled value changes externally (e.g. the user presses the
// keyboard shortcut while the popup happens to be open) so the toggle in the
// popup stays in sync with reality.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (typeof changes[ENABLED_KEY]?.newValue === 'boolean') {
    toggleEl.checked = changes[ENABLED_KEY].newValue;
  }
  if (changes[SHORTCUT_KEY]?.newValue) {
    currentShortcut = { ...DEFAULT_SHORTCUT, ...changes[SHORTCUT_KEY].newValue };
    if (!recording) renderKeycaps(shortcutToKeys(currentShortcut));
  }
});

async function load() {
  const res = await chrome.storage.sync.get([ENABLED_KEY, SHORTCUT_KEY]);
  toggleEl.checked = res[ENABLED_KEY] !== false; // default true
  currentShortcut = res[SHORTCUT_KEY] || DEFAULT_SHORTCUT;
  renderKeycaps(shortcutToKeys(currentShortcut));
  // Wait a frame so the just-set state is committed to the DOM, then remove
  // .no-anim so future user toggles animate normally.
  requestAnimationFrame(() => {
    document.body.classList.remove('no-anim');
  });
}

load();
