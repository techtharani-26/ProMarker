/* --------------------------------------------------------------------------
   6a. CONFIRM DIALOG (styled replacement for window.confirm)
   confirmDialog({ title, message, confirmLabel, cancelLabel, danger }) → Promise<boolean>
   Several choices: confirmDialog({ title, message, buttons: [{ label, value, kind }], dismissValue })
   resolves with the chosen button's value; Esc / clicking outside gives dismissValue.
   Lives in its own layer above other dialogs, so it can open on top of Settings.
   -------------------------------------------------------------------------- */
const ConfirmDialog = {
  el: null,
  resolve: null,
  prevFocus: null,

  open(opts) {
    if (this.el) this.close(this.dismissValue);
    const o = Object.assign({ title: 'Are you sure?', message: '', confirmLabel: 'Confirm', cancelLabel: 'Cancel', danger: false, icon: null, buttons: null, dismissValue: false }, opts || {});
    const icon = o.icon || (o.danger ? 'trash' : 'shield');
    const buttons = o.buttons || [
      { label: o.cancelLabel, value: false, kind: 'secondary', focus: o.danger },
      { label: o.confirmLabel, value: true, kind: o.danger ? 'danger' : 'primary', focus: !o.danger },
    ];
    if (!buttons.some(b => b.focus)) buttons[buttons.length - 1].focus = true;
    this.values = buttons.map(b => b.value);
    this.dismissValue = o.dismissValue;
    this.prevFocus = document.activeElement;

    const root = document.createElement('div');
    root.className = 'modal-overlay active confirm-overlay';
    root.innerHTML = `
      <div class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <div class="confirm-body">
          <div class="confirm-icon ${o.danger ? 'danger' : ''}"><svg class="icon"><use href="#icon-${escapeHTML(icon)}"/></svg></div>
          <div class="confirm-text">
            <h3 class="modal-title" id="confirm-title">${escapeHTML(o.title)}</h3>
            ${o.message ? `<p class="confirm-message" id="confirm-message">${escapeHTML(o.message)}</p>` : ''}
          </div>
        </div>
        <div class="modal-footer">
          ${buttons.map((b, i) => `<button class="btn btn-${b.kind || 'secondary'}" type="button" data-confirm="${i}">${escapeHTML(b.label)}</button>`).join('')}
        </div>
      </div>`;
    root.addEventListener('mousedown', (e) => { if (e.target === root) this.close(this.dismissValue); });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-confirm]');
      if (b) this.close(this.values[Number(b.getAttribute('data-confirm'))]);
    });
    document.body.appendChild(root);
    this.el = root;
    // Default focus on Cancel for destructive actions, so Enter never deletes by accident
    root.querySelector(`[data-confirm="${buttons.findIndex(b => b.focus)}"]`).focus();
    return new Promise((resolve) => { this.resolve = resolve; });
  },

  close(result) {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    const r = this.resolve;
    this.resolve = null;
    if (this.prevFocus && document.contains(this.prevFocus) && this.prevFocus.focus) this.prevFocus.focus();
    if (r) r(result);
  },
};

function confirmDialog(opts) { return ConfirmDialog.open(opts); }

// While the dialog is open it owns the keyboard: Esc cancels, Tab stays inside,
// and app shortcuts (N, arrows, Cmd+Z …) don't reach the page underneath.
window.addEventListener('keydown', (e) => {
  if (!ConfirmDialog.el) return;
  if (e.key === 'Escape') { e.preventDefault(); ConfirmDialog.close(ConfirmDialog.dismissValue); }
  else if (e.key === 'Tab') {
    const btns = [...ConfirmDialog.el.querySelectorAll('button')];
    const i = btns.indexOf(document.activeElement);
    e.preventDefault();
    btns[(i + (e.shiftKey ? btns.length - 1 : 1)) % btns.length].focus();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const btns = [...ConfirmDialog.el.querySelectorAll('button')];
    const i = btns.indexOf(document.activeElement);
    btns[Math.max(0, Math.min(btns.length - 1, i + (e.key === 'ArrowLeft' ? -1 : 1)))].focus();
    e.preventDefault();
  }
  e.stopImmediatePropagation();
}, true);
