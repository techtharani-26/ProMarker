/* --------------------------------------------------------------------------
   3B. FILE INTEGRITY ALERTS
   Shown when the linked file is not ProMarker any more, or its code was changed
   by something other than ProMarker. Saving pauses until you decide.
   -------------------------------------------------------------------------- */
function openSecurityNotice(title, html, actions = []) {
  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal security-notice" style="max-width: 520px;" role="alertdialog" aria-labelledby="sec-title">
        <div class="modal-header">
          <h3 class="modal-title" id="sec-title">
            <svg class="icon" style="color: var(--danger);"><use href="#icon-shield"/></svg>
            ${escapeHTML(title)}
          </h3>
          <button class="btn btn-icon-only" id="btn-close-modal"><svg class="icon"><use href="#icon-x"/></svg></button>
        </div>
        <div class="modal-body"><div class="security-text">${html}</div></div>
        <div class="modal-footer">
          ${actions.map((a, i) => `<button class="btn ${a.primary ? (a.danger ? 'btn-danger' : 'btn-primary') : 'btn-secondary'}" data-sec-action="${i}">${escapeHTML(a.label)}</button>`).join('')}
          ${actions.length ? '' : '<button class="btn btn-primary" data-sec-close>OK</button>'}
        </div>
      </div>
    </div>`;
  const close = () => { mc.innerHTML = ''; };
  document.getElementById('btn-close-modal').onclick = close;
  const ok = mc.querySelector('[data-sec-close]');
  if (ok) ok.onclick = close;
  mc.querySelectorAll('[data-sec-action]').forEach(btn => {
    btn.onclick = () => { close(); actions[Number(btn.getAttribute('data-sec-action'))].onClick(); };
  });
}

function raiseIntegrityAlert(fileName, check) {
  const first = !AppState.integrity;
  AppState.integrity = { fileName, isProMarker: !!(check && check.isProMarker), problems: (check && check.problems) || [] };
  AppState.notify();
  if (first) openIntegrityModal();
}

function openIntegrityModal() {
  const info = AppState.integrity;
  if (!info) return;
  const name = escapeHTML(info.fileName);
  const what = info.isProMarker
    ? `<p><b>${name}</b> was changed by something other than ProMarker:</p>
       <ul class="security-list">${info.problems.map(p => `<li>${escapeHTML(p)}</li>`).join('')}</ul>
       <p>This can be another program, an older ProMarker copy, or a malicious page. Code added this way is blocked from running here, but it would stay in the file.</p>`
    : `<p><b>${name}</b> no longer contains ProMarker bookmarks — it may have been replaced with a different file.</p>`;
  openSecurityNotice('Saving paused: file changed outside ProMarker', `
    ${what}
    <p><b>Restore clean file</b> rewrites ${name} with this page's original code and the bookmarks you see now, replacing the changed version. <b>Download clean copy</b> saves a separate clean file and leaves ${name} untouched.</p>`, [
    { label: 'Download clean copy', onClick: () => { QuineEngine.downloadFile(QuineEngine.serialize(), 'ProMarker-clean-copy.html'); openIntegrityModal(); } },
    { label: 'Keep paused', onClick: () => {} },
    { label: 'Restore clean file', primary: true, danger: true, onClick: () => { AppState.repairApproved = true; QuineEngine.save(); } },
  ]);
}
