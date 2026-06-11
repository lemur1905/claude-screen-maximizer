# Chrome Web Store listing

Everything to paste into the Developer Dashboard forms. Fields below map 1:1
to the dashboard.

## Store listing tab

**Name** (comes from manifest.json on upload)

> Screen Maximizer for Claude

**Summary** (comes from manifest.json `description`, max 132 chars)

> Hide the prompt box, sidebar, and menus on claude.ai with keyboard shortcuts. Unofficial; not affiliated with Anthropic.

**Description**

```
Reclaim your screen on claude.ai. Screen Maximizer for Claude hides the
interface around your conversation so the content gets the whole window,
on both regular Claude chats and Claude Code sessions.

FEATURES

- Hide the prompt box with one shortcut, so a finished conversation reads
  like a document
- Hide the sidebar, top bar, and menus with another, and the chat expands
  to the full window width
- Auto-hide after send: sending a message tucks everything away so the
  response is front and center. Per-tab, on by default for chats, off by
  default for Claude Code, and adjustable from the popup
- Rebindable shortcuts: click a shortcut in the popup and type a new combo
- The toolbar icon is tinted while something is hidden, grey when not

DEFAULT SHORTCUTS

- Cmd+; (Ctrl+; on Windows) toggles the prompt box
- Option+; (Alt+; on Windows) toggles the sidebar and menus

Restoring the prompt box refocuses the editor so you can keep typing
immediately.

PRIVACY

No data collection, no analytics, no network requests. The extension only
runs on claude.ai and only stores your shortcut bindings and toggle states.
Privacy policy: https://github.com/lemur1905/claude-screen-maximizer#privacy-policy

This is an unofficial extension and is not affiliated with or endorsed by
Anthropic. Claude is a trademark of Anthropic, PBC. Source code:
https://github.com/lemur1905/claude-screen-maximizer
```

**Category**: Tools (or Productivity)

**Language**: English

**Store icon**: upload `store/icon-128.png` (128x128, art inset to 96x96 with
transparent padding per CWS guidance).

**Screenshots**: upload `store/screenshot-1.png` (1280x800). The store allows
up to 5; consider adding a before/after capture of a claude.ai page from a
clean profile (avoid showing real conversation titles or content).

## Privacy tab

**Single purpose description**

> Hides claude.ai interface elements (prompt box, sidebar, menus) via keyboard shortcuts to maximize screen space for the conversation.

**Permission justifications**

- `storage`: Saves the user's custom keyboard shortcut bindings and the
  current hidden/visible toggle states so they sync across the popup, the
  page, and the toolbar icon.
- Host permission `https://claude.ai/*`: The extension's single purpose is
  to hide interface elements on claude.ai; the content script must run
  there to do so. It runs on no other site.

**Data usage disclosures**: check "no data collected" for every category.

**Remote code**: No, all code is packaged.

## Distribution tab

- Visibility: Public, or Unlisted if you prefer install-by-link only.
- Regions: all.

## Packaging

Build the upload zip from the repo root:

```sh
zip -r dist/screen-maximizer-for-claude-$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])").zip \
  manifest.json content.js content.css popup.html popup.js service_worker.js icons
```

Upload the zip on the dashboard's Package tab. Bump `version` in
manifest.json before every new upload.
