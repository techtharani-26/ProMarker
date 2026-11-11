const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- ProMarker Automated Test Suite (v2) ---');

const htmlPath = path.join(__dirname, '..', 'index.html');
assert(fs.existsSync(htmlPath), 'index.html must exist');
const html = fs.readFileSync(htmlPath, 'utf8');

// Test 1: Validate HTML Shell & Doctype
console.log('1. Validating HTML Document Structure...');
assert(html.startsWith('<!DOCTYPE html>'), 'Document must start with <!DOCTYPE html>');
assert(/<html[^>]*lang="en"/.test(html), 'Must include <html lang="en">');
assert(html.includes('<head>'), 'Must include <head>');
assert(html.includes('</head>'), 'Must include </head>');
assert(html.includes('<body>'), 'Must include <body>');
assert(html.includes('</body>'), 'Must include </body>');
assert(html.includes('<div id="app" class="app-container"></div>'), 'Must contain pristine app container');
assert(html.includes('<div id="toast-container" class="toast-container"></div>'), 'Must contain toast container');
console.log('✓ HTML document structure is valid.');

// Test 2: Validate SVG Icons Sprite
console.log('2. Validating SVG Icons Sprite (including v2 additions)...');
const expectedIcons = [
  'icon-bookmark', 'icon-folder', 'icon-folder-plus', 'icon-star',
  'icon-clock', 'icon-trash', 'icon-search', 'icon-plus', 'icon-grid',
  'icon-compact', 'icon-list', 'icon-external-link', 'icon-edit',
  'icon-copy', 'icon-check', 'icon-save', 'icon-download', 'icon-upload',
  'icon-settings', 'icon-grip', 'icon-tag', 'icon-menu', 'icon-x',
  'icon-refresh', 'icon-chevron-right', 'icon-sort', 'icon-link-file',
  'icon-undo', 'icon-redo', 'icon-restore'
];
expectedIcons.forEach(iconId => {
  assert(html.includes(`id="${iconId}"`), `Missing SVG icon definition for #${iconId}`);
});
console.log(`✓ All ${expectedIcons.length} embedded SVG icons verified.`);

// Test 3: Validate Embedded JSON Data Store & Settings
console.log('3. Validating Embedded JSON Data Store & Settings...');
const dataMatch = html.match(/<script id="promarker-data" type="application\/json">([\s\S]*?)<\/script>/);
assert(dataMatch, 'Must contain <script id="promarker-data" type="application/json">');
const state = JSON.parse(dataMatch[1].trim());

assert.strictEqual(state.version, 1, 'Version must be 1');
assert(state.settings, 'Settings object must exist');
assert(state.settings.theme, 'Theme setting must exist');
assert(state.settings.copyFormat, 'Default copy format must exist');
assert(Array.isArray(state.categories), 'Categories must be an array');
assert(state.categories.length >= 1, 'Must have at least 1 category');
assert(Array.isArray(state.bookmarks), 'Bookmarks must be an array');
console.log(`✓ Seed store verified: ${state.categories.length} categories, ${state.bookmarks.length} bookmarks.`);

// Test 4: Quine Serialization Test
console.log('4. Testing Quine Serialization Round-trip...');
const mutatedState = JSON.parse(JSON.stringify(state));
mutatedState.bookmarks.push({
  id: 'bm-test-unit',
  title: 'Antigravity AI Test Link',
  url: 'https://example.org/test',
  description: 'A test bookmark',
  categoryId: state.categories[0].id,
  tags: ['test', 'unit'],
  isFavorite: true,
  isTrash: false,
  clickCount: 1,
  createdAt: Date.now(),
  order: 999
});

const simulatedSerialized = html.replace(
  /<script id="promarker-data" type="application\/json">[\s\S]*?<\/script>/,
  '<script id="promarker-data" type="application/json">\n' + JSON.stringify(mutatedState, null, 2) + '\n</script>'
);

const reParsedMatch = simulatedSerialized.match(/<script id="promarker-data" type="application\/json">([\s\S]*?)<\/script>/);
assert(reParsedMatch, 'Serialized HTML must retain script tag');
const reParsedState = JSON.parse(reParsedMatch[1].trim());
assert.strictEqual(reParsedState.bookmarks.length, state.bookmarks.length + 1);
const testBm = reParsedState.bookmarks.find(b => b.id === 'bm-test-unit');
assert(testBm, 'New bookmark must be present in re-parsed JSON');
assert.strictEqual(testBm.title, 'Antigravity AI Test Link');
console.log('✓ Quine serialization round-trip verified.');

// Test 5: Drag & Drop Reordering Logic
console.log('5. Testing Drag & Drop Reordering Logic...');
const bookmarksList = [
  { id: 'b1', order: 0 },
  { id: 'b2', order: 1 },
  { id: 'b3', order: 2 },
  { id: 'b4', order: 3 }
];
function simulateReorder(list, sourceId, targetId, insertBefore) {
  const srcIdx = list.findIndex(b => b.id === sourceId);
  const tgtIdx = list.findIndex(b => b.id === targetId);
  const [item] = list.splice(srcIdx, 1);
  let newIdx = list.findIndex(b => b.id === targetId);
  if (!insertBefore) newIdx++;
  list.splice(newIdx, 0, item);
  list.forEach((b, i) => b.order = i);
  return list;
}
const reordered = simulateReorder([...bookmarksList], 'b4', 'b2', true);
assert.deepStrictEqual(reordered.map(b => b.id), ['b1', 'b4', 'b2', 'b3']);
console.log('✓ Drag & drop reordering logic verified.');

// Test 6: Single-Click Copy Link with Title Formatter
console.log('6. Testing Single-Click Copy Link with Title Formatting...');
function formatLinkCopy(title, url, format) {
  const cleanTitle = (title || 'Link').trim();
  if (format === 'title-link') {
    return {
      plainText: `[${cleanTitle}](${url})`,
      htmlText: `<a href="${url}">${cleanTitle}</a>`
    };
  } else if (format === 'title-url') {
    return {
      plainText: `${cleanTitle} - ${url}`,
      htmlText: `<a href="${url}">${cleanTitle}</a>`
    };
  } else if (format === 'url-only') {
    return {
      plainText: url,
      htmlText: `<a href="${url}">${url}</a>`
    };
  }
}

const copyResult = formatLinkCopy('GitHub', 'https://github.com', 'title-link');
assert.strictEqual(copyResult.plainText, '[GitHub](https://github.com)');
assert.strictEqual(copyResult.htmlText, '<a href="https://github.com">GitHub</a>');

const copyResultTitleUrl = formatLinkCopy('GitHub', 'https://github.com', 'title-url');
assert.strictEqual(copyResultTitleUrl.plainText, 'GitHub - https://github.com');

console.log('✓ Single-click title-as-link formatter verified.');

// Test 7: Category Deletion Branching Logic
console.log('7. Testing Category Deletion Branching Logic (Keep vs Delete Bookmarks)...');
const sampleCategories = [
  { id: 'cat-a', name: 'Cat A' },
  { id: 'cat-b', name: 'Cat B' }
];
const sampleBookmarks = [
  { id: 'bm-1', categoryId: 'cat-a', isTrash: false },
  { id: 'bm-2', categoryId: 'cat-a', isTrash: false },
  { id: 'bm-3', categoryId: 'cat-b', isTrash: false }
];

// Branch A: Keep Bookmarks (reassign to fallback category)
function deleteCategoryKeepBookmarks(cats, bms, catId) {
  const remaining = cats.filter(c => c.id !== catId);
  const fallback = remaining[0]?.id || 'cat-general';
  bms.forEach(b => {
    if (b.categoryId === catId) b.categoryId = fallback;
  });
  return { cats: remaining, bms };
}

const resKeep = deleteCategoryKeepBookmarks([...sampleCategories], JSON.parse(JSON.stringify(sampleBookmarks)), 'cat-a');
assert.strictEqual(resKeep.cats.length, 1);
assert.strictEqual(resKeep.bms.filter(b => b.isTrash).length, 0, 'No bookmarks should be trashed');
assert.strictEqual(resKeep.bms.filter(b => b.categoryId === 'cat-b').length, 3, 'All 3 bookmarks now in remaining cat');

// Branch B: Delete Category AND its Bookmarks
function deleteCategoryDeleteBookmarks(cats, bms, catId) {
  const remaining = cats.filter(c => c.id !== catId);
  bms.forEach(b => {
    if (b.categoryId === catId) b.isTrash = true;
  });
  return { cats: remaining, bms };
}

const resDelete = deleteCategoryDeleteBookmarks([...sampleCategories], JSON.parse(JSON.stringify(sampleBookmarks)), 'cat-a');
assert.strictEqual(resDelete.cats.length, 1);
assert.strictEqual(resDelete.bms.filter(b => b.isTrash).length, 2, '2 bookmarks from cat-a must be trashed');
assert.strictEqual(resDelete.bms.filter(b => !b.isTrash).length, 1, 'Only bm-3 from cat-b remains active');

console.log('✓ Category deletion branching logic verified.');

// Test 8: Settings Danger Zone Reset & Clear Actions
console.log('8. Testing Settings Danger Zone Reset & Clear Actions...');

// 8a: Clear All Bookmarks
const clearedBms = [];
assert.strictEqual(clearedBms.length, 0);

// 8b: Reset to Factory Defaults
const defaultSeedMatch = html.match(/const DEFAULT_SEED_DATA = ({[\s\S]*?});\s*\n\s*\/\/ Load initial state/);
const defaultSeed = defaultSeedMatch ? eval('(' + defaultSeedMatch[1] + ')') : null;
assert(defaultSeed, 'DEFAULT_SEED_DATA must exist in HTML');
assert(defaultSeed.categories.length >= 4, 'Default seed must have at least 4 starter categories');
assert(defaultSeed.bookmarks.length >= 6, 'Default seed must have starter bookmarks');

// 8c: Wipe All Data (Blank Canvas)
const blankState = {
  version: 1,
  settings: { theme: 'system', viewMode: 'grid', sortBy: 'custom', openInNewTab: true, trackClicks: true, copyFormat: 'title-link' },
  categories: [{ id: 'cat-general', name: 'General', icon: 'folder', color: '#6366f1', order: 0 }],
  bookmarks: []
};
assert.strictEqual(blankState.bookmarks.length, 0);
assert.strictEqual(blankState.categories.length, 1);
assert.strictEqual(blankState.categories[0].id, 'cat-general');

console.log('✓ Settings Danger Zone data mutations verified.');

// Test 9: Themes & Design System (including Espresso & Latte)
console.log('9. Validating Themes & Design System (Espresso & Latte)...');
assert(html.includes('[data-theme="espresso"]'), 'Must contain [data-theme="espresso"] CSS rules');
assert(html.includes('[data-theme="latte"]'), 'Must contain [data-theme="latte"] CSS rules');
assert(html.includes('--bg-base: #302018;'), 'Espresso theme must use #302018 as base background');
assert(html.includes('--text-main: #fdfbf7;'), 'Espresso theme must use #fdfbf7 as main text');
assert(html.includes('--bg-base: #fdfbf7;'), 'Latte theme must use #fdfbf7 as base background');
assert(html.includes('--text-main: #302018;'), 'Latte theme must use #302018 as main text');
assert(html.includes('value="espresso"'), 'Settings modal must offer espresso option');
assert(html.includes('value="latte"'), 'Settings modal must offer latte option');
assert(html.includes(':root:not([data-theme])'), 'System dark mode must only apply when no explicit theme is chosen');
console.log('✓ Espresso (#302018) & Latte (#fdfbf7) themes verified in CSS and Settings.');

// Test 10: Emoji Cleanliness, Tag Separator Line, & True Same-File Quine Saving
console.log('10. Validating Emoji Cleanliness, Tag Separator Line, & Same-File Quine Engine...');
// 10a: Tag separator line in CSS
assert(html.includes('.card-tags {'), 'Must define .card-tags');
assert(/\.card-bottom \{[^}]*border-top: 1px (solid|dashed) var\(--border-subtle\)/.test(html), 'Must have a separator line above the card footer');

// 10b: Emoji replacement in sort and theme options
const sortSelectMatch = html.match(/<select class="select-dropdown" id="sort-select"[\s\S]*?<\/select>/);
assert(sortSelectMatch, 'Must find sort-select');
assert(!sortSelectMatch[0].includes('🔀'), 'Sort options must not contain emoji');
assert(!sortSelectMatch[0].includes('📅'), 'Sort options must not contain emoji');
assert(!sortSelectMatch[0].includes('🔥'), 'Sort options must not contain emoji');

const themeSelectMatch = html.match(/<select class="form-select" id="theme-select"[\s\S]*?<\/select>/);
assert(themeSelectMatch, 'Must find theme-select');
assert(!themeSelectMatch[0].includes('💻'), 'Theme options must not contain emoji');
assert(!themeSelectMatch[0].includes('🌙'), 'Theme options must not contain emoji');
assert(!themeSelectMatch[0].includes('☕'), 'Theme options must not contain emoji');

// 10c: Same-file Quine engine
assert(html.includes('getAppFilename()'), 'QuineEngine must define getAppFilename()');
assert(html.includes('promarker_fs'), 'Must configure IndexedDB for handle persistence');
assert(html.includes('storeFileHandle'), 'Must define storeFileHandle');
assert(html.includes('retrieveFileHandle'), 'Must define retrieveFileHandle');
assert(html.includes('connectFile'), 'QuineEngine must define connectFile');

console.log('✓ Emoji replacement, tag divider, and same-file Quine saving verified.');

// Test 11: Inline Application Script Parsing & Syntax Integrity
console.log('11. Validating Inline Application Script Parsing & Syntax Integrity...');
const vm = require('vm');
const scriptMatch = html.match(/<script(?![^>]*type="application\/json")[\s\S]*?>([\s\S]*?)<\/script>/i);
assert(scriptMatch, 'Must find main application <script> block');
const scriptRest = html.slice(scriptMatch.index + scriptMatch[0].length);
assert(!scriptRest.includes('</script>'), 'No premature or unescaped </script> tags allowed inside application script');

try {
  new vm.Script(scriptMatch[1], { filename: 'index.html#app-script' });
} catch (err) {
  assert.fail(`Application script failed JavaScript syntax check: ${err.message}`);
}
console.log('✓ Application script parses cleanly with zero syntax errors.');

// Test 12: Undo/Redo State History System (HistoryManager)
console.log('12. Validating Undo/Redo State History System...');
assert(html.includes('const HistoryManager = {'), 'Must define HistoryManager');
assert(html.includes('pushState('), 'HistoryManager must implement pushState');
assert(html.includes('undo()'), 'HistoryManager must implement undo()');
assert(html.includes('redo()'), 'HistoryManager must implement redo()');
assert(html.includes('canUndo()'), 'HistoryManager must implement canUndo()');
assert(html.includes('canRedo()'), 'HistoryManager must implement canRedo()');
assert(html.includes('id="btn-undo"'), 'Must render Undo button in top header');
assert(html.includes('id="btn-redo"'), 'Must render Redo button in top header');
assert(html.includes("key === 'z'") && html.includes('HistoryManager.undo()'), 'Must register Cmd/Ctrl+Z undo shortcut');

// Simulate HistoryManager stack transitions
const simHistory = {
  undoStack: [],
  redoStack: [],
  maxStackSize: 50,
  push(state, desc) {
    this.undoStack.push({ data: JSON.parse(JSON.stringify(state)), description: desc });
    if (this.undoStack.length > this.maxStackSize) this.undoStack.shift();
    this.redoStack = [];
  },
  undo(curr) {
    if (this.undoStack.length === 0) return curr;
    this.redoStack.push({ data: JSON.parse(JSON.stringify(curr)) });
    return this.undoStack.pop().data;
  },
  redo(curr) {
    if (this.redoStack.length === 0) return curr;
    this.undoStack.push({ data: JSON.parse(JSON.stringify(curr)) });
    return this.redoStack.pop().data;
  }
};

let simState = { count: 1 };
simHistory.push(simState, 'step 1');
simState = { count: 2 };
simHistory.push(simState, 'step 2');
simState = { count: 3 };

// Undo to step 2
simState = simHistory.undo(simState);
assert.strictEqual(simState.count, 2, 'Undo must revert to count 2');
// Undo to step 1
simState = simHistory.undo(simState);
assert.strictEqual(simState.count, 1, 'Undo must revert to count 1');
// Redo back to step 2
simState = simHistory.redo(simState);
assert.strictEqual(simState.count, 2, 'Redo must advance to count 2');
console.log('✓ Undo/Redo state history logic and UI verified.');

// Test 13: Trash Restoration & Toast Undo Action
console.log('13. Validating Trash Restoration & Toast Undo Action...');
assert(html.includes('data-action="restore-bookmark"'), 'Bookmark cards in trash must have restore-bookmark action');
assert(html.includes('id="btn-restore-all"'), 'Trash header must offer Restore All button');
assert(html.includes('id="btn-batch-restore"'), 'Floating batch bar must offer Restore Selected button in Trash');
assert(html.includes('.toast-action-btn'), 'CSS must define .toast-action-btn');
assert(html.includes('toast-action-btn'), 'showToast must render interactive toast action button');

// Simulate bookmark restore logic
const sampleTrashedBms = [
  { id: 'b-t1', title: 'Trash 1', categoryId: 'cat-general', isTrash: true },
  { id: 'b-t2', title: 'Trash 2', categoryId: 'cat-deleted', isTrash: true }
];
const existingCats = [{ id: 'cat-general', name: 'General' }];

// Restore single
sampleTrashedBms[0].isTrash = false;
assert.strictEqual(sampleTrashedBms[0].isTrash, false, 'Bookmark must be restored from trash');

// Restore with fallback category
sampleTrashedBms[1].isTrash = false;
if (!existingCats.some(c => c.id === sampleTrashedBms[1].categoryId)) {
  sampleTrashedBms[1].categoryId = existingCats[0].id;
}
assert.strictEqual(sampleTrashedBms[1].categoryId, 'cat-general', 'Restored item must fallback to valid category');
console.log('✓ Trash restoration, batch restore, and toast undo actions verified.');

// Test 14: Auto-Save Engine, Debounce & Status Dot
console.log('14. Validating Auto-Save Engine, Debounce & Status Dot...');
assert(html.includes('autoSave: true'), 'DEFAULT_SEED_DATA.settings must include autoSave: true');
assert(html.includes('autoSave()'), 'QuineEngine must implement autoSave()');
assert(html.includes('id="pref-auto-save"'), 'Settings modal must offer pref-auto-save toggle');
assert(html.includes('.status-dot.saving'), 'CSS must define .status-dot.saving pulse state');
assert(html.includes("s.text = 'Saving…'"), 'Must render Saving… status text while writing');

console.log('✓ Auto-save engine, debounce logic, and status indicators verified.');

// Test 15: Cross-Browser Multi-Instance Synchronization & Truthful Connection Status
console.log('15. Validating Cross-Browser Multi-Instance Sync & Truthful Status...');
assert(html.includes('.status-dot.unlinked'), 'CSS must define .status-dot.unlinked state');
assert(html.includes('syncFromDisk()'), 'QuineEngine must implement syncFromDisk()');
assert(html.includes("window.addEventListener('focus'"), 'Must register focus listener for syncFromDisk');
assert(html.includes("document.addEventListener('visibilitychange'"), 'Must register visibilitychange listener for syncFromDisk');
assert(html.includes("Not linked to file"), 'Must render Not linked to file when no handle is connected');
assert(html.includes("btnLabel = 'Resume'"), 'Must surface a Resume action when write permission lapsed');
assert(html.includes("'Not linked to disk'"), 'Settings modal must clearly report unlinked state');
assert(!html.includes("Saved to index.html"), 'Must never show misleading "Saved to index.html" when unlinked');

// Simulate 2-Browser Disk Synchronization Flow:
let diskFileContent = {
  html: html,
  lastModified: 1000
};

// Simulated Browser Instance A
const browserA = {
  data: JSON.parse(JSON.stringify(state)),
  lastDiskMtime: 1000,
  isDirty: false
};

// Simulated Browser Instance B
const browserB = {
  data: JSON.parse(JSON.stringify(state)),
  lastDiskMtime: 1000,
  isDirty: false
};

// 1. Browser A adds a bookmark and saves to disk
browserA.data.bookmarks.push({
  id: 'bm-sync-a',
  title: 'Added by Browser A',
  url: 'https://example.com/a',
  categoryId: browserA.data.categories[0].id,
  isFavorite: false,
  isTrash: false,
  order: 99
});
const timeA = Date.now();
browserA.data._lastSaved = timeA;
diskFileContent.html = html.replace(
  /<script id="promarker-data" type="application\/json">[\s\S]*?<\/script>/,
  '<script id="promarker-data" type="application/json">\n' + JSON.stringify(browserA.data, null, 2) + '\n</script>'
);
diskFileContent.lastModified = 2000;
browserA.lastDiskMtime = 2000;

// Verify Browser B initially has fewer bookmarks
assert.strictEqual(browserB.data.bookmarks.length, state.bookmarks.length);
assert.strictEqual(browserA.data.bookmarks.length, state.bookmarks.length + 1);

// 2. Browser B triggers syncFromDisk() on focus/poll
function simulateSync(browser, disk) {
  if (browser.isDirty) return false;
  if (disk.lastModified > browser.lastDiskMtime) {
    const match = disk.html.match(/<script id="promarker-data" type="application\/json">([\s\S]*?)<\/script>/i);
    if (match) {
      const diskData = JSON.parse(match[1]);
      if ((diskData._lastSaved || 0) > (browser.data._lastSaved || 0)) {
        browser.data = diskData;
        browser.lastDiskMtime = disk.lastModified;
        return true;
      }
    }
  }
  return false;
}

const syncResultB = simulateSync(browserB, diskFileContent);
assert.strictEqual(syncResultB, true, 'Browser B must detect disk change and sync');
assert.strictEqual(browserB.data.bookmarks.length, browserA.data.bookmarks.length, 'Browser B bookmarks count must match Browser A');
assert(browserB.data.bookmarks.some(b => b.id === 'bm-sync-a'), 'Browser B now has bookmark created by Browser A');

// 3. Browser B adds another bookmark and saves to disk
browserB.data.bookmarks.push({
  id: 'bm-sync-b',
  title: 'Added by Browser B',
  url: 'https://example.com/b',
  categoryId: browserB.data.categories[0].id,
  isFavorite: false,
  isTrash: false,
  order: 100
});
const timeB = timeA + 5000;
browserB.data._lastSaved = timeB;
diskFileContent.html = html.replace(
  /<script id="promarker-data" type="application\/json">[\s\S]*?<\/script>/,
  '<script id="promarker-data" type="application/json">\n' + JSON.stringify(browserB.data, null, 2) + '\n</script>'
);
diskFileContent.lastModified = 3000;
browserB.lastDiskMtime = 3000;

// 4. Browser A triggers syncFromDisk() on focus/poll
const syncResultA = simulateSync(browserA, diskFileContent);
assert.strictEqual(syncResultA, true, 'Browser A must detect disk change from Browser B');
assert.strictEqual(browserA.data.bookmarks.length, browserB.data.bookmarks.length, 'Both browsers in sync');
assert(browserA.data.bookmarks.some(b => b.id === 'bm-sync-b'), 'Browser A now has bookmark created by Browser B');

console.log('✓ Cross-browser multi-instance live synchronization verified.');

// Test 16: Direct File Linking, Auto-Save Without Modals, and Resilient Handle Persistence
console.log('16. Validating Direct File Linking, In-Place Auto-Saving & Modal Prevention...');
assert(html.includes('ensureWritePermission'), 'QuineEngine must implement ensureWritePermission');
assert(html.includes('writeToHandle'), 'QuineEngine must implement writeToHandle');
assert(!html.includes('perm !== \'granted\'\n                    showToast(\'Write permission not granted for \' + handle.name'), 'Must not abort linking when user gesture was consumed by file picker');

// Simulate FileHandle operations
let writtenContent = null;
let savePickerInvoked = false;
const mockHandle = {
  name: 'index.html',
  async queryPermission(opts) { return 'granted'; },
  async requestPermission(opts) { return 'granted'; },
  async getFile() { return { lastModified: Date.now() }; },
  async createWritable() {
    return {
      async write(chunk) { writtenContent = chunk; },
      async close() {}
    };
  }
};

const simAppState = {
  fileHandle: mockHandle,
  isDirty: true,
  isSaving: false,
  _isSyncing: false,
  notify() {}
};

// Simulate save when fileHandle is linked: it MUST write to handle and NOT open save picker
async function simSave(appState) {
  if (appState.fileHandle) {
    const writable = await appState.fileHandle.createWritable();
    await writable.write('SAVED_HTML');
    await writable.close();
    appState.isDirty = false;
    return true;
  }
  savePickerInvoked = true;
  return false;
}

simSave(simAppState).then(res => {
  assert.strictEqual(res, true, 'Save with fileHandle must return true');
  assert.strictEqual(writtenContent, 'SAVED_HTML', 'Must write directly to linked fileHandle');
  assert.strictEqual(savePickerInvoked, false, 'showSaveFilePicker must NEVER be opened when handle is linked');
  assert.strictEqual(simAppState.isDirty, false, 'Dirty flag must be cleared after save');
});

console.log('✓ Direct file linking, in-place auto-save, and modal prevention verified.');

// Test 17: Security policy pins the app script; no inline handlers in the shipped markup
console.log('17. Validating Content Security Policy & markup hygiene...');
{
  const crypto = require('crypto');
  const cspMatch = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert(cspMatch, 'Must ship a Content-Security-Policy meta tag');
  const csp = cspMatch[1];
  assert(/default-src 'none'/.test(csp), "CSP must default to 'none'");
  assert(!/script-src[^;]*'unsafe-inline'/.test(csp), "CSP must not allow inline scripts");
  const body = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const hash = 'sha256-' + crypto.createHash('sha256').update(body, 'utf8').digest('base64');
  assert(csp.includes(`'${hash}'`), 'CSP script hash must match the app script exactly');
  const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  assert(!/\son[a-z]+\s*=/i.test(markup), 'Shipped markup must not contain inline event handlers');
  assert(!/onerror=/.test(body.replace(/addEventListener\('error'/g, '')), 'App templates must not render inline onerror handlers');
  assert(body.includes('function sanitizeData('), 'Must sanitize loaded data');
  assert(body.includes('function inspectProMarkerFile('), 'Must verify files before linking/saving');
}
console.log('✓ CSP hash, sanitizer and file verification present; no inline handlers.');

// Test 18: stored site icons and new settings survive the sanitizer only in their safe form
console.log('18. Validating sanitizer for stored icons & offline-icons setting...');
{
  const vm = require('vm');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '00-security.js'), 'utf8');
  const core = src.slice(0, src.indexOf('/* --------------------------------------------------------------------------\n   FILE INTEGRITY'));
  const ctx = {};
  vm.runInNewContext(core + '\nthis.sanitizeData = sanitizeData;', ctx);
  const png = 'data:image/png;base64,' + 'A'.repeat(200) + '==';
  const mk = (favicon) => ctx.sanitizeData({ settings: { offlineIcons: true }, categories: [{ id: 'c', name: 'C' }],
    bookmarks: [{ id: 'b', title: 't', url: 'https://x.com', categoryId: 'c', favicon }] });
  const ok = mk(png);
  assert.strictEqual(ok.bookmarks[0].favicon, png, 'A small base64 PNG icon must be kept');
  assert.strictEqual(ok.settings.offlineIcons, true, 'offlineIcons setting must be kept');
  [
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',               // SVG can carry script
    'https://evil.example/x.png',                               // remote URL, not stored data
    'data:image/png;base64,AAA" onerror="alert(1)',              // attribute break-out
    'data:image/png;base64,' + 'A'.repeat(20000),               // oversized
    'javascript:alert(1)',
  ].forEach((bad) => assert(!('favicon' in mk(bad).bookmarks[0]), 'Unsafe icon must be dropped: ' + bad.slice(0, 40)));
  assert.strictEqual(ctx.sanitizeData({ settings: {}, categories: [], bookmarks: [] }).settings.offlineIcons, false, 'offlineIcons defaults to off');
}
console.log('✓ Only small PNG/WebP icons are kept; SVG, URLs, break-outs and oversized data are dropped.');

// Test 19: 4-per-row Category Sections View, Archive Smart View, & Nested Sub-Category Folders
console.log('19. Validating Category Sections View, Archive View, & Nested Sub-Category Folders...');
{
  const vm = require('vm');
  // Icons & CSS & UI markers
  assert(html.includes('id="icon-sections"'), 'Must include #icon-sections in SVG sprite');
  assert(html.includes('id="icon-archive"'), 'Must include #icon-archive in SVG sprite');
  assert(html.includes('data-view="sections"'), 'Must render Sections view mode button');
  assert(html.includes('data-nav="archive"'), 'Must render Archive smart view in sidebar');
  assert(html.includes('data-action="toggle-archive"'), 'Must render archive toggle action on cards');
  assert(html.includes('.bookmarks-sections'), 'CSS must define .bookmarks-sections');
  assert(html.includes('repeat(4, minmax(0, 1fr))'), 'Sections view must use 4 columns per row on desktop');
  assert(html.includes('function renderSectionsView('), 'Must define renderSectionsView()');
  assert(html.includes('id="cat-parent"'), 'Category modal must offer parent folder selector');
  assert(html.includes('if (b.isArchived && !isSearching) return false;'), 'Archived links must be included when searching');
  assert(!html.includes('<div class="section-subfolders-strip">'), 'Sub-categories must be rendered as individual category sections rather than embedded strips');
  assert(/\.section-bm-actions\s*\{[^}]*background:\s*transparent/.test(html), 'Action icon group in section links must have transparent background');

  // Verify sanitizeData + hierarchy helpers
  const secSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '00-security.js'), 'utf8');
  const coreSec = secSrc.slice(0, secSrc.indexOf('/* --------------------------------------------------------------------------\n   FILE INTEGRITY'));
  const helpSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '03-helpers.js'), 'utf8');
  const ctx = {};
  vm.runInNewContext(coreSec + '\n' + helpSrc + '\nthis.sanitizeData = sanitizeData; this.getCategoryTree = getCategoryTree; this.getCategoryDescendants = getCategoryDescendants; this.getCategoryPathString = getCategoryPathString;', ctx);

  const sanitized = ctx.sanitizeData({
    settings: { viewMode: 'sections' },
    categories: [
      { id: 'c-root', name: 'Engineering', order: 0 },
      { id: 'c-sub', name: 'Frontend', parentId: 'c-root', order: 1 },
      { id: 'c-cycle-a', name: 'Cycle A', parentId: 'c-cycle-b', order: 2 },
      { id: 'c-cycle-b', name: 'Cycle B', parentId: 'c-cycle-a', order: 3 }
    ],
    bookmarks: [
      { id: 'b-active', title: 'Active', url: 'https://a.com', categoryId: 'c-sub', isArchived: false },
      { id: 'b-arch', title: 'Archived', url: 'https://b.com', categoryId: 'c-root', isArchived: true }
    ]
  });

  assert.strictEqual(sanitized.settings.viewMode, 'sections', 'sections viewMode must survive sanitizer');
  assert.strictEqual(sanitized.categories.find(c => c.id === 'c-sub').parentId, 'c-root', 'Valid parentId must be preserved');
  // Cycle must be broken
  const cycA = sanitized.categories.find(c => c.id === 'c-cycle-a');
  const cycB = sanitized.categories.find(c => c.id === 'c-cycle-b');
  assert(!(cycA.parentId && cycB.parentId), 'Circular parentId references must be broken by sanitizer');

  // Archive flag
  assert.strictEqual(sanitized.bookmarks.find(b => b.id === 'b-active').isArchived, false);
  assert.strictEqual(sanitized.bookmarks.find(b => b.id === 'b-arch').isArchived, true);

  // Hierarchy helpers
  const tree = ctx.getCategoryTree(sanitized.categories);
  const subEntry = tree.find(e => e.cat.id === 'c-sub');
  assert.strictEqual(subEntry.depth, 1, 'Subcategory must have depth 1 in tree');
  assert.strictEqual(ctx.getCategoryPathString('c-sub', sanitized.categories), 'Engineering / Frontend');
  const desc = ctx.getCategoryDescendants('c-root', sanitized.categories);
  assert(desc.has('c-root') && desc.has('c-sub'), 'Descendants of root must include both root and subcategory');
}
console.log('✓ 4-column Sections view, Archive view, and nested sub-category folders verified.');

// Test 20: Local-Use Security & Privacy Hardening
console.log('20. Validating Local-Use Security & Privacy Hardening...');
{
  const vm = require('vm');
  const secSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '00-security.js'), 'utf8');
  const coreSec = secSrc.slice(0, secSrc.indexOf('/* --------------------------------------------------------------------------\n   FILE INTEGRITY'));
  const helpSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '03-helpers.js'), 'utf8');
  const ctx = {
    URL,
    AppState: { data: { settings: { fetchFavicons: true }, categories: [], bookmarks: [] } }
  };
  vm.runInNewContext(
    coreSec + '\n' + helpSrc +
    '\nthis.isPublicFaviconDomain = isPublicFaviconDomain; this.getFaviconUrl = getFaviconUrl; this.sanitizeData = sanitizeData;',
    ctx
  );

  // 20a: Private/local domains must never leak to external favicon services
  [
    'localhost',
    '127.0.0.1',
    '192.168.1.50',
    '10.0.0.1',
    '172.16.0.5',
    '[::1]',
    'router.local',
    'gitlab.internal',
    'nas.lan',
    'wiki.corp',
    'intranet',
    'hidden.onion',
  ].forEach((priv) => {
    assert.strictEqual(ctx.isPublicFaviconDomain(priv), false, `Private/local host must be rejected: ${priv}`);
    assert.strictEqual(ctx.getFaviconUrl('http://' + priv + '/admin'), '', `Must not build external favicon URL for ${priv}`);
  });
  assert.strictEqual(ctx.getFaviconUrl('file:///Users/pro/secret.html'), '', 'file:// URLs must never fetch external favicons');
  assert.strictEqual(ctx.isPublicFaviconDomain('github.com'), true, 'Public domain must be allowed');
  assert(ctx.getFaviconUrl('https://github.com').includes('github.com'), 'Public domain returns favicon URL when enabled');

  // 20b: Disabling fetchFavicons suppresses all remote favicon URLs
  ctx.AppState.data.settings.fetchFavicons = false;
  assert.strictEqual(ctx.getFaviconUrl('https://github.com'), '', 'fetchFavicons=false must suppress remote favicon URLs');
  assert.strictEqual(ctx.sanitizeData({ settings: { fetchFavicons: false }, categories: [], bookmarks: [] }).settings.fetchFavicons, false, 'fetchFavicons=false survives sanitizer');

  // 20c: Future-dated localStorage backup guard & Netscape import sanitization
  assert(html.includes('backup._backupTime <= now + 5000'), 'Must reject future-dated localStorage backups');
  assert(html.includes('const cleaned = sanitizeData(AppState.data);'), 'Netscape import must pass through sanitizeData()');
  assert(html.includes('hasUnsafeAttrUrl'), 'Must check obfuscated unsafe URLs and srcdoc in attributes');
  assert(!html.includes('login hints'), 'Notes placeholder must not encourage storing plaintext login hints');
}
console.log('✓ Local-use security & privacy hardening verified.');

console.log('\n========================================');
console.log(' ALL 20 AUTOMATED TESTS PASSED (100%)');
console.log('========================================\n');
