/* --------------------------------------------------------------------------
   7. VIEW RENDERER (App Shell, Sidebar, Bookmark Cards, Modals)
   -------------------------------------------------------------------------- */
function getSaveStatus() {
  const fh = AppState.fileHandle;
  const canLink = !!(window.showOpenFilePicker || window.showSaveFilePicker);
  const time = AppState.lastSavedTime ? AppState.lastSavedTime.replace(/:\d\d(\s|$)/, '$1').trim() : '';
  const s = { dot: '', text: '', title: '', btnLabel: 'Save', btnIcon: 'save', btnClass: '', btnTitle: 'Save now (Cmd/Ctrl+S)' };
  if (fh) {
    const paused = AppState.writePermission === 'prompt' || AppState.writePermission === 'denied';
    if (AppState.integrity) {
      s.dot = 'alert'; s.text = 'Saving paused · file changed';
      s.btnLabel = 'Review'; s.btnIcon = 'shield'; s.btnClass = 'btn-danger';
      s.btnTitle = 'The linked file was changed outside ProMarker';
    }
    else if (AppState.codeUpdated) {
      s.dot = 'paused'; s.text = 'Newer version on disk';
      s.btnLabel = 'Reload'; s.btnIcon = 'refresh'; s.btnClass = 'btn-warn';
      s.btnTitle = 'This file was updated to a newer ProMarker. Reload to continue; your edits come back.';
    }
    else if (AppState.isSaving) { s.dot = 'saving'; s.text = 'Saving…'; }
    else if (paused) {
      s.dot = 'paused'; s.text = AppState.isDirty ? 'Autosave paused · unsaved' : 'Autosave paused';
      s.btnLabel = 'Resume'; s.btnIcon = 'refresh'; s.btnClass = 'btn-warn';
      s.btnTitle = 'The browser needs your OK to write to ' + fh.name + ' again';
    }
    else if (AppState.isDirty) { s.dot = 'dirty'; s.text = 'Unsaved changes'; }
    else { s.text = time ? ('Saved · ' + time) : 'Saved'; }
    s.title = 'Linked to ' + fh.name + (AppState.data.settings.autoSave !== false ? ' — autosave on' : ' — autosave off');
  } else {
    const copyIsCurrent = AppState.isDirty && AppState.downloadedRevision === AppState.revision;
    s.dot = copyIsCurrent ? 'unlinked' : (AppState.isDirty ? 'dirty' : 'unlinked');
    s.text = copyIsCurrent ? 'Copy downloaded' : (AppState.isDirty ? 'Only in this browser' : 'Not linked to file');
    s.title = canLink
      ? 'Changes are kept in this browser only. Link the HTML file to save into it automatically.'
      : `${FileSupport.browserName()} can't write to files, so saving downloads an updated copy. Your edits stay in this browser meanwhile.`;
    s.btnLabel = canLink ? 'Link File' : 'Download';
    s.btnIcon = canLink ? 'link-file' : 'download';
    s.btnTitle = canLink ? 'Link this HTML file to enable autosave' : 'Download an updated copy (Cmd/Ctrl+S)';
  }
  return s;
}

const RECENT_LIMIT = 30;
const recentTime = (b) => Math.max(b.lastVisitedAt || 0, b.updatedAt || 0, b.createdAt || 0);

function renderApp() {
  const app = document.getElementById('app');
  if (!app) return;

  // The whole shell is re-rendered; remember which field had focus (e.g. search) so a
  // background save or sync never interrupts typing.
  const prevFocus = document.activeElement;
  const keepFocus = prevFocus && prevFocus.id && app.contains(prevFocus) &&
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(prevFocus.tagName)
    ? { id: prevFocus.id, start: prevFocus.selectionStart, end: prevFocus.selectionEnd } : null;

  const { categories, bookmarks, settings } = AppState.data;
  const activeCat = AppState.activeCategory;
  const catTree = getCategoryTree(categories);

  // Calculate counts (Archive items are excluded from All Bookmarks and active views)
  const allCount = bookmarks.filter(b => !b.isTrash && !b.isArchived).length;
  const favCount = bookmarks.filter(b => b.isFavorite && !b.isTrash && !b.isArchived).length;
  const recentCount = Math.min(RECENT_LIMIT, allCount);
  const archiveCount = bookmarks.filter(b => b.isArchived && !b.isTrash).length;
  const saveStatus = getSaveStatus();
  const trashCount = bookmarks.filter(b => b.isTrash).length;

  // If viewing a specific category, include bookmarks in its descendant sub-category folders
  const isSpecialView = ['all', 'favorites', 'recent', 'archive', 'trash'].includes(activeCat);
  const activeCatDescendants = !isSpecialView ? getCategoryDescendants(activeCat, categories) : null;
  const isSearching = !!AppState.searchQuery.trim();

  // Filter bookmarks for current view (archived links are included whenever searching)
  let filtered = bookmarks.filter(b => {
    if (activeCat === 'trash') return b.isTrash;
    if (b.isTrash) return false;
    if (activeCat === 'archive') return b.isArchived === true;
    if (b.isArchived && !isSearching) return false;
    if (activeCat === 'all') return true;
    if (activeCat === 'favorites') return b.isFavorite;
    if (activeCat === 'recent') return true;
    return activeCatDescendants ? activeCatDescendants.has(b.categoryId) : b.categoryId === activeCat;
  });

  // Recent = latest activity, capped, before anything else narrows it
  if (activeCat === 'recent') {
    filtered = filtered.sort((a, b) => recentTime(b) - recentTime(a)).slice(0, RECENT_LIMIT);
  }

  // Tags offered in the chip bar: only those used by bookmarks in this view/category
  const allTags = Array.from(new Set(filtered.flatMap(b => b.tags || []))).sort();
  if (AppState.activeTag && !allTags.includes(AppState.activeTag)) AppState.activeTag = null;

  // Search: words must all match; "#tag" words match tags (prefix while typing)
  if (AppState.searchQuery.trim()) {
    const query = parseSearch(AppState.searchQuery);
    filtered = filtered.filter(b => matchesSearch(b, query));
  }

  // Active tag filter
  if (AppState.activeTag) {
    filtered = filtered.filter(b => b.tags && b.tags.includes(AppState.activeTag));
  }

  // Sorting (Recent view always shows latest activity first)
  const sortBy = settings.sortBy || 'custom';
  if (activeCat === 'recent') {
    // already ordered by latest activity above
  } else if (sortBy === 'date-desc') {
    filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } else if (sortBy === 'date-asc') {
    filtered.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  } else if (sortBy === 'title-asc') {
    filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (sortBy === 'title-desc') {
    filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
  } else if (sortBy === 'clicks') {
    filtered.sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0));
  } else {
    // Custom order
    filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  // Active Category Title & Hierarchy Context
  let headingTitle = 'All Bookmarks';
  let headingIcon = 'bookmark';
  let activeCatObj = null;
  let activeCatBreadcrumb = [];
  let activeChildCats = [];
  if (activeCat === 'favorites') { headingTitle = 'Favorites'; headingIcon = 'star'; }
  else if (activeCat === 'recent') { headingTitle = 'Recent Links'; headingIcon = 'clock'; }
  else if (activeCat === 'archive') { headingTitle = 'Archive'; headingIcon = 'archive'; }
  else if (activeCat === 'trash') { headingTitle = 'Trash'; headingIcon = 'trash'; }
  else if (activeCat !== 'all') {
    activeCatObj = categories.find(cat => cat.id === activeCat);
    if (activeCatObj) {
      headingTitle = activeCatObj.name;
      headingIcon = activeCatObj.icon || 'folder';
      activeCatBreadcrumb = getCategoryPath(activeCatObj.id, categories);
      activeChildCats = categories.filter(c => c.parentId === activeCatObj.id);
    }
  }

  // Ensure ancestors of the active category are not collapsed in the sidebar
  if (activeCatBreadcrumb.length > 1) {
    activeCatBreadcrumb.slice(0, -1).forEach(anc => AppState.collapsedCats.delete(anc.id));
  }

  // Animate cards in only when the view itself changes
  const viewKey = [activeCat, AppState.activeTag, settings.viewMode].join('|');
  const intro = viewKey !== renderApp._lastViewKey;
  renderApp._lastViewKey = viewKey;

  const isFilteredBySearchOrTag = !!(AppState.searchQuery.trim() || AppState.activeTag);
  const showSectionsLayout = settings.viewMode === 'sections' && (filtered.length > 0 || (!isFilteredBySearchOrTag && (activeCat === 'all' || (activeCatObj && categories.length > 0))));

  app.innerHTML = `
    <!-- SIDEBAR -->
    <aside class="sidebar ${AppState.sidebarCollapsed ? 'collapsed' : ''}" id="sidebar">
      <div class="sidebar-header">
        <div class="brand">
          <div class="brand-logo">
            <svg class="icon"><use href="#icon-bookmark"/></svg>
          </div>
          <span>ProMarker</span>
        </div>
        <button class="toggle-sidebar-btn" id="btn-collapse-sidebar" title="Collapse sidebar">
          <svg class="icon"><use href="#icon-menu"/></svg>
        </button>
      </div>

      <div class="sidebar-scroll">
        <!-- Smart Views -->
        <div>
          <div class="sidebar-section-title">Views</div>
          <ul class="sidebar-nav-list">
            <li class="nav-item ${activeCat === 'all' ? 'active' : ''}" data-nav="all" title="All Bookmarks (A)">
              <div class="nav-item-left">
                <span class="nav-icon"><svg class="icon"><use href="#icon-bookmark"/></svg></span>
                <span class="nav-label">All Bookmarks</span>
              </div>
              <span class="nav-key" aria-hidden="true">A</span><span class="nav-badge">${allCount}</span>
            </li>
            <li class="nav-item ${activeCat === 'favorites' ? 'active' : ''}" data-nav="favorites" title="Favorites (B)">
              <div class="nav-item-left">
                <span class="nav-icon nav-icon-star"><svg class="icon"><use href="#icon-star"/></svg></span>
                <span class="nav-label">Favorites</span>
              </div>
              <span class="nav-key" aria-hidden="true">B</span><span class="nav-badge">${favCount}</span>
            </li>
            <li class="nav-item ${activeCat === 'recent' ? 'active' : ''}" data-nav="recent">
              <div class="nav-item-left">
                <span class="nav-icon"><svg class="icon"><use href="#icon-clock"/></svg></span>
                <span class="nav-label">Recent</span>
              </div>
              <span class="nav-badge">${recentCount}</span>
            </li>
            <li class="nav-item ${activeCat === 'archive' ? 'active' : ''}" data-nav="archive" title="Archive (V)">
              <div class="nav-item-left">
                <span class="nav-icon nav-icon-archive"><svg class="icon"><use href="#icon-archive"/></svg></span>
                <span class="nav-label">Archive</span>
              </div>
              <span class="nav-key" aria-hidden="true">V</span><span class="nav-badge">${archiveCount}</span>
            </li>
            <li class="nav-item ${activeCat === 'trash' ? 'active' : ''}" data-nav="trash">
              <div class="nav-item-left">
                <span class="nav-icon nav-icon-trash"><svg class="icon"><use href="#icon-trash"/></svg></span>
                <span class="nav-label">Trash</span>
              </div>
              <span class="nav-badge">${trashCount}</span>
            </li>
          </ul>
        </div>

        <!-- Folders / Categories & Sub-category Folders -->
        <div>
          <div class="sidebar-section-title">
            <span>Categories</span>
            <button id="btn-add-category" title="New Category">
              <svg class="icon icon-sm"><use href="#icon-plus"/></svg>
            </button>
          </div>
          <ul class="sidebar-nav-list" id="category-nav-list">
            ${catTree.map(({ cat, depth, children }, i) => {
              // Hide if any ancestor is collapsed
              const path = getCategoryPath(cat.id, categories);
              if (path.slice(0, -1).some(anc => AppState.collapsedCats.has(anc.id))) return '';
              const descSet = getCategoryDescendants(cat.id, categories);
              const count = bookmarks.filter(b => descSet.has(b.categoryId) && !b.isTrash && !b.isArchived).length;
              const key = i < 9 ? String(i + 1) : '';
              const hasKids = children && children.length > 0;
              const isCollapsed = hasKids && AppState.collapsedCats.has(cat.id);
              return `
                <li class="nav-item ${activeCat === cat.id ? 'active' : ''} ${depth > 0 ? 'nav-item-sub' : ''}"
                    style="${depth > 0 ? `--depth: ${depth};` : ''}"
                    data-cat-id="${cat.id}" draggable="true"
                    title="${escapeHTML(getCategoryPathString(cat.id, categories))}${key ? ' (' + key + ')' : ''} — right-click for options">
                  <div class="nav-item-left">
                    ${hasKids ? `
                      <button type="button" class="cat-collapse-btn ${isCollapsed ? 'collapsed' : ''}" data-toggle-cat="${cat.id}" title="${isCollapsed ? 'Expand subfolders' : 'Collapse subfolders'}" aria-label="Toggle subfolders">
                        <svg class="icon"><use href="#icon-chevron-down"/></svg>
                      </button>
                    ` : (depth > 0 ? `<span class="sub-cat-elbow" aria-hidden="true"></span>` : '')}
                    <span class="nav-icon nav-icon-cat" style="--cat: ${cat.color || 'var(--primary)'};"><svg class="icon"><use href="#icon-${cat.icon || 'folder'}"/></svg></span>
                    <span class="nav-label">${escapeHTML(cat.name)}</span>
                  </div>
                  <div class="nav-item-right">
                    <button type="button" class="nav-sub-add" data-add-subcat="${cat.id}" title="New subcategory in ${escapeHTML(cat.name)}" aria-label="New subcategory">
                      <svg class="icon"><use href="#icon-plus"/></svg>
                    </button>
                    ${key ? `<span class="nav-key" aria-hidden="true">${key}</span>` : ''}
                    <span class="nav-badge">${count}</span>
                  </div>
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      </div>

      <!-- Footer & Persistence Status -->
      <div class="sidebar-footer">
        <div class="save-status-card" title="${escapeHTML(saveStatus.title)}">
          <div class="status-indicator">
            <span class="status-dot ${saveStatus.dot}"></span>
            <span class="status-text">
              <span class="status-main">${escapeHTML(saveStatus.text)}</span>
              <span class="status-sub">${AppState.fileHandle ? escapeHTML(AppState.fileHandle.name) : 'Browser storage'}</span>
            </span>
          </div>
          <button class="btn btn-save btn-sm ${saveStatus.btnClass}" id="btn-save-file" title="${escapeHTML(saveStatus.btnTitle)}">
            <svg class="icon icon-sm"><use href="#icon-${saveStatus.btnIcon}"/></svg>
            ${saveStatus.btnLabel}
          </button>
        </div>
      </div>
    </aside>
    <div class="sidebar-scrim" id="sidebar-scrim"></div>

    <!-- MAIN VIEW -->
    <main class="main-view">
      <!-- Top Header -->
      <header class="top-header">
        <div class="header-left">
          ${AppState.sidebarCollapsed ? `
            <button class="toggle-sidebar-btn" id="btn-expand-sidebar" title="Expand sidebar">
              <svg class="icon"><use href="#icon-menu"/></svg>
            </button>
          ` : ''}

          <div class="search-box header-search">
            <svg class="icon search-icon"><use href="#icon-search"/></svg>
            <input
              type="search"
              class="search-input"
              id="global-search"
              placeholder="Search, or #tag to filter by tag…"
              value="${escapeHTML(AppState.searchQuery)}"
              autocomplete="off" spellcheck="false" aria-label="Search bookmarks"
            />
            <button type="button" class="search-clear" id="btn-search-clear" title="Clear search (Esc)" aria-label="Clear search">
              <svg class="icon"><use href="#icon-x"/></svg>
            </button>
            <span class="search-shortcut">${/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"}</span>
          </div>
        </div>

        <div class="header-right">
          <div class="undo-redo-group" title="History (Cmd+Z / Cmd+Shift+Z)">
            <button class="btn btn-secondary btn-icon-only" id="btn-undo" title="Undo (Cmd+Z / Ctrl+Z)" ${!HistoryManager.canUndo() ? 'disabled' : ''}>
              <svg class="icon"><use href="#icon-undo"/></svg>
            </button>
            <button class="btn btn-secondary btn-icon-only" id="btn-redo" title="Redo (Cmd+Shift+Z / Ctrl+Y)" ${!HistoryManager.canRedo() ? 'disabled' : ''}>
              <svg class="icon"><use href="#icon-redo"/></svg>
            </button>
          </div>

          <button class="btn btn-primary" id="btn-new-bookmark" title="Add Bookmark (N)">
            <svg class="icon"><use href="#icon-plus"/></svg>
            <span>New Link</span>
          </button>

          <button class="btn btn-secondary btn-icon-only header-shortcuts" id="btn-shortcuts" title="Keyboard shortcuts (?)">
            <svg class="icon"><use href="#icon-keyboard"/></svg>
          </button>

          <button class="btn btn-secondary btn-icon-only" id="btn-open-settings" title="Settings & Data">
            <svg class="icon"><use href="#icon-settings"/></svg>
          </button>
        </div>
      </header>

      ${(!AppState.fileHandle && FileSupport.canLink) ? `
        <div class="file-connect-banner" id="file-connect-banner">
          <div class="banner-text">
            <span class="banner-icon"><svg class="icon icon-sm"><use href="#icon-link-file"/></svg></span>
            <span>Link <b>${escapeHTML(QuineEngine.getAppFilename())}</b> once so every change saves straight into it.</span>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-banner-link">
            <svg class="icon icon-sm"><use href="#icon-link-file"/></svg>
            Link Current File
          </button>
        </div>
      ` : ''}
      ${(!FileSupport.canLink && !FileSupport.tipHidden()) ? `
        <div class="file-connect-banner warn" id="file-support-banner">
          <div class="banner-text">
            <span class="banner-icon"><svg class="icon icon-sm"><use href="#icon-download"/></svg></span>
            <span><b>${FileSupport.browserName()}</b> can't save into <b>${escapeHTML(QuineEngine.getAppFilename())}</b> directly — saving downloads a new copy.${FileSupport.isBrave ? ' One setting fixes this.' : ''}</span>
          </div>
          <div class="banner-actions">
            <button class="btn btn-primary btn-sm" id="btn-file-help">${FileSupport.isBrave ? 'Show me how' : 'Learn more'}</button>
            <button class="btn btn-icon-only btn-sm" id="btn-file-help-dismiss" title="Hide"><svg class="icon icon-sm"><use href="#icon-x"/></svg></button>
          </div>
        </div>
      ` : ''}

      <!-- Sub Header: Heading, Views, Sorting -->
      <div class="sub-bar">
        <div class="sub-bar-top">
          <div class="category-heading">
            <span class="heading-icon heading-icon-${activeCat === 'favorites' ? 'star' : (activeCat === 'trash' ? 'trash' : (activeCat === 'archive' ? 'archive' : 'default'))}" ${activeCatObj && activeCatObj.color ? `style="--tint: ${activeCatObj.color};"` : ''}><svg class="icon"><use href="#icon-${headingIcon}"/></svg></span>
            <div>
              ${activeCatBreadcrumb.length > 1 ? `
                <div class="category-breadcrumb">
                  ${activeCatBreadcrumb.slice(0, -1).map(anc => `
                    <button type="button" class="breadcrumb-link" data-cat-jump="${anc.id}">${escapeHTML(anc.name)}</button>
                    <span class="breadcrumb-sep">/</span>
                  `).join('')}
                </div>
              ` : ''}
              <h1 class="category-title">
                ${escapeHTML(headingTitle)}
                <span class="category-count">${filtered.length}</span>
              </h1>
            </div>

            ${!isSpecialView ? `
              <div class="heading-actions">
                <button id="btn-add-subcategory" class="btn btn-secondary btn-sm" title="New Subcategory Folder">
                  <svg class="icon icon-sm"><use href="#icon-folder-plus"/></svg>
                  <span>Subfolder</span>
                </button>
                <button id="btn-edit-current-category" class="btn btn-secondary btn-icon-only btn-sm" title="Edit Category">
                  <svg class="icon icon-sm"><use href="#icon-edit"/></svg>
                </button>
              </div>
            ` : ''}

            ${activeCat === 'archive' && archiveCount > 0 ? `
              <div class="heading-actions">
                <button id="btn-unarchive-all" class="btn btn-secondary btn-sm">
                  <svg class="icon icon-sm"><use href="#icon-restore"/></svg>
                  Unarchive All
                </button>
              </div>
            ` : ''}

            ${activeCat === 'trash' && trashCount > 0 ? `
              <div class="heading-actions">
                <button id="btn-restore-all" class="btn btn-secondary btn-sm btn-success-ghost">
                  <svg class="icon icon-sm"><use href="#icon-restore"/></svg>
                  Restore All
                </button>
                <button id="btn-empty-trash" class="btn btn-secondary btn-sm btn-danger-ghost">
                  <svg class="icon icon-sm"><use href="#icon-trash"/></svg>
                  Empty Trash
                </button>
              </div>
            ` : ''}
          </div>

          <div class="view-sort-controls">
            <!-- View Switcher -->
            <div class="segmented-control">
              <button class="segment-btn ${settings.viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Cards Grid">
                <svg class="icon icon-sm"><use href="#icon-grid"/></svg>
              </button>
              <button class="segment-btn ${settings.viewMode === 'sections' ? 'active' : ''}" data-view="sections" title="Category Sections (4 per row)">
                <svg class="icon icon-sm"><use href="#icon-sections"/></svg>
              </button>
              <button class="segment-btn ${settings.viewMode === 'compact' ? 'active' : ''}" data-view="compact" title="Compact Grid">
                <svg class="icon icon-sm"><use href="#icon-compact"/></svg>
              </button>
              <button class="segment-btn ${settings.viewMode === 'list' ? 'active' : ''}" data-view="list" title="Detailed List">
                <svg class="icon icon-sm"><use href="#icon-list"/></svg>
              </button>
            </div>

            <!-- Sort Dropdown -->
            <div class="sort-control">
              <svg class="icon icon-sm"><use href="#icon-sort"/></svg>
              <select class="select-dropdown" id="sort-select">
                <option value="custom" ${settings.sortBy === 'custom' ? 'selected' : ''}>Custom (Drag &amp; Drop)</option>
                <option value="date-desc" ${settings.sortBy === 'date-desc' ? 'selected' : ''}>Date Added (Newest)</option>
                <option value="date-asc" ${settings.sortBy === 'date-asc' ? 'selected' : ''}>Date Added (Oldest)</option>
                <option value="title-asc" ${settings.sortBy === 'title-asc' ? 'selected' : ''}>Title (A–Z)</option>
                <option value="title-desc" ${settings.sortBy === 'title-desc' ? 'selected' : ''}>Title (Z–A)</option>
                <option value="clicks" ${settings.sortBy === 'clicks' ? 'selected' : ''}>Most Visited</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Sub-category Folders Bar (when viewing a parent category that has subfolders) -->
        ${activeChildCats.length > 0 ? `
          <div class="subcategories-bar" aria-label="Subcategory folders">
            <span class="chips-label" title="Subcategory folders">
              <svg class="icon icon-sm"><use href="#icon-folder"/></svg>
            </span>
            ${activeChildCats.map(sub => {
              const subDesc = getCategoryDescendants(sub.id, categories);
              const subCount = bookmarks.filter(b => subDesc.has(b.categoryId) && !b.isTrash && !b.isArchived).length;
              return `
                <button type="button" class="subcat-pill" data-cat-jump="${sub.id}" style="--cat: ${sub.color || 'var(--primary)'};">
                  <span class="subcat-pill-dot"></span>
                  <svg class="icon icon-sm"><use href="#icon-${sub.icon || 'folder'}"/></svg>
                  <span>${escapeHTML(sub.name)}</span>
                  <span class="subcat-pill-count">${subCount}</span>
                </button>
              `;
            }).join('')}
          </div>
        ` : ''}

        <!-- Filter Tags Strip -->
        ${allTags.length > 0 ? `
          <div class="filter-chips-bar">
            <span class="chips-label">
              <svg class="icon icon-sm"><use href="#icon-tag"/></svg>
            </span>
            <div class="tag-chip ${!AppState.activeTag ? 'active' : ''}" data-filter-tag="">All</div>
            ${allTags.map(tag => `
              <div class="tag-chip ${AppState.activeTag === tag ? 'active' : ''}" data-filter-tag="${escapeHTML(tag)}">
                #${escapeHTML(tag)}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <!-- Content Area: Bookmarks Grid / List / 4-per-row Category Sections -->
      <div class="content-area" id="content-drop-area">
        ${showSectionsLayout ? renderSectionsView(filtered, categories, settings, activeCat, intro) : (filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon-box">
              <svg class="icon icon-lg"><use href="#icon-${AppState.searchQuery ? 'search' : headingIcon}"/></svg>
            </div>
            <div class="empty-title">${AppState.searchQuery ? 'No matches' : (activeCat === 'trash' ? 'Trash is empty' : (activeCat === 'archive' ? 'Archive is empty' : 'Nothing here yet'))}</div>
            <div class="empty-subtitle">
              ${AppState.searchQuery ? 'Try a different word, or clear the search and tag filters.'
                : activeCat === 'trash' ? 'Links you delete land here, so you can restore them later.'
                : activeCat === 'archive' ? 'Archive links you want to keep for reference without cluttering All Bookmarks.'
                : activeCat === 'favorites' ? 'Star a link to keep it one click away.'
                : 'Add a link, or drag one in from your browser’s address bar.'}
            </div>
            ${activeCat === 'trash' || activeCat === 'archive' ? '' : `
            <button class="btn btn-primary" id="btn-empty-add">
              <svg class="icon"><use href="#icon-plus"/></svg>
              Add Bookmark
            </button>`}
          </div>
        ` : `
          <div class="bookmarks-grid ${settings.viewMode || 'grid'}${intro ? ' intro' : ''}" id="bookmarks-grid" role="list" aria-label="Bookmarks">
            ${filtered.map(b => renderBookmarkCard(b, categories, settings)).join('')}
          </div>
        `)}
      </div>
    </main>

    <!-- Floating Batch Action Bar -->
    <div class="batch-bar ${AppState.selectedIds.size > 0 ? 'visible' : ''}" id="batch-bar">
      <span class="batch-count">${AppState.selectedIds.size} selected</span>
      ${activeCat === 'trash' ? `
        <button class="btn btn-secondary btn-sm btn-success-ghost" id="btn-batch-restore">
          <svg class="icon icon-sm"><use href="#icon-restore"/></svg>
          Restore Selected
        </button>
        <button class="btn btn-secondary btn-sm btn-danger-ghost" id="btn-batch-delete-perm">
          <svg class="icon icon-sm"><use href="#icon-trash"/></svg>
          Delete Permanently
        </button>
      ` : `
        <button class="btn btn-secondary btn-sm" id="btn-batch-star">
          <svg class="icon icon-sm icon-star-color"><use href="#icon-star"/></svg>
          Star
        </button>
        ${activeCat === 'archive' ? `
          <button class="btn btn-secondary btn-sm" id="btn-batch-unarchive">
            <svg class="icon icon-sm"><use href="#icon-archive"/></svg>
            Unarchive
          </button>
        ` : `
          <button class="btn btn-secondary btn-sm" id="btn-batch-archive">
            <svg class="icon icon-sm"><use href="#icon-archive"/></svg>
            Archive
          </button>
        `}
        <button class="btn btn-secondary btn-sm" id="btn-batch-move">
          <svg class="icon icon-sm"><use href="#icon-folder"/></svg>
          Move To...
        </button>
        <button class="btn btn-secondary btn-sm btn-danger-ghost" id="btn-batch-delete">
          <svg class="icon icon-sm"><use href="#icon-trash"/></svg>
          Move to Trash
        </button>
      `}
      <button class="btn btn-icon-only" id="btn-batch-clear" title="Clear selection">
        <svg class="icon icon-sm"><use href="#icon-x"/></svg>
      </button>
    </div>

  `;

  bindAppEvents();
  // Favicon fallback without inline handlers (blocked by the page's security policy)
  app.querySelectorAll('.favicon-img').forEach(img => {
    const fallback = () => { img.style.display = 'none'; if (img.nextElementSibling) img.nextElementSibling.style.display = 'flex'; };
    if (!img.getAttribute('src') || (img.complete && img.naturalWidth === 0)) fallback();
    else img.addEventListener('error', fallback, { once: true });
  });
  if (keepFocus) {
    const el = document.getElementById(keepFocus.id);
    if (el) {
      el.focus({ preventScroll: true });
      try { if (keepFocus.start != null) el.setSelectionRange(keepFocus.start, keepFocus.end); } catch (e) {}
    }
  }
  KeyNav.restore(); // skips stealing focus while a field is focused
}
