// Auto-restore file handle from IndexedDB
if (window.showSaveFilePicker || window.showOpenFilePicker) {
  let markReady;
  AppState.handleReady = new Promise((resolve) => { markReady = resolve; });
  retrieveFileHandle().then(async (handle) => {
    if (handle) {
      AppState.fileHandle = handle;
      try {
        AppState.writePermission = handle.queryPermission
          ? await handle.queryPermission({ mode: 'readwrite' })
          : 'granted';
      } catch (e) { AppState.writePermission = 'prompt'; }
      markReady();
      AppState.notify();
      // A backup restored from the browser means edits never reached disk: push them now if we can
      if (AppState.isDirty) AppState.scheduleAutoSave();
      try {
        const file = await handle.getFile();
        AppState.lastDiskMtime = file.lastModified;
        await QuineEngine.syncFromDisk();
      } catch (e) {}
      AppState.notify();
    }
  }).finally(() => markReady());
}

// Multi-browser live synchronization listeners
window.addEventListener('focus', () => {
  if (typeof QuineEngine !== 'undefined' && QuineEngine.syncFromDisk) {
    QuineEngine.syncFromDisk();
  }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && typeof QuineEngine !== 'undefined' && QuineEngine.syncFromDisk) {
    QuineEngine.syncFromDisk();
  }
});
setInterval(() => {
  if (typeof QuineEngine !== 'undefined' && QuineEngine.syncFromDisk) {
    QuineEngine.syncFromDisk();
  }
}, 3000);
