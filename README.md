# ProMarker 🚀
> **Self-Contained Single-Page HTML Bookmark Manager (TiddlyWiki Quine Architecture)**

ProMarker is a modern, standalone bookmark and web resource hub built as an all-in-one single-file HTML application. Inspired by TiddlyWiki, **all data is saved directly inside the HTML file itself**, requiring zero build steps, zero servers, and zero runtime dependencies.

## 🆕 v4 — Premium polish (Nov 2026)

- **Settings redesigned**: tabs (Appearance · General · Data & Sync), a visual theme picker with a live miniature of every theme, toggle switches, and bookmark/category/tag counts.
- **Styled confirm dialogs** replace the browser's plain `confirm()` pop-ups for permanent deletes and resets (Esc cancels; Cancel is focused for destructive actions).
- Refined depth and type: ambient accent glow behind the header, header shade on scroll, larger favicons and titles, tinted category icon, two-line save status, icon chips in toasts.
- Empty states speak to the view (search, Trash, Favorites). "Wipe Everything" keeps your chosen theme.
- **Tags tab** in Settings: rename a tag everywhere (renaming onto an existing tag merges them), remove a tag, or jump to its bookmarks.
- **JSON backup round-trip**: *Import JSON* next to *Export JSON*, with **Merge** (adds new links, matches categories by name, skips duplicates) or **Replace**. Both can be undone.
- **Duplicate finder** (Settings → Data & Sync): lists links saved more than once and merges them — tags, notes, visits and stars are combined into one link, the copies go to Trash.
- **Keep icons offline** (Settings → General): stores each site's icon inside the file as a small PNG (~3 KB each), so icons show without internet. Icons come from icon.horse / favicone.com (only the domain is sent); Google's favicon service is still used for normal display.
- **Clearer file-conflict choice**: when a file you link was saved elsewhere after your edits, a dialog offers *Keep my edits* / *Use the file's version* / *Cancel*, asked before the file is linked.
- **Inter font embedded** (Latin subset, 48 KB, SIL OFL) — same look on every computer, still zero network requests for fonts.
- Undo/redo now also restores the theme when an undone import or reset changed it.
- **Link cards**: soft glow and icon tile tinted in each site's own color, an "opens" arrow on the domain, category shown as a colored dot, quieter tags, visit count with an eye icon, hover actions in a floating pill, and a check badge on selected cards.
- **Add / edit dialog**: live preview header (icon, title and domain update as you type) with a one-click favorite star; address field with an "open" button; Title and Category side by side; **tag chips** with suggestions from your existing tags (Enter, comma or Tab adds, Backspace removes); added date and visit count when editing; Move to Trash right from the dialog.

## 🆕 v3.3 — Shortcuts & category order (Nov 2026)

- `A` = All bookmarks, `B` = Favorites, `1`–`9` = categories by sidebar position.
- Reorder categories by dragging them in the sidebar, or right-click → Move Up / Move Down / Move to Top. The order is saved in the file and can be undone.
- Compact card grid; notes open from a notes icon (`I` on a focused card).
- Double-click a card to copy it as a rich link. Click counts sit on the right of the card footer and give way to the action icons on hover.

## 🆕 v3.2 — Security hardening, smarter tags (Nov 2026)

- **Security** (see *Security* below): strict Content Security Policy pinned to the app script's hash; all loaded data sanitized; unsafe links (`javascript:`, `data:` …) blocked; files are verified before linking and before every save; saves are written from a clean snapshot.
- Tag bar shows only the tags used in the current view/category.
- Search understands `#tag` (e.g. `#ai claude`), and every word must match.
- Latte theme gets an espresso sidebar; the line under the top bar is gone.

## 🆕 v3.1 — Keyboard navigation, modular source, saving fixes (Nov 2026)

- Full keyboard navigation (see **Keyboard** below; press `?` in the app).
- Source split into `src/` modules with a zero-dependency `build.js`.
- Saving: clear explanation when a browser can't write files (Brave default, Safari, Firefox) instead of silently downloading `index (1).html`, `index (2).html`…; downloaded copies no longer discard the browser backup; linking no longer throws away unsaved edits; `Cmd+S` right after opening waits for the remembered link; dialogs and search no longer get closed or lose focus when an autosave finishes; old tabs can't overwrite a newer version.

## 🆕 v3 — Premium redesign & save-engine fixes (Nov 2026)

- **New design system**: layered neutral surfaces, hairline borders, soft depth, glass header, refined cards/list/compact views, polished dialogs, toasts and menus. All six themes reworked (Espresso `#302018` / Latte `#fdfbf7` brand colors kept).
- **Mobile & narrow windows**: sidebar becomes a slide-in drawer; no horizontal scrolling.
- **Safer saving**:
  - Edits made *while* a save is writing are no longer marked as saved (they're saved again right after).
  - Backups and the linked-file handle are now scoped to each file's path, so two ProMarker copies can't overwrite each other.
  - Unsaved browser backups restored on open are shown as unsaved and pushed to the file.
  - Status card tells the truth: `Saved · time`, `Unsaved changes`, `Only in this browser`, or `Autosave paused` with a **Resume** button when the browser needs permission again after a restart.
  - Warning before closing the tab with edits that haven't reached the file.
  - Every `<` in the embedded JSON is escaped, so no bookmark text can break the file.
- **Recent** view now shows the 30 most recently added, edited or opened links.
- Duplicate URL warning when adding; browser import skips duplicates and keeps original dates.
- Shortcuts: `/` focuses search, `Cmd/Ctrl+Enter` submits the bookmark dialog, `Esc` closes only the top-most thing; `N` no longer fires inside dialogs.

---

## ✨ Key Features

- 💾 **Quine Persistence Engine, Auto-Save & Multi-Browser Sync**:
  - Stores all bookmarks, categories, tags, and settings in an embedded `<script id="promarker-data" type="application/json">` block.
  - **Seamless In-Place Auto-Save**: Automatically writes changes back to your HTML file on disk with debouncing (800ms) once connected via the **File System Access API**. Zero save prompts needed!
  - **Truthful Connection Status**: Distinguishes between linked and unlinked states with dedicated visual indicators (`● Linked: index.html` in green vs `○ Not Linked to Disk` in amber with "Link File" action).
  - **Multi-Browser Live Sync**: When opened across multiple browsers or tabs connected to the same file, changes saved by one browser are automatically detected and reloaded by other browsers upon window focus, tab visibility change, or background polling (3s).
  - **Conflict-Free File Linking**: When connecting an existing file, ProMarker inspects disk state and loads the latest bookmarks without blind overwrites.
  - **Manual Save / Overwrite**: 1-click in-place overwrite with `Cmd+S` / `Ctrl+S` or the "Save" button.
  - **Download Fallback**: Automatic `Blob` download fallback for browsers or protocols where File System Access API is restricted.
  - **Clean Emergency Backup**: Changes are backed up to browser `localStorage` during active edits and automatically pruned once safely written to disk.

- ↩️ **Full Undo / Redo History System**:
  - Desktop-grade 50-step state history stack (`HistoryManager`).
  - **Keyboard Shortcuts**: `Cmd+Z` / `Ctrl+Z` to Undo, `Cmd+Shift+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` to Redo.
  - **Header Controls**: Dedicated Undo & Redo buttons in the top header with live enabled/disabled states.
  - Works across all operations: bookmark creation, edits, deletions, category changes, reordering, starring, and batch actions.

- 🗑️ **Trash & Instant Restoration**:
  - **Direct Card Restore**: Dedicated Restore button (in success green) on every bookmark card in the Trash view.
  - **Restore All**: 1-click "Restore All" button in the Trash header alongside "Empty Trash".
  - **Batch Restore**: Multi-select bookmarks in Trash and click "Restore Selected" in the floating action bar.
  - **Interactive Toast Undo**: Every delete, trash, or batch operation shows an instant notification toast with a clickable `[Undo]` button.
  - **Category Fallback**: Restoring bookmarks whose original category was deleted automatically assigns them to an active category.

- 📋 **Single-Click Copy Link as Title**:
  - Click the copy icon on any bookmark card to copy the title formatted as a link in a single click!
  - Copies multi-MIME rich HTML (`<a href="URL">Title</a>`) and Markdown (`[Title](URL)`). When pasted in rich-text editors (Slack, Google Docs, Notion, Word, Gmail), it pastes as a clean clickable title link; in plain text, it pastes as Markdown.
  - Configurable in Settings: `Title as Link`, `Title - URL`, or `URL Only`.

- 🖱️ **Desktop-Grade Context Menus**:
  - **Right-click on Bookmark Cards**:
    - Open in New Tab
    - Copy Title as Link
    - Copy URL Only
    - Toggle Favorite ⭐
    - Edit Bookmark...
    - Move to Category ▾ (with dynamic submenu of all active categories)
    - Delete / Move to Trash
  - **Right-click on Sidebar Categories**:
    - Add Bookmark to Category
    - Edit Category...
    - Copy Category Name
    - Delete Category... (asks whether to move bookmarks or delete them)
  - Features smart boundary clamping so menus never clip outside window edges.

- 🗂️ **Sidebar Categories & Smart Folders**:
  - Smart system views: **All Bookmarks**, **Favorites ⭐**, **Recent 🕒**, and **Trash 🗑️**.
  - Custom hierarchical categories with 12 color accents and custom SVG icons.
  - Category deletion modal asking whether to **keep bookmarks** (moving them to All Bookmarks) or **delete category & its bookmarks**.
  - Live bookmark counter badges on all categories.

- ⚠️ **Settings Reset & Clear Engine (Danger Zone)**:
  - **Clear All Bookmarks**: Wipes all bookmarks while preserving your category taxonomy.
  - **Reset to Factory Defaults**: Restores starter developer & designer categories and bookmarks.
  - **Wipe All (Blank Canvas)**: Completely clears everything to a fresh, clean slate.

- 🎨 **Adaptive Grid & List Views**:
  - **Comfortable Grid (Default)**: Rich cards with favicons, domain badges, descriptions, tags, click counters, and action toolbars.
  - **Compact Grid**: High-density view for large bookmark collections.
  - **Detailed List View**: Linear table layout with quick access to all metadata.

- 🖐️ **Native Drag & Drop**:
  - **Drag-to-Category**: Drag any bookmark card and drop it onto a sidebar category to instantly reassign it.
  - **Drag-to-Reorder**: Reorder bookmark cards directly within the grid in "Custom Sort" mode with live insertion indicator lines.
  - **External Drop Target**: Drag URLs or highlighted links from other browser tabs or windows directly onto the page to quick-add them.

- 🌐 **Browser Netscape Bookmark Import & Export**:
  - Universal compatibility with Chrome, Brave, Safari, Firefox, and Edge.
  - Import existing `bookmarks.html` files with automatic category/folder discovery.
  - Export valid Netscape HTML to take your bookmarks back to any browser.
  - JSON data export for developer backups.

- ⚡ **Batch Multi-Select Operations**:
  - Select multiple cards with `Cmd`/`Ctrl` + Click.
  - Bulk actions: "Move To Category...", "Star All", "Delete Selected".

- ⌨️ **Keyboard-First Workflow**:
  - `Cmd+S` / `Ctrl+S`: Save file directly to disk.
  - `Cmd+Z` / `Ctrl+Z`: Undo last action.
  - `Cmd+Shift+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`: Redo last undone action.
  - `Cmd+K` / `Ctrl+K`: Global instant search (filters titles, URLs, tags, descriptions).
  - `N`: Quick-add new bookmark modal.
  - `Escape`: Close modals, context menus, and clear selection.

- 🌓 **Themes & Design System**:
  - Clean Linear / Raycast-inspired aesthetic.
  - Defaults to **System Preference** with seamless automatic switching between Dark and Light modes.
  - Manual overrides available in Settings:
    - 💻 **System Default (Auto)**
    - 🌙 **Dark Mode** (Cool Slate / Navy)
    - ☀️ **Light Mode** (Clean Neutral White)
    - 🌌 **Midnight** (Pure OLED Black)
    - ☕ **Espresso** (Warm Dark Chocolate `#302018` with warm ivory `#fdfbf7` typography and caramel accents)
    - 🍦 **Latte** (Warm Light Cream `#fdfbf7` with rich espresso `#302018` typography and roasted bronze accents)
  - 100% offline-ready with 30 embedded SVG icons.

---

## 🚀 Getting Started

1. Simply double-click [`index.html`](file:///Users/pro/Documents/ProMarker/index.html) to open it in your favorite browser (Chrome, Edge, Brave, Safari, Firefox).
2. Right-click on any bookmark card or sidebar category to reveal the context menus.
3. Click the copy icon on any card to copy the title formatted as a link.
4. When you make changes, click the green **"Save"** button or press **`Cmd+S` / `Ctrl+S`**:
   - In Chromium browsers (Chrome, Edge, Brave), choose `index.html` to grant in-place write access. All future saves will write directly to the file!
   - In other browsers, an updated `index.html` file will be downloaded with matching filename to easily replace your existing file.

---

## 💾 Saving into the same file

ProMarker writes your bookmarks back into this HTML file using the browser's File System Access API.

| Browser | What happens |
|---|---|
| Chrome, Edge, Arc, Opera | Click **Link File** once and pick this file. Every change autosaves into it; `Cmd/Ctrl+S` saves immediately. After a browser restart, click **Resume** once to allow writing again. |
| Brave | The API is **off by default**, so saving downloads a new copy (and Brave may ask where to save it). Turn it on: open `brave://flags/#file-system-access-api` → **Enabled** → Relaunch, then click **Link File**. |
| Safari, Firefox | Can't write to files. Saving downloads an updated copy; replace your original with it. |

Your edits are never lost while unlinked: they're kept in the browser and restored when you reopen the file there.

---

## ⌨️ Keyboard

Press `?` in the app for the full list.

| Keys | Action |
|---|---|
| `↑ ↓ ← →`, `J` / `K`, `Home` / `End` | Move between bookmarks |
| `Enter` / `Cmd+Enter` | Open / open in background tab |
| `Space` or `X`, `Shift+Arrows`, `Cmd+A` | Select, extend selection, select all |
| Double-click a card | Copy it as a rich link (title linked to the URL) |
| `E` `F` `C` `M` `Delete` `R` | Edit, favorite, copy link, move, trash, restore (in Trash) |
| `A` / `B` | All bookmarks / Favorites |
| `1` … `9` | Categories, in sidebar order (hover a sidebar item to see its key) |
| `[` / `]` | Previous / next view or category |
| `/` or `Cmd+K`, then `↓` | Search, then jump into results |
| `Shift+F10` | Context menu (arrow keys + Enter inside it) |
| `N`, `Cmd+S`, `Cmd+Z`, `Cmd+Shift+Z` | New, save, undo, redo |

---

## 🔒 Security

ProMarker is a page that can rewrite a file on your disk, so it defends itself:

- **Only its own code runs.** A Content Security Policy pins the app script by its SHA-256 hash (computed by `build.js`). Injected `<script>` tags, inline handlers like `onerror=` and `javascript:` links are refused by the browser. Nothing loads from the network except favicon images.
- **Data is never trusted.** Everything read from the file, the browser backup, other tabs or imports goes through `sanitizeData()` (`src/js/00-security.js`): ids, icons, colors and settings are restricted to safe values, and links may only use `http`, `https`, `ftp`, `mailto` or `file`.
- **Files are verified.** Linking refuses any file that isn't a ProMarker file. Before each save, the file on disk is checked: if its code was changed, scripts or handlers were added, or it isn't ProMarker any more, saving pauses and you choose *Restore clean file*, *Download clean copy* or *Keep paused*.
- **Saves are clean.** The file is rebuilt from the page as it was loaded, with anything foreign stripped, so browser-extension leftovers or injected markup never get saved.

Good habits: link only `index.html` (never a folder), prefer "Allow this time" over "Allow on every visit", and don't open untrusted `.html` downloads in the browser you use for ProMarker.

> Adding a new field to bookmarks, categories or settings? Add it to `sanitizeData()` too, or it will be dropped on load.

---

## 🛠️ Project Structure

`index.html` is **generated**. Edit the files in `src/`, then rebuild.

```
ProMarker/
├── index.html              # The app + your bookmarks (generated by build.js — don't edit by hand)
├── build.js                # Stitches src/ into index.html, keeping the bookmarks already inside it
├── package.json            # npm run build | test | test:e2e | check
├── src/
│   ├── template.html       # Page skeleton with {{PLACEHOLDERS}}
│   ├── icons.svg           # SVG icon sprite (<symbol id="icon-…">)
│   ├── seed.json           # Starter bookmarks for `node build.js --fresh`
│   ├── styles/             # CSS, concatenated in file-name order
│   │   ├── 01-tokens.css         themes & design tokens
│   │   ├── 02-base.css           reset, typography, icons
│   │   ├── 03-layout-sidebar.css app shell, sidebar, link banner
│   │   ├── 04-header-buttons.css top bar, search, buttons
│   │   ├── 05-toolbar.css        heading, view switcher, tag chips
│   │   ├── 06-cards.css          grid / compact / list cards, empty state, batch bar
│   │   ├── 07-modals-forms.css   dialogs, forms, help dialog
│   │   ├── 08-toasts-menus.css   toasts, context menu, shortcut help
│   │   └── 09-responsive.css     tablet / phone / touch / reduced motion
│   └── js/                 # Script, concatenated in file-name order inside one closure
│       ├── 00-security.js        data sanitizer, safe links, file integrity checks
│       ├── 01-state.js           AppState, browser backup, autosave scheduling
│       ├── 02-history.js         undo / redo
│       ├── 03-helpers.js         domain, favicon, URL normalising
│       ├── 04-clipboard.js       copy title as link
│       ├── 05-context-menu.js    right-click menus
│       ├── 06-file-handle-store.js  remembers the linked file (IndexedDB)
│       ├── 06a-file-support.js   browser capability detection + "why download?" help
│       ├── 06b-integrity-ui.js   "file changed outside ProMarker" alert + repair
│       ├── 07-quine-engine.js    serialize + save / link / sync with the file
│       ├── 08-disk-sync.js       restore link on open, multi-tab sync
│       ├── 09-netscape.js        browser bookmark import / export
│       ├── 10-theme.js  11-utils-toast.js
│       ├── 12-render-app.js      app shell + save status
│       ├── 13-render-card.js     bookmark card
│       ├── 13a-notes-popover.js  notes panel opened from the card's notes icon
│       ├── 14-events.js          click / input wiring
│       ├── 15-drag-drop.js
│       ├── 15a-category-order.js  sidebar category drag-to-reorder + menu moves
│       ├── 16…19-modal-*.js      bookmark, category, batch move, settings dialogs
│       ├── 20-keyboard.js        global shortcuts, close warning
│       ├── 21-keyboard-nav.js    card / sidebar / menu keyboard navigation, shortcut help
│       └── 99-bootstrap.js       first render
├── tests/
│   ├── verify_promarker.js # Static checks on the built file
│   └── e2e-save.mjs        # Real headless-Chrome test of linking, autosave and safety guards
└── backups/                # build.js copies the previous index.html here (last 10)
```

### Updating the app

```bash
npm run build      # or: node build.js
```

- Your bookmarks are read from the current `index.html` and carried into the new build; the old file is copied to `backups/` first.
- Reload any open ProMarker tab afterwards. An old tab that tries to save will notice the newer version and ask you to reload instead of overwriting it.
- Add a feature: create a new numbered file in `src/js/` or `src/styles/` (e.g. `22-my-feature.js`) — no imports needed, everything shares one scope.
- Other builds: `node build.js --out work.html` (keeps work.html's bookmarks), `--data other.html` (take bookmarks from another file), `--fresh` (starter bookmarks).

---

## 🧪 Running Automated Tests

```bash
npm run check      # build + static tests + end-to-end save test (needs Google Chrome)
```
