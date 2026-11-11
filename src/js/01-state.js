/* --------------------------------------------------------------------------
   1. STATE STORE & BACKUP CACHE
   -------------------------------------------------------------------------- */
// Keys are scoped to this file's path so two ProMarker copies never
// overwrite each other's backups or linked file handles (file:// pages share one origin).
const LEGACY_STORAGE_KEY = 'promarker_local_backup';
const FILE_SCOPE = (() => { try { return decodeURIComponent(location.pathname) || 'default'; } catch (e) { return 'default'; } })();
const STORAGE_KEY = LEGACY_STORAGE_KEY + ':' + FILE_SCOPE;

const DEFAULT_SEED_DATA = {
  version: 1,
  settings: {
    theme: "system",
    viewMode: "grid",
    sortBy: "custom",
    openInNewTab: true,
    trackClicks: true,
    copyFormat: "title-link",
    autoSave: true,
    fetchFavicons: true
  },
  categories: [
    { id: "cat-dev", name: "Development", icon: "code", color: "#6366f1", order: 0 },
    { id: "cat-design", name: "Design & UI", icon: "palette", color: "#ec4899", order: 1 },
    { id: "cat-ai", name: "AI & Tools", icon: "sparkles", color: "#8b5cf6", order: 2 },
    { id: "cat-news", name: "Tech & News", icon: "globe", color: "#06b6d4", order: 3 },
    { id: "cat-reading", name: "Reading & Docs", icon: "book-open", color: "#10b981", order: 4 }
  ],
  bookmarks: [
    {
      id: "bm-1",
      title: "GitHub",
      url: "https://github.com",
      description: "Where the world builds software. Code hosting, version control, collaboration.",
      categoryId: "cat-dev",
      tags: ["git", "code", "open-source"],
      isFavorite: true,
      isTrash: false,
      clickCount: 42,
      createdAt: 1700000000000,
      order: 0
    },
    {
      id: "bm-2",
      title: "MDN Web Docs",
      url: "https://developer.mozilla.org",
      description: "Resources for developers, by developers. The authority on HTML, CSS, and JavaScript.",
      categoryId: "cat-dev",
      tags: ["docs", "javascript", "reference"],
      isFavorite: true,
      isTrash: false,
      clickCount: 18,
      createdAt: 1700001000000,
      order: 1
    },
    {
      id: "bm-3",
      title: "Figma",
      url: "https://figma.com",
      description: "The collaborative interface design tool. Design, prototype, and gather feedback in one place.",
      categoryId: "cat-design",
      tags: ["design", "ui", "collaboration"],
      isFavorite: true,
      isTrash: false,
      clickCount: 35,
      createdAt: 1700002000000,
      order: 2
    },
    {
      id: "bm-4",
      title: "Tailwind CSS",
      url: "https://tailwindcss.com",
      description: "A utility-first CSS framework packed with classes that can be composed to build any design.",
      categoryId: "cat-design",
      tags: ["css", "framework", "styling"],
      isFavorite: false,
      isTrash: false,
      clickCount: 9,
      createdAt: 1700003000000,
      order: 3
    },
    {
      id: "bm-5",
      title: "ChatGPT",
      url: "https://chatgpt.com",
      description: "Conversational AI model for drafting, coding, brainstorms, and analysis.",
      categoryId: "cat-ai",
      tags: ["ai", "assistant", "productivity"],
      isFavorite: true,
      isTrash: false,
      clickCount: 54,
      createdAt: 1700004000000,
      order: 4
    },
    {
      id: "bm-6",
      title: "Hugging Face",
      url: "https://huggingface.co",
      description: "The AI community building the future. Open-source models, datasets, and ML spaces.",
      categoryId: "cat-ai",
      tags: ["ai", "models", "ml"],
      isFavorite: false,
      isTrash: false,
      clickCount: 12,
      createdAt: 1700005000000,
      order: 5
    },
    {
      id: "bm-7",
      title: "Hacker News",
      url: "https://news.ycombinator.com",
      description: "A social news website focusing on computer science, entrepreneurship, and technology.",
      categoryId: "cat-news",
      tags: ["news", "tech", "community"],
      isFavorite: false,
      isTrash: false,
      clickCount: 27,
      createdAt: 1700006000000,
      order: 6
    },
    {
      id: "bm-8",
      title: "DevDocs API Documentation",
      url: "https://devdocs.io",
      description: "Fast, offline, and free documentation browser for developers with 100+ API docs.",
      categoryId: "cat-reading",
      tags: ["docs", "offline", "reference"],
      isFavorite: false,
      isTrash: false,
      clickCount: 7,
      createdAt: 1700007000000,
      order: 7
    }
  ]
};

// Load initial state from embedded JSON script tag
let bootFromBackup = false; // true when unsaved browser edits were newer than the file
function loadInitialState() {
  let state = null;
  try {
    const raw = document.getElementById('promarker-data').textContent;
    state = sanitizeData(JSON.parse(raw));
  } catch (e) {
    console.error('Error parsing embedded data:', e);
  }

  // Check if there is an unsaved emergency backup in localStorage that is genuinely newer
  try {
    // Remove legacy unscoped backup key so shared-origin pages cannot inject state via it
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const backupRaw = localStorage.getItem(STORAGE_KEY);
    if (backupRaw) {
      const backup = sanitizeData(JSON.parse(backupRaw));
      const diskTime = (state && state._lastSaved) || 0;
      const now = Date.now();
      // Only restore if backup is genuinely newer than disk data by > 1000ms and not future-dated
      if (backup && backup._backupTime && backup._backupTime <= now + 5000 && backup._backupTime > diskTime + 1000) {
        console.log('Restoring from newer localStorage backup');
        state = backup;
        bootFromBackup = true;
      } else {
        // Obsolete, redundant, or future-dated local backup — clean up
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch (e) {
    console.warn('LocalStorage access error:', e);
  }

  return state || JSON.parse(JSON.stringify(DEFAULT_SEED_DATA));
}

const initialData = loadInitialState();

const AppState = {
  data: initialData,
  activeCategory: 'all', // 'all', 'favorites', 'recent', 'archive', 'trash', or categoryId
  activeTag: null,
  searchQuery: '',
  selectedIds: new Set(),
  collapsedCats: new Set(),    // parent category IDs collapsed in the sidebar
  focusedId: null,             // card that keyboard navigation is on
  isDirty: bootFromBackup,
  isSaving: false,
  lastSavedTime: (initialData && initialData._lastSaved) ? new Date(initialData._lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null,
  fileHandle: null,
  lastDiskMtime: 0,
  _isSyncing: false,
  sidebarCollapsed: window.innerWidth <= 900,
  editingBookmarkId: null,
  editingCategoryId: null,
  _autoSaveTimer: null,
  integrity: null,             // set when the linked file was changed outside ProMarker
  repairApproved: false,       // user chose to overwrite it with a clean copy
  lastEditAt: 0,               // time of the newest unsaved edit
  downloadedRevision: -1,      // revision last exported as a downloaded copy (no direct file access)
  handleReady: Promise.resolve(), // resolves once a remembered file link has been restored
  revision: 0,                 // bumps on every edit; lets a save know if edits landed mid-write
  writePermission: 'unknown',  // 'granted' | 'prompt' | 'denied' | 'unknown'

  isNarrow() { return window.innerWidth <= 900; },

  // Snapshot current state to history before a mutation
  recordAction(description = 'change') {
    if (typeof HistoryManager !== 'undefined') {
      HistoryManager.pushState(description);
    }
  },

  // Mutate and mark dirty
  saveDirty() {
    this.isDirty = true;
    this.revision++;
    this.lastEditAt = Date.now();
    try {
      const toBackup = JSON.parse(JSON.stringify(this.data));
      toBackup._backupTime = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toBackup));
    } catch (e) {
      // Ignore quota issues
    }

    // If file is linked but write permission might be prompt, request it while user activation is active
    if (this.fileHandle && this.fileHandle.queryPermission && this.fileHandle.requestPermission) {
      this.fileHandle.queryPermission({ mode: 'readwrite' }).then(status => {
        if (status === 'prompt') {
          this.fileHandle.requestPermission({ mode: 'readwrite' }).then(s => {
            this.writePermission = s;
            if (s === 'granted' && typeof QuineEngine !== 'undefined') QuineEngine.autoSave();
          }).catch(() => {});
        } else {
          this.writePermission = status;
        }
      }).catch(() => {});
    }

    this.scheduleAutoSave();
    this.notify();
  },

  // Debounced Auto-Save to file if enabled
  scheduleAutoSave() {
    if (!(this.data && this.data.settings && this.data.settings.autoSave !== false)) return;
    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => {
      if (typeof QuineEngine !== 'undefined' && QuineEngine.autoSave) {
        QuineEngine.autoSave();
      }
    }, 800);
  },

  listeners: [],
  subscribe(fn) {
    this.listeners.push(fn);
  },
  notify() {
    this.listeners.forEach(fn => fn());
  }
};
