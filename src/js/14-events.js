/* --------------------------------------------------------------------------
   9. EVENT BINDING & INTERACTIVITY
   -------------------------------------------------------------------------- */
function bindAppEvents() {
  // Sidebar Toggle
  const collapseBtn = document.getElementById('btn-collapse-sidebar');
  if (collapseBtn) {
    collapseBtn.onclick = () => {
      AppState.sidebarCollapsed = true;
      renderApp();
    };
  }
  const expandBtn = document.getElementById('btn-expand-sidebar');
  if (expandBtn) {
    expandBtn.onclick = () => {
      AppState.sidebarCollapsed = false;
      renderApp();
    };
  }

  const scrim = document.getElementById('sidebar-scrim');
  if (scrim) scrim.onclick = () => { AppState.sidebarCollapsed = true; renderApp(); };

  // Search Input
  const searchInput = document.getElementById('global-search');
  if (searchInput) {
    searchInput.oninput = (e) => {
      AppState.searchQuery = e.target.value;
      renderApp(); // renderApp keeps focus and cursor position in the search box
    };
  }
  const searchClear = document.getElementById('btn-search-clear');
  if (searchClear) {
    searchClear.onmousedown = (e) => e.preventDefault(); // keep focus in the box
    searchClear.onclick = () => {
      AppState.searchQuery = '';
      renderApp();
      const box = document.getElementById('global-search');
      if (box) box.focus();
    };
  }

  // View Mode Switcher
  document.querySelectorAll('.segment-btn[data-view]').forEach(btn => {
    btn.onclick = () => {
      AppState.data.settings.viewMode = btn.getAttribute('data-view');
      AppState.saveDirty();
      renderApp();
    };
  });

  // Sort By Select
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.onchange = (e) => {
      AppState.data.settings.sortBy = e.target.value;
      AppState.saveDirty();
      renderApp();
    };
  }

  // Navigation clicks
  document.querySelectorAll('.nav-item[data-nav]').forEach(item => {
    item.onclick = () => {
      AppState.activeCategory = item.getAttribute('data-nav');
      AppState.activeTag = null;
      AppState.selectedIds.clear();
      if (AppState.isNarrow()) AppState.sidebarCollapsed = true;
      renderApp();
    };
  });

  document.querySelectorAll('.nav-item[data-cat-id]').forEach(item => {
    item.onclick = (e) => {
      const toggleBtn = e.target.closest('[data-toggle-cat]');
      if (toggleBtn) {
        e.stopPropagation();
        const cid = toggleBtn.getAttribute('data-toggle-cat');
        if (AppState.collapsedCats.has(cid)) AppState.collapsedCats.delete(cid);
        else AppState.collapsedCats.add(cid);
        renderApp();
        return;
      }
      const addSubBtn = e.target.closest('[data-add-subcat]');
      if (addSubBtn) {
        e.stopPropagation();
        openCategoryModal(null, addSubBtn.getAttribute('data-add-subcat'));
        return;
      }
      AppState.activeCategory = item.getAttribute('data-cat-id');
      AppState.activeTag = null;
      AppState.selectedIds.clear();
      if (AppState.isNarrow()) AppState.sidebarCollapsed = true;
      renderApp();
    };
  });

  // Category jump links (breadcrumbs, subcategory pills, section headers)
  document.querySelectorAll('[data-cat-jump]').forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      const cid = el.getAttribute('data-cat-jump');
      if (!cid) return;
      AppState.activeCategory = cid;
      AppState.activeTag = null;
      AppState.selectedIds.clear();
      renderApp();
    };
  });

  // Tag Chip clicks
  document.querySelectorAll('.tag-chip[data-filter-tag]').forEach(chip => {
    chip.onclick = () => {
      const tag = chip.getAttribute('data-filter-tag');
      AppState.activeTag = tag ? tag : null;
      renderApp();
    };
  });

  // Undo & Redo Buttons
  const undoBtn = document.getElementById('btn-undo');
  if (undoBtn) undoBtn.onclick = () => HistoryManager.undo();
  const redoBtn = document.getElementById('btn-redo');
  if (redoBtn) redoBtn.onclick = () => HistoryManager.redo();

  // Save File Button
  const saveBtn = document.getElementById('btn-save-file');
  if (saveBtn) {
    saveBtn.onclick = () => {
      if (AppState.integrity) { openIntegrityModal(); return; }
      if (AppState.codeUpdated) { location.reload(); return; }
      if (!AppState.fileHandle && window.showOpenFilePicker) {
        QuineEngine.connectFile();
      } else {
        QuineEngine.save();
      }
    };
  }

  // Link Current File Banner Button
  const fileHelpBtn = document.getElementById('btn-file-help');
  if (fileHelpBtn) fileHelpBtn.onclick = () => openFileHelpModal();
  const fileHelpDismiss = document.getElementById('btn-file-help-dismiss');
  if (fileHelpDismiss) fileHelpDismiss.onclick = () => { FileSupport.hideTip(); renderApp(); };

  const bannerLinkBtn = document.getElementById('btn-banner-link');
  if (bannerLinkBtn) {
    bannerLinkBtn.onclick = () => QuineEngine.connectFile();
  }

  // New Bookmark Buttons
  const newBtn = document.getElementById('btn-new-bookmark');
  if (newBtn) newBtn.onclick = () => openBookmarkModal();
  const emptyAdd = document.getElementById('btn-empty-add');
  if (emptyAdd) emptyAdd.onclick = () => openBookmarkModal();

  // New Category Button
  const addCatBtn = document.getElementById('btn-add-category');
  if (addCatBtn) addCatBtn.onclick = () => openCategoryModal();

  // New Subcategory Button (in Category Heading)
  const addSubCatBtn = document.getElementById('btn-add-subcategory');
  if (addSubCatBtn) {
    addSubCatBtn.onclick = () => openCategoryModal(null, AppState.activeCategory);
  }

  // Edit Current Category Button
  const editCatBtn = document.getElementById('btn-edit-current-category');
  if (editCatBtn) {
    editCatBtn.onclick = () => {
      const cat = AppState.data.categories.find(c => c.id === AppState.activeCategory);
      if (cat) openCategoryModal(cat);
    };
  }

  // Unarchive All Button
  const unarchiveAllBtn = document.getElementById('btn-unarchive-all');
  if (unarchiveAllBtn) {
    unarchiveAllBtn.onclick = () => {
      const archivedItems = AppState.data.bookmarks.filter(b => b.isArchived && !b.isTrash);
      if (archivedItems.length === 0) return;
      AppState.recordAction('Unarchive All');
      archivedItems.forEach(b => { b.isArchived = false; });
      AppState.saveDirty();
      showToast(`Unarchived ${archivedItems.length} ${archivedItems.length === 1 ? 'link' : 'links'}`, 'success', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
      renderApp();
    };
  }

  // Empty Trash Button
  const emptyTrashBtn = document.getElementById('btn-empty-trash');
  if (emptyTrashBtn) {
    emptyTrashBtn.onclick = async () => {
      const trashCount = AppState.data.bookmarks.filter(b => b.isTrash).length;
      if (trashCount === 0) return;
      if (await confirmDialog({ title: 'Empty Trash?', message: `${trashCount} ${trashCount === 1 ? 'link' : 'links'} will be deleted permanently. You can still undo right after.`, confirmLabel: 'Empty Trash', danger: true })) {
        AppState.recordAction('Empty Trash');
        AppState.data.bookmarks = AppState.data.bookmarks.filter(b => !b.isTrash);
        AppState.saveDirty();
        showToast('Trash emptied', 'info', {
          label: 'Undo',
          onClick: () => HistoryManager.undo()
        });
        renderApp();
      }
    };
  }

  // Restore All Button
  const restoreAllBtn = document.getElementById('btn-restore-all');
  if (restoreAllBtn) {
    restoreAllBtn.onclick = () => {
      const trashItems = AppState.data.bookmarks.filter(b => b.isTrash);
      if (trashItems.length === 0) return;
      AppState.recordAction('Restore All from Trash');
      trashItems.forEach(b => {
        b.isTrash = false;
        if (!AppState.data.categories.some(c => c.id === b.categoryId)) {
          b.categoryId = AppState.data.categories[0]?.id || 'cat-general';
        }
      });
      AppState.saveDirty();
      showToast(`Restored ${trashItems.length} items from Trash`, 'success', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
      renderApp();
    };
  }

  // Settings Button
  const settingsBtn = document.getElementById('btn-open-settings');
  if (settingsBtn) settingsBtn.onclick = () => openSettingsModal();
  const shortcutsBtn = document.getElementById('btn-shortcuts');
  if (shortcutsBtn) shortcutsBtn.onclick = () => KeyNav.showHelp();

  // Batch Action Buttons
  const batchClear = document.getElementById('btn-batch-clear');
  if (batchClear) batchClear.onclick = () => { AppState.selectedIds.clear(); renderApp(); };

  const batchStar = document.getElementById('btn-batch-star');
  if (batchStar) {
    batchStar.onclick = () => {
      AppState.recordAction('Star Selected Bookmarks');
      AppState.data.bookmarks.forEach(b => {
        if (AppState.selectedIds.has(b.id)) b.isFavorite = true;
      });
      AppState.saveDirty();
      AppState.selectedIds.clear();
      renderApp();
      showToast('Starred selected links', 'success', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
    };
  }

  const batchArchive = document.getElementById('btn-batch-archive');
  if (batchArchive) {
    batchArchive.onclick = () => {
      const count = AppState.selectedIds.size;
      if (count === 0) return;
      AppState.recordAction('Archive Selected Bookmarks');
      AppState.data.bookmarks.forEach(b => {
        if (AppState.selectedIds.has(b.id)) b.isArchived = true;
      });
      AppState.saveDirty();
      AppState.selectedIds.clear();
      renderApp();
      showToast(`Archived ${count} ${count === 1 ? 'link' : 'links'}`, 'info', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
    };
  }

  const batchUnarchive = document.getElementById('btn-batch-unarchive');
  if (batchUnarchive) {
    batchUnarchive.onclick = () => {
      const count = AppState.selectedIds.size;
      if (count === 0) return;
      AppState.recordAction('Unarchive Selected Bookmarks');
      AppState.data.bookmarks.forEach(b => {
        if (AppState.selectedIds.has(b.id)) b.isArchived = false;
      });
      AppState.saveDirty();
      AppState.selectedIds.clear();
      renderApp();
      showToast(`Unarchived ${count} ${count === 1 ? 'link' : 'links'}`, 'success', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
    };
  }

  const batchDelete = document.getElementById('btn-batch-delete');
  if (batchDelete) {
    batchDelete.onclick = () => {
      const count = AppState.selectedIds.size;
      if (count === 0) return;
      AppState.recordAction('Move Selected to Trash');
      AppState.data.bookmarks.forEach(b => {
        if (AppState.selectedIds.has(b.id)) b.isTrash = true;
      });
      AppState.saveDirty();
      AppState.selectedIds.clear();
      showToast(`Moved ${count} links to trash`, 'info', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
      renderApp();
    };
  }

  const batchRestore = document.getElementById('btn-batch-restore');
  if (batchRestore) {
    batchRestore.onclick = () => {
      const count = AppState.selectedIds.size;
      if (count === 0) return;
      AppState.recordAction('Restore Selected Bookmarks');
      AppState.data.bookmarks.forEach(b => {
        if (AppState.selectedIds.has(b.id)) {
          b.isTrash = false;
          if (!AppState.data.categories.some(c => c.id === b.categoryId)) {
            b.categoryId = AppState.data.categories[0]?.id || 'cat-general';
          }
        }
      });
      AppState.saveDirty();
      AppState.selectedIds.clear();
      showToast(`Restored ${count} links from trash`, 'success', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
      renderApp();
    };
  }

  const batchDeletePerm = document.getElementById('btn-batch-delete-perm');
  if (batchDeletePerm) {
    batchDeletePerm.onclick = async () => {
      const count = AppState.selectedIds.size;
      if (count === 0) return;
      if (await confirmDialog({ title: `Delete ${count} ${count === 1 ? 'link' : 'links'} permanently?`, message: 'They will be removed from Trash. You can still undo right after.', confirmLabel: 'Delete Permanently', danger: true })) {
        AppState.recordAction('Permanently Delete Selected');
        AppState.data.bookmarks = AppState.data.bookmarks.filter(b => !AppState.selectedIds.has(b.id));
        AppState.saveDirty();
        AppState.selectedIds.clear();
        showToast(`Permanently deleted ${count} links`, 'info', {
          label: 'Undo',
          onClick: () => HistoryManager.undo()
        });
        renderApp();
      }
    };
  }

  const batchMove = document.getElementById('btn-batch-move');
  if (batchMove) {
    batchMove.onclick = () => {
      openBatchMoveModal();
    };
  }

  // Card action event delegation
  const grid = document.getElementById('bookmarks-grid');
  if (grid) {
    // Double-click anywhere on a card (except its link, buttons and tags) copies the rich link
    grid.onmousedown = (e) => {
      if (e.detail > 1 && e.target.closest('.bookmark-card') && !e.target.closest('a, button, .card-tag, input')) {
        e.preventDefault(); // no word selection on double-click
      }
    };
    grid.ondblclick = (e) => {
      const card = e.target.closest('.bookmark-card');
      if (!card || e.target.closest('a, button, .card-tag, .drag-handle')) return;
      const bm = AppState.data.bookmarks.find(b => b.id === card.getAttribute('data-id'));
      if (!bm) return;
      e.preventDefault();
      copyTitleAsLink(bm.title, bm.url, 'title-link');
      card.classList.remove('copied-flash');
      void card.offsetWidth; // restart the animation
      card.classList.add('copied-flash');
      setTimeout(() => card.classList.remove('copied-flash'), 700);
    };

    grid.onclick = async (e) => {
      const notesBtn = e.target.closest('[data-action="show-notes"]');
      if (notesBtn) {
        e.preventDefault();
        e.stopPropagation();
        const bm = AppState.data.bookmarks.find(b => b.id === notesBtn.getAttribute('data-id'));
        if (bm) NotesPopover.toggle(notesBtn, bm);
        return;
      }

      const addToCatBtn = e.target.closest('[data-action="add-to-category"]');
      if (addToCatBtn) {
        e.stopPropagation();
        const catId = addToCatBtn.getAttribute('data-cat-id');
        openBookmarkModal(catId ? { categoryId: catId } : null);
        return;
      }

      const addSubCatAction = e.target.closest('[data-action="add-subcategory"]');
      if (addSubCatAction) {
        e.stopPropagation();
        const catId = addSubCatAction.getAttribute('data-cat-id');
        if (catId) openCategoryModal(null, catId);
        return;
      }

      const editCatAction = e.target.closest('[data-action="edit-category"]');
      if (editCatAction) {
        e.stopPropagation();
        const catId = editCatAction.getAttribute('data-cat-id');
        const cat = AppState.data.categories.find(c => c.id === catId);
        if (cat) openCategoryModal(cat);
        return;
      }

      const archiveBtn = e.target.closest('[data-action="toggle-archive"]');
      if (archiveBtn) {
        e.stopPropagation();
        const id = archiveBtn.getAttribute('data-id');
        const bm = AppState.data.bookmarks.find(b => b.id === id);
        if (bm) {
          AppState.recordAction(bm.isArchived ? `Unarchive "${bm.title || 'Link'}"` : `Archive "${bm.title || 'Link'}"`);
          bm.isArchived = !bm.isArchived;
          AppState.saveDirty();
          renderApp();
          showToast(bm.isArchived ? `Archived "${bm.title || 'Link'}"` : `Unarchived "${bm.title || 'Link'}"`, 'info', {
            label: 'Undo',
            onClick: () => HistoryManager.undo()
          });
        }
        return;
      }

      const starBtn = e.target.closest('[data-action="toggle-star"]');
      if (starBtn) {
        e.stopPropagation();
        const id = starBtn.getAttribute('data-id');
        const bm = AppState.data.bookmarks.find(b => b.id === id);
        if (bm) {
          AppState.recordAction(bm.isFavorite ? `Unfavorite "${bm.title || 'Link'}"` : `Favorite "${bm.title || 'Link'}"`);
          bm.isFavorite = !bm.isFavorite;
          AppState.saveDirty();
          renderApp();
        }
        return;
      }

      const copyBtn = e.target.closest('[data-action="copy-title-link"]');
      if (copyBtn) {
        e.stopPropagation();
        const id = copyBtn.getAttribute('data-id');
        const bm = AppState.data.bookmarks.find(b => b.id === id);
        if (bm) {
          copyTitleAsLink(bm.title, bm.url);
          copyBtn.innerHTML = '<svg class="icon icon-sm" style="color: var(--success);"><use href="#icon-check"/></svg>';
          setTimeout(() => {
            copyBtn.innerHTML = '<svg class="icon icon-sm"><use href="#icon-copy"/></svg>';
          }, 1500);
        }
        return;
      }

      const editBtn = e.target.closest('[data-action="edit-bookmark"]');
      if (editBtn) {
        e.stopPropagation();
        const id = editBtn.getAttribute('data-id');
        const bm = AppState.data.bookmarks.find(b => b.id === id);
        if (bm) openBookmarkModal(bm);
        return;
      }

      const restoreBtn = e.target.closest('[data-action="restore-bookmark"]');
      if (restoreBtn) {
        e.stopPropagation();
        const id = restoreBtn.getAttribute('data-id');
        const bm = AppState.data.bookmarks.find(b => b.id === id);
        if (bm) {
          AppState.recordAction(`Restore "${bm.title || 'Bookmark'}"`);
          bm.isTrash = false;
          if (!AppState.data.categories.some(c => c.id === bm.categoryId)) {
            bm.categoryId = AppState.data.categories[0]?.id || 'cat-general';
          }
          AppState.saveDirty();
          renderApp();
          showToast(`Restored "${bm.title || 'Bookmark'}"`, 'success', {
            label: 'Undo',
            onClick: () => HistoryManager.undo()
          });
        }
        return;
      }

      const deleteBtn = e.target.closest('[data-action="delete-bookmark"]');
      if (deleteBtn) {
        e.stopPropagation();
        const id = deleteBtn.getAttribute('data-id');
        const bm = AppState.data.bookmarks.find(b => b.id === id);
        if (bm) {
          if (bm.isTrash) {
            if (await confirmDialog({ title: 'Delete permanently?', message: `"${bm.title || 'This bookmark'}" will be removed from Trash.`, confirmLabel: 'Delete', danger: true })) {
              AppState.recordAction(`Delete "${bm.title || 'Bookmark'}" Permanently`);
              AppState.data.bookmarks = AppState.data.bookmarks.filter(b => b.id !== id);
              AppState.saveDirty();
              renderApp();
              showToast('Deleted permanently', 'info', {
                label: 'Undo',
                onClick: () => HistoryManager.undo()
              });
            }
          } else {
            AppState.recordAction(`Move "${bm.title || 'Bookmark'}" to Trash`);
            bm.isTrash = true;
            AppState.saveDirty();
            renderApp();
            showToast('Moved to Trash', 'info', {
              label: 'Undo',
              onClick: () => HistoryManager.undo()
            });
          }
        }
        return;
      }

      const visitLink = e.target.closest('[data-action="visit"]');
      if (visitLink) {
        const card = visitLink.closest('.bookmark-card');
        if (card) {
          const id = card.getAttribute('data-id');
          const bm = AppState.data.bookmarks.find(b => b.id === id);
          if (bm && !isSafeUrl(bm.url)) {
            e.preventDefault();
            showToast('Blocked a link with an unsafe address', 'danger');
            return;
          }
          if (bm && AppState.data.settings.trackClicks) {
            bm.clickCount = (bm.clickCount || 0) + 1;
            bm.lastVisitedAt = Date.now();
            AppState.saveDirty();
          }
        }
        return;
      }

      // Tag click inside card
      const tagSpan = e.target.closest('.card-tag');
      if (tagSpan) {
        e.stopPropagation();
        AppState.activeTag = tagSpan.getAttribute('data-tag');
        renderApp();
        return;
      }

      // Multi-selection with Ctrl/Cmd or regular click
      const card = e.target.closest('.bookmark-card');
      if (card && (e.metaKey || e.ctrlKey || e.shiftKey)) {
        e.preventDefault();
        const id = card.getAttribute('data-id');
        if (AppState.selectedIds.has(id)) {
          AppState.selectedIds.delete(id);
        } else {
          AppState.selectedIds.add(id);
        }
        renderApp();
      }
    };
  }

  // Right-click Context Menus on Bookmark Cards
  document.querySelectorAll('.bookmark-card').forEach(card => {
    card.oncontextmenu = (e) => {
      const id = card.getAttribute('data-id');
      const bm = AppState.data.bookmarks.find(b => b.id === id);
      if (bm) {
        showBookmarkContextMenu(e, bm);
      }
    };
  });

  // Right-click Context Menus on Sidebar Categories
  document.querySelectorAll('.nav-item[data-cat-id]').forEach(item => {
    item.oncontextmenu = (e) => {
      const catId = item.getAttribute('data-cat-id');
      const cat = AppState.data.categories.find(c => c.id === catId);
      if (cat) {
        showCategoryContextMenu(e, cat);
      }
    };
  });

  // Right-click Context Menus on Section Headers in Sections View
  document.querySelectorAll('.category-section-card[data-section-cat-id] .section-card-header').forEach(hdr => {
    hdr.oncontextmenu = (e) => {
      const sec = hdr.closest('.category-section-card[data-section-cat-id]');
      const catId = sec && sec.getAttribute('data-section-cat-id');
      const cat = catId && AppState.data.categories.find(c => c.id === catId);
      if (cat) {
        showCategoryContextMenu(e, cat);
      }
    };
  });

  // Initialize Drag and Drop
  initDragAndDrop();
}
