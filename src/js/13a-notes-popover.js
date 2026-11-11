/* --------------------------------------------------------------------------
   8B. NOTES POPOVER
   Cards show a notes icon instead of the note text; clicking it (or pressing I
   on a focused card) opens this small panel next to the icon.
   -------------------------------------------------------------------------- */
const NotesPopover = {
  el: null,
  forId: null,
  anchor: null,

  toggle(anchor, bm) {
    if (this.el && this.forId === bm.id) { this.hide(); return; }
    this.show(anchor, bm);
  },

  show(anchor, bm) {
    this.hide();
    const el = document.createElement('div');
    el.className = 'notes-popover';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Notes for ' + (bm.title || bm.url));
    el.innerHTML = `
      <div class="notes-popover-head">
        <svg class="icon icon-sm"><use href="#icon-note"/></svg>
        <span class="notes-popover-title">${escapeHTML(bm.title || extractDomain(bm.url) || 'Notes')}</span>
        <button class="action-btn" data-np="close" title="Close (Esc)" aria-label="Close"><svg class="icon icon-sm"><use href="#icon-x"/></svg></button>
      </div>
      <div class="notes-popover-body" tabindex="0">${escapeHTML(bm.description)}</div>
      <div class="notes-popover-foot">
        <button class="btn btn-secondary" data-np="copy"><svg class="icon icon-sm"><use href="#icon-copy"/></svg>Copy</button>
        ${bm.isTrash ? '' : '<button class="btn btn-secondary" data-np="edit"><svg class="icon icon-sm"><use href="#icon-edit"/></svg>Edit</button>'}
      </div>`;
    document.body.appendChild(el);
    this.el = el;
    this.forId = bm.id;
    this.anchor = anchor;
    if (anchor) anchor.setAttribute('aria-expanded', 'true');
    this.position();

    el.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-np]');
      if (!btn) return;
      const action = btn.getAttribute('data-np');
      if (action === 'close') this.hide(true);
      if (action === 'copy') {
        try { await navigator.clipboard.writeText(bm.description || ''); showToast('Notes copied', 'success'); }
        catch (err) { showToast('Could not copy notes', 'danger'); }
      }
      if (action === 'edit') { this.hide(); openBookmarkModal(bm); }
    });
    el.querySelector('.notes-popover-body').focus({ preventScroll: true });
  },

  // Below the icon, right-aligned to it; flips above / clamps to stay on screen
  position() {
    if (!this.el || !this.anchor || !this.anchor.isConnected) return;
    const r = this.anchor.getBoundingClientRect();
    const w = this.el.offsetWidth, h = this.el.offsetHeight, m = 10;
    let left = Math.min(Math.max(m, r.right - w), window.innerWidth - w - m);
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - m) top = Math.max(m, r.top - h - 6);
    this.el.style.left = left + 'px';
    this.el.style.top = top + 'px';
  },

  hide(refocus) {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    const id = this.forId;
    this.forId = null;
    if (this.anchor) this.anchor.setAttribute('aria-expanded', 'false');
    this.anchor = null;
    if (refocus) {
      const card = KeyNav.cardById(id);
      if (card) KeyNav.focus(card, { scroll: false });
    }
  },
};

// Close on outside click, scroll or resize
document.addEventListener('mousedown', (e) => {
  if (!NotesPopover.el) return;
  if (NotesPopover.el.contains(e.target) || e.target.closest('[data-action="show-notes"]')) return;
  NotesPopover.hide();
}, true);
window.addEventListener('resize', () => NotesPopover.hide());
document.addEventListener('scroll', (e) => {
  if (NotesPopover.el && !NotesPopover.el.contains(e.target)) NotesPopover.hide();
}, true);
