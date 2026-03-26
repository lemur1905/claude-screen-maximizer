// Claude Screen Maximizer
// Keyboard shortcuts to hide UI elements for maximum screen real estate

(function() {
  'use strict';

  // State tracking
  let inputHidden = false;
  let topBarHidden = false;

  // CSS class for hiding elements
  const HIDDEN_CLASS = 'claude-ext-hidden';

  // Find the input/composer container
  function findInputContainer() {
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

  // Find the sidebar (nav element)
  function findSidebar() {
    return document.querySelector('nav');
  }

  // Find the top right header icons (new chat page)
  function findTopBar() {
    // The fixed header area with profile icon
    return document.querySelector('[class*="z-header"][class*="fixed"]') ||
           document.querySelector('.fixed.right-3');
  }

  // Find the conversation header (conversation page - has title, share button)
  function findConversationHeader() {
    // The sticky header at top with conversation title
    return document.querySelector('header');
  }

  // Find the share button container (top right in conversation view)
  function findShareContainer() {
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
    const inputContainer = findInputContainer();

    if (inputContainer) {
      inputHidden = !inputHidden;
      inputContainer.classList.toggle(HIDDEN_CLASS, inputHidden);

      // If showing, focus the input
      if (!inputHidden) {
        const editor = document.querySelector('.ProseMirror, [role="textbox"]');
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
        const inputContainer = findInputContainer();
        if (inputContainer) {
          inputHidden = true;
          inputContainer.classList.add(HIDDEN_CLASS);
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
      const editor = document.querySelector('.ProseMirror, [role="textbox"]');
      if (editor && editor.contains(event.target)) {
        hideAllAfterSend();
      }
    }
  }

  // Re-apply hidden classes after DOM changes (SPA navigation)
  function reapplyHiddenClasses() {
    if (inputHidden) {
      const inputContainer = findInputContainer();

      if (inputContainer && !inputContainer.classList.contains(HIDDEN_CLASS)) {
        inputContainer.classList.add(HIDDEN_CLASS);
      }
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

  // Initialize
  function init() {
    console.log('[Claude Maximizer] Initializing...');

    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown, true);

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
