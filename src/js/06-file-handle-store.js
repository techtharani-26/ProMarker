/* --------------------------------------------------------------------------
   3. QUINE ENGINE (In-Place File System Overwrite & Serializer)
   -------------------------------------------------------------------------- */
const FS_DB_NAME = 'promarker_fs';
const FS_STORE_NAME = 'handles';
const HANDLE_KEY = 'activeFile:' + FILE_SCOPE;

function getFsDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return resolve(null);
    try {
      const req = indexedDB.open(FS_DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(FS_STORE_NAME)) {
          req.result.createObjectStore(FS_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function storeFileHandle(handle) {
  try {
    const db = await getFsDb();
    if (!db) return false;
    const tx = db.transaction(FS_STORE_NAME, 'readwrite');
    tx.objectStore(FS_STORE_NAME).put(handle, HANDLE_KEY);
    return await new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => resolve(false);
    });
  } catch (e) {
    console.warn('Could not store file handle in IndexedDB:', e);
    return false;
  }
}

async function retrieveFileHandle() {
  try {
    const db = await getFsDb();
    if (!db) return null;
    const tx = db.transaction(FS_STORE_NAME, 'readonly');
    const store = tx.objectStore(FS_STORE_NAME);
    return await new Promise((resolve) => {
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function clearStoredFileHandle() {
  try {
    const db = await getFsDb();
    if (!db) return;
    const tx = db.transaction(FS_STORE_NAME, 'readwrite');
    tx.objectStore(FS_STORE_NAME).delete(HANDLE_KEY);
  } catch (e) {}
}
