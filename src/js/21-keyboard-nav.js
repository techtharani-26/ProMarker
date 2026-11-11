/* --------------------------------------------------------------------------
   12B. KEYBOARD NAVIGATION (cards, sidebar, context menu, shortcut help)
   Arrows / j k move · Enter opens · Space selects · e edit · f favorite
   c copy · Delete trash · m move · [ ] switch view · ? help
   -------------------------------------------------------------------------- */
const KeyNav = {
  // True while the user is steering with the keyboard; keeps focus on a card across re-renders
  active: false,

  cards() {
    return Array.from(document.querySelectorAll('#bookmarks-grid .bookmark-card'));
  },

  cardById(id) {
    return id ? document.querySelector(`#bookmarks-grid .bookmark-card[data-id="${CSS.escape(id)}"]`) : null;
  },

  current() {
    const el = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest('#bookmarks-grid .bookmark-card') : null;
    return el || this.cardById(AppState.focusedId);
  },

  focus(card, { scroll = true } = {}) {
    if (!card) return;
    this.cards().forEach(c => c.setAttribute('tabindex', '-1'));
    card.setAttribute('tabindex', '0');
    AppState.focusedId = card.getAttribute('data-id');
    card.focus({ preventScroll: true });
    if (scroll) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },

  // Called at the end of every renderApp(): roving tabindex + restore keyboard focus
  restore() {
    const cards = this.cards();
    if (!cards.length) return;
    const target = this.cardById(AppState.focusedId) || cards[0];
    target.setAttribute('tabindex', '0');
    if (this.active && !document.querySelector('#modal-container > *')) {
      const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if (!typing) target.focus({ preventScroll: true });
    }
  },

  // Grid-aware movement: up/down pick the nearest card in the row above/below
  neighbour(card, dir) {
    const cards = this.cards();
    const i = cards.indexOf(card);
    if (i === -1) return cards[0];
    if (dir === 'left') return cards[Math.max(0, i - 1)];
    if (dir === 'right') return cards[Math.min(cards.length - 1, i + 1)];
    if (dir === 'home') return cards[0];
    if (dir === 'end') return cards[cards.length - 1];

    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const rows = cards
      .map(c => ({ c, r: c.getBoundingClientRect() }))
      .filter(o => dir === 'down' ? o.r.top > r.top + 4 : o.r.top < r.top - 4);
    if (!rows.length) return card;
    const rowTop = dir === 'down' ? Math.min(...rows.map(o => o.r.top)) : Math.max(...rows.map(o => o.r.top));
    return rows
      .filter(o => Math.abs(o.r.top - rowTop) < 4)
      .sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - cx) - Math.abs(b.r.left + b.r.width / 2 - cx))[0].c;
  },

  move(dir, extendSelection) {
    const from = this.current();
    const to = from ? this.neighbour(from, dir) : this.cards()[0];
    if (!to) return;
    this.active = true;
    if (extendSelection) {
      if (from) AppState.selectedIds.add(from.getAttribute('data-id'));
      AppState.selectedIds.add(to.getAttribute('data-id'));
      AppState.focusedId = to.getAttribute('data-id');
      renderApp();
      this.focus(this.cardById(AppState.focusedId));
      return;
    }
    this.focus(to);
  },

  press(card, selector) {
    const btn = card && card.querySelector(selector);
    if (btn) { btn.click(); return true; }
    return false;
  },

  openCard(card, background) {
    const link = card && card.querySelector('.card-title');
    if (!link) return;
    if (background) {
      const bm = AppState.data.bookmarks.find(b => b.id === card.getAttribute('data-id'));
      if (bm) {
        if (!openSafely(bm.url)) return;
        if (AppState.data.settings.trackClicks) {
          bm.clickCount = (bm.clickCount || 0) + 1;
          bm.lastVisitedAt = Date.now();
          AppState.saveDirty();
        }
      }
      return;
    }
    link.click();
  },

  // Jump straight to a view ('all', 'favorites', …) or a category id
  goView(id) {
    if (!id) return;
    AppState.activeCategory = id;
    AppState.activeTag = null;
    AppState.selectedIds.clear();
    AppState.focusedId = null;
    if (AppState.isNarrow()) AppState.sidebarCollapsed = true;
    renderApp();
    const first = this.cards()[0];
    if (first && this.active) this.focus(first, { scroll: false });
  },

  // Step through the sidebar: All, Favorites, Recent, Archive, Trash, then each category
  switchView(step) {
    const ids = ['all', 'favorites', 'recent', 'archive', 'trash', ...getCategoryTree(AppState.data.categories).map(x => x.cat.id)];
    const i = Math.max(0, ids.indexOf(AppState.activeCategory));
    this.goView(ids[(i + step + ids.length) % ids.length]);
  },

  menuKeys(e) {
    const menu = ContextMenuManager.activeMenu;
    const items = Array.from(menu.querySelectorAll(':scope > .context-menu-item'));
    if (!items.length) return false;
    let i = items.findIndex(el => el.classList.contains('kbd-active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (i !== -1) items[i].classList.remove('kbd-active');
      i = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
      items[i].classList.add('kbd-active');
      return true;
    }
    if (e.key === 'Enter' && i !== -1) {
      e.preventDefault();
      const sub = items[i].querySelector('.context-submenu');
      if (sub) { items[i].classList.add('kbd-open'); return true; }
      items[i].click();
      return true;
    }
    return false;
  },

  showHelp() {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    const mod = isMac ? '⌘' : 'Ctrl';
    const groups = [
      ['Navigate', [['↑ ↓ ← →', 'Move between bookmarks'], ['J · K', 'Next / previous'], ['Home · End', 'First / last'], ['A', 'All bookmarks'], ['B', 'Favorites'], ['V', 'Archive'], ['1 – 9', 'Category by sidebar position'], ['[ · ]', 'Previous / next view or category'], ['/ · ' + mod + ' K', 'Search'], ['↓', 'From search: jump to results']]],
      ['Act on bookmark', [['Enter', 'Open'], [mod + ' Enter', 'Open in background tab'], ['E', 'Edit'], ['I', 'Show notes'], ['F', 'Favorite'], ['Y', 'Archive / unarchive'], ['C', 'Copy as link'], ['Double-click', 'Copy as link (mouse)'], ['M', 'Move to category'], ['Delete', 'Move to Trash'], ['R', 'Restore (in Trash)'], ['Shift F10', 'Context menu']]],
      ['Select', [['Space · X', 'Select or deselect'], ['Shift ↑ ↓ ← →', 'Extend selection'], [mod + ' A', 'Select all shown'], ['Esc', 'Clear selection / close']]],
      ['App', [['N', 'New bookmark'], [mod + ' S', 'Save'], [mod + ' Z', 'Undo'], [mod + ' Shift Z', 'Redo'], ['?', 'This help']]],
    ];
    const kbd = (k) => k.split(' ').map(p => p === '·' ? '<span class="kbd-sep">or</span>'
      : p === '–' ? '<span class="kbd-sep">to</span>' : `<kbd class="kbd">${escapeHTML(p)}</kbd>`).join('');
    document.getElementById('modal-container').innerHTML = `
      <div class="modal-overlay active">
        <div class="modal" style="max-width: 640px;">
          <div class="modal-header">
            <h3 class="modal-title">Keyboard shortcuts</h3>
            <button class="btn btn-icon-only" id="btn-close-modal"><svg class="icon"><use href="#icon-x"/></svg></button>
          </div>
          <div class="modal-body shortcut-help">
            ${groups.map(([title, rows]) => `
              <section>
                <h4>${title}</h4>
                ${rows.map(([k, label]) => `<div class="shortcut-row"><span>${label}</span><span class="shortcut-keys">${kbd(k)}</span></div>`).join('')}
              </section>`).join('')}
          </div>
        </div>
      </div>`;
    document.getElementById('btn-close-modal').onclick = () => { document.getElementById('modal-container').innerHTML = ''; };
  },

  onKeyDown(e) {
    if (e.defaultPrevented || e.isComposing) return;
    const mod = e.metaKey || e.ctrlKey;
    const el = document.activeElement;
    const typing = el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
    const modal = !!document.querySelector('#modal-container > *');

    if (ContextMenuManager.activeMenu && this.menuKeys(e)) return;
    if (modal) return;

    // From search: ↓ jumps into results, Enter opens the first result
    if (el && el.id === 'global-search') {
      if (e.key === 'ArrowDown' && this.cards().length) { e.preventDefault(); this.active = true; this.focus(this.cards()[0]); }
      else if (e.key === 'Enter' && this.cards().length) { e.preventDefault(); this.openCard(this.cards()[0], mod); }
      return;
    }
    if (typing) return;

    if (e.key === '?' || (e.shiftKey && (e.key === '/' || e.code === 'Slash'))) { e.preventDefault(); this.showHelp(); return; }
    // A = All bookmarks, B = Favorites, V = Archive, 1–9 = categories in sidebar order
    if (!mod && !e.altKey && !e.shiftKey) {
      const lower = e.key.toLowerCase();
      if (lower === 'a') { e.preventDefault(); this.goView('all'); return; }
      if (lower === 'b') { e.preventDefault(); this.goView('favorites'); return; }
      if (lower === 'v') { e.preventDefault(); this.goView('archive'); return; }
      if (/^[1-9]$/.test(e.key)) {
        const tree = getCategoryTree(AppState.data.categories);
        const entry = tree[Number(e.key) - 1];
        e.preventDefault();
        if (entry && entry.cat) this.goView(entry.cat.id); else showToast(`No category ${e.key} yet`, 'info');
        return;
      }
    }

    const bracket = e.key === '[' || e.code === 'BracketLeft' ? -1 : (e.key === ']' || e.code === 'BracketRight' ? 1 : 0);
    if (!mod && !e.altKey && bracket) { e.preventDefault(); this.switchView(bracket); return; }

    const dirs = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Home: 'home', End: 'end' };
    if (!mod && !e.altKey && dirs[e.key]) {
      // Don't hijack arrows while a sidebar item / button has focus, except from cards or the page
      if (el && el !== document.body && !el.closest('#bookmarks-grid') && !el.closest('.main-view')) return;
      e.preventDefault();
      this.move(dirs[e.key], e.shiftKey && !['home', 'end'].includes(dirs[e.key]));
      return;
    }
    if (!mod && !e.altKey && (e.key === 'j' || e.key === 'k')) { e.preventDefault(); this.move(e.key === 'j' ? 'right' : 'left'); return; }

    if (mod && e.key.toLowerCase() === 'a') {
      const cards = this.cards();
      if (!cards.length) return;
      e.preventDefault();
      cards.forEach(c => AppState.selectedIds.add(c.getAttribute('data-id')));
      renderApp();
      return;
    }

    const card = el && el.closest ? el.closest('#bookmarks-grid .bookmark-card') : null;
    if (!card) return;
    const id = card.getAttribute('data-id');
    const k = e.key.toLowerCase();

    if (e.key === 'Enter' && el === card) { e.preventDefault(); this.openCard(card, mod); return; }
    if (mod || e.altKey) return;

    if (e.key === ' ' || k === 'x') {
      e.preventDefault();
      if (AppState.selectedIds.has(id)) AppState.selectedIds.delete(id); else AppState.selectedIds.add(id);
      renderApp();
      return;
    }
    if (k === 'e') { e.preventDefault(); this.press(card, '[data-action="edit-bookmark"]'); return; }
    if (k === 'i') {
      e.preventDefault();
      const bm = AppState.data.bookmarks.find(b => b.id === id);
      if (bm && bm.description) NotesPopover.toggle(card.querySelector('[data-action="show-notes"]') || card, bm);
      else showToast('No notes on this bookmark', 'info');
      return;
    }
    if (k === 'f') { e.preventDefault(); this.press(card, '[data-action="toggle-star"]'); return; }
    if (k === 'y') { e.preventDefault(); this.press(card, '[data-action="toggle-archive"]'); return; }
    if (k === 'c') { e.preventDefault(); this.press(card, '[data-action="copy-title-link"]'); return; }
    if (k === 'r' && AppState.activeCategory === 'trash') { e.preventDefault(); this.press(card, '[data-action="restore-bookmark"]'); return; }
    if (k === 'm') {
      e.preventDefault();
      if (!AppState.selectedIds.size) AppState.selectedIds.add(id);
      openBatchMoveModal();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const next = this.neighbour(card, 'right') !== card ? this.neighbour(card, 'right') : this.neighbour(card, 'left');
      const nextId = next && next !== card ? next.getAttribute('data-id') : null;
      this.press(card, '[data-action="delete-bookmark"]');
      AppState.focusedId = nextId;
      this.restore();
      return;
    }
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const r = card.getBoundingClientRect();
      const bm = AppState.data.bookmarks.find(b => b.id === id);
      if (bm) showBookmarkContextMenu({ clientX: r.left + 24, clientY: r.top + 40, preventDefault() {}, stopPropagation() {} }, bm);
    }
  },
};

window.addEventListener('keydown', (e) => KeyNav.onKeyDown(e));

// Mouse use ends keyboard mode; clicking a card makes it the keyboard anchor
document.addEventListener('mousedown', (e) => {
  KeyNav.active = false;
  const card = e.target.closest && e.target.closest('#bookmarks-grid .bookmark-card');
  if (card) AppState.focusedId = card.getAttribute('data-id');
}, true);
