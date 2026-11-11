/* --------------------------------------------------------------------------
   10B. CATEGORY ORDER (sidebar)
   Drag a category up or down in the sidebar, or use Move Up / Move Down in its
   right-click menu. The order is saved into the file (and undoable); the
   1–9 shortcuts follow it.
   -------------------------------------------------------------------------- */
let draggedCategoryId = null;

function moveCategory(id, toIndex, newParentId = undefined) {
  const list = AppState.data.categories;
  const from = list.findIndex(c => c.id === id);
  if (from === -1) return;
  const cat = list[from];
  const desc = getCategoryDescendants(id, list);
  const canChangeParent = newParentId !== undefined && (!newParentId || !desc.has(newParentId));
  const parentChanged = canChangeParent && (cat.parentId || '') !== (newParentId || '');
  const target = Math.max(0, Math.min(list.length - 1, toIndex));
  if (target === from && !parentChanged) return;

  const parentCat = newParentId ? list.find(c => c.id === newParentId) : null;
  const actionLabel = parentChanged
    ? (newParentId ? `Move "${cat.name}" into "${parentCat ? parentCat.name : 'folder'}"` : `Move "${cat.name}" to top level`)
    : `Reorder category "${cat.name}"`;
  AppState.recordAction(actionLabel);

  if (canChangeParent) {
    cat.parentId = newParentId || '';
    if (newParentId) AppState.collapsedCats.delete(newParentId);
  }
  if (target !== from) {
    list.splice(from, 1);
    list.splice(target, 0, cat);
  }
  list.forEach((c, i) => { c.order = i; });
  AppState.saveDirty();
  renderApp();
  showToast(
    parentChanged
      ? (newParentId ? `Moved "${cat.name}" into "${parentCat ? parentCat.name : 'folder'}"` : `Moved "${cat.name}" to top level`)
      : `Moved "${cat.name}" to position ${target + 1}`,
    'success',
    { label: 'Undo', onClick: () => HistoryManager.undo() }
  );
}

function setCategoryParent(id, newParentId) {
  const list = AppState.data.categories;
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return;
  moveCategory(id, idx, newParentId || '');
}

// Context-menu entries for a category (only the moves that make sense)
function categoryMoveItems(cat) {
  const list = AppState.data.categories;
  const i = list.findIndex(c => c.id === cat.id);
  const items = [];
  if (cat.parentId) {
    items.push({
      label: 'Move Out to Top Level',
      icon: 'arrow-up',
      action: () => setCategoryParent(cat.id, '')
    });
  }
  const forbidden = getCategoryDescendants(cat.id, list);
  const validTargets = getCategoryTree(list).filter(({ cat: c }) => !forbidden.has(c.id) && c.id !== (cat.parentId || ''));
  if (validTargets.length > 0 || cat.parentId) {
    const submenu = [];
    if (cat.parentId) {
      submenu.push({
        label: 'Top-Level (No Parent)',
        icon: 'folder',
        color: 'var(--primary)',
        action: () => setCategoryParent(cat.id, '')
      });
    }
    validTargets.forEach(({ cat: c, depth }) => {
      submenu.push({
        label: (depth > 0 ? '  '.repeat(depth) + '↳ ' : '') + c.name,
        icon: c.icon || 'folder',
        color: c.color,
        action: () => setCategoryParent(cat.id, c.id)
      });
    });
    items.push({
      label: 'Move Folder Into...',
      icon: 'folder',
      submenu
    });
  }
  if (i > 0) items.push({ label: 'Move Up', icon: 'arrow-up', action: () => moveCategory(cat.id, i - 1) });
  if (i !== -1 && i < list.length - 1) items.push({ label: 'Move Down', icon: 'arrow-down', action: () => moveCategory(cat.id, i + 1) });
  if (i > 1) items.push({ label: 'Move to Top', icon: 'arrow-up', action: () => moveCategory(cat.id, 0) });
  return items;
}

function initCategoryDrag() {
  const items = Array.from(document.querySelectorAll('#category-nav-list .nav-item[data-cat-id]'));
  const sectionCards = Array.from(document.querySelectorAll('.category-section-card[data-section-cat-id]'));
  const catHeader = document.querySelector('#btn-add-category')?.closest('.sidebar-section-title');
  const clear = () => {
    items.forEach(el => el.classList.remove('cat-drop-before', 'cat-drop-after', 'cat-drop-inside', 'cat-dragging'));
    sectionCards.forEach(el => el.classList.remove('sec-drop-before', 'sec-drop-after', 'sec-dragging'));
    if (catHeader) catHeader.classList.remove('cat-drop-root');
  };

  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      if (draggedBookmarkId) return;
      draggedCategoryId = item.getAttribute('data-cat-id');
      item.classList.add('cat-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/x-promarker-category', draggedCategoryId);
    });

    item.addEventListener('dragend', () => { draggedCategoryId = null; clear(); });

    item.addEventListener('dragover', (e) => {
      const targetId = item.getAttribute('data-cat-id');
      if (!draggedCategoryId || draggedCategoryId === targetId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = item.getBoundingClientRect();
      const relY = (e.clientY - r.top) / Math.max(1, r.height);
      const desc = getCategoryDescendants(draggedCategoryId, AppState.data.categories);
      const canNestInside = !desc.has(targetId);

      item.classList.remove('cat-drop-before', 'cat-drop-after', 'cat-drop-inside');
      if (canNestInside && relY >= 0.25 && relY <= 0.75) {
        item.classList.add('cat-drop-inside');
      } else if (relY < 0.5) {
        item.classList.add('cat-drop-before');
      } else {
        item.classList.add('cat-drop-after');
      }
    });

    item.addEventListener('dragleave', () => item.classList.remove('cat-drop-before', 'cat-drop-after', 'cat-drop-inside'));

    item.addEventListener('drop', (e) => {
      if (!draggedCategoryId) return;
      e.preventDefault();
      e.stopPropagation();
      const list = AppState.data.categories;
      const targetId = item.getAttribute('data-cat-id');
      const isInside = item.classList.contains('cat-drop-inside');
      const before = item.classList.contains('cat-drop-before');
      const id = draggedCategoryId;
      draggedCategoryId = null;
      clear();
      if (id === targetId) return;

      const targetCat = list.find(c => c.id === targetId);
      const from = list.findIndex(c => c.id === id);
      if (isInside) {
        // Make dragged folder a subfolder of targetId
        let to = list.findIndex(c => c.id === targetId) + 1;
        if (from < to) to -= 1;
        moveCategory(id, to, targetId);
      } else {
        // Reorder before/after targetCat and adopt targetCat's parentId (moves out to top-level if targetCat is top-level)
        const r = item.getBoundingClientRect();
        const unnestToRoot = (e.clientX - r.left) < 20;
        const newParentId = unnestToRoot ? '' : (targetCat ? (targetCat.parentId || '') : '');
        let to = list.findIndex(c => c.id === targetId) + (before ? 0 : 1);
        if (from < to) to -= 1;
        moveCategory(id, to, newParentId);
      }
    });
  });

  // Dropping a subfolder onto the "Categories" sidebar header moves it out to top-level
  if (catHeader) {
    catHeader.addEventListener('dragover', (e) => {
      if (!draggedCategoryId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      catHeader.classList.add('cat-drop-root');
    });
    catHeader.addEventListener('dragleave', () => catHeader.classList.remove('cat-drop-root'));
    catHeader.addEventListener('drop', (e) => {
      if (!draggedCategoryId) return;
      e.preventDefault();
      const id = draggedCategoryId;
      draggedCategoryId = null;
      clear();
      setCategoryParent(id, '');
    });
  }

  // Drag-and-drop section reordering in Sections View
  sectionCards.forEach(sec => {
    sec.addEventListener('dragstart', (e) => {
      if (draggedBookmarkId || e.target.closest('.bookmark-card')) return;
      draggedCategoryId = sec.getAttribute('data-section-cat-id');
      sec.classList.add('sec-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/x-promarker-category', draggedCategoryId);
    });

    sec.addEventListener('dragend', () => { draggedCategoryId = null; clear(); });

    sec.addEventListener('dragover', (e) => {
      if (!draggedCategoryId || draggedCategoryId === sec.getAttribute('data-section-cat-id')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = sec.getBoundingClientRect();
      const before = e.clientX < r.left + r.width / 2;
      sec.classList.toggle('sec-drop-before', before);
      sec.classList.toggle('sec-drop-after', !before);
    });

    sec.addEventListener('dragleave', (e) => {
      if (!sec.contains(e.relatedTarget)) {
        sec.classList.remove('sec-drop-before', 'sec-drop-after');
      }
    });

    sec.addEventListener('drop', (e) => {
      if (!draggedCategoryId) return;
      e.preventDefault();
      e.stopPropagation();
      const list = AppState.data.categories;
      const targetId = sec.getAttribute('data-section-cat-id');
      const before = sec.classList.contains('sec-drop-before');
      const id = draggedCategoryId;
      draggedCategoryId = null;
      clear();
      if (id === targetId) return;
      const from = list.findIndex(c => c.id === id);
      let to = list.findIndex(c => c.id === targetId) + (before ? 0 : 1);
      if (from < to) to -= 1;
      moveCategory(id, to);
    });
  });
}
