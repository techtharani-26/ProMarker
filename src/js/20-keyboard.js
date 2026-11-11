/* --------------------------------------------------------------------------
   12. GLOBAL KEYBOARD SHORTCUTS
   -------------------------------------------------------------------------- */
const isTyping = () => {
  const el = document.activeElement;
  return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
};
const modalOpen = () => {
  const mc = document.getElementById('modal-container');
  return !!(mc && mc.children.length);
};

window.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  const key = (e.key || '').toLowerCase();

  // Cmd/Ctrl+S: save (works even while typing, and with Caps Lock on)
  if (mod && !e.altKey && key === 's') {
    e.preventDefault();
    QuineEngine.save();
    return;
  }

  // Cmd/Ctrl+Z: undo · Cmd/Ctrl+Shift+Z or Ctrl+Y: redo (native undo inside text fields)
  if (mod && !e.shiftKey && key === 'z' && !isTyping()) {
    e.preventDefault();
    HistoryManager.undo();
    return;
  }
  if (((mod && e.shiftKey && key === 'z') || (e.ctrlKey && !e.shiftKey && key === 'y')) && !isTyping()) {
    e.preventDefault();
    HistoryManager.redo();
    return;
  }

  // Cmd/Ctrl+K or "/": focus search
  if ((mod && key === 'k') || (e.key === '/' && !e.shiftKey && !mod && !isTyping() && !modalOpen())) {
    e.preventDefault();
    if (AppState.isNarrow() && !AppState.sidebarCollapsed) { AppState.sidebarCollapsed = true; renderApp(); }
    const searchInput = document.getElementById('global-search');
    if (searchInput) { searchInput.focus(); searchInput.select(); }
    return;
  }

  // N: new bookmark (no modifiers, not while typing or in a dialog)
  if (key === 'n' && !mod && !e.altKey && !isTyping() && !modalOpen()) {
    e.preventDefault();
    openBookmarkModal();
    return;
  }

  // Enter submits the bookmark dialog from any single-line field
  if (e.key === 'Enter' && mod) {
    const submit = document.getElementById('btn-submit-bookmark');
    if (submit) { e.preventDefault(); submit.click(); return; }
  }

  // Escape: close the top-most thing only
  if (e.key === 'Escape') {
    if (NotesPopover.el) { NotesPopover.hide(true); return; }
    if (ContextMenuManager.activeMenu) { ContextMenuManager.hide(); return; }
    if (modalOpen()) { document.getElementById('modal-container').innerHTML = ''; return; }
    if (document.activeElement && document.activeElement.id === 'global-search' && AppState.searchQuery) {
      AppState.searchQuery = ''; renderApp(); return;
    }
    if (AppState.isNarrow() && !AppState.sidebarCollapsed) { AppState.sidebarCollapsed = true; renderApp(); return; }
    if (AppState.selectedIds.size) { AppState.selectedIds.clear(); renderApp(); }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
});

// Warn before closing if edits have not reached the file yet
window.addEventListener('beforeunload', (e) => {
  // Unlinked edits are kept in the browser backup and come back on reopen, so only warn
  // when a linked file is still waiting for a write.
  // After a version update, edits are safe in the browser backup and come back on reload
  if (AppState.codeUpdated) return;
  if (!AppState.fileHandle || (!AppState.isDirty && !AppState.isSaving)) return;
  if (AppState.writePermission === 'granted') QuineEngine.autoSave();
  e.preventDefault();
  e.returnValue = '';
});

// Collapse sidebar into a drawer when the window gets narrow
let wasNarrow = AppState.isNarrow();
window.addEventListener('resize', () => {
  const narrow = AppState.isNarrow();
  if (narrow !== wasNarrow) { wasNarrow = narrow; AppState.sidebarCollapsed = narrow; renderApp(); }
});
