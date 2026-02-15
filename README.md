# Claude Screen Maximizer

A Chrome extension that adds keyboard shortcuts to hide UI elements on [claude.ai](https://claude.ai), giving you maximum screen real estate for reading and reviewing conversations.

## Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd + ;` | Toggle the input/composer box |
| `Option + ;` | Toggle the sidebar, top bar, and conversation header |

Pressing `Cmd + ;` again restores the input box and automatically focuses it so you can start typing immediately.

## What It Hides

**`Cmd + ;`** hides:
- The input/composer area (sticky bottom container)

**`Option + ;`** hides:
- Sidebar navigation
- Top header bar (profile icon, etc.)
- Conversation header (title, share button)
- Share/artifact controls

When the sidebar and top bar are hidden, the chat content expands to use the full width of the screen.

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the extension folder

## How It Works

The extension injects a content script into `claude.ai` that listens for keyboard shortcuts. When triggered, it toggles a CSS class (`claude-ext-hidden`) on the target elements to hide or show them. A `MutationObserver` ensures the hidden state persists across Claude's SPA navigation and re-renders.

## Files

```
├── manifest.json    # Extension manifest (Manifest V3)
├── content.js       # Keyboard listener and DOM logic
├── content.css      # Hide/show styles and layout adjustments
└── icons/           # Extension icons (16, 48, 128px)
```
