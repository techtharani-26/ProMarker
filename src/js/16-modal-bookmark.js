/* --------------------------------------------------------------------------
   11. MODALS: BOOKMARK, CATEGORY, SETTINGS, BATCH MOVE
   -------------------------------------------------------------------------- */
const MOD_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

function openBookmarkModal(existing = null) {
  const isEdit = existing && existing.id;
  const { categories } = AppState.data;
  const catTree = getCategoryTree(categories);
  const defaultCat = (!['all', 'favorites', 'recent', 'archive', 'trash'].includes(AppState.activeCategory))
    ? AppState.activeCategory
    : (categories[0]?.id || 'cat-dev');

  const initialData = {
    url: existing?.url || '',
    title: existing?.title || '',
    categoryId: existing?.categoryId || defaultCat,
    tags: (existing?.tags || []).join(', '),
    description: existing?.description || '',
    isFavorite: existing?.isFavorite || false
  };
  const fmtDate = (t) => t ? new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const meta = isEdit ? [
    existing.createdAt ? 'Added ' + fmtDate(existing.createdAt) : '',
    existing.clickCount ? `${existing.clickCount} ${existing.clickCount === 1 ? 'visit' : 'visits'}` : '',
    existing.lastVisitedAt ? 'last ' + fmtDate(existing.lastVisitedAt) : '',
  ].filter(Boolean).join(' · ') : '';

  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay active" id="bookmark-modal-overlay">
      <div class="modal bm-modal">
        <div class="bm-hero">
          <div class="favicon-wrap bm-hero-icon" id="bm-hero-icon">
            <img alt="" class="favicon-img" id="bm-hero-img" referrerpolicy="no-referrer" hidden />
            <div class="favicon-fallback" id="bm-hero-fallback"><svg class="icon"><use href="#icon-link"/></svg></div>
          </div>
          <div class="bm-hero-text">
            <span class="bm-eyebrow">${isEdit ? 'Edit link' : 'New link'}</span>
            <h3 class="modal-title" id="bm-hero-title">${escapeHTML(initialData.title || 'Untitled link')}</h3>
            <span class="bm-hero-domain" id="bm-hero-domain">${escapeHTML(extractDomain(initialData.url) || 'Paste an address to begin')}</span>
          </div>
          <button type="button" class="bm-star-toggle ${initialData.isFavorite ? 'on' : ''}" id="bm-star-btn" aria-pressed="${initialData.isFavorite}" title="Favorite">
            <svg class="icon"><use href="#icon-star"/></svg>
          </button>
          <button class="btn btn-icon-only" id="btn-close-modal" title="Close">
            <svg class="icon"><use href="#icon-x"/></svg>
          </button>
          <input type="checkbox" id="bm-favorite" ${initialData.isFavorite ? 'checked' : ''} hidden />
        </div>

        <div class="modal-body bm-body">
          <div class="form-group">
            <label class="form-label" for="bm-url">Address</label>
            <div class="input-affix">
              <svg class="icon icon-sm input-affix-icon"><use href="#icon-globe"/></svg>
              <input
                type="url"
                class="form-input"
                id="bm-url"
                placeholder="https://example.com"
                value="${escapeHTML(initialData.url)}"
                autocomplete="off"
                spellcheck="false"
                required
              />
              <button type="button" class="input-affix-btn" id="bm-open-url" title="Open in a new tab" ${initialData.url ? '' : 'hidden'}>
                <svg class="icon icon-sm"><use href="#icon-external-link"/></svg>
              </button>
            </div>
            <div class="form-hint" id="bm-dup-hint" hidden></div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="bm-title">Title</label>
              <input
                type="text"
                class="form-input"
                id="bm-title"
                placeholder="Page or app name"
                value="${escapeHTML(initialData.title)}"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="bm-category">Category</label>
              <select class="form-select" id="bm-category">
                ${catTree.map(({ cat: c, depth }) => `<option value="${c.id}" data-depth="${depth}" ${c.id === initialData.categoryId ? 'selected' : ''}>${escapeHTML(getCategoryPathString(c.id, categories))}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="bm-tag-entry">Tags</label>
            <div class="tag-field" id="bm-tag-field">
              <span class="tag-field-chips" id="bm-tag-chips"></span>
              <input type="text" class="tag-field-input" id="bm-tag-entry" placeholder="Add a tag…" autocomplete="off" spellcheck="false"
                     role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="bm-tag-suggest" />
              <div class="tag-suggest" id="bm-tag-suggest" role="listbox" hidden></div>
            </div>
            <input type="hidden" id="bm-tags" value="${escapeHTML(initialData.tags)}" />
          </div>

          <div class="form-group">
            <label class="form-label" for="bm-desc">Notes <span class="form-label-hint">shown from the note icon on the card</span></label>
            <textarea
              class="form-textarea"
              id="bm-desc"
              placeholder="Why you saved it, key takeaways, context… (avoid passwords — saved as plain text)"
            >${escapeHTML(initialData.description)}</textarea>
          </div>
        </div>

        <div class="modal-footer">
          ${isEdit && !existing.isTrash ? `
            <button class="btn btn-secondary btn-icon-only btn-danger-ghost" id="bm-trash" title="Move to Trash">
              <svg class="icon icon-sm"><use href="#icon-trash"/></svg>
            </button>` : ''}
          <span class="modal-footer-note">${meta ? escapeHTML(meta) : `<kbd class="kbd">${MOD_KEY}</kbd> <kbd class="kbd">↵</kbd> to save`}</span>
          <button class="btn btn-secondary" id="btn-cancel-modal">Cancel</button>
          <button class="btn btn-primary" id="btn-submit-bookmark">
            ${isEdit ? 'Save Changes' : 'Add Link'}
          </button>
        </div>
      </div>
    </div>
  `;

  const urlInput = document.getElementById('bm-url');
  const titleInput = document.getElementById('bm-title');
  enhanceCategorySelect(document.getElementById('bm-category'));
  urlInput.focus();

  // ---- Live preview: icon, title and domain follow what you type
  const heroIcon = document.getElementById('bm-hero-icon');
  const heroImg = document.getElementById('bm-hero-img');
  const heroFallback = document.getElementById('bm-hero-fallback');
  const heroTitle = document.getElementById('bm-hero-title');
  const heroDomain = document.getElementById('bm-hero-domain');
  const openBtn = document.getElementById('bm-open-url');
  let shownDomain = null;
  heroImg.addEventListener('load', () => { heroImg.hidden = false; heroFallback.hidden = true; });
  heroImg.addEventListener('error', () => { heroImg.hidden = true; heroFallback.hidden = false; });
  const paintPreview = () => {
    const raw = urlInput.value.trim();
    const domain = raw ? extractDomain(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw) : '';
    heroTitle.textContent = titleInput.value.trim() || domain || 'Untitled link';
    heroDomain.textContent = domain || 'Paste an address to begin';
    openBtn.hidden = !raw;
    if (domain === shownDomain) return;
    shownDomain = domain;
    heroIcon.style.setProperty('--site', domain ? getDomainColor(domain) : 'var(--primary)');
    heroImg.hidden = true; heroFallback.hidden = false;
    const stored = existing && existing.favicon && normalizeUrlKey(existing.url) === normalizeUrlKey(raw) ? existing.favicon : '';
    const iconUrl = stored || (domain ? getFaviconUrl('https://' + domain) : '');
    if (iconUrl) {
      heroImg.src = iconUrl;
    } else heroImg.removeAttribute('src');
  };
  let previewTimer = null;
  urlInput.addEventListener('input', () => { clearTimeout(previewTimer); previewTimer = setTimeout(paintPreview, 250); });
  titleInput.addEventListener('input', paintPreview);
  paintPreview();
  openBtn.onclick = () => { if (urlInput.value.trim()) openSafely(urlInput.value.trim()); };

  // Auto-fill title from URL domain if title is empty
  urlInput.onblur = () => {
    if (!titleInput.value && urlInput.value) {
      titleInput.value = extractDomain(urlInput.value);
    }
    paintPreview();
  };

  // ---- Favorite star in the header drives the hidden checkbox
  const starBtn = document.getElementById('bm-star-btn');
  const favBox = document.getElementById('bm-favorite');
  starBtn.onclick = () => {
    favBox.checked = !favBox.checked;
    starBtn.classList.toggle('on', favBox.checked);
    starBtn.setAttribute('aria-pressed', String(favBox.checked));
    starBtn.title = favBox.checked ? 'Unfavorite' : 'Favorite';
  };

  // ---- Tag chips with suggestions from tags already in use (#bm-tags keeps the comma list)
  const tagsHidden = document.getElementById('bm-tags');
  const tagEntry = document.getElementById('bm-tag-entry');
  const chipsEl = document.getElementById('bm-tag-chips');
  const suggestEl = document.getElementById('bm-tag-suggest');
  const known = DataTools.tagCounts();
  const cleanTag = (t) => String(t || '').trim().toLowerCase().replace(/^#+/, '').replace(/,/g, '').slice(0, 60);
  let chosen = initialData.tags.split(',').map(cleanTag).filter(Boolean);
  let suggestions = [];
  let active = -1;
  const syncTags = () => {
    tagsHidden.value = chosen.join(', ');
    chipsEl.innerHTML = chosen.map((t, i) => `
      <span class="tag-chip-token">#${escapeHTML(t)}<button type="button" data-remove-tag="${i}" aria-label="Remove ${escapeHTML(t)}"><svg class="icon"><use href="#icon-x"/></svg></button></span>`).join('');
    tagEntry.placeholder = chosen.length ? '' : 'Add a tag…';
  };
  const addTag = (t) => {
    t = cleanTag(t);
    if (t && !chosen.includes(t)) chosen.push(t);
    tagEntry.value = '';
    syncTags();
    renderSuggest();
  };
  const closeSuggest = () => { suggestEl.hidden = true; tagEntry.setAttribute('aria-expanded', 'false'); active = -1; };
  const renderSuggest = () => {
    const q = cleanTag(tagEntry.value);
    suggestions = known.filter(([t]) => !chosen.includes(t) && (!q || t.includes(q)))
      .sort((a, b) => (b[0].startsWith(q) - a[0].startsWith(q)) || (b[1] - a[1])).slice(0, 6);
    if (!suggestions.length || document.activeElement !== tagEntry) { closeSuggest(); return; }
    active = Math.min(active, suggestions.length - 1);
    suggestEl.innerHTML = suggestions.map(([t, n], i) => `
      <div class="tag-suggest-item ${i === active ? 'active' : ''}" role="option" data-suggest="${escapeHTML(t)}" aria-selected="${i === active}">
        <span>#${escapeHTML(t)}</span><small>${n}</small>
      </div>`).join('');
    suggestEl.hidden = false;
    tagEntry.setAttribute('aria-expanded', 'true');
  };
  tagEntry.addEventListener('input', () => {
    if (tagEntry.value.includes(',')) { tagEntry.value.split(',').slice(0, -1).forEach(addTag); tagEntry.value = tagEntry.value.split(',').pop(); }
    active = -1;
    renderSuggest();
  });
  tagEntry.addEventListener('focus', renderSuggest);
  tagEntry.addEventListener('blur', () => { setTimeout(() => { if (tagEntry.value.trim()) addTag(tagEntry.value); closeSuggest(); }, 120); });
  tagEntry.addEventListener('keydown', (e) => {
    const open = !suggestEl.hidden;
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); active = (active + 1) % suggestions.length; renderSuggest(); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); active = active <= 0 ? suggestions.length - 1 : active - 1; renderSuggest(); }
    else if ((e.key === 'Enter' || e.key === 'Tab') && !e.metaKey && !e.ctrlKey && (tagEntry.value.trim() || (open && active >= 0))) {
      e.preventDefault();
      addTag(open && active >= 0 ? suggestions[active][0] : tagEntry.value);
    }
    else if (e.key === 'Backspace' && !tagEntry.value && chosen.length) { chosen.pop(); syncTags(); renderSuggest(); }
    else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); closeSuggest(); }
  });
  suggestEl.addEventListener('mousedown', (e) => {
    const item = e.target.closest('[data-suggest]');
    if (item) { e.preventDefault(); addTag(item.getAttribute('data-suggest')); }
  });
  chipsEl.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove-tag]');
    if (rm) { chosen.splice(Number(rm.getAttribute('data-remove-tag')), 1); syncTags(); tagEntry.focus(); }
  });
  document.getElementById('bm-tag-field').addEventListener('mousedown', (e) => {
    if (e.target.id === 'bm-tag-field' || e.target.id === 'bm-tag-chips') { e.preventDefault(); tagEntry.focus(); }
  });
  syncTags();

  // Warn (without blocking) when this URL is already saved
  const dupHint = document.getElementById('bm-dup-hint');
  const checkDuplicate = () => {
    const key = normalizeUrlKey(urlInput.value);
    const dup = key && AppState.data.bookmarks.find(b =>
      b.id !== (existing && existing.id) && normalizeUrlKey(b.url) === key);
    if (dup) {
      const cat = AppState.data.categories.find(c => c.id === dup.categoryId);
      dupHint.textContent = `Already saved as “${dup.title || dup.url}”` +
        (dup.isTrash ? ' (in Trash)' : (dup.isArchived ? ' (in Archive)' : (cat ? ` in ${getCategoryPathString(cat.id, categories)}` : '')));
      dupHint.hidden = false;
    } else {
      dupHint.hidden = true;
    }
  };
  urlInput.oninput = () => { urlInput.classList.remove('invalid'); checkDuplicate(); };
  checkDuplicate();

  const closeModal = () => { modalContainer.innerHTML = ''; };
  document.getElementById('btn-close-modal').onclick = closeModal;
  document.getElementById('btn-cancel-modal').onclick = closeModal;

  // Move to Trash from the edit dialog (undoable)
  const trashBtn = document.getElementById('bm-trash');
  if (trashBtn) trashBtn.onclick = () => {
    const bm = AppState.data.bookmarks.find(b => b.id === existing.id);
    if (!bm) return;
    AppState.recordAction(`Move "${bm.title || 'Bookmark'}" to Trash`);
    bm.isTrash = true;
    AppState.selectedIds.delete(bm.id);
    AppState.saveDirty();
    closeModal();
    renderApp();
    showToast('Moved to Trash', 'info', { label: 'Undo', onClick: () => HistoryManager.undo() });
  };

  // A half-typed tag still counts when saving
  document.getElementById('btn-submit-bookmark').addEventListener('click', () => {
    if (tagEntry.value.trim()) addTag(tagEntry.value);
  });

  document.getElementById('btn-submit-bookmark').onclick = () => {
    let url = urlInput.value.trim();
    if (!url) {
      urlInput.focus();
      urlInput.classList.remove('invalid'); void urlInput.offsetWidth; urlInput.classList.add('invalid');
      showToast('Please enter a URL', 'danger');
      return;
    }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      url = 'https://' + url;
    }
    url = Sanitize.text(url, 8192).trim();
    if (!isSafeUrl(url)) {
      urlInput.focus();
      urlInput.classList.remove('invalid'); void urlInput.offsetWidth; urlInput.classList.add('invalid');
      showToast('Blocked a link with an unsafe address', 'danger');
      return;
    }

    const title = Sanitize.text(titleInput.value.trim() || extractDomain(url), 1000);
    const categoryId = document.getElementById('bm-category').value;
    const tags = Array.from(new Set(
      document.getElementById('bm-tags').value
        .split(',')
        .map(t => Sanitize.text(t.trim().toLowerCase().replace(/^#/, ''), 60).trim())
        .filter(Boolean)
    )).slice(0, 50);
    const description = Sanitize.text(document.getElementById('bm-desc').value.trim(), 10000);
    const isFavorite = document.getElementById('bm-favorite').checked;

    if (isEdit) {
      AppState.recordAction(`Edit Bookmark "${title}"`);
      const bm = AppState.data.bookmarks.find(b => b.id === existing.id);
      if (bm) {
        if (normalizeUrlKey(bm.url) !== normalizeUrlKey(url)) delete bm.favicon; // icon belonged to the old site
        bm.url = url;
        bm.title = title;
        bm.categoryId = categoryId;
        bm.tags = tags;
        bm.description = description;
        bm.isFavorite = isFavorite;
        bm.updatedAt = Date.now();
      }
      showToast('Bookmark updated', 'success', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
    } else {
      AppState.recordAction(`Add Bookmark "${title}"`);
      AppState.data.bookmarks.unshift({
        id: 'bm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        url,
        title,
        categoryId,
        tags,
        description,
        isFavorite,
        isTrash: false,
        clickCount: 0,
        createdAt: Date.now(),
        order: 0
      });
      showToast('New bookmark added', 'success', {
        label: 'Undo',
        onClick: () => HistoryManager.undo()
      });
    }

    AppState.saveDirty();
    closeModal();
    renderApp();
  };
}
