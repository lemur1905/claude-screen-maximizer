# Screen Maximizer Extension - Summary & Plan

## Overview

Chrome extension to maximize screen real estate on AI chat interfaces by hiding UI elements with keyboard shortcuts.

**Keyboard Shortcuts:**
- `Cmd + /` — Toggle input box
- `Option + /` — Toggle top bar & sidebar

---

## ChatGPT Extension - Completed

### Features Implemented
1. **Input Box Toggle** (`Cmd + /`)
   - Hides the bottom input container (`#thread-bottom-container`)
   - Auto-focuses input when shown again

2. **Top Bar + Sidebar Toggle** (`Option + /`)
   - Hides: header, sidebar (conversation history)
   - Content expands to fill reclaimed space

3. **Always-On Improvements**
   - Removes fading gradients above input
   - Removes scroll fade masks (but NOT the input container!)

### Key Technical Learnings

1. **Mac Keyboard Events - CRITICAL**
   - `Option + /` produces `÷` character, NOT `/`
   - Must use `event.code === 'Slash'` instead of `event.key === '/'`
   - This is because Mac Option key transforms characters
   ```javascript
   // WRONG - won't work on Mac
   const isSlash = event.key === '/';

   // CORRECT - works on Mac
   const isSlashKey = event.code === 'Slash' || event.key === '/';
   ```

2. **CSS Selectors Can Match Unintended Elements**
   - Broad selectors like `[class*="fade-mask"]` can match unintended elements
   - ChatGPT's input container has class `vertical-scroll-fade-mask`
   - Our CSS was hiding it! Fixed with `:not()` selector:
   ```css
   /* WRONG - hides input container too */
   [class*="fade-mask"] { display: none !important; }

   /* CORRECT - excludes input */
   [class*="fade-mask"]:not([class*="prosemirror"]) { display: none !important; }
   ```

3. **Finding the Right Sidebar Element**
   - ChatGPT has a narrow "rail" (52px) AND an expandable panel (260px)
   - The selector `[class*="sidebar"]` found the wrong element (just the rail)
   - Correct selector: `[class*="border-token-border-light"][class*="shrink-0"]`

4. **DOM Discovery Techniques**
   - Walk up from known element (like the input) to find containers
   - Check `getBoundingClientRect()` for width/height to verify correct element
   - Use `document.elementFromPoint(x, y)` to find what's blocking clicks

5. **Debugging with Browser Extension**
   - Use `javascript_tool` to run diagnostics
   - Store captured events in `window._capturedKeys = []` for inspection
   - Check `computedStyle.display` vs inline style to find CSS conflicts

6. **MutationObserver for SPAs**
   - ChatGPT re-renders DOM frequently
   - Observer re-applies hidden classes when DOM changes

### File Structure
```
gptmaximizer/
├── manifest.json      # Extension config (matches chatgpt.com, chat.openai.com)
├── content.js         # Keyboard handling, element finders, toggles
├── content.css        # Hidden class, layout adjustments, gradient removal
└── icons/             # Extension icons (16, 48, 128px)
```

---

## Plan for Claude.ai Extension

### Goal
Add Claude.ai support to the same extension (not a separate extension).

### Phase 1: Discovery

1. **Navigate to claude.ai** and identify key elements:
   - Input/composer area (bottom)
   - Top navigation bar
   - Sidebar (conversation list)
   - Any gradient/fade overlays

2. **Use these diagnostic scripts:**
   ```javascript
   // Find input area candidates
   document.querySelector('[role="textbox"]');
   document.querySelector('textarea');
   document.querySelector('[contenteditable="true"]');
   document.querySelector('.ProseMirror');

   // Find sidebar
   document.querySelector('nav');
   document.querySelector('[class*="sidebar"]');
   document.querySelector('aside');

   // Find top bar
   document.querySelector('header');

   // Check what's at a specific point (for debugging click issues)
   document.elementFromPoint(x, y);

   // Walk up DOM to find container sizes
   let el = document.querySelector('.ProseMirror');
   while (el) {
     console.log(el.tagName, el.getBoundingClientRect().width);
     el = el.parentElement;
   }
   ```

3. **Check for CSS conflicts:**
   ```javascript
   // Find elements with display:none that shouldn't be hidden
   const el = document.querySelector('INPUT_SELECTOR');
   console.log('inline:', el.getAttribute('style'));
   console.log('computed:', window.getComputedStyle(el).display);
   ```

### Phase 2: Implementation

1. **Update manifest.json** to include Claude URLs:
   ```json
   {
     "content_scripts": [{
       "matches": [
         "https://chatgpt.com/*",
         "https://chat.openai.com/*",
         "https://claude.ai/*"
       ],
       "js": ["content.js"],
       "css": ["content.css"]
     }]
   }
   ```

2. **Update content.js** with site detection:
   ```javascript
   const SITE = window.location.hostname.includes('claude.ai') ? 'claude' : 'chatgpt';

   function findInputContainer() {
     if (SITE === 'claude') {
       // Claude-specific selectors
     } else {
       // ChatGPT selectors
     }
   }
   ```

3. **Update content.css** with Claude-specific rules:
   ```css
   /* Claude-specific adjustments */
   body.claude-ext-topbar-hidden [class*="claude-sidebar"] {
     display: none !important;
   }
   ```

### Phase 3: Testing Checklist

- [ ] `Cmd + /` hides input on Claude
- [ ] `Cmd + /` shows input and focuses it
- [ ] `Option + /` hides sidebar and top bar
- [ ] `Option + /` shows them again
- [ ] Normal typing works in input (no CSS conflicts!)
- [ ] Test on new chat page
- [ ] Test on existing conversation
- [ ] Test after page navigation (MutationObserver)

---

## Debugging Checklist

When something doesn't work:

1. **Keyboard shortcut not firing?**
   - Check `event.code` vs `event.key` (Mac Option transforms chars)
   - Add test listener: `window._capturedKeys = []`

2. **Can't type in input?**
   - Check if element has `display: none` in computed style
   - Check if CSS selectors are too broad
   - Walk up DOM to find which parent has 0 dimensions

3. **Wrong element being hidden?**
   - Check `getBoundingClientRect()` for dimensions
   - Verify selector finds the outermost container
   - Use `:not()` to exclude unintended matches

4. **Hidden state not persisting after navigation?**
   - Verify MutationObserver is running
   - Check if `reapplyHiddenClasses()` finds the right elements

---

## Next Steps

1. [x] Complete ChatGPT extension
2. [x] Fix keyboard shortcuts for Mac
3. [x] Fix CSS input visibility bug
4. [ ] Open claude.ai and run discovery
5. [ ] Document Claude selectors
6. [ ] Add Claude support to extension
7. [ ] Test and refine
