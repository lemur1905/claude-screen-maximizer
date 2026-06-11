# Screen Maximizer for Claude

A Chrome extension that reclaims screen real estate on [claude.ai](https://claude.ai). Hide the prompt box, sidebar, and menus with keyboard shortcuts, on both regular Claude chats and [Claude Code](https://claude.ai/code) sessions, so the conversation gets the whole screen.

<img src="assets/popup.png" alt="Extension popup with toggles and editable shortcuts" width="360">

## Features

- **Hide the prompt box**: collapses the composer/input area (and, on Claude Code, the "ready for next turn" indicator row) so a finished conversation reads like a document.
- **Hide the menus**: collapses the sidebar, top bar, conversation header, and share controls in one shortcut, and the chat expands to the full window width.
- **Auto-hide after send**: sending a message hides everything automatically, putting the response front and center. This is per-tab: it defaults on for regular chats and off for Claude Code sessions (where you usually want the prompt between turns), and you can flip it for any tab from the popup.
- **Custom shortcuts**: click a shortcut in the popup and type a new combo to rebind it. Shortcuts match physical keys, so Option combos work correctly on macOS.
- **Live status icon**: the toolbar icon is tinted while the extension is actively hiding something, grey when everything is visible.

## Default shortcuts

| Shortcut (macOS) | Action |
|---|---|
| `⌘ ;` | Toggle the prompt box |
| `⌥ ;` | Toggle the sidebar and menus |

Restoring the prompt box automatically focuses the editor so you can keep typing immediately. Both shortcuts are rebindable in the popup, and the popup toggles mirror the page state in real time.

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the repository folder
5. Open [claude.ai](https://claude.ai) and press `⌥ ;`

## Project structure

```
├── manifest.json       # Manifest V3
├── content.js          # Shortcuts, element finders, hide/show state machine
├── content.css         # Hide rules and layout reclaim (width/padding overrides)
├── popup.html          # Popup UI: per-feature toggles + shortcut recorder
├── popup.js            # Popup logic, synced through chrome.storage
├── service_worker.js   # Draws the state-aware toolbar icon
└── icons/              # Static extension icons (16/48/128px)
```

## Privacy policy

Screen Maximizer for Claude does not collect, transmit, sell, or share any user data.

- The extension runs only on `claude.ai` pages and makes no network requests of any kind.
- It does not read, store, or transmit your conversations or any page content. It only adds and removes CSS classes to show or hide page elements.
- The only stored values are your shortcut bindings and toggle states, kept locally in Chrome's extension storage (`chrome.storage.sync`) and synced by Chrome to your own Google account if you have extension sync enabled.
- There are no analytics, no tracking, no third-party services, and no remote code.

If you have a privacy question, please open an issue on this repository.

## Caveats

This is an unofficial project, not affiliated with Anthropic. It depends on claude.ai's DOM structure, which changes without notice. If a shortcut stops working after a site redesign, the element selectors in `content.js` likely need updating.

## Credits

Developed by Ian Kahn, using [Claude Code](https://claude.com/claude-code).

## License

[MIT](LICENSE)
