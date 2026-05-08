// Claude Screen Maximizer
// Keyboard shortcuts to hide UI elements for maximum screen real estate

(function() {
  'use strict';

  // State tracking
  let inputHidden = false;
  let topBarHidden = false;

  // CSS class for hiding elements
  const HIDDEN_CLASS = 'claude-ext-hidden';

  // /code uses a different design system (epitaxy-*, dframe-*) than the
  // conversation pages, so selectors branch on pathname.
  const isCodeMode = () => location.pathname === '/code' || location.pathname.startsWith('/code/');

  // The /code page renders both a main composer and a floating side-chat
  // ASIDE — both use .epitaxy-prompt and .ProseMirror. We need the main one.
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

    // Conversation view (claude.ai/chat/...) — single-element finder, wrapped.
    const single = findConversationInputContainer();
    return single ? [single] : [];
  }

  // The orange-asterisk + dropdown "ready for next turn" row that sits
  // between the conversation and the composer. Identified by a span with
  // inline style `color: var(--accent-brand)` (the orange brand colour).
  // Walks up to its closest .epitaxy-chat-size wrapper row.
  function findCodeReadyTurnRow() {
    const stars = document.querySelectorAll('span[style*="accent-brand"]');
    // Iterate from last to first — the indicator is appended at the bottom
    // of the conversation, so the last match is the most likely candidate.
    for (let i = stars.length - 1; i >= 0; i--) {
      const star = stars[i];
      const row = star.closest('.epitaxy-chat-size');
      if (!row) continue;
      // Sanity: the indicator row is a small (h <= 40) one-line row. Skip
      // assistant message wrappers, which use the same class and are tall.
      const r = row.getBoundingClientRect();
      if (r.height > 0 && r.height <= 40) return row;
    }
    return null;
  }

  function findConversationInputContainer() {
    // In conversation view: sticky bottom container holds the entire input area
    const stickyBottom = document.querySelector('[class*="sticky"][class*="bottom-0"]');
    if (stickyBottom) return stickyBottom;

    // Best approach: walk up from the actual editor to find its fieldset container
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

    // Fallback: find the visible fieldset (not the one with opacity-0)
    const fieldsets = document.querySelectorAll('fieldset');
    for (const fieldset of fieldsets) {
      if (!fieldset.className.includes('opacity-0')) {
        return fieldset;
      }
    }

    // Fallback: find container with bg-bg-000 class (the styled input box)
    const inputBox = document.querySelector('[class*="bg-bg-000"][class*="flex-col"]');
    if (inputBox) return inputBox;

    return null;
  }

  // Find the main editor element (used to focus on show + detect Enter-to-send).
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

  // Find the sidebar (nav element)
  function findSidebar() {
    if (isCodeMode()) {
      return document.querySelector('aside.dframe-sidebar');
    }
    return document.querySelector('nav');
  }

  // Find the top right header icons (new chat page)
  function findTopBar() {
    if (isCodeMode()) {
      // Session pages (claude.ai/code/session_*) render the top breadcrumb
      // row as a plain <div> directly inside .tiles-shell, NOT a <header>.
      // It has h-[32px] + pl-[16px] + pr-[16px] in its className.
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
    // The fixed header area with profile icon
    return document.querySelector('[class*="z-header"][class*="fixed"]') ||
           document.querySelector('.fixed.right-3');
  }

  // Find the conversation header (conversation page - has title, share button)
  function findConversationHeader() {
    if (isCodeMode()) return null; // already covered by findTopBar()
    return document.querySelector('header');
  }

  // Find the share button container (top right in conversation view)
  function findShareContainer() {
    if (isCodeMode()) return null; // merged into the single /code header
    // The container with Share button and artifact icon
    return document.querySelector('[class*="z-20"][class*="md:absolute"][class*="md:right-0"]');
  }

  // Find the sidebar toggle button
  function findSidebarToggle() {
    return document.querySelector('[aria-label="Open sidebar"]') ||
           document.querySelector('[aria-label="Close sidebar"]');
  }

  // Toggle input visibility (Cmd + /)
  function toggleInputVisibility() {
    const containers = findInputContainers();

    if (containers.length) {
      inputHidden = !inputHidden;
      containers.forEach(el => el.classList.toggle(HIDDEN_CLASS, inputHidden));
      // Body class lets CSS hide companion elements (e.g. .epitaxy-bottom-scrim)
      document.body.classList.toggle('claude-ext-input-hidden', inputHidden);

      // If showing, focus the input
      if (!inputHidden) {
        const editor = findMainEditor();
        if (editor) {
          editor.focus();
        }
      }

      console.log('[Claude Maximizer] Input ' + (inputHidden ? 'hidden' : 'shown'));
    } else {
      console.log('[Claude Maximizer] Could not find input container');
    }
  }

  // Toggle top bar and sidebar visibility (Option + /)
  function toggleTopBarVisibility() {
    topBarHidden = !topBarHidden;

    const sidebar = findSidebar();
    const topBar = findTopBar();
    const conversationHeader = findConversationHeader();
    const shareContainer = findShareContainer();

    if (sidebar) {
      sidebar.classList.toggle(HIDDEN_CLASS, topBarHidden);
    }

    if (topBar) {
      topBar.classList.toggle(HIDDEN_CLASS, topBarHidden);
    }

    if (conversationHeader) {
      conversationHeader.classList.toggle(HIDDEN_CLASS, topBarHidden);
    }

    if (shareContainer) {
      shareContainer.classList.toggle(HIDDEN_CLASS, topBarHidden);
    }

    // Toggle body class for layout adjustments
    document.body.classList.toggle('claude-ext-topbar-hidden', topBarHidden);

    console.log('[Claude Maximizer] Top bar/sidebar ' + (topBarHidden ? 'hidden' : 'shown'));
  }

  // Hide all UI elements after sending a message
  function hideAllAfterSend() {
    // Small delay to let the message send before hiding
    setTimeout(() => {
      if (!inputHidden) {
        const containers = findInputContainers();
        if (containers.length) {
          inputHidden = true;
          containers.forEach(el => el.classList.add(HIDDEN_CLASS));
          document.body.classList.add('claude-ext-input-hidden');
        }
      }

      if (!topBarHidden) {
        topBarHidden = true;
        const sidebar = findSidebar();
        const topBar = findTopBar();
        const conversationHeader = findConversationHeader();
        const shareContainer = findShareContainer();

        [sidebar, topBar, conversationHeader, shareContainer].forEach(el => {
          if (el) el.classList.add(HIDDEN_CLASS);
        });

        document.body.classList.add('claude-ext-topbar-hidden');
      }

      console.log('[Claude Maximizer] UI auto-hidden after send');
    }, 150);
  }

  // Keyboard event handler
  function handleKeyDown(event) {
    // Use event.code for physical key (works regardless of Option key character transforms)
    // On Mac, Option+; produces ellipsis (…), so we must check event.code
    const isSemicolonKey = event.code === 'Semicolon';

    if (isSemicolonKey) {
      // Cmd + ; = toggle input
      if (event.metaKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        toggleInputVisibility();
        return;
      }

      // Option + ; = toggle top bar and sidebar
      if (event.altKey && !event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        toggleTopBarVisibility();
        return;
      }
    }

    // Enter (without Shift) in the editor = message send → auto-hide input
    if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.altKey) {
      const editor = findMainEditor();
      if (editor && editor.contains(event.target)) {
        hideAllAfterSend();
      }
    }
  }

  // Re-apply hidden classes after DOM changes (SPA navigation)
  function reapplyHiddenClasses() {
    if (inputHidden) {
      findInputContainers().forEach(el => {
        if (!el.classList.contains(HIDDEN_CLASS)) {
          el.classList.add(HIDDEN_CLASS);
        }
      });
    }

    if (topBarHidden) {
      const sidebar = findSidebar();
      const topBar = findTopBar();
      const conversationHeader = findConversationHeader();
      const shareContainer = findShareContainer();

      [sidebar, topBar, conversationHeader, shareContainer].forEach(el => {
        if (el && !el.classList.contains(HIDDEN_CLASS)) {
          el.classList.add(HIDDEN_CLASS);
        }
      });
    }
  }

  // Set up MutationObserver to handle SPA re-renders
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      // Only reapply if we're in a hidden state
      if (inputHidden || topBarHidden) {
        reapplyHiddenClasses();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  // Sample the conversation reading area's background colour and expose it as
  // a CSS variable so the scrim-masking rules adapt to theme (light/dark).
  // The .epitaxy-top-scrim / .epitaxy-bottom-scrim gradients use the same
  // colour as <main class="dframe-content">'s computed background, which
  // changes with the user's theme. Hard-coding light-mode colours would
  // produce visible bands in dark mode.
  function syncContentBgVar() {
    const main = document.querySelector('main.dframe-content');
    if (!main) return;
    const bg = getComputedStyle(main).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      document.documentElement.style.setProperty('--claude-ext-content-bg', bg);
    }
  }

  // Initialize
  function init() {
    console.log('[Claude Maximizer] Initializing...');

    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown, true);

    // Sample the page bg now and on subsequent updates (theme toggles, etc.)
    syncContentBgVar();
    setInterval(syncContentBgVar, 2000);

    // Set up observer for SPA navigation
    setupObserver();

    console.log('[Claude Maximizer] Ready! Shortcuts:');
    console.log('  Cmd + ;    : Toggle input box');
    console.log('  Option + ; : Toggle top bar & sidebar');
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
