/* --------------------------------------------------------------------------
   15a. DATA TOOLS — JSON import, duplicate finder, tag manager, offline icons
   Every change records an undo step first, so each tool can be undone.
   -------------------------------------------------------------------------- */
const DataTools = {
  /* ---------- JSON import (the file made by "Export JSON") ---------- */
  async importJSON(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { showToast('That file is not valid JSON', 'danger'); return false; }
    const incoming = sanitizeData(parsed);
    if (!incoming) { showToast('That JSON file has no ProMarker bookmarks in it', 'danger'); return false; }
    delete incoming._lastSaved;
    delete incoming._backupTime;
    const n = incoming.bookmarks.filter(b => !b.isTrash).length;

    const choice = await confirmDialog({
      title: `Import ${n} ${n === 1 ? 'bookmark' : 'bookmarks'}?`,
      message: 'Merge adds the new links and categories to what you have (duplicates are skipped). Replace swaps everything here, including settings, for the file’s contents.',
      icon: 'upload',
      buttons: [
        { label: 'Cancel', value: null, kind: 'secondary' },
        { label: 'Replace Everything', value: 'replace', kind: 'secondary btn-danger-ghost' },
        { label: 'Merge', value: 'merge', kind: 'primary', focus: true },
      ],
      dismissValue: null,
    });
    if (!choice) return false;

    AppState.recordAction(choice === 'merge' ? 'Merge JSON Import' : 'Replace from JSON');
    if (choice === 'replace') {
      AppState.data = incoming;
      AppState.activeCategory = 'all';
      AppState.activeTag = null;
      AppState.selectedIds.clear();
      applyTheme(incoming.settings.theme || 'system');
      AppState.saveDirty();
      showToast(`Replaced with ${n} imported bookmarks`, 'success', { label: 'Undo', onClick: () => HistoryManager.undo() });
      return true;
    }

    // Merge: match categories by name, give everything fresh ids, skip known URLs
    const data = AppState.data;
    const usedCat = new Set(data.categories.map(c => c.id));
    const byName = new Map(data.categories.map(c => [c.name.trim().toLowerCase(), c.id]));
    const catMap = new Map();
    const addedCats = [];
    incoming.categories.forEach((c) => {
      const key = c.name.trim().toLowerCase();
      if (byName.has(key) && !c.parentId) { catMap.set(c.id, byName.get(key)); return; }
      const id = Sanitize.id('', 'cat', usedCat);
      const clone = Object.assign({}, c, { id, order: data.categories.length, _origParent: c.parentId || '' });
      data.categories.push(clone);
      addedCats.push(clone);
      byName.set(key, id);
      catMap.set(c.id, id);
    });
    addedCats.forEach((c) => {
      c.parentId = c._origParent ? (catMap.get(c._origParent) || '') : '';
      delete c._origParent;
    });
    const fallbackCat = () => {
      if (data.categories.length) return data.categories[0].id;
      const id = Sanitize.id('', 'cat', usedCat);
      data.categories.push({ id, name: 'Imported', icon: 'folder', color: '#6366f1', order: 0 });
      return id;
    };
    const seen = new Set(data.bookmarks.filter(b => !b.isTrash).map(b => normalizeUrlKey(b.url)));
    const usedBm = new Set(data.bookmarks.map(b => b.id));
    let order = data.bookmarks.reduce((m, b) => Math.max(m, b.order || 0), 0);
    let added = 0, skipped = 0;
    incoming.bookmarks.filter(b => !b.isTrash).forEach((b) => {
      const key = normalizeUrlKey(b.url);
      if (!key || seen.has(key)) { skipped++; return; }
      seen.add(key);
      data.bookmarks.push(Object.assign({}, b, {
        id: Sanitize.id('', 'bm', usedBm),
        categoryId: catMap.get(b.categoryId) || fallbackCat(),
        order: ++order,
      }));
      added++;
    });
    AppState.saveDirty();
    showToast(`Imported ${added} ${added === 1 ? 'link' : 'links'}` + (skipped ? ` · skipped ${skipped} already here` : ''), 'success', { label: 'Undo', onClick: () => HistoryManager.undo() });
    return true;
  },

  /* ---------- Duplicates ---------- */
  // Groups of 2+ live bookmarks pointing at the same address. The first item is the one kept:
  // favorite first, then most visited, then oldest.
  findDuplicates() {
    const groups = new Map();
    AppState.data.bookmarks.filter(b => !b.isTrash).forEach((b) => {
      const key = normalizeUrlKey(b.url);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    });
    return [...groups.values()].filter(g => g.length > 1).map(g => g.sort((a, b) =>
      (b.isFavorite - a.isFavorite) || ((b.clickCount || 0) - (a.clickCount || 0)) || ((a.createdAt || 0) - (b.createdAt || 0))));
  },

  // Keep one per group; fold the others' tags, notes, visits and star into it, then trash them.
  mergeDuplicates() {
    const groups = this.findDuplicates();
    if (!groups.length) return 0;
    AppState.recordAction('Merge Duplicates');
    let moved = 0;
    groups.forEach(([keep, ...extras]) => {
      extras.forEach((x) => {
        keep.tags = Array.from(new Set([...(keep.tags || []), ...(x.tags || [])]));
        if (!keep.description && x.description) keep.description = x.description;
        else if (x.description && x.description !== keep.description) keep.description += '\n\n' + x.description;
        keep.clickCount = (keep.clickCount || 0) + (x.clickCount || 0);
        keep.isFavorite = keep.isFavorite || x.isFavorite;
        keep.lastVisitedAt = Math.max(keep.lastVisitedAt || 0, x.lastVisitedAt || 0) || undefined;
        x.isTrash = true;
        x.updatedAt = Date.now();
        moved++;
      });
      keep.updatedAt = Date.now();
    });
    AppState.selectedIds.clear();
    AppState.saveDirty();
    return moved;
  },

  openDuplicatesModal() {
    const groups = this.findDuplicates();
    const extras = groups.reduce((n, g) => n + g.length - 1, 0);
    const mc = document.getElementById('modal-container');
    const catName = (id) => (AppState.data.categories.find(c => c.id === id) || {}).name || 'No category';
    mc.innerHTML = `
      <div class="modal-overlay active">
        <div class="modal dup-modal">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">Duplicate links</h3>
              <p class="modal-subtitle">${groups.length ? `${groups.length} ${groups.length === 1 ? 'address is' : 'addresses are'} saved more than once` : 'Every link is saved only once'}</p>
            </div>
            <button class="btn btn-icon-only" id="btn-close-modal" title="Close"><svg class="icon"><use href="#icon-x"/></svg></button>
          </div>
          <div class="modal-body">
            ${groups.length ? groups.map(g => `
              <div class="dup-group">
                ${g.map((b, i) => `
                  <div class="dup-item ${i === 0 ? 'keep' : ''}">
                    <div class="dup-text">
                      <span class="dup-title">${escapeHTML(b.title || b.url)}</span>
                      <span class="dup-meta">${escapeHTML(catName(b.categoryId))}${b.tags && b.tags.length ? ' · #' + b.tags.map(escapeHTML).join(' #') : ''}${b.clickCount ? ' · ' + b.clickCount + ' clicks' : ''}</span>
                    </div>
                    <span class="dup-badge ${i === 0 ? 'keep' : ''}">${i === 0 ? 'Keep' : 'Merge in'}</span>
                  </div>`).join('')}
                <div class="dup-url">${escapeHTML(extractDomain(g[0].url) || g[0].url)}</div>
              </div>`).join('') : `
              <div class="empty-state compact-empty">
                <div class="empty-icon-box"><svg class="icon icon-lg"><use href="#icon-check"/></svg></div>
                <div class="empty-title">No duplicates</div>
              </div>`}
          </div>
          <div class="modal-footer">
            ${groups.length ? `<span class="modal-footer-note">Tags, notes, visits and stars are combined into the kept link. The others go to Trash.</span>` : ''}
            <button class="btn btn-secondary" id="btn-dup-back">Back</button>
            ${groups.length ? `<button class="btn btn-primary" id="btn-dup-merge">Merge ${extras} ${extras === 1 ? 'Duplicate' : 'Duplicates'}</button>` : ''}
          </div>
        </div>
      </div>`;
    const back = () => { settingsLastTab = 'data'; openSettingsModal(); };
    document.getElementById('btn-close-modal').onclick = () => { mc.innerHTML = ''; };
    document.getElementById('btn-dup-back').onclick = back;
    const merge = document.getElementById('btn-dup-merge');
    if (merge) merge.onclick = () => {
      const moved = this.mergeDuplicates();
      mc.innerHTML = '';
      renderApp();
      showToast(`Merged ${moved} ${moved === 1 ? 'duplicate' : 'duplicates'}`, 'success', { label: 'Undo', onClick: () => HistoryManager.undo() });
    };
  },

  /* ---------- Tags ---------- */
  tagCounts() {
    const counts = new Map();
    AppState.data.bookmarks.filter(b => !b.isTrash).forEach(b => (b.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  },

  // Renaming onto an existing tag merges the two. Trashed bookmarks are updated too.
  renameTag(from, to) {
    to = String(to || '').trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-').slice(0, 60);
    if (!to || to === from || !AppState.data.bookmarks.some(b => (b.tags || []).includes(from))) return false;
    const merging = AppState.data.bookmarks.some(b => (b.tags || []).includes(to));
    AppState.recordAction(`${merging ? 'Merge' : 'Rename'} Tag #${from}`);
    AppState.data.bookmarks.forEach((b) => {
      if (!(b.tags || []).includes(from)) return;
      b.tags = Array.from(new Set(b.tags.map(t => (t === from ? to : t))));
    });
    if (AppState.activeTag === from) AppState.activeTag = to;
    AppState.saveDirty();
    showToast(merging ? `Merged #${from} into #${to}` : `Renamed #${from} to #${to}`, 'success', { label: 'Undo', onClick: () => HistoryManager.undo() });
    return true;
  },

  deleteTag(tag) {
    AppState.recordAction(`Delete Tag #${tag}`);
    AppState.data.bookmarks.forEach((b) => { if ((b.tags || []).includes(tag)) b.tags = b.tags.filter(t => t !== tag); });
    if (AppState.activeTag === tag) AppState.activeTag = null;
    AppState.saveDirty();
    showToast(`Removed #${tag}`, 'info', { label: 'Undo', onClick: () => HistoryManager.undo() });
  },
};

/* ---------- Offline icons ----------
   With "Keep icons offline" on, each site's icon is drawn into a small PNG and stored
   with the bookmark (b.favicon, ~2–4 KB), so cards show real icons with no network. */
const IconCache = {
  running: false,
  tried: new Set(),     // domains that failed this session (not retried until reload)

  pending() {
    return AppState.data.bookmarks.filter(b => {
      if (b.isTrash || b.favicon) return false;
      const d = extractDomain(b.url);
      return isPublicFaviconDomain(d) && !this.tried.has(d);
    });
  },

  // Icon services that send CORS headers, so the image can be read back into a PNG.
  // (Google's favicon service, used for normal display, does not allow that.) Only the domain is sent.
  sources: [
    (d) => `https://icon.horse/icon/${encodeURIComponent(d)}`,
    (d) => `https://favicone.com/${encodeURIComponent(d)}?s=64`,
  ],

  async capture(domain) {
    for (const src of this.sources) {
      const url = await this.captureFrom(src(domain));
      if (url) return url;
    }
    return null;
  },

  captureFrom(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';    // needed to read the pixels back
      img.referrerPolicy = 'no-referrer';
      const done = (v) => { clearTimeout(timer); resolve(v); };
      const timer = setTimeout(() => done(null), 8000);
      img.onload = () => {
        try {
          if (!img.naturalWidth) return done(null);
          const c = document.createElement('canvas');
          c.width = c.height = 48;   // shown at 20px: sharp on 2x screens
          const ctx = c.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, 48, 48);
          const url = c.toDataURL('image/png');
          done(url.length <= FAVICON_MAX ? url : null);
        } catch (e) { done(null); } // image without CORS: canvas is tainted
      };
      img.onerror = () => done(null);
      img.src = src;
    });
  },

  async fill() {
    if (this.running || !AppState.data.settings.offlineIcons) return;
    const todo = this.pending();
    if (!todo.length) return;
    this.running = true;
    const domains = [...new Set(todo.map(b => extractDomain(b.url)))];
    const results = new Map();
    let i = 0;
    const worker = async () => {
      while (i < domains.length) {
        const d = domains[i++];
        const url = await this.capture(d);
        if (url) results.set(d, url); else this.tried.add(d);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    this.running = false;
    if (!AppState.data.settings.offlineIcons || !results.size) return;
    let stored = 0;
    AppState.data.bookmarks.forEach((b) => {
      const url = !b.favicon && results.get(extractDomain(b.url));
      if (url) { b.favicon = url; stored++; }
    });
    // Not an undo step: it only adds cached icons, never changes what the user wrote
    if (stored) AppState.saveDirty();
  },

  clear() {
    AppState.data.bookmarks.forEach((b) => { delete b.favicon; });
    this.tried.clear();
    AppState.saveDirty();
  },

  bytes() {
    return AppState.data.bookmarks.reduce((n, b) => n + (b.favicon ? b.favicon.length : 0), 0);
  },
};

// Fill in missing icons a moment after the app settles (and after each change)
AppState.subscribe(() => {
  if (!AppState.data.settings.offlineIcons || IconCache.running) return;
  clearTimeout(IconCache._t);
  IconCache._t = setTimeout(() => IconCache.fill(), 1500);
});
setTimeout(() => IconCache.fill(), 2000);
