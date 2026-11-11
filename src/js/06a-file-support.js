/* --------------------------------------------------------------------------
   3A. FILE SUPPORT DETECTION & HELP
   Saving into the same file needs the File System Access API
   (Chrome, Edge, Opera, Arc; Brave only with a flag). Elsewhere we can only
   download an updated copy, so we say so plainly instead of silently
   producing "index (1).html", "index (2).html", ...
   -------------------------------------------------------------------------- */
const FileSupport = {
  canLink: typeof window.showOpenFilePicker === 'function',
  isBrave: !!(navigator.brave && typeof navigator.brave.isBrave === 'function'),
  TIP_KEY: 'promarker_hide_fs_tip:' + FILE_SCOPE,

  browserName() {
    const ua = navigator.userAgent;
    if (this.isBrave) return 'Brave';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'this browser';
  },

  tipHidden() {
    try { return localStorage.getItem(this.TIP_KEY) === '1'; } catch (e) { return false; }
  },
  hideTip() {
    try { localStorage.setItem(this.TIP_KEY, '1'); } catch (e) {}
  },
};

function openFileHelpModal() {
  const name = FileSupport.browserName();
  const file = escapeHTML(QuineEngine.getAppFilename());
  const step = (n, html) => `<li class="help-step"><span class="help-step-num">${n}</span><div>${html}</div></li>`;
  const copyFlag = `<button class="btn btn-secondary help-copy" data-copy="brave://flags/#file-system-access-api" style="height: 26px; padding: 0 8px; font-size: 12px;">
      <svg class="icon icon-sm"><use href="#icon-copy"/></svg>Copy</button>`;

  let body;
  if (FileSupport.canLink) {
    body = `
      <p class="help-lead">${name} can save straight into <b>${file}</b>. Link it once:</p>
      <ol class="help-steps">
        ${step(1, 'Click <b>Link File</b> (bottom of the sidebar).')}
        ${step(2, `In the file picker choose this same file, <b>${file}</b>.`)}
        ${step(3, 'Allow editing when the browser asks. After a browser restart it asks once more — click <b>Resume</b> in the sidebar.')}
      </ol>`;
  } else if (FileSupport.isBrave) {
    body = `
      <p class="help-lead">Brave turns off direct file saving by default, so <kbd class="kbd">${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'}</kbd> <kbd class="kbd">S</kbd> can only download a new copy. Turn it on once:</p>
      <ol class="help-steps">
        ${step(1, `Open a new tab and paste <code>brave://flags/#file-system-access-api</code> ${copyFlag}`)}
        ${step(2, 'Set <b>File System Access API</b> to <b>Enabled</b>, then click <b>Relaunch</b>.')}
        ${step(3, `Reopen <b>${file}</b>, click <b>Link File</b> and pick this same file. Every save then goes into it.`)}
      </ol>`;
  } else {
    body = `
      <p class="help-lead">${name} doesn't let web pages write to files on your disk, so saving here can only <b>download a new copy</b>.</p>
      <ol class="help-steps">
        ${step(1, `For autosave into <b>${file}</b>, open it in <b>Chrome</b>, <b>Edge</b> or <b>Brave</b> (with its flag on) and click <b>Link File</b>.`)}
        ${step(2, `To keep using ${name}: press save, then replace your original <b>${file}</b> with the downloaded copy.`)}
      </ol>`;
  }

  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay active">
      <div class="modal" style="max-width: 540px;">
        <div class="modal-header">
          <h3 class="modal-title">${FileSupport.canLink ? 'Save into this file' : 'Why does saving download a new file?'}</h3>
          <button class="btn btn-icon-only" id="btn-close-modal"><svg class="icon"><use href="#icon-x"/></svg></button>
        </div>
        <div class="modal-body">
          ${body}
          <p class="help-note">Your edits are never lost meanwhile: they're kept in this browser and come back when you reopen ${file} here.
          ${!FileSupport.canLink ? 'If the browser asks where to save every download, you can turn that off in its download settings.' : ''}</p>
        </div>
        <div class="modal-footer">
          ${FileSupport.canLink && !AppState.fileHandle ? '<button class="btn btn-secondary" id="btn-help-link">Link File</button>' : ''}
          <button class="btn btn-primary" id="btn-help-done">Got it</button>
        </div>
      </div>
    </div>`;

  const close = () => { document.getElementById('modal-container').innerHTML = ''; };
  document.getElementById('btn-close-modal').onclick = close;
  document.getElementById('btn-help-done').onclick = close;
  const linkBtn = document.getElementById('btn-help-link');
  if (linkBtn) linkBtn.onclick = () => { close(); QuineEngine.connectFile(); };
  document.querySelectorAll('.help-copy').forEach(btn => {
    btn.onclick = async () => {
      try { await navigator.clipboard.writeText(btn.getAttribute('data-copy')); showToast('Copied — paste it into a new tab', 'success'); }
      catch (e) { showToast('Select and copy the address manually', 'info'); }
    };
  });
}
