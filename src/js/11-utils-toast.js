/* --------------------------------------------------------------------------
   6. UTILITIES
   -------------------------------------------------------------------------- */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'info', action = null) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';

  let actionBtnHtml = '';
  if (action && action.label && typeof action.onClick === 'function') {
    actionBtnHtml = `<button class="toast-action-btn" type="button">${escapeHTML(action.label)}</button>`;
  }

  const kind = type === 'success' ? 'success' : (type === 'danger' ? 'danger' : 'info');
  const iconType = kind === 'success' ? 'check' : (kind === 'danger' ? 'trash' : 'bookmark');
  toast.className = 'toast toast-' + kind;

  toast.innerHTML = `
    <span class="toast-icon"><svg class="icon icon-sm"><use href="#icon-${iconType}"/></svg></span>
    <span class="toast-msg">${escapeHTML(message)}</span>
    ${actionBtnHtml}
  `;

  if (action && action.onClick) {
    const btn = toast.querySelector('.toast-action-btn');
    if (btn) {
      btn.onclick = (e) => {
        e.stopPropagation();
        action.onClick();
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      };
    }
  }

  container.appendChild(toast);
  const duration = action ? 5000 : 2800;
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 200ms ease';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  }, duration);
}
