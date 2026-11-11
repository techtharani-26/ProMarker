const THEME_OPTIONS = [
  { id: 'system', name: 'System', hint: 'Follows your OS' },
  { id: 'light', name: 'Light', hint: 'Clean & bright' },
  { id: 'dark', name: 'Dark', hint: 'Easy on the eyes' },
  { id: 'midnight', name: 'Midnight', hint: 'OLED black' },
  { id: 'espresso', name: 'Espresso', hint: 'Warm dark' },
  { id: 'latte', name: 'Latte', hint: 'Warm light' },
];
let settingsLastTab = 'appearance';

function openSettingsModal() {
  const { settings, categories, bookmarks } = AppState.data;
  const modalContainer = document.getElementById('modal-container');
  const live = bookmarks.filter(b => !b.isTrash);
  const tagCount = new Set(live.flatMap(b => b.tags || [])).size;
  const fh = AppState.fileHandle;
  const currentTheme = settings.theme || 'system';
  const tags = DataTools.tagCounts();
  const dupGroups = DataTools.findDuplicates();
  const dupExtras = dupGroups.reduce((n, g) => n + g.length - 1, 0);
  const iconKB = Math.round(IconCache.bytes() / 1024);
  const iconCount = live.filter(b => b.favicon).length;
  const tab = (id, icon, label) => `
    <button class="settings-tab ${settingsLastTab === id ? 'active' : ''}" type="button" role="tab" data-settings-tab="${id}" aria-selected="${settingsLastTab === id}">
      <svg class="icon icon-sm"><use href="#icon-${icon}"/></svg><span>${label}</span>
    </button>`;
  const panel = (id) => `class="settings-panel" data-settings-panel="${id}" role="tabpanel" ${settingsLastTab === id ? '' : 'hidden'}`;
  modalContainer.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal settings-modal">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">Settings</h3>
            <p class="modal-subtitle">Appearance, preferences and your data</p>
          </div>
          <button class="btn btn-icon-only" id="btn-close-modal" title="Close">
            <svg class="icon"><use href="#icon-x"/></svg>
          </button>
        </div>

        <div class="settings-tabs" role="tablist">
          ${tab('appearance', 'palette', 'Appearance')}
          ${tab('general', 'settings', 'General')}
          ${tab('tags', 'tag', 'Tags')}
          ${tab('data', 'save', 'Data &amp; Sync')}
        </div>

        <div class="modal-body settings-body">
          <!-- Appearance -->
          <section ${panel('appearance')}>
            <div class="settings-section-label">Theme</div>
            <div class="theme-grid" role="radiogroup" aria-label="Theme">
              ${THEME_OPTIONS.map(t => `
                <button type="button" class="theme-tile ${currentTheme === t.id ? 'selected' : ''}" data-theme-value="${t.id}" role="radio" aria-checked="${currentTheme === t.id}">
                  <span class="theme-preview tp-${t.id}" aria-hidden="true">
                    <span class="tp-side"><i></i><i></i><i></i></span>
                    <span class="tp-main"><b></b><span class="tp-cards"><i></i><i></i><i></i><i></i></span></span>
                  </span>
                  <span class="theme-tile-label"><span>${t.name}</span><small>${t.hint}</small></span>
                  <span class="theme-check"><svg class="icon"><use href="#icon-check"/></svg></span>
                </button>`).join('')}
            </div>
            <!-- Kept for scripts and accessibility; the tiles above drive it -->
            <select class="form-select" id="theme-select" aria-hidden="true" tabindex="-1">
              <option value="system" ${currentTheme === 'system' ? 'selected' : ''}>System Default (Auto)</option>
              <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark Mode</option>
              <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Light Mode</option>
              <option value="midnight" ${currentTheme === 'midnight' ? 'selected' : ''}>Midnight (OLED Black)</option>
              <option value="espresso" ${currentTheme === 'espresso' ? 'selected' : ''}>Espresso (Warm Dark)</option>
              <option value="latte" ${currentTheme === 'latte' ? 'selected' : ''}>Latte (Warm Light)</option>
            </select>
          </section>

          <!-- General -->
          <section ${panel('general')}>
            <div class="settings-group">
              <label class="settings-row" for="pref-auto-save">
                <div class="settings-row-text">
                  <span class="settings-row-title">Auto-save to file</span>
                  <span class="settings-row-desc">Write every change into the linked HTML file automatically.</span>
                </div>
                <input type="checkbox" class="switch" id="pref-auto-save" ${settings.autoSave !== false ? 'checked' : ''} />
              </label>
              <label class="settings-row" for="pref-new-tab">
                <div class="settings-row-text">
                  <span class="settings-row-title">Open links in a new tab</span>
                  <span class="settings-row-desc">Keep ProMarker open when you visit a bookmark.</span>
                </div>
                <input type="checkbox" class="switch" id="pref-new-tab" ${settings.openInNewTab ? 'checked' : ''} />
              </label>
              <label class="settings-row" for="pref-clicks">
                <div class="settings-row-text">
                  <span class="settings-row-title">Track visits</span>
                  <span class="settings-row-desc">Count clicks to power “Most Visited” sorting.</span>
                </div>
                <input type="checkbox" class="switch" id="pref-clicks" ${settings.trackClicks ? 'checked' : ''} />
              </label>
              <div class="settings-row">
                <div class="settings-row-text">
                  <span class="settings-row-title">Copy format</span>
                  <span class="settings-row-desc">Used by Copy and double-click on a card.</span>
                </div>
                <select class="form-select settings-select" id="pref-copy-format">
                  <option value="title-link" ${(settings.copyFormat || 'title-link') === 'title-link' ? 'selected' : ''}>Rich link</option>
                  <option value="title-url" ${settings.copyFormat === 'title-url' ? 'selected' : ''}>Title – URL</option>
                  <option value="url-only" ${settings.copyFormat === 'url-only' ? 'selected' : ''}>URL only</option>
                </select>
              </div>
            </div>
            <div class="settings-group">
              <label class="settings-row" for="pref-fetch-favicons">
                <div class="settings-row-text">
                  <span class="settings-row-title">Load site icons from the web</span>
                  <span class="settings-row-desc">Fetch favicons for public sites (private/local addresses are never sent).</span>
                </div>
                <input type="checkbox" class="switch" id="pref-fetch-favicons" ${settings.fetchFavicons !== false ? 'checked' : ''} />
              </label>
              <label class="settings-row" for="pref-offline-icons">
                <div class="settings-row-text">
                  <span class="settings-row-title">Keep icons offline</span>
                  <span class="settings-row-desc">Store each site’s icon inside the file (about 3 KB each), so icons show with no internet.
                    ${iconCount ? `<br>${iconCount} stored · ${iconKB} KB · <button class="link-btn" type="button" id="btn-clear-icons">Remove stored icons</button>` : ''}</span>
                </div>
                <input type="checkbox" class="switch" id="pref-offline-icons" ${settings.offlineIcons ? 'checked' : ''} />
              </label>
            </div>
          </section>

          <!-- Tags -->
          <section ${panel('tags')}>
            ${tags.length ? `
              <div class="tag-manager-head">
                <div class="search-box tag-filter-box">
                  <svg class="icon search-icon"><use href="#icon-search"/></svg>
                  <input type="text" class="search-input" id="tag-filter" placeholder="Filter ${tags.length} tags…" autocomplete="off" />
                </div>
              </div>
              <p class="settings-card-text">Rename a tag by editing it and pressing Enter. Renaming onto an existing tag merges them.</p>
              <div class="settings-group tag-list" id="tag-list">
                ${tags.map(([t, n]) => `
                  <div class="tag-row" data-tag="${escapeHTML(t)}">
                    <span class="tag-hash">#</span>
                    <input class="tag-name-input" type="text" value="${escapeHTML(t)}" aria-label="Rename tag ${escapeHTML(t)}" spellcheck="false" />
                    <span class="tag-count">${n}</span>
                    <button class="action-btn" type="button" data-tag-action="filter" title="Show these bookmarks"><svg class="icon icon-sm"><use href="#icon-search"/></svg></button>
                    <button class="action-btn" type="button" data-tag-action="delete" title="Remove this tag from all bookmarks"><svg class="icon icon-sm"><use href="#icon-trash"/></svg></button>
                  </div>`).join('')}
              </div>
            ` : `
              <div class="empty-state compact-empty">
                <div class="empty-icon-box"><svg class="icon icon-lg"><use href="#icon-tag"/></svg></div>
                <div class="empty-title">No tags yet</div>
                <div class="empty-subtitle">Add tags when you save or edit a bookmark.</div>
              </div>`}
          </section>

          <!-- Data & Sync -->
          <section ${panel('data')}>
            <div class="stat-tiles">
              <div class="stat-tile"><span class="stat-value">${live.length}</span><span class="stat-label">Bookmarks</span></div>
              <div class="stat-tile"><span class="stat-value">${categories.length}</span><span class="stat-label">Categories</span></div>
              <div class="stat-tile"><span class="stat-value">${tagCount}</span><span class="stat-label">Tags</span></div>
            </div>

            <div class="settings-card">
              <div class="settings-card-head">
                <div class="settings-card-icon"><svg class="icon"><use href="#icon-save"/></svg></div>
                <div class="settings-card-title">
                  <span>Save into this file</span>
                  <small>Your bookmarks live inside the HTML file itself.</small>
                </div>
                <span class="status-pill ${fh ? 'ok' : 'warn'}"><span class="status-dot ${fh ? '' : 'unlinked'}"></span>${fh ? escapeHTML(fh.name) : 'Not linked to disk'}</span>
              </div>
              <p class="settings-card-text">
                Link the file once for instant in-place saves (<kbd class="kbd">${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}</kbd> <kbd class="kbd">S</kbd>) and live sync across browsers.
                ${!FileSupport.canLink ? `<br><span class="text-warning">${FileSupport.browserName()} can't write to files, so saving downloads a copy.</span> <button class="link-btn" id="btn-settings-file-help">How to fix</button>` : ''}
              </p>
              <div class="settings-actions">
                <button class="btn btn-primary" id="btn-settings-save">
                  <svg class="icon icon-sm"><use href="#icon-save"/></svg>
                  ${fh ? 'Save Now' : 'Save / Download'}
                </button>
                <button class="btn btn-secondary" id="btn-settings-connect">
                  <svg class="icon icon-sm"><use href="#icon-link-file"/></svg>
                  ${fh ? 'Change File' : 'Link File'}
                </button>
                <button class="btn btn-secondary" id="btn-settings-download">
                  <svg class="icon icon-sm"><use href="#icon-download"/></svg>
                  Download Copy
                </button>
              </div>
            </div>

            <div class="settings-card">
              <div class="settings-card-head">
                <div class="settings-card-icon"><svg class="icon"><use href="#icon-globe"/></svg></div>
                <div class="settings-card-title">
                  <span>Browser bookmarks</span>
                  <small>Chrome, Safari, Firefox and Edge <code>bookmarks.html</code> files.</small>
                </div>
              </div>
              <div class="settings-actions">
                <label class="btn btn-secondary">
                  <svg class="icon icon-sm"><use href="#icon-upload"/></svg>
                  Import
                  <input type="file" id="import-netscape-file" accept=".html,.htm" hidden />
                </label>
                <button class="btn btn-secondary" id="btn-export-netscape">
                  <svg class="icon icon-sm"><use href="#icon-download"/></svg>
                  Export
                </button>
              </div>
            </div>

            <div class="settings-card">
              <div class="settings-card-head">
                <div class="settings-card-icon"><svg class="icon"><use href="#icon-book-open"/></svg></div>
                <div class="settings-card-title">
                  <span>JSON backup</span>
                  <small>A full copy of bookmarks, categories and settings. Import merges or replaces.</small>
                </div>
              </div>
              <div class="settings-actions">
                <button class="btn btn-secondary" id="btn-export-json">
                  <svg class="icon icon-sm"><use href="#icon-download"/></svg>
                  Export JSON
                </button>
                <label class="btn btn-secondary">
                  <svg class="icon icon-sm"><use href="#icon-upload"/></svg>
                  Import JSON
                  <input type="file" id="import-json-file" accept=".json,application/json" hidden />
                </label>
              </div>
            </div>

            <div class="settings-card">
              <div class="settings-card-head">
                <div class="settings-card-icon"><svg class="icon"><use href="#icon-copy"/></svg></div>
                <div class="settings-card-title">
                  <span>Duplicates</span>
                  <small>${dupExtras ? `${dupExtras} extra ${dupExtras === 1 ? 'copy' : 'copies'} of ${dupGroups.length} ${dupGroups.length === 1 ? 'link' : 'links'}` : 'Every link is saved only once'}</small>
                </div>
                ${dupExtras ? `<button class="btn btn-secondary btn-sm" id="btn-review-dups">Review</button>` : `<span class="status-pill ok"><span class="status-dot"></span>Clean</span>`}
              </div>
            </div>

            <div class="settings-card danger-zone-card">
              <div class="settings-card-head">
                <div class="settings-card-icon danger"><svg class="icon"><use href="#icon-trash"/></svg></div>
                <div class="settings-card-title">
                  <span>Reset &amp; clear</span>
                  <small>Every reset can be undone with <kbd class="kbd">${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}</kbd> <kbd class="kbd">Z</kbd>.</small>
                </div>
              </div>
              <div class="settings-actions">
                <button class="btn btn-secondary btn-danger-ghost" id="btn-clear-bookmarks">Clear Bookmarks</button>
                <button class="btn btn-secondary" id="btn-reset-defaults">Restore Starter Set</button>
                <button class="btn btn-secondary btn-danger-ghost" id="btn-wipe-all">Wipe Everything</button>
              </div>
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <span class="modal-footer-note">Changes apply instantly</span>
          <button class="btn btn-primary" id="btn-close-settings">Done</button>
        </div>
      </div>
    </div>
  `;

  // Tabs
  modalContainer.querySelectorAll('[data-settings-tab]').forEach((btn) => {
    btn.onclick = () => {
      settingsLastTab = btn.getAttribute('data-settings-tab');
      modalContainer.querySelectorAll('[data-settings-tab]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
      modalContainer.querySelectorAll('[data-settings-panel]').forEach((p) => {
        p.hidden = p.getAttribute('data-settings-panel') !== settingsLastTab;
      });
    };
  });

  // Theme tiles drive the (hidden) theme select
  modalContainer.querySelectorAll('[data-theme-value]').forEach((tile) => {
    tile.onclick = () => {
      const sel = document.getElementById('theme-select');
      sel.value = tile.getAttribute('data-theme-value');
      sel.dispatchEvent(new Event('change'));
      modalContainer.querySelectorAll('[data-theme-value]').forEach((t) => {
        const on = t === tile;
        t.classList.toggle('selected', on);
        t.setAttribute('aria-checked', String(on));
      });
    };
  });

  const closeModal = () => { modalContainer.innerHTML = ''; };
  document.getElementById('btn-close-modal').onclick = closeModal;
  document.getElementById('btn-close-settings').onclick = closeModal;

  // Theme change
  document.getElementById('theme-select').onchange = (e) => {
    AppState.data.settings.theme = e.target.value;
    applyTheme(e.target.value);
    AppState.saveDirty();
  };

  // Preferences
  const autoSaveCheck = document.getElementById('pref-auto-save');
  if (autoSaveCheck) {
    autoSaveCheck.onchange = (e) => {
      AppState.data.settings.autoSave = e.target.checked;
      AppState.saveDirty();
    };
  }
  document.getElementById('pref-new-tab').onchange = (e) => {
    AppState.data.settings.openInNewTab = e.target.checked;
    AppState.saveDirty();
  };
  document.getElementById('pref-clicks').onchange = (e) => {
    AppState.data.settings.trackClicks = e.target.checked;
    AppState.saveDirty();
  };
  document.getElementById('pref-copy-format').onchange = (e) => {
    AppState.data.settings.copyFormat = e.target.value;
    AppState.saveDirty();
  };

  // Offline & remote icons
  const fetchFaviconsCheck = document.getElementById('pref-fetch-favicons');
  if (fetchFaviconsCheck) {
    fetchFaviconsCheck.onchange = (e) => {
      AppState.data.settings.fetchFavicons = e.target.checked;
      AppState.saveDirty();
      renderApp();
    };
  }
  document.getElementById('pref-offline-icons').onchange = (e) => {
    AppState.data.settings.offlineIcons = e.target.checked;
    AppState.saveDirty();
    if (e.target.checked) { IconCache.tried.clear(); IconCache.fill(); showToast('Storing site icons in the background', 'info'); }
  };
  const clearIcons = document.getElementById('btn-clear-icons');
  if (clearIcons) clearIcons.onclick = (e) => {
    e.preventDefault();
    AppState.data.settings.offlineIcons = false;
    IconCache.clear();
    settingsLastTab = 'general';
    openSettingsModal();
    showToast('Stored icons removed', 'info');
  };

  // Tag manager
  const tagFilter = document.getElementById('tag-filter');
  if (tagFilter) tagFilter.oninput = () => {
    const q = tagFilter.value.trim().toLowerCase().replace(/^#/, '');
    modalContainer.querySelectorAll('.tag-row').forEach((r) => { r.hidden = !!q && !r.getAttribute('data-tag').includes(q); });
  };
  modalContainer.querySelectorAll('.tag-row').forEach((row) => {
    const tag = row.getAttribute('data-tag');
    const input = row.querySelector('.tag-name-input');
    let done = false;
    const commit = () => {
      if (done) return;
      if (input.value.trim().toLowerCase().replace(/^#+/, '') === tag) { input.value = tag; return; }
      if (DataTools.renameTag(tag, input.value)) { done = true; settingsLastTab = 'tags'; openSettingsModal(); renderApp(); }
      else input.value = tag;
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); input.value = tag; input.blur(); }
    };
    input.onblur = commit;
    row.querySelector('[data-tag-action="filter"]').onclick = () => {
      AppState.activeCategory = 'all';
      AppState.activeTag = tag;
      closeModal();
      renderApp();
    };
    row.querySelector('[data-tag-action="delete"]').onclick = async () => {
      const n = Number(row.querySelector('.tag-count').textContent) || 0;
      if (await confirmDialog({ title: `Remove #${tag}?`, message: `The tag is taken off ${n} ${n === 1 ? 'bookmark' : 'bookmarks'}. The bookmarks themselves stay.`, confirmLabel: 'Remove Tag', danger: true, icon: 'tag' })) {
        DataTools.deleteTag(tag);
        settingsLastTab = 'tags';
        openSettingsModal();
        renderApp();
      }
    };
  });

  // Duplicates & JSON import
  const reviewDups = document.getElementById('btn-review-dups');
  if (reviewDups) reviewDups.onclick = () => DataTools.openDuplicatesModal();
  document.getElementById('import-json-file').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      e.target.value = '';
      if (await DataTools.importJSON(event.target.result)) { closeModal(); renderApp(); }
    };
    reader.readAsText(file);
  };

  // Danger Zone: Reset & Clear App
  document.getElementById('btn-clear-bookmarks').onclick = async () => {
    if (await confirmDialog({ title: 'Clear all bookmarks?', message: 'Every bookmark is removed. Your categories and settings are kept.', confirmLabel: 'Clear Bookmarks', danger: true })) {
      AppState.recordAction('Clear All Bookmarks');
      AppState.data.bookmarks = [];
      AppState.selectedIds.clear();
      AppState.saveDirty();
      closeModal();
      renderApp();
      showToast('All bookmarks cleared', 'info', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
    }
  };

  document.getElementById('btn-reset-defaults').onclick = async () => {
    if (await confirmDialog({ title: 'Restore the starter set?', message: 'Your bookmarks and categories are replaced by the starter collection.', confirmLabel: 'Restore', icon: 'refresh' })) {
      AppState.recordAction('Reset to Factory Defaults');
      AppState.data = JSON.parse(JSON.stringify(DEFAULT_SEED_DATA));
      AppState.activeCategory = 'all';
      AppState.activeTag = null;
      AppState.searchQuery = '';
      AppState.selectedIds.clear();
      applyTheme(AppState.data.settings.theme || 'system');
      AppState.saveDirty();
      closeModal();
      renderApp();
      showToast('Reset to factory defaults!', 'success', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
    }
  };

  document.getElementById('btn-wipe-all').onclick = async () => {
    if (await confirmDialog({ title: 'Wipe everything?', message: 'All bookmarks and categories are removed, leaving a blank canvas.', confirmLabel: 'Wipe Everything', danger: true })) {
      AppState.recordAction('Wipe All Data');
      AppState.data = {
        version: 1,
        settings: {
          theme: AppState.data.settings.theme || 'system',
          viewMode: 'grid',
          sortBy: 'custom',
          openInNewTab: true,
          trackClicks: true,
          copyFormat: 'title-link',
          autoSave: true
        },
        categories: [
          { id: 'cat-general', name: 'General', icon: 'folder', color: '#6366f1', order: 0 }
        ],
        bookmarks: []
      };
      AppState.activeCategory = 'all';
      AppState.activeTag = null;
      AppState.searchQuery = '';
      AppState.selectedIds.clear();
      AppState.saveDirty();
      closeModal();
      renderApp();
      showToast('Wiped all data to blank canvas!', 'info', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
    }
  };

  // Save, Connect & Download buttons
  const settingsFileHelp = document.getElementById('btn-settings-file-help');
  if (settingsFileHelp) settingsFileHelp.onclick = () => openFileHelpModal();

  document.getElementById('btn-settings-save').onclick = () => {
    if (!AppState.fileHandle && window.showOpenFilePicker) {
      QuineEngine.connectFile();
    } else {
      QuineEngine.save();
    }
  };
  const connectBtn = document.getElementById('btn-settings-connect');
  if (connectBtn) {
    connectBtn.onclick = async () => {
      await QuineEngine.connectFile();
      closeModal();
      renderApp();
    };
  }
  document.getElementById('btn-settings-download').onclick = () => {
    const filename = QuineEngine.getAppFilename();
    QuineEngine.downloadFile(QuineEngine.serialize(), filename);
    showToast(`Downloaded ${filename}`, 'success');
  };

  // Export Netscape HTML
  document.getElementById('btn-export-netscape').onclick = () => {
    const html = NetscapeEngine.exportHTML();
    QuineEngine.downloadFile(html, 'promarker_bookmarks.html');
    showToast('Exported Netscape bookmarks HTML', 'success');
  };

  // Import Netscape HTML
  document.getElementById('import-netscape-file').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const count = NetscapeEngine.importHTML(event.target.result);
      showToast(`Imported ${count} bookmarks` + (NetscapeEngine.lastSkipped ? ` · skipped ${NetscapeEngine.lastSkipped} duplicates` : ''), 'success');
      closeModal();
      renderApp();
    };
    reader.readAsText(file);
  };

  // Export JSON
  document.getElementById('btn-export-json').onclick = () => {
    const json = JSON.stringify(AppState.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'promarker_data.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  };
}
