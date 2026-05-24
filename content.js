// Claude Screen Maximizer
// Two independent features, each with a "currently hidden" flag and a
// keyboard shortcut stored in chrome.storage.sync:
//   - prompt: composer/input area  (default ⌘ ;)
//   - menus:  top bar + sidebar    (default ⌥ ;)
//
// Storage is the single source of truth. The popup toggle and the keyboard
// shortcut both flip the storage value; this script reacts to storage
// changes by adding/removing the hidden class on the page.

(function() {
  'use strict';

  const HIDDEN_CLASS = 'claude-ext-hidden';

  let promptHidden = false;
  let menusHidden = false;
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
  // On /code session pages this can be multiple sibling elements:
  //   1) The composer column (.epitaxy-chat-column wrapping .epitaxy-prompt)
  //   2) The bottom-scrim wrapper column (when the page renders one)
  //   3) The "ready for next turn" indicator row — a small flex row inside the
  //      conversation column that holds the orange brand asterisk and a
  //      dropdown. The DOM places it inside .relative.epitaxy-chat-column
  //      rather than the composer, so hiding the composer alone leaves it
  //      visible. We hide it together with the composer.
  function findInputContainers() {
    if (isCodeMode()) {
      const out = [];
      const prompt = findMainCodePrompt();
      if (prompt) {
        let el = prompt.parentElement;
        while (el && el !== document.body) {
          if (el.classList.contains('epitaxy-chat-column') && el.tagName !== 'HEADER') {
            out.push(el);
            break;
          }
          el = el.parentElement;
        }
      }
      const scrim = document.querySelector('.epitaxy-bottom-scrim');
      if (scrim) {
        let el = scrim.parentElement;
        while (el && el !== document.body) {
          if (el.classList.contains('epitaxy-chat-column')) {
            if (!out.includes(el)) out.push(el);
            break;
          }
          el = el.parentElement;
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
      const row = star.closest('.epitaxy-chat-size');
      if (!row) continue;
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
          if (cls.includes('h-[32px]') && cls.includes('pl-[16px]') && cls.includes('pr-[16px]')) {
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
    if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.altKey) {
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

  async function init() {
    console.log('[Claude Maximizer] Initializing...');

    const res = await chrome.storage.sync.get([
      'prompt_hidden', 'menus_hidden', 'prompt_shortcut', 'menus_shortcut',
    ]);
    if (typeof res.prompt_hidden === 'boolean') promptHidden = res.prompt_hidden;
    if (typeof res.menus_hidden === 'boolean') menusHidden = res.menus_hidden;
    if (res.prompt_shortcut) promptShortcut = res.prompt_shortcut;
    if (res.menus_shortcut) menusShortcut = res.menus_shortcut;

    // Apply restored state. Don't focus the editor on initial load.
    if (promptHidden) {
      const containers = findInputContainers();
      containers.forEach(el => el.classList.add(HIDDEN_CLASS));
      document.body.classList.add('claude-ext-input-hidden');
    }
    if (menusHidden) applyMenusHidden(true);

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
