const QuineEngine = {
  getAppFilename() {
    try {
      const path = window.location.pathname;
      const name = path.substring(path.lastIndexOf('/') + 1);
      if (name && (name.endsWith('.html') || name.endsWith('.htm'))) {
        return decodeURIComponent(name);
      }
    } catch (e) {}
    return 'index.html';
  },

  serialize() {
    // Start from the page exactly as it loaded (not the live DOM, which browser
    // extensions and runtime state can touch), and drop anything foreign.
    const clone = cleanseDocument(RUNNING.pristine.cloneNode(true));
    const theme = AppState.data.settings && AppState.data.settings.theme;
    if (theme && theme !== 'system') clone.setAttribute('data-theme', theme); else clone.removeAttribute('data-theme');

    // Clear dynamic app container so saved HTML stays pristine
    const appEl = clone.querySelector('#app');
    if (appEl) appEl.innerHTML = '';

    // Clear any open toasts or context menus
    const toastEl = clone.querySelector('#toast-container');
    if (toastEl) toastEl.innerHTML = '';
    const modalEl = clone.querySelector('#modal-container');
    if (modalEl) modalEl.innerHTML = '';
    const contextMenu = clone.querySelector('#custom-context-menu');
    if (contextMenu) contextMenu.remove();

    // Update embedded data script
    const dataScript = clone.querySelector('#promarker-data');
    if (dataScript) {
      const exportData = JSON.parse(JSON.stringify(AppState.data));
      const now = Date.now();
      exportData._lastSaved = now;
      AppState.data._lastSaved = now;
      delete exportData._backupTime;
      delete AppState.data._backupTime;
      // Escape every "<" so no bookmark text (closing script tags, HTML comments) can break the HTML parser.
      // < is still valid JSON and parses back to "<".
      const jsonText = JSON.stringify(exportData, null, 2).replace(/</g, '\\u003c');
      dataScript.textContent = '\n' + jsonText + '\n';
    }

    return '<!DOCTYPE html>\n' + clone.outerHTML;
  },

  async ensureWritePermission(handle, promptUser = true) {
    if (!handle) return false;
    try {
      const opts = { mode: 'readwrite' };
      if (handle.queryPermission) {
        const status = await handle.queryPermission(opts);
        AppState.writePermission = status;
        if (status === 'granted') return true;
      }
      if (promptUser && handle.requestPermission) {
        const status = await handle.requestPermission(opts);
        AppState.writePermission = status;
        return status === 'granted';
      }
      if (!handle.queryPermission) { AppState.writePermission = 'granted'; return true; }
      return false;
    } catch (e) {
      // Silently returns false if requestPermission lacks user gesture
      return false;
    }
  },

  _writeChain: Promise.resolve(),

  // Writes are queued so a manual save and an autosave never overlap on disk.
  writeToHandle(handle, isAutoSave = false) {
    const run = () => this._doWrite(handle, isAutoSave);
    const p = this._writeChain.then(run, run);
    this._writeChain = p.catch(() => {});
    return p;
  },

  // Build id of the running code (set by build.js); used to avoid an old tab
  // overwriting a newer ProMarker version on disk.
  runningBuild: (document.querySelector('meta[name="promarker-build"]') || {}).content || '',

  buildOf(text) {
    const m = text.match(/<meta name="promarker-build" content="([^"]*)"/);
    return m ? m[1] : '';
  },


  announceUpdate() {
    if (AppState.codeUpdated) return;
    AppState.codeUpdated = true;
    AppState.isSaving = false;
    showToast('A newer ProMarker version is in this file — reload to keep saving', 'info', {
      label: 'Reload',
      onClick: () => location.reload()
    });
    AppState.notify();
  },

  async _doWrite(handle, isAutoSave) {
    // Verify what's on disk before replacing it
    let check = null;
    try { check = inspectProMarkerFile(await (await handle.getFile()).text()); } catch (e) { check = null; }
    if (AppState.codeUpdated || (check && check.newer)) {
      // Keep edits dirty + backed up; they are restored after reloading the new version
      this.announceUpdate();
      AppState.isSaving = false;
      return false;
    }
    if (check && !AppState.repairApproved && (!check.isProMarker || check.problems.length)) {
      AppState.isSaving = false;
      raiseIntegrityAlert(handle.name, check);
      return false;
    }
    const revAtSerialize = AppState.revision;
    const html = this.serialize();
    const writable = await handle.createWritable();
    await writable.write(html);
    await writable.close();
    AppState.writePermission = 'granted';
    if (AppState.repairApproved) showToast(`${handle.name} restored to a clean ProMarker file`, 'success');
    AppState.repairApproved = false;
    AppState.integrity = null;

    AppState.isSaving = false;
    if (AppState.revision === revAtSerialize) {
      AppState.isDirty = false;
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    } else {
      // Edits arrived while writing: keep them dirty (and backed up) and save again
      AppState.scheduleAutoSave();
    }
    try {
      const file = await handle.getFile();
      AppState.lastDiskMtime = file.lastModified;
    } catch (e) {}

    AppState.lastSavedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (!isAutoSave) {
      showToast(`Saved directly to ${handle.name}`, 'success');
    }
    AppState.notify();
    return true;
  },

  async autoSave() {
    if (!AppState.isDirty || !AppState.fileHandle) return false;
    if (AppState._isSyncing) { AppState.scheduleAutoSave(); return false; }

    try {
      // Check write permission without prompting (cannot prompt inside setTimeout)
      const hasPerm = await this.ensureWritePermission(AppState.fileHandle, false);
      if (!hasPerm) {
        // Permission not active in this session: the status card now shows "Resume".
        AppState.notify();
        return false;
      }

      AppState.isSaving = true;
      AppState.notify();

      await this.writeToHandle(AppState.fileHandle, true);
      return true;
    } catch (err) {
      console.warn('Auto-save write error:', err);
      AppState.isSaving = false;
      AppState.notify();
      return false;
    }
  },

  async save() {
    const filename = this.getAppFilename();
    // Ctrl+S right after opening: wait for the remembered link instead of asking again
    try { await AppState.handleReady; } catch (e) {}

    // 1. If a file is already linked, save directly to it! NEVER open a save-to-folder modal!
    if (AppState.fileHandle) {
      try {
        AppState.isSaving = true;
        AppState.notify();

        const hasPerm = await this.ensureWritePermission(AppState.fileHandle, true);
        if (!hasPerm) {
          AppState.isSaving = false;
          AppState.notify();
          showToast(`Write permission required to save to ${AppState.fileHandle.name}`, 'warning');
          return false;
        }

        await this.writeToHandle(AppState.fileHandle, false);
        return true;
      } catch (err) {
        AppState.isSaving = false;
        AppState.notify();
        console.warn('File handle write error:', err);

        if (err.name === 'NotFoundError') {
          AppState.fileHandle = null;
          await clearStoredFileHandle();
          showToast('Linked file was not found on disk. Please link the file again.', 'warning');
          AppState.notify();
          return false;
        }

        if (err.name === 'NotAllowedError') {
          showToast(`Write permission was not granted for ${AppState.fileHandle.name}`, 'warning');
          return false;
        }

        showToast('Error saving file: ' + err.message, 'error');
        return false;
      }
    }

    // 2. If no file is linked yet, prompt user to link index.html
    if (window.showOpenFilePicker) {
      return await this.connectFile();
    }

    // 3. Fallback for environments where showOpenFilePicker is not available
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'HTML Bookmark App',
            accept: { 'text/html': ['.html', '.htm'] }
          }]
        });
        AppState.fileHandle = handle;
        await storeFileHandle(handle);
        await this.writeToHandle(handle, false);
        return true;
      } catch (err) {
        if (err.name === 'AbortError') return false;
        console.warn('Save picker error:', err);
      }
    }

    // 4. No direct file access (Brave without flag, Safari, Firefox): download a copy.
    //    The original file is NOT updated, so keep the browser backup and the unsaved state.
    const html = this.serialize();
    this.downloadFile(html, filename);
    AppState.downloadedRevision = AppState.revision;
    AppState.lastSavedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    showToast(`Downloaded a copy of ${filename} — ${FileSupport.browserName()} can't save into the original`, 'info', {
      label: 'Why?',
      onClick: () => openFileHelpModal()
    });
    AppState.notify();
    return true;
  },

  async connectFile() {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          id: 'promarker-file',       // browser reopens the picker in the same folder
          types: [{
            description: 'HTML Bookmark App',
            accept: { 'text/html': ['.html', '.htm'] }
          }],
          multiple: false
        });

        if (!handle) return false;

        // Only ever link a ProMarker file, so we never overwrite something else
        let picked = null;
        try { picked = inspectProMarkerFile(await (await handle.getFile()).text()); } catch (e) { picked = null; }
        if (!picked || !picked.isProMarker) {
          openSecurityNotice(
            'Not a ProMarker file',
            `<b>${escapeHTML(handle.name)}</b> doesn't contain ProMarker bookmarks, so it was <b>not linked</b> and nothing was written to it. Pick the ProMarker HTML file you opened (usually <b>${escapeHTML(this.getAppFilename())}</b>).`
          );
          return false;
        }

        // Edits here AND a newer save in the file: ask which to keep *before* linking,
        // so nothing (autosave included) can write to the file while the question is open.
        let keepLocalEdits = true;
        if (!picked.problems.length && AppState.isDirty) {
          const diskTime = picked.data._lastSaved || 0;
          const memTime = (AppState.data && AppState.data._lastSaved) || 0;
          if (diskTime > (AppState.lastEditAt || memTime)) {
            const choice = await confirmDialog({
              title: `${handle.name} has newer changes`,
              message: `It was saved somewhere else after your latest edits in this browser. Which version do you want to keep? The other one is replaced.`,
              icon: 'refresh',
              buttons: [
                { label: 'Cancel', value: null, kind: 'secondary' },
                { label: 'Use the file’s version', value: 'disk', kind: 'secondary' },
                { label: 'Keep my edits', value: 'local', kind: 'primary', focus: true },
              ],
              dismissValue: null,
            });
            if (choice === null) return false;
            keepLocalEdits = choice === 'local';
          }
        }

        // Immediately link and persist the handle
        AppState.fileHandle = handle;
        AppState.writePermission = 'unknown';
        const remembered = await storeFileHandle(handle);
        if (!remembered) {
          showToast('Linked for now, but the browser would not remember it — you may need to link again after reopening', 'info');
        }
        const pageName = this.getAppFilename();
        if (handle.name !== pageName) {
          showToast(`Heads up: you linked ${handle.name}, but this page is ${pageName}. Saves will go to ${handle.name}.`, 'info');
        }
        if (picked.problems.length) {
          raiseIntegrityAlert(handle.name, picked);
          return true;
        }

        // Read file content and inspect embedded store
        let diskData = null;
        try {
          const file = await handle.getFile();
          AppState.lastDiskMtime = file.lastModified;
          const text = await file.text();
          const match = text.match(/<script id="promarker-data" type="application\/json">([\s\S]*?)<\/script>/i);
          if (match) {
            try {
              diskData = sanitizeData(JSON.parse(match[1]));
            } catch (e) {}
          }
        } catch (e) {
          console.warn('Error reading linked file:', e);
        }

        if (diskData) {
          const diskTime = diskData._lastSaved || 0;

          // No local edits: the file is the truth. With local edits, keep them unless the file
          // was saved by someone else *after* our newest edit — then ask.
          // (the choice between the two was made before linking, above)
          const useDisk = !AppState.isDirty || !keepLocalEdits;
          if (useDisk) {
            AppState.data = diskData;
            AppState.isDirty = false;
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            AppState.lastSavedTime = diskTime ? new Date(diskTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            showToast(`Linked to ${handle.name}!`, 'success');
            AppState.notify();
            return true;
          }
        }

        // If current state has unsaved edits, save them directly to the linked file
        showToast(`Linked to ${handle.name}!`, 'success');
        if (AppState.isDirty) {
          await this.save();
        } else {
          AppState.notify();
        }
        return true;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Picker error:', err);
          showToast('Could not link file: ' + err.message, 'error');
        }
        return false;
      }
    } else if (window.showSaveFilePicker) {
      return this.save();
    } else {
      return this.save();
    }
  },

  async syncFromDisk() {
    if (!AppState.fileHandle || AppState.isDirty || AppState.isSaving || AppState._isSyncing) return false;

    try {
      AppState._isSyncing = true;
      const file = await AppState.fileHandle.getFile();

      if (!AppState.lastDiskMtime) {
        AppState.lastDiskMtime = file.lastModified;
        AppState._isSyncing = false;
        return false;
      }

      if (file.lastModified > AppState.lastDiskMtime) {
        const text = await file.text();
        if (this.buildOf(text) > this.runningBuild) { this.announceUpdate(); return false; }
        const check = inspectProMarkerFile(text);
        if (!check.isProMarker || check.problems.length) {
          AppState.lastDiskMtime = file.lastModified;
          raiseIntegrityAlert(AppState.fileHandle.name, check);
          return false;
        }
        const match = text.match(/<script id="promarker-data" type="application\/json">([\s\S]*?)<\/script>/i);
        if (match) {
          const diskData = sanitizeData(JSON.parse(match[1]));
          if (!diskData) return false;
          const diskTime = diskData._lastSaved || 0;
          const memTime = (AppState.data && AppState.data._lastSaved) || 0;

          if (diskTime > memTime) {
            AppState.data = diskData;
            AppState.lastDiskMtime = file.lastModified;
            AppState.isDirty = false;
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            AppState.lastSavedTime = new Date(diskTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            AppState.notify();
            showToast('Updated bookmarks reloaded from disk!', 'info');
            AppState._isSyncing = false;
            return true;
          } else {
            AppState.lastDiskMtime = file.lastModified;
          }
        }
      }
    } catch (e) {
      // Background sync error ignored
    } finally {
      AppState._isSyncing = false;
    }
    return false;
  },

  downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || this.getAppFilename();
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  }
};
