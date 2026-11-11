/* --------------------------------------------------------------------------
   2C. CONTEXT MENU CONTROLLER
   -------------------------------------------------------------------------- */
const ContextMenuManager = {
  activeMenu: null,

  show(e, items) {
    e.preventDefault();
    e.stopPropagation();
    this.hide();

    const menu = document.createElement('div');
    menu.id = 'custom-context-menu';
    menu.className = 'context-menu';

    const isNearRight = (e.clientX > window.innerWidth / 2);

    items.forEach(item => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'context-menu-separator';
        menu.appendChild(sep);
        return;
      }

      const itemEl = document.createElement('div');
      itemEl.className = `context-menu-item ${item.danger ? 'danger' : ''}`;
      itemEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          ${item.icon ? `<svg class="icon icon-sm"><use href="#icon-${item.icon}"/></svg>` : ''}
          <span>${escapeHTML(item.label)}</span>
        </div>
        ${item.submenu ? `<svg class="icon icon-sm" style="opacity: 0.5;"><use href="#icon-chevron-right"/></svg>` : ''}
      `;

      if (item.submenu && item.submenu.length > 0) {
        const subMenuEl = document.createElement('div');
        subMenuEl.className = `context-menu context-submenu ${isNearRight ? 'submenu-left' : ''}`;
        item.submenu.forEach(sub => {
          const subEl = document.createElement('div');
          subEl.className = 'context-menu-item';
          subEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
              ${sub.icon ? `<svg class="icon icon-sm" style="color: ${sub.color || '#6366f1'};"><use href="#icon-${sub.icon}"/></svg>` : (sub.color ? `<span class="category-color-dot" style="background-color: ${sub.color};"></span>` : '')}
              <span>${escapeHTML(sub.label)}</span>
            </div>
          `;
          subEl.onclick = (ev) => {
            ev.stopPropagation();
            ContextMenuManager.hide();
            sub.action();
          };
          subMenuEl.appendChild(subEl);
        });
        itemEl.appendChild(subMenuEl);
      } else if (item.action) {
        itemEl.onclick = (ev) => {
          ev.stopPropagation();
          ContextMenuManager.hide();
          item.action();
        };
      }

      menu.appendChild(itemEl);
    });

    document.body.appendChild(menu);
    this.activeMenu = menu;

    // Clamping to screen boundaries
    const menuWidth = menu.offsetWidth || 220;
    const menuHeight = menu.offsetHeight || 260;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth - 10) {
      x = Math.max(10, window.innerWidth - menuWidth - 10);
    }
    if (y + menuHeight > window.innerHeight - 10) {
      y = Math.max(10, window.innerHeight - menuHeight - 10);
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  },

  hide() {
    if (this.activeMenu) {
      this.activeMenu.remove();
      this.activeMenu = null;
    }
  }
};

// Global dismiss listeners
window.addEventListener('click', () => ContextMenuManager.hide());
window.addEventListener('scroll', () => ContextMenuManager.hide(), true);
window.addEventListener('resize', () => ContextMenuManager.hide());

function showBookmarkContextMenu(e, bm) {
  const categories = AppState.data.categories;
  const tree = getCategoryTree(categories);
  const items = [
    {
      label: 'Open in New Tab',
      icon: 'external-link',
      action: () => {
        if (!openSafely(bm.url)) return;
        if (AppState.data.settings.trackClicks) {
          bm.clickCount = (bm.clickCount || 0) + 1;
            bm.lastVisitedAt = Date.now();
          AppState.saveDirty();
        }
      }
    },
    {
      label: 'Copy Title as Link',
      icon: 'copy',
      action: () => copyTitleAsLink(bm.title, bm.url, 'title-link')
    },
    {
      label: 'Copy URL Only',
      icon: 'copy',
      action: () => {
        navigator.clipboard.writeText(bm.url);
        showToast('URL copied to clipboard!', 'success');
      }
    },
    {
      label: bm.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
      icon: 'star',
      action: () => {
        AppState.recordAction(bm.isFavorite ? `Unfavorite "${bm.title || 'Bookmark'}"` : `Favorite "${bm.title || 'Bookmark'}"`);
        bm.isFavorite = !bm.isFavorite;
        AppState.saveDirty();
        renderApp();
        showToast(bm.isFavorite ? 'Added to Favorites' : 'Removed from Favorites', 'info', {
          label: 'Undo',
          onClick: () => HistoryManager.undo()
        });
      }
    },
    ...(!bm.isTrash ? [{
      label: bm.isArchived ? 'Unarchive Bookmark' : 'Archive Bookmark',
      icon: 'archive',
      action: () => {
        AppState.recordAction(bm.isArchived ? `Unarchive "${bm.title || 'Bookmark'}"` : `Archive "${bm.title || 'Bookmark'}"`);
        bm.isArchived = !bm.isArchived;
        AppState.saveDirty();
        renderApp();
        showToast(bm.isArchived ? `Archived "${bm.title || 'Bookmark'}"` : `Unarchived "${bm.title || 'Bookmark'}"`, 'info', {
          label: 'Undo',
          onClick: () => HistoryManager.undo()
        });
      }
    }] : []),
    {
      label: 'Edit Bookmark...',
      icon: 'edit',
      action: () => openBookmarkModal(bm)
    },
    {
      label: 'Move to Category',
      icon: 'folder',
      submenu: tree.map(({ cat: c, depth }) => ({
        label: (depth > 0 ? '  '.repeat(depth) + '↳ ' : '') + c.name,
        color: c.color,
        icon: c.icon || 'folder',
        action: () => {
          AppState.recordAction(`Move "${bm.title || 'Bookmark'}" to "${c.name}"`);
          bm.categoryId = c.id;
          bm.isTrash = false;
          AppState.saveDirty();
          renderApp();
          showToast(`Moved to "${c.name}"`, 'success', {
            label: 'Undo',
            onClick: () => HistoryManager.undo()
          });
        }
      }))
    },
    ...(bm.isTrash ? [{
      label: 'Restore Bookmark',
      icon: 'restore',
      action: () => {
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
    }] : []),
    { separator: true },
    {
      label: bm.isTrash ? 'Delete Permanently' : 'Move to Trash',
      icon: 'trash',
      danger: true,
      action: async () => {
        if (bm.isTrash) {
          if (await confirmDialog({ title: 'Delete permanently?', message: `"${bm.title || 'This bookmark'}" will be removed from Trash.`, confirmLabel: 'Delete', danger: true })) {
            AppState.recordAction(`Delete "${bm.title || 'Bookmark'}" Permanently`);
            AppState.data.bookmarks = AppState.data.bookmarks.filter(x => x.id !== bm.id);
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
          showToast(`Moved "${bm.title || 'Bookmark'}" to Trash`, 'info', {
            label: 'Undo',
            onClick: () => HistoryManager.undo()
          });
        }
      }
    }
  ];

  ContextMenuManager.show(e, items);
}

function showCategoryContextMenu(e, cat) {
  const descIds = getCategoryDescendants(cat.id);
  const activeInCat = AppState.data.bookmarks.filter(b => descIds.has(b.categoryId) && !b.isTrash && !b.isArchived);
  const items = [
    {
      label: `Add Bookmark to "${cat.name}"`,
      icon: 'plus',
      action: () => openBookmarkModal({ categoryId: cat.id })
    },
    {
      label: `New Subcategory in "${cat.name}"...`,
      icon: 'folder-plus',
      action: () => openCategoryModal(null, cat.id)
    },
    {
      label: 'Edit Category...',
      icon: 'edit',
      action: () => openCategoryModal(cat)
    },
    ...categoryMoveItems(cat),
    ...(activeInCat.length > 0 ? [{
      label: `Archive ${activeInCat.length} ${activeInCat.length === 1 ? 'Link' : 'Links'} in "${cat.name}"`,
      icon: 'archive',
      action: () => {
        AppState.recordAction(`Archive links in "${cat.name}"`);
        activeInCat.forEach(b => { b.isArchived = true; });
        AppState.saveDirty();
        renderApp();
        showToast(`Archived ${activeInCat.length} ${activeInCat.length === 1 ? 'link' : 'links'} from "${cat.name}"`, 'info', {
          label: 'Undo',
          onClick: () => HistoryManager.undo()
        });
      }
    }] : []),
    {
      label: 'Copy Category Name',
      icon: 'copy',
      action: () => {
        navigator.clipboard.writeText(cat.name);
        showToast('Category name copied', 'success');
      }
    },
    { separator: true },
    {
      label: 'Delete Category...',
      icon: 'trash',
      danger: true,
      action: () => openDeleteCategoryModal(cat)
    }
  ];

  ContextMenuManager.show(e, items);
}
