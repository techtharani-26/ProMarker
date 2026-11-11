function openCategoryModal(existing = null, defaultParentId = '') {
  const isEdit = !!(existing && existing.id);
  const colorPalette = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308',
    '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6', '#64748b', '#1e293b'
  ];
  const iconList = [
    'folder', 'code', 'palette', 'sparkles', 'globe', 'book-open',
    'bookmark', 'tag', 'clock', 'star'
  ];

  const categories = AppState.data.categories;
  const initialParentId = isEdit ? (existing.parentId || '') : (defaultParentId || '');
  const parentCat = initialParentId ? categories.find(c => c.id === initialParentId) : null;

  let selectedColor = existing?.color || (parentCat && parentCat.color) || colorPalette[0];
  let selectedIcon = existing?.icon || iconList[0];

  // Exclude self and descendants from valid parent options
  const forbiddenIds = isEdit ? getCategoryDescendants(existing.id, categories) : new Set();
  const validParents = getCategoryTree(categories).filter(({ cat }) => !forbiddenIds.has(cat.id));

  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay active" id="cat-modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${isEdit ? 'Edit Category' : (initialParentId ? 'New Subcategory Folder' : 'New Category')}</h3>
          <button class="btn btn-icon-only" id="btn-close-modal">
            <svg class="icon"><use href="#icon-x"/></svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="cat-name">Category Name *</label>
            <input
              type="text"
              class="form-input"
              id="cat-name"
              placeholder="${initialParentId ? 'e.g. Frontend, APIs, Inspiration' : 'e.g. Design Systems'}"
              value="${escapeHTML(existing?.name || '')}"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="cat-parent">Parent Folder <span class="form-label-hint">optional — creates a subcategory</span></label>
            <select class="form-select" id="cat-parent">
              <option value="" ${!initialParentId ? 'selected' : ''}>None (Top-level Category)</option>
              ${validParents.map(({ cat: c, depth }) => `
                <option value="${c.id}" data-depth="${depth}" ${c.id === initialParentId ? 'selected' : ''}>${escapeHTML(getCategoryPathString(c.id, categories))}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Color Accent</label>
            <div class="color-picker-grid" id="color-picker">
              ${colorPalette.map(c => `
                <div class="color-swatch ${c === selectedColor ? 'selected' : ''}" style="background-color: ${c};" data-color="${c}"></div>
              `).join('')}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Icon</label>
            <div class="icon-picker-grid" id="icon-picker">
              ${iconList.map(ic => `
                <div class="icon-swatch ${ic === selectedIcon ? 'selected' : ''}" data-icon="${ic}">
                  <svg class="icon icon-sm"><use href="#icon-${ic}"/></svg>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="modal-footer" style="justify-content: ${isEdit ? 'space-between' : 'flex-end'};">
          ${isEdit ? `
            <button class="btn btn-secondary" id="btn-delete-cat" style="color: var(--danger);">
              <svg class="icon icon-sm"><use href="#icon-trash"/></svg> Delete
            </button>
          ` : ''}
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary" id="btn-cancel-modal">Cancel</button>
            <button class="btn btn-primary" id="btn-submit-cat">
              ${isEdit ? 'Save Changes' : (initialParentId ? 'Create Subcategory' : 'Create Category')}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const nameInput = document.getElementById('cat-name');
  const parentSelect = document.getElementById('cat-parent');
  enhanceCategorySelect(parentSelect);
  nameInput.focus();
  nameInput.oninput = () => nameInput.classList.remove('invalid');
  nameInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-submit-cat').click();
    }
  };

  // Color selection
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.onclick = () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selectedColor = sw.getAttribute('data-color');
    };
  });

  // Icon selection
  document.querySelectorAll('.icon-swatch').forEach(sw => {
    sw.onclick = () => {
      document.querySelectorAll('.icon-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selectedIcon = sw.getAttribute('data-icon');
    };
  });

  const closeModal = () => { modalContainer.innerHTML = ''; };
  document.getElementById('btn-close-modal').onclick = closeModal;
  document.getElementById('btn-cancel-modal').onclick = closeModal;

  if (isEdit) {
    document.getElementById('btn-delete-cat').onclick = () => {
      closeModal();
      openDeleteCategoryModal(existing);
    };
  }

  document.getElementById('btn-submit-cat').onclick = () => {
    const name = Sanitize.text(nameInput.value.trim(), 200);
    if (!name) {
      nameInput.focus();
      nameInput.classList.remove('invalid'); void nameInput.offsetWidth; nameInput.classList.add('invalid');
      showToast('Please enter a category name', 'danger');
      return;
    }
    selectedColor = Sanitize.color(selectedColor);
    selectedIcon = Sanitize.icon(selectedIcon);
    const parentId = parentSelect ? parentSelect.value : '';

    if (isEdit) {
      AppState.recordAction(`Edit Category "${name}"`);
      const cat = AppState.data.categories.find(c => c.id === existing.id);
      if (cat) {
        cat.name = name;
        cat.color = selectedColor;
        cat.icon = selectedIcon;
        if (!forbiddenIds.has(parentId)) {
          cat.parentId = parentId || '';
        }
      }
      showToast('Category updated', 'success', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
    } else {
      AppState.recordAction(`Create Category "${name}"`);
      const newCat = {
        id: 'cat-' + Date.now(),
        name,
        color: selectedColor,
        icon: selectedIcon,
        order: AppState.data.categories.length,
        parentId: parentId || ''
      };
      AppState.data.categories.push(newCat);
      if (parentId) AppState.collapsedCats.delete(parentId);
      AppState.activeCategory = newCat.id;
      showToast(`Created ${parentId ? 'subcategory' : 'category'} "${name}"`, 'success', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
    }

    AppState.saveDirty();
    closeModal();
    renderApp();
  };
}

function openDeleteCategoryModal(cat) {
  const descIds = getCategoryDescendants(cat.id);
  const childCatCount = descIds.size - 1;
  const bookmarksInTree = AppState.data.bookmarks.filter(b => descIds.has(b.categoryId) && !b.isTrash);
  const directBookmarks = AppState.data.bookmarks.filter(b => b.categoryId === cat.id && !b.isTrash);
  const count = bookmarksInTree.length;

  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal" style="max-width: 480px;">
        <div class="modal-header">
          <h3 class="modal-title" style="display: flex; align-items: center; gap: 8px; color: var(--danger);">
            <svg class="icon"><use href="#icon-trash"/></svg>
            Delete Category "${escapeHTML(cat.name)}"
          </h3>
          <button class="btn btn-icon-only" id="btn-close-del-cat">
            <svg class="icon"><use href="#icon-x"/></svg>
          </button>
        </div>

        <div class="modal-body">
          ${count === 0 && childCatCount === 0 ? `
            <p style="font-size: 0.9rem; color: var(--text-main);">
              Are you sure you want to delete the category <b>"${escapeHTML(cat.name)}"</b>? It currently contains no bookmarks.
            </p>
          ` : `
            <p style="font-size: 0.92rem; color: var(--text-main); margin-bottom: 8px;">
              This category contains <b>${count} bookmark${count === 1 ? '' : 's'}</b>${childCatCount > 0 ? ` and <b>${childCatCount} subfolder${childCatCount === 1 ? '' : 's'}</b>` : ''}.
            </p>
            <p style="font-size: 0.84rem; color: var(--text-muted); line-height: 1.4;">
              What would you like to do with the contents inside this category?
            </p>
          `}
        </div>

        <div class="modal-footer" style="flex-direction: column; gap: 8px; align-items: stretch;">
          ${count > 0 || childCatCount > 0 ? `
            <button class="btn btn-primary" id="btn-del-cat-keep" style="justify-content: center;">
              Keep Bookmarks ${childCatCount > 0 ? '& Subfolders ' : ''}(Move to ${cat.parentId ? 'Parent Folder' : 'All Bookmarks'})
            </button>
            <button class="btn btn-secondary" id="btn-del-cat-delete-all" style="justify-content: center; color: var(--danger); border-color: rgba(239, 68, 68, 0.4);">
              Delete Category${childCatCount > 0 ? ', Subfolders' : ''} & All ${count} Bookmarks
            </button>
          ` : `
            <button class="btn btn-secondary" id="btn-del-cat-confirm-empty" style="justify-content: center; color: var(--danger); border-color: rgba(239, 68, 68, 0.4);">
              Delete Category
            </button>
          `}
          <button class="btn btn-secondary" id="btn-del-cat-cancel" style="justify-content: center;">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalContainer.innerHTML = ''; };
  document.getElementById('btn-close-del-cat').onclick = closeModal;
  document.getElementById('btn-del-cat-cancel').onclick = closeModal;

  const removeCategoryOnly = () => {
    AppState.recordAction(`Delete Category "${cat.name}"`);
    const remainingCats = AppState.data.categories.filter(c => c.id !== cat.id);
    // Promote direct child subfolders to cat.parentId (or top-level)
    remainingCats.forEach(c => {
      if (c.parentId === cat.id) c.parentId = cat.parentId || '';
    });
    const fallbackCatId = (cat.parentId && remainingCats.some(c => c.id === cat.parentId))
      ? cat.parentId
      : (remainingCats[0]?.id || 'cat-general');
    directBookmarks.forEach(b => {
      b.categoryId = fallbackCatId;
    });
    AppState.data.categories = remainingCats;
    if (AppState.activeCategory === cat.id) {
      AppState.activeCategory = cat.parentId || 'all';
    }
    AppState.saveDirty();
    closeModal();
    renderApp();
    showToast(`Category "${cat.name}" deleted. Bookmarks kept.`, 'info', {
      label: 'Undo',
      onClick: () => HistoryManager.undo()
    });
  };

  const removeCategoryAndBookmarks = () => {
    AppState.recordAction(`Delete Category "${cat.name}" & Bookmarks`);
    bookmarksInTree.forEach(b => {
      b.isTrash = true;
    });
    AppState.data.categories = AppState.data.categories.filter(c => !descIds.has(c.id));
    if (descIds.has(AppState.activeCategory)) {
      AppState.activeCategory = cat.parentId || 'all';
    }
    AppState.saveDirty();
    closeModal();
    renderApp();
    showToast(`Category "${cat.name}" and ${count} bookmarks deleted`, 'info', {
      label: 'Undo',
      onClick: () => HistoryManager.undo()
    });
  };

  if (count > 0 || childCatCount > 0) {
    document.getElementById('btn-del-cat-keep').onclick = removeCategoryOnly;
    document.getElementById('btn-del-cat-delete-all').onclick = removeCategoryAndBookmarks;
  } else {
    document.getElementById('btn-del-cat-confirm-empty').onclick = removeCategoryOnly;
  }
}
