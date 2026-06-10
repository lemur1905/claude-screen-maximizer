// Claude Screen Maximizer
// Two independent features, each with a "currently hidden" flag and a
// keyboard shortcut stored in chrome.storage.sync:
//   - prompt: composer/input area  (default ⌘ ;)
//   - menus:  top bar + sidebar    (default ⌥ ;)
//
// Storage is the single source of truth. The popup toggle and the keyboard
// shortcut both flip the storage value; this script reacts to storage
// changes by adding/removing the hidden class on the page.
//
// Sending a message (Enter in the editor) auto-hides both features when
// auto-hide is on. Unlike the hidden flags, auto-hide is PER-TAB state: it
// lives only in this script (no storage), defaults by page type — ON on
// regular chat pages, OFF on /code — and the popup reads/writes the active
// tab's value via chrome.tabs.sendMessage.

(function() {
  'use strict';

  const HIDDEN_CLASS = 'claude-ext-hidden';

  let promptHidden = false;
  let menusHidden = false;
  let autoHideOnSubmit = true;
  let promptShortcut = { code: 'Semicolon', meta: true, ctrl: false, alt: false, shift: false };
  let menusShortcut = { code: 'Semicolon', meta: false, ctrl: false, alt: true, shift: false };

  function shortcutMatches(e, s) {
    return s
      && e.code === s.code
      && !!e.metaKey === !!s.meta
      && !!e.ctrlKey === !!s.ctrl
      && !!e.altKey === !!s.alt
      && !!e.shiftKey === !!s.shift;
  }

  // /code uses a different design system (epitaxy-*, dframe-*) than the
  // conversation pages, so selectors branch on pathname.
  const isCodeMode = () => location.pathname === '/code' || location.pathname.startsWith('/code/');

  function findMainCodePrompt() {
    const prompts = document.querySelectorAll('.epitaxy-prompt');
    for (const p of prompts) {
      if (!p.closest('.epitaxy-side-chat')) return p;
    }
    return null;
  }

  // Returns ALL elements that should be toggled as part of the "input area".
  // On /code this can be multiple sibling elements:
  //   1) The composer wrapper — the nearest .epitaxy-composer-width ancestor
  //      of the main .epitaxy-prompt. The page header shares that class, so
  //      skip HEADER. (The site dropped the old .epitaxy-chat-column wrapper;
  //      we keep a walk for it as a fallback for stale DOM variants.)
  //   2) The "ready for next turn" indicator row — a small flex row inside
  //      the conversation column with the orange brand asterisk + dropdown.
  //      It lives in the conversation, not the composer, so hiding the
  //      composer alone leaves it visible.
  // The bottom scrim is handled by content.css via the
  // body.claude-ext-input-hidden class — its nearest shared ancestor is the
  // whole chat panel, which must NOT be hidden.
  function findInputContainers() {
    if (isCodeMode()) {
      const out = [];
      const prompt = findMainCodePrompt();
      if (prompt) {
        const wrapper = prompt.closest('.epitaxy-composer-width');
        if (wrapper && wrapper.tagName !== 'HEADER') {
          out.push(wrapper);
        } else {
          // Fallback: older DOM wrapped the composer in .epitaxy-chat-column.
          let el = prompt.parentElement;
          while (el && el !== document.body) {
            if (el.classList.contains('epitaxy-chat-column') && el.tagName !== 'HEADER') {
              out.push(el);
              break;
            }
            el = el.parentElement;
          }
          if (!out.length) out.push(prompt);
        }
      }
      const readyRow = findCodeReadyTurnRow();
      if (readyRow && !out.includes(readyRow)) out.push(readyRow);
      return out;
    }

    const single = findConversationInputContainer();
    return single ? [single] : [];
  }

  // The orange-asterisk + dropdown "ready for next turn" row that sits
  // between the conversation and the composer. Identified by a span with
  // inline style `color: var(--accent-brand)` (the orange brand colour).
  function findCodeReadyTurnRow() {
    const stars = document.querySelectorAll('span[style*="accent-brand"]');
    // Iterate from last to first — the indicator is appended at the bottom
    // of the conversation, so the last match is the most likely candidate.
    for (let i = stars.length - 1; i >= 0; i--) {
      const star = stars[i];
      // .epitaxy-transcript-width is the current row wrapper;
      // .epitaxy-chat-size was its predecessor.
      const row = star.closest('.epitaxy-transcript-width') || star.closest('.epitaxy-chat-size');
      if (!row) continue;
      // A row we already hid measures 0×0, which the size check below would
      // reject — and then un-hide could never find it. Ours is always valid.
      if (row.classList.contains(HIDDEN_CLASS)) return row;
      // The indicator row is short (<=40px); assistant message wrappers use
      // the same class but are tall. Skip those.
      const r = row.getBoundingClientRect();
      if (r.height > 0 && r.height <= 40) return row;
    }
    return null;
  }

  function findConversationInputContainer() {
    const stickyBottom = document.querySelector('[class*="sticky"][class*="bottom-0"]');
    if (stickyBottom) return stickyBottom;

    // Walk up from the actual editor to find its fieldset container.
    const prosemirror = document.querySelector('.ProseMirror');
    if (prosemirror) {
      let parent = prosemirror.parentElement;
      while (parent && parent !== document.body) {
        if (parent.tagName === 'FIELDSET') {
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    const fieldsets = document.querySelectorAll('fieldset');
    for (const fieldset of fieldsets) {
      if (!fieldset.className.includes('opacity-0')) {
        return fieldset;
      }
    }

    const inputBox = document.querySelector('[class*="bg-bg-000"][class*="flex-col"]');
    if (inputBox) return inputBox;

    return null;
  }

  // On /code there are two .ProseMirrors; skip the side-chat one.
  function findMainEditor() {
    if (isCodeMode()) {
      const editors = document.querySelectorAll('.ProseMirror');
      for (const e of editors) {
        if (!e.closest('.epitaxy-side-chat')) return e;
      }
      return null;
    }
    return document.querySelector('.ProseMirror') || document.querySelector('[role="textbox"]');
  }

  function findSidebar() {
    if (isCodeMode()) {
      return document.querySelector('aside.dframe-sidebar');
    }
    return document.querySelector('nav');
  }

  function findTopBar() {
    if (isCodeMode()) {
      // Session pages (claude.ai/code/session_*) render the top breadcrumb
      // row as a plain <div> directly inside .tiles-shell, NOT a <header>.
      const tilesShell = document.querySelector('.tiles-shell');
      if (tilesShell) {
        for (const el of tilesShell.querySelectorAll('div')) {
          const cls = el.className?.toString?.() || '';
          // Right padding drifted from pr-[16px] to pr-[var(--epitaxy-titlebar-pr,16px)],
          // so only require the pr- prefix.
          if (cls.includes('h-[32px]') && cls.includes('pl-[16px]') && cls.includes('pr-[')) {
            return el;
          }
        }
      }
      // The bare /code index (no session) DOES have a <header>; fall back.
      return document.querySelector('header');
    }
    return document.querySelector('[class*="z-header"][class*="fixed"]') ||
           document.querySelector('.fixed.right-3');
  }

  function findConversationHeader() {
    if (isCodeMode()) return null; // already covered by findTopBar()
    return document.querySelector('header');
  }

  function findShareContainer() {
    if (isCodeMode()) return null; // merged into the single /code header
    return document.querySelector('[class*="z-20"][class*="md:absolute"][class*="md:right-0"]');
  }

  // Apply the "prompt hidden" state to the DOM. Idempotent — safe to call
  // any time, including from the MutationObserver.
  function applyPromptHidden(hidden) {
    const containers = findInputContainers();
    containers.forEach(el => el.classList.toggle(HIDDEN_CLASS, hidden));
    document.body.classList.toggle('claude-ext-input-hidden', hidden);
    if (!hidden) {
      const editor = findMainEditor();
      if (editor) editor.focus();
    }
  }

  function applyMenusHidden(hidden) {
    const sidebar = findSidebar();
    const topBar = findTopBar();
    const conversationHeader = findConversationHeader();
    const shareContainer = findShareContainer();
    [sidebar, topBar, conversationHeader, shareContainer].forEach(el => {
      if (el) el.classList.toggle(HIDDEN_CLASS, hidden);
    });
    document.body.classList.toggle('claude-ext-topbar-hidden', hidden);
  }

  // Keyboard event handler — flips the storage value; the storage listener
  // then calls the apply function.
  function handleKeyDown(event) {
    if (shortcutMatches(event, promptShortcut)) {
      event.preventDefault();
      event.stopPropagation();
      chrome.storage.sync.set({ prompt_hidden: !promptHidden });
      return;
    }

    if (shortcutMatches(event, menusShortcut)) {
      event.preventDefault();
      event.stopPropagation();
      chrome.storage.sync.set({ menus_hidden: !menusHidden });
      return;
    }

    // Enter (without modifiers) in the editor = message send → auto-hide both
    // (when the popup's auto-hide toggle is on).
    if (autoHideOnSubmit
        && event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.altKey) {
      const editor = findMainEditor();
      if (editor && editor.contains(event.target)) {
        // Small delay to let the message actually send before hiding.
        setTimeout(() => {
          const patch = {};
          if (!promptHidden) patch.prompt_hidden = true;
          if (!menusHidden) patch.menus_hidden = true;
          if (Object.keys(patch).length) chrome.storage.sync.set(patch);
        }, 150);
      }
    }
  }

  // After SPA navigation the elements are rebuilt; reapply the hidden state.
  function reapplyHiddenClasses() {
    if (promptHidden) {
      findInputContainers().forEach(el => {
        if (!el.classList.contains(HIDDEN_CLASS)) {
          el.classList.add(HIDDEN_CLASS);
        }
      });
    }
    if (menusHidden) {
      const els = [findSidebar(), findTopBar(), findConversationHeader(), findShareContainer()];
      els.forEach(el => {
        if (el && !el.classList.contains(HIDDEN_CLASS)) {
          el.classList.add(HIDDEN_CLASS);
        }
      });
    }
  }

  function setupObserver() {
    const observer = new MutationObserver(() => {
      if (promptHidden || menusHidden) {
        reapplyHiddenClasses();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (typeof changes.prompt_hidden?.newValue === 'boolean') {
      promptHidden = changes.prompt_hidden.newValue;
      applyPromptHidden(promptHidden);
    }
    if (typeof changes.menus_hidden?.newValue === 'boolean') {
      menusHidden = changes.menus_hidden.newValue;
      applyMenusHidden(menusHidden);
    }
    if (changes.prompt_shortcut?.newValue) promptShortcut = changes.prompt_shortcut.newValue;
    if (changes.menus_shortcut?.newValue) menusShortcut = changes.menus_shortcut.newValue;
  });

  // Per-tab auto-hide: the popup asks for / sets this tab's value.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'get_auto_hide') {
      sendResponse({ value: autoHideOnSubmit });
    } else if (msg?.type === 'set_auto_hide') {
      autoHideOnSubmit = !!msg.value;
      sendResponse({ value: autoHideOnSubmit });
    }
  });

  async function init() {
    console.log('[Claude Maximizer] Initializing...');

    // Every new page load starts with both features visible. We write the
    // reset through storage so the popup's toggles and any other open tabs
    // stay in sync via the storage listener. Auto-hide is per-tab and just
    // takes its page-type default here.
    autoHideOnSubmit = !isCodeMode();
    chrome.storage.sync.set({ prompt_hidden: false, menus_hidden: false });

    const res = await chrome.storage.sync.get(['prompt_shortcut', 'menus_shortcut']);
    if (res.prompt_shortcut) promptShortcut = res.prompt_shortcut;
    if (res.menus_shortcut) menusShortcut = res.menus_shortcut;

    document.addEventListener('keydown', handleKeyDown, true);
    setupObserver();

    console.log('[Claude Maximizer] Ready. Shortcuts configured in popup.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
