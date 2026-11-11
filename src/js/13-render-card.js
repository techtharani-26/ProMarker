/* --------------------------------------------------------------------------
   8. BOOKMARK CARD & CATEGORY SECTIONS COMPONENTS
   -------------------------------------------------------------------------- */
function renderBookmarkCard(b, categories, settings) {
  const domain = extractDomain(b.url);
  const favicon = b.favicon || getFaviconUrl(b.url);
  const category = categories.find(c => c.id === b.categoryId);
  const catPath = category ? getCategoryPathString(category.id, categories) : '';
  const initial = domain ? domain.charAt(0).toUpperCase() : '?';
  const initialBg = getDomainColor(domain);
  const isSelected = AppState.selectedIds.has(b.id);

  return `
    <div
      class="bookmark-card ${isSelected ? 'selected' : ''}"
      style="--site: ${initialBg};"
      data-id="${b.id}"
      tabindex="-1"
      role="listitem"
      aria-selected="${isSelected}"
      aria-label="${escapeHTML(b.title || domain || b.url)}"
      draggable="true"
    >
      <span class="card-select-badge" aria-hidden="true"><svg class="icon"><use href="#icon-check"/></svg></span>
      <div class="card-top">
        <div class="favicon-wrap">
          <img
            ${favicon ? `src="${escapeHTML(favicon)}"` : 'style="display: none;"'}
            alt=""
            class="favicon-img"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
          <div class="favicon-fallback" style="display: ${favicon ? 'none' : 'flex'}; background: ${initialBg};">
            ${escapeHTML(initial)}
          </div>
        </div>

        <div class="card-meta">
          <div class="card-title-row">
            <a
              href="${escapeHTML(safeHref(b.url))}"
              class="card-title"
              target="${settings.openInNewTab ? '_blank' : '_self'}"
              rel="noopener noreferrer"
              title="${escapeHTML(b.title || b.url)}"
              data-action="visit"
            >
              ${escapeHTML(b.title || domain || b.url)}
            </a>

            <div class="card-quick">
              <button
                class="action-btn ${b.isFavorite ? 'star-active' : ''}"
                data-action="toggle-star"
                data-id="${b.id}"
                title="${b.isFavorite ? 'Unfavorite' : 'Favorite'}"
              >
                <svg class="icon icon-sm"><use href="#icon-star"/></svg>
              </button>
              ${b.description ? `
                <button class="action-btn notes-btn" data-action="show-notes" data-id="${b.id}" title="Show notes (I)" aria-label="Show notes" aria-haspopup="dialog">
                  <svg class="icon icon-sm"><use href="#icon-note"/></svg>
                </button>
              ` : ''}
            </div>
          </div>

          <div class="card-domain" title="${escapeHTML(b.url)}">
            <span>${escapeHTML(domain)}</span>
            <svg class="icon card-ext" aria-hidden="true"><use href="#icon-external-link"/></svg>
          </div>
        </div>
      </div>

      <div class="card-bottom">
        <div class="card-stats">
          ${b.isArchived ? `
            <span class="archived-badge" title="Archived link">
              <svg class="icon"><use href="#icon-archive"/></svg>
              <span>Archived</span>
            </span>
          ` : ''}
          ${category ? `
            <span class="card-category" title="${escapeHTML(catPath)}" data-cat-jump="${category.id}">
              <i class="cat-dot" style="--cat: ${category.color || '#6366f1'};"></i>
              <span>${escapeHTML(catPath)}</span>
            </span>
          ` : ''}
          ${(b.tags && b.tags.length > 0) ? `
            <div class="card-tags">
              ${b.tags.map(t => `<span class="card-tag" data-tag="${escapeHTML(t)}" title="Show #${escapeHTML(t)}">#${escapeHTML(t)}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        ${settings.trackClicks && b.clickCount ? `
          <span class="card-clicks" title="Opened ${b.clickCount} time${b.clickCount === 1 ? '' : 's'}"><svg class="icon" aria-hidden="true"><use href="#icon-eye"/></svg>${b.clickCount}</span>
        ` : ''}

        <div class="card-actions">
          ${b.isTrash ? `
            <button class="action-btn action-success" data-action="restore-bookmark" data-id="${b.id}" title="Restore Bookmark">
              <svg class="icon icon-sm"><use href="#icon-restore"/></svg>
            </button>
            <button class="action-btn action-danger" data-action="delete-bookmark" data-id="${b.id}" title="Delete Permanently">
              <svg class="icon icon-sm"><use href="#icon-trash"/></svg>
            </button>
          ` : `
            <button class="action-btn" data-action="copy-title-link" data-id="${b.id}" title="Copy title as link (Single Click)">
              <svg class="icon icon-sm"><use href="#icon-copy"/></svg>
            </button>
            <button class="action-btn ${b.isArchived ? 'archive-active' : ''}" data-action="toggle-archive" data-id="${b.id}" title="${b.isArchived ? 'Unarchive (Y)' : 'Archive (Y)'}">
              <svg class="icon icon-sm"><use href="#icon-archive"/></svg>
            </button>
            <button class="action-btn" data-action="edit-bookmark" data-id="${b.id}" title="Edit Link">
              <svg class="icon icon-sm"><use href="#icon-edit"/></svg>
            </button>
            <button class="action-btn" data-action="delete-bookmark" data-id="${b.id}" title="Move to Trash">
              <svg class="icon icon-sm"><use href="#icon-trash"/></svg>
            </button>
            <span class="drag-handle" title="Drag to reorder or drop onto sidebar category">
              <svg class="icon icon-sm"><use href="#icon-grip"/></svg>
            </span>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderSectionBookmarkItem(b, settings) {
  const domain = extractDomain(b.url);
  const favicon = b.favicon || getFaviconUrl(b.url);
  const initial = domain ? domain.charAt(0).toUpperCase() : '?';
  const initialBg = getDomainColor(domain);
  const isSelected = AppState.selectedIds.has(b.id);

  return `
    <div
      class="bookmark-card section-bm-card ${isSelected ? 'selected' : ''}"
      style="--site: ${initialBg};"
      data-id="${b.id}"
      tabindex="-1"
      role="listitem"
      aria-selected="${isSelected}"
      aria-label="${escapeHTML(b.title || domain || b.url)}"
      draggable="true"
    >
      <span class="card-select-badge" aria-hidden="true"><svg class="icon"><use href="#icon-check"/></svg></span>
      <div class="favicon-wrap section-favicon">
        <img
          ${favicon ? `src="${escapeHTML(favicon)}"` : 'style="display: none;"'}
          alt=""
          class="favicon-img"
          loading="lazy"
          referrerpolicy="no-referrer"
        />
        <div class="favicon-fallback" style="display: ${favicon ? 'none' : 'flex'}; background: ${initialBg};">
          ${escapeHTML(initial)}
        </div>
      </div>

      <div class="section-bm-meta">
        <a
          href="${escapeHTML(safeHref(b.url))}"
          class="card-title section-bm-title"
          target="${settings.openInNewTab ? '_blank' : '_self'}"
          rel="noopener noreferrer"
          title="${escapeHTML(b.title || b.url)}\n${escapeHTML(b.url)}"
          data-action="visit"
        >
          ${escapeHTML(b.title || domain || b.url)}
        </a>
        <div class="section-bm-sub">
          <span class="card-domain">${escapeHTML(domain)}</span>
          ${b.isArchived ? `<span class="archived-badge archived-badge-sm" title="Archived link">Archived</span>` : ''}
          ${(b.tags && b.tags.length > 0) ? `
            <span class="section-bm-tags">
              ${b.tags.slice(0, 2).map(t => `<span class="card-tag" data-tag="${escapeHTML(t)}" title="Show #${escapeHTML(t)}">#${escapeHTML(t)}</span>`).join('')}
            </span>
          ` : ''}
        </div>
      </div>

      <div class="section-bm-right">
        <button
          class="action-btn ${b.isFavorite ? 'star-active' : ''}"
          data-action="toggle-star"
          data-id="${b.id}"
          title="${b.isFavorite ? 'Unfavorite' : 'Favorite'}"
        >
          <svg class="icon icon-sm"><use href="#icon-star"/></svg>
        </button>
        ${b.description ? `
          <button class="action-btn notes-btn" data-action="show-notes" data-id="${b.id}" title="Show notes (I)" aria-label="Show notes">
            <svg class="icon icon-sm"><use href="#icon-note"/></svg>
          </button>
        ` : ''}
        <div class="card-actions section-bm-actions">
          ${b.isTrash ? `
            <button class="action-btn action-success" data-action="restore-bookmark" data-id="${b.id}" title="Restore Bookmark">
              <svg class="icon icon-sm"><use href="#icon-restore"/></svg>
            </button>
            <button class="action-btn action-danger" data-action="delete-bookmark" data-id="${b.id}" title="Delete Permanently">
              <svg class="icon icon-sm"><use href="#icon-trash"/></svg>
            </button>
          ` : `
            <button class="action-btn" data-action="copy-title-link" data-id="${b.id}" title="Copy title as link">
              <svg class="icon icon-sm"><use href="#icon-copy"/></svg>
            </button>
            <button class="action-btn ${b.isArchived ? 'archive-active' : ''}" data-action="toggle-archive" data-id="${b.id}" title="${b.isArchived ? 'Unarchive (Y)' : 'Archive (Y)'}">
              <svg class="icon icon-sm"><use href="#icon-archive"/></svg>
            </button>
            <button class="action-btn" data-action="edit-bookmark" data-id="${b.id}" title="Edit Link">
              <svg class="icon icon-sm"><use href="#icon-edit"/></svg>
            </button>
            <button class="action-btn" data-action="delete-bookmark" data-id="${b.id}" title="Move to Trash">
              <svg class="icon icon-sm"><use href="#icon-trash"/></svg>
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderSectionsView(filtered, categories, settings, activeCat, intro) {
  const isSpecial = ['all', 'favorites', 'recent', 'archive', 'trash'].includes(activeCat);
  const hasFilter = !!(AppState.searchQuery.trim() || AppState.activeTag);
  const activeDescendants = !isSpecial ? getCategoryDescendants(activeCat, categories) : null;

  // Group filtered bookmarks by their categoryId
  const byCat = new Map();
  const uncategorized = [];
  const validCatIds = new Set(categories.map(c => c.id));
  filtered.forEach(b => {
    if (b.categoryId && validCatIds.has(b.categoryId)) {
      if (!byCat.has(b.categoryId)) byCat.set(b.categoryId, []);
      byCat.get(b.categoryId).push(b);
    } else {
      uncategorized.push(b);
    }
  });

  // Determine which category & sub-category sections to show (in custom category order)
  const sections = [];
  categories.forEach(cat => {
    if (!isSpecial && activeDescendants && !activeDescendants.has(cat.id)) return;
    const items = byCat.get(cat.id) || [];
    const isParentFolder = categories.some(c => c.parentId === cat.id);
    // Parent folders without any direct links are not shown in All Bookmarks (or when subfolders exist)
    if (isParentFolder && items.length === 0) return;
    const showEmpty = !hasFilter && (activeCat === 'all' || !isSpecial);
    if (items.length > 0 || showEmpty) {
      sections.push({ cat, items });
    }
  });

  if (uncategorized.length > 0) {
    sections.push({
      cat: { id: '', name: 'Uncategorized', icon: 'folder', color: '#64748b' },
      items: uncategorized,
      isUncategorized: true
    });
  }

  return `
    <div class="bookmarks-sections${intro ? ' intro' : ''}" id="bookmarks-grid" role="region" aria-label="Bookmark Category Sections">
      ${sections.map(({ cat, items, isUncategorized }) => {
        return `
          <section class="category-section-card"
                   style="--cat: ${cat.color || 'var(--primary)'};"
                   ${cat.id ? `data-section-cat-id="${cat.id}" draggable="true"` : ''}>
            <header class="section-card-header">
              <div class="section-header-left" ${cat.id ? `data-cat-jump="${cat.id}" role="button" tabindex="0" title="Open ${escapeHTML(getCategoryPathString(cat.id, categories))}"` : ''}>
                <span class="section-cat-icon">
                  <svg class="icon"><use href="#icon-${cat.icon || 'folder'}"/></svg>
                </span>
                <div class="section-title-wrap">
                  <h2 class="section-cat-title">${escapeHTML(cat.name)}</h2>
                </div>
              </div>
              <div class="section-header-right">
                <span class="section-count">${items.length}</span>
                ${!isUncategorized && activeCat !== 'trash' ? `
                  <button type="button" class="action-btn section-head-btn" data-action="add-to-category" data-cat-id="${cat.id}" title="Add bookmark to ${escapeHTML(cat.name)}">
                    <svg class="icon icon-sm"><use href="#icon-plus"/></svg>
                  </button>
                  <button type="button" class="action-btn section-head-btn" data-action="add-subcategory" data-cat-id="${cat.id}" title="New subfolder in ${escapeHTML(cat.name)}">
                    <svg class="icon icon-sm"><use href="#icon-folder-plus"/></svg>
                  </button>
                  <button type="button" class="action-btn section-head-btn" data-action="edit-category" data-cat-id="${cat.id}" title="Edit ${escapeHTML(cat.name)}">
                    <svg class="icon icon-sm"><use href="#icon-edit"/></svg>
                  </button>
                  <span class="drag-handle section-head-btn section-drag-handle" title="Drag to reorder section">
                    <svg class="icon icon-sm"><use href="#icon-grip"/></svg>
                  </span>
                ` : ''}
              </div>
            </header>

            <div class="section-card-body" role="list" aria-label="${escapeHTML(cat.name)} bookmarks">
              ${items.length === 0 ? `
                <div class="section-empty">
                  <span>No links in this section yet</span>
                  ${!isUncategorized && activeCat !== 'trash' ? `
                    <button type="button" class="section-empty-add" data-action="add-to-category" data-cat-id="${cat.id}">
                      <svg class="icon icon-sm"><use href="#icon-plus"/></svg>
                      Add Link
                    </button>
                  ` : ''}
                </div>
              ` : items.map(b => renderSectionBookmarkItem(b, settings)).join('')}
            </div>
          </section>
        `;
      }).join('')}
    </div>
  `;
}
