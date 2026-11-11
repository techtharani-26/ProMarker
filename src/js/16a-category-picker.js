/* --------------------------------------------------------------------------
   11A. CATEGORY PICKER
   Replaces a native <select> of categories with a styled dropdown showing each
   category's icon and color. The hidden <select> keeps the value, so existing
   code that reads select.value keeps working.
   Keys: ↑ ↓ Home End to move, Enter/Space to pick, Esc to close, letters to jump.
   -------------------------------------------------------------------------- */
function enhanceCategorySelect(select) {
  if (!select || select.dataset.enhanced) return;
  select.dataset.enhanced = '1';
  select.classList.add('cs-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  const catById = (id) => AppState.data.categories.find(c => c.id === id);
  const iconHtml = (cat) => cat
    ? `<svg class="icon icon-sm" style="color: ${cat.color};"><use href="#icon-${cat.icon}"/></svg>`
    : '<svg class="icon icon-sm"><use href="#icon-folder"/></svg>';
  const options = () => Array.from(select.options);
  const label = select.id ? document.querySelector(`label[for="${select.id}"]`) : null;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'cs-trigger form-select';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  if (label) { label.id = label.id || select.id + '-label'; trigger.setAttribute('aria-labelledby', label.id); }
  select.after(trigger);

  const paint = () => {
    const opt = select.options[select.selectedIndex];
    const cat = opt && catById(opt.value);
    trigger.innerHTML = `${iconHtml(cat)}<span class="cs-value">${escapeHTML(opt ? opt.textContent.trim() : 'Choose…')}</span>`;
  };
  paint();

  let list = null;
  let active = -1;

  const setActive = (i) => {
    const items = list ? Array.from(list.children) : [];
    if (!items.length) return;
    active = (i + items.length) % items.length;
    items.forEach((el, n) => el.classList.toggle('active', n === active));
    items[active].scrollIntoView({ block: 'nearest' });
    list.setAttribute('aria-activedescendant', items[active].id);
  };

  const close = (refocus = true) => {
    if (!list) return;
    list.remove();
    list = null;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', outside, true);
    window.removeEventListener('resize', reposition);
    document.removeEventListener('scroll', onScroll, true);
    if (refocus) trigger.focus();
  };

  const choose = (i) => {
    const opt = options()[i];
    if (!opt) return;
    const changed = select.value !== opt.value;
    select.value = opt.value;
    paint();
    close();
    if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const reposition = () => {
    if (!list) return;
    const r = trigger.getBoundingClientRect();
    const h = Math.min(list.scrollHeight, 280);
    const below = window.innerHeight - r.bottom - 8;
    list.style.left = r.left + 'px';
    list.style.width = r.width + 'px';
    list.style.top = (below >= Math.min(h, 160) ? r.bottom + 4 : Math.max(8, r.top - h - 4)) + 'px';
  };
  const outside = (e) => { if (list && !list.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) close(false); };
  const onScroll = (e) => { if (list && !list.contains(e.target)) close(false); };

  const open = () => {
    if (list) return;
    list = document.createElement('div');
    list.className = 'cs-list';
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    const base = (select.id || 'cs') + '-opt-';
    list.innerHTML = options().map((opt, i) => {
      const cat = catById(opt.value);
      const depth = Number(opt.dataset.depth || 0);
      const selected = i === select.selectedIndex;
      const labelText = depth > 0 && cat ? cat.name : opt.textContent.trim();
      return `<div class="cs-option${selected ? ' selected' : ''}" role="option" id="${base}${i}" aria-selected="${selected}" data-i="${i}" style="${depth > 0 ? `padding-left: ${10 + depth * 16}px;` : ''}">
        ${depth > 0 ? '<span class="cs-sub-indent">↳</span>' : ''}${iconHtml(cat)}<span>${escapeHTML(labelText)}</span>
        <svg class="icon icon-sm cs-check"><use href="#icon-check"/></svg>
      </div>`;
    }).join('');
    document.body.appendChild(list);
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-controls', list.id = base + 'list');
    reposition();
    setActive(Math.max(0, select.selectedIndex));
    list.addEventListener('mousemove', (e) => { const o = e.target.closest('.cs-option'); if (o) setActive(Number(o.dataset.i)); });
    list.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus on the trigger
    list.addEventListener('click', (e) => { const o = e.target.closest('.cs-option'); if (o) choose(Number(o.dataset.i)); });
    document.addEventListener('mousedown', outside, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('scroll', onScroll, true);
  };

  trigger.addEventListener('click', () => (list ? close() : open()));
  trigger.addEventListener('keydown', (e) => {
    const n = options().length;
    const handled = () => { e.preventDefault(); e.stopPropagation(); };
    if (!list) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { handled(); open(); }
      return;
    }
    if (e.key === 'Escape') { handled(); close(); }
    else if (e.key === 'ArrowDown') { handled(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { handled(); setActive(active - 1); }
    else if (e.key === 'Home') { handled(); setActive(0); }
    else if (e.key === 'End') { handled(); setActive(n - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { handled(); choose(active); }
    else if (e.key === 'Tab') { close(false); }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      // type-ahead: jump to the next category starting with that letter
      const k = e.key.toLowerCase();
      const opts = options();
      for (let step = 1; step <= n; step++) {
        const i = (active + step) % n;
        if (opts[i].textContent.trim().toLowerCase().startsWith(k)) { handled(); setActive(i); break; }
      }
    }
  });

  // If code changes the hidden select, keep the trigger in sync
  select.addEventListener('change', paint);
  // Clean up a popup left open when the dialog closes
  const observer = new MutationObserver(() => { if (!trigger.isConnected) { close(false); observer.disconnect(); } });
  observer.observe(document.getElementById('modal-container'), { childList: true });
  return trigger;
}
