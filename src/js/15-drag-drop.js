/* --------------------------------------------------------------------------
   10. DRAG & DROP ENGINE (Card Reordering & Category Moving)
   -------------------------------------------------------------------------- */
let draggedBookmarkId = null;

function initDragAndDrop() {
  const cards = document.querySelectorAll('.bookmark-card');
  const catNavItems = document.querySelectorAll('.nav-item[data-cat-id], .nav-item[data-nav="trash"], .nav-item[data-nav="archive"], .nav-item[data-nav="favorites"], .nav-item[data-nav="all"]');
  const sectionCards = document.querySelectorAll('.category-section-card[data-section-cat-id]');

  cards.forEach(card => {
    card.ondragstart = (e) => {
      e.stopPropagation();
      draggedBookmarkId = card.getAttribute('data-id');
      card.classList.add('dragging');
      e.dataTransfer.setData('text/x-promarker-id', draggedBookmarkId);
      e.dataTransfer.setData('text/plain', card.querySelector('.card-title')?.href || '');
      e.dataTransfer.effectAllowed = 'move';
    };

    card.ondragend = () => {
      draggedBookmarkId = null;
      card.classList.remove('dragging');
      document.querySelectorAll('.bookmark-card').forEach(c => {
        c.classList.remove('drag-over-before', 'drag-over-after');
      });
      document.querySelectorAll('.nav-item, .category-section-card').forEach(n => n.classList.remove('drop-target-active'));
    };

    // Grid reordering (Custom Sort)
    card.ondragover = (e) => {
      if (!draggedBookmarkId || draggedBookmarkId === card.getAttribute('data-id')) return;
      if (AppState.data.settings.sortBy !== 'custom' && AppState.data.settings.viewMode !== 'sections') return;

      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const rect = card.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (e.clientY < midpoint) {
        card.classList.add('drag-over-before');
        card.classList.remove('drag-over-after');
      } else {
        card.classList.add('drag-over-after');
        card.classList.remove('drag-over-before');
      }
    };

    card.ondragleave = () => {
      card.classList.remove('drag-over-before', 'drag-over-after');
    };

    card.ondrop = (e) => {
      if (!draggedBookmarkId || draggedBookmarkId === card.getAttribute('data-id')) return;
      if (AppState.data.settings.sortBy !== 'custom' && AppState.data.settings.viewMode !== 'sections') return;

      e.preventDefault();
      e.stopPropagation();
      const sourceId = draggedBookmarkId;
      draggedBookmarkId = null;
      const targetId = card.getAttribute('data-id');
      const isBefore = card.classList.contains('drag-over-before');
      const sec = card.closest('.category-section-card[data-section-cat-id]');
      const targetSectionCatId = sec ? sec.getAttribute('data-section-cat-id') : null;

      reorderBookmarks(sourceId, targetId, isBefore, targetSectionCatId);
    };
  });

  // Section card dropzones in Sections View (move bookmark into another category section)
  sectionCards.forEach(sec => {
    sec.ondragover = (e) => {
      if (!draggedBookmarkId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      sec.classList.add('drop-target-active');
    };

    sec.ondragleave = (e) => {
      if (!sec.contains(e.relatedTarget)) {
        sec.classList.remove('drop-target-active');
      }
    };

    sec.ondrop = (e) => {
      if (!draggedBookmarkId) return;
      e.preventDefault();
      sec.classList.remove('drop-target-active');
      const targetCatId = sec.getAttribute('data-section-cat-id');
      const bm = AppState.data.bookmarks.find(b => b.id === draggedBookmarkId);
      draggedBookmarkId = null;
      if (!bm || !targetCatId || bm.categoryId === targetCatId) return;
      const cat = AppState.data.categories.find(c => c.id === targetCatId);
      AppState.recordAction(`Move "${bm.title || 'Link'}" to ${cat ? cat.name : 'Category'}`);
      bm.categoryId = targetCatId;
      bm.isTrash = false;
      AppState.saveDirty();
      renderApp();
      showToast(`Moved to ${cat ? cat.name : 'Category'}`, 'success', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
    };
  });

  // Sidebar dropzones (drop onto category, archive, favorites, all, or trash)
  catNavItems.forEach(item => {
    item.ondragover = (e) => {
      if (!draggedBookmarkId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drop-target-active');
    };

    item.ondragleave = () => {
      item.classList.remove('drop-target-active');
    };

    item.ondrop = (e) => {
      if (!draggedBookmarkId) return;
      e.preventDefault();
      item.classList.remove('drop-target-active');

      const targetCatId = item.getAttribute('data-cat-id');
      const targetNav = item.getAttribute('data-nav');
      const bm = AppState.data.bookmarks.find(b => b.id === draggedBookmarkId);
      draggedBookmarkId = null;

      if (!bm) return;

      if (targetNav === 'trash') {
        AppState.recordAction(`Move "${bm.title || 'Link'}" to Trash`);
        bm.isTrash = true;
        showToast(`Moved "${bm.title || 'Link'}" to Trash`, 'info', {
          label: 'Undo',
          onClick: () => HistoryManager.undo()
        });
      } else if (targetNav === 'archive') {
        AppState.recordAction(`Archive "${bm.title || 'Link'}"`);
        bm.isArchived = true;
        bm.isTrash = false;
        showToast(`Archived "${bm.title || 'Link'}"`, 'info', {
          label: 'Undo',
          onClick: () => HistoryManager.undo()
        });
      } else if (targetNav === 'all') {
        AppState.recordAction(`Restore "${bm.title || 'Link'}" to All Bookmarks`);
        bm.isArchived = false;
        bm.isTrash = false;
        showToast(`Moved "${bm.title || 'Link'}" to All Bookmarks`, 'success', {
          label: 'Undo',
          onClick: () => HistoryManager.undo()
        });
      } else if (targetNav === 'favorites') {
        AppState.recordAction(`Favorite "${bm.title || 'Link'}"`);
        bm.isFavorite = true;
        bm.isArchived = false;
        bm.isTrash = false;
        showToast(`Added "${bm.title || 'Link'}" to Favorites`, 'success', {
          label: 'Undo',
          onClick: () => HistoryManager.undo()
        });
      } else if (targetCatId) {
        const cat = AppState.data.categories.find(c => c.id === targetCatId);
        AppState.recordAction(`Move "${bm.title || 'Link'}" to ${cat ? cat.name : 'Category'}`);
        bm.categoryId = targetCatId;
        bm.isTrash = false;
        bm.isArchived = false;
        showToast(`Moved to ${cat ? cat.name : 'Category'}`, 'success', {
          label: 'Undo',
          onClick: () => HistoryManager.undo()
        });
      }

      AppState.saveDirty();
      renderApp();
    };
  });

  // Category reordering in the sidebar (15a-category-order.js)
  initCategoryDrag();

  // External link drop support (drop URL anywhere onto content-area)
  const contentArea = document.getElementById('content-drop-area');
  if (contentArea) {
    contentArea.ondragover = (e) => {
      if (!draggedBookmarkId && !draggedCategoryId) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    contentArea.ondrop = (e) => {
      if (draggedBookmarkId) return; // already handled by card
      e.preventDefault();
      const droppedText = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
      if (droppedText && (droppedText.startsWith('http://') || droppedText.startsWith('https://'))) {
        openBookmarkModal({ url: droppedText, title: extractDomain(droppedText) });
      }
    };
  }
}

function reorderBookmarks(sourceId, targetId, insertBefore, targetSectionCatId = null) {
  AppState.recordAction('Reorder Bookmarks');
  const list = AppState.data.bookmarks;
  const sourceIndex = list.findIndex(b => b.id === sourceId);
  const targetIndex = list.findIndex(b => b.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) return;

  const [removed] = list.splice(sourceIndex, 1);
  if (targetSectionCatId && removed.categoryId !== targetSectionCatId) {
    removed.categoryId = targetSectionCatId;
    removed.isTrash = false;
  }
  let newIndex = list.findIndex(b => b.id === targetId);
  if (!insertBefore) newIndex++;

  list.splice(newIndex, 0, removed);

  // Update sequential order numbers
  list.forEach((b, idx) => { b.order = idx; });

  AppState.saveDirty();
  renderApp();
}
