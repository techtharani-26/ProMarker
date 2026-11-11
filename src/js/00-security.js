/* --------------------------------------------------------------------------
   0. SECURITY HELPERS
   Everything that comes from the file, the browser backup, another tab or an
   import passes through sanitizeData() before the app uses it, so a tampered
   file cannot inject markup or script through ids, icons, colors or links.
   -------------------------------------------------------------------------- */

// Link schemes a bookmark may open. Anything else (javascript:, data:, blob:, …) is blocked.
const SAFE_URL_SCHEMES = ['http:', 'https:', 'ftp:', 'mailto:', 'file:'];

function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  // Scheme-less URLs ("example.com") are treated as https by the app
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return true;
  try {
    return SAFE_URL_SCHEMES.includes(new URL(trimmed).protocol);
  } catch (e) {
    return false;
  }
}

// href value for rendering/opening: unsafe links become inert
function safeHref(url) {
  if (!isSafeUrl(url)) return '#blocked-link';
  const trimmed = String(url).trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : 'https://' + trimmed;
}

function openSafely(url) {
  if (!isSafeUrl(url)) {
    showToast('Blocked a link with an unsafe address', 'danger');
    return false;
  }
  window.open(safeHref(url), '_blank', 'noopener,noreferrer');
  return true;
}

// Stored site icons: only small base64 PNG/WebP images (never SVG, which can carry script)
const FAVICON_MAX = 16000;
const FAVICON_RE = /^data:image\/(png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const Sanitize = {
  id(value, prefix, used) {
    let id = String(value == null ? '' : value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
    if (!id || used.has(id)) id = prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    used.add(id);
    return id;
  },
  text(value, max) {
    return typeof value === 'string' ? value.slice(0, max) : (value == null ? '' : String(value).slice(0, max));
  },
  icon(value) {
    return /^[a-z0-9-]{1,40}$/.test(String(value || '')) ? value : 'folder';
  },
  color(value) {
    return /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? value : '#6366f1';
  },
  num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  },
  oneOf(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  },
};

// Returns a clean copy (or null if the input isn't ProMarker data at all)
function sanitizeData(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.bookmarks) || !Array.isArray(input.categories)) {
    return null;
  }
  const s = input.settings && typeof input.settings === 'object' ? input.settings : {};
  const usedCat = new Set();
  const catIdMap = new Map();

  const categories = input.categories.filter(c => c && typeof c === 'object').map((c, i) => {
    const id = Sanitize.id(c.id, 'cat', usedCat);
    catIdMap.set(String(c.id), id);
    return {
      id,
      name: Sanitize.text(c.name, 200) || 'Untitled',
      icon: Sanitize.icon(c.icon),
      color: Sanitize.color(c.color),
      order: Sanitize.num(c.order, i),
      _rawParent: c.parentId ? String(c.parentId) : ''
    };
  });

  // Resolve parentId references and guard against self-parenting or cycles
  const catById = new Map(categories.map(c => [c.id, c]));
  categories.forEach(c => {
    const pid = c._rawParent ? (catIdMap.get(c._rawParent) || '') : '';
    delete c._rawParent;
    if (pid && pid !== c.id && catById.has(pid)) {
      c.parentId = pid;
    } else {
      c.parentId = '';
    }
  });
  categories.forEach(c => {
    if (!c.parentId) return;
    const seen = new Set([c.id]);
    let cur = catById.get(c.parentId);
    while (cur) {
      if (seen.has(cur.id)) { c.parentId = ''; break; }
      seen.add(cur.id);
      cur = cur.parentId ? catById.get(cur.parentId) : null;
    }
  });

  const usedBm = new Set();
  const bookmarks = input.bookmarks.filter(b => b && typeof b === 'object').map((b, i) => {
    const clean = {
      id: Sanitize.id(b.id, 'bm', usedBm),
      title: Sanitize.text(b.title, 1000),
      url: Sanitize.text(b.url, 8192).trim(),
      description: Sanitize.text(b.description, 10000),
      categoryId: catIdMap.get(String(b.categoryId)) || '',
      tags: Array.isArray(b.tags)
        ? Array.from(new Set(b.tags.map(t => Sanitize.text(t, 60).trim()).filter(Boolean))).slice(0, 50)
        : [],
      isFavorite: b.isFavorite === true,
      isArchived: b.isArchived === true,
      isTrash: b.isTrash === true,
      clickCount: Math.max(0, Sanitize.num(b.clickCount)),
      createdAt: Sanitize.num(b.createdAt, Date.now()),
      order: Sanitize.num(b.order, i),
    };
    if (b.updatedAt != null) clean.updatedAt = Sanitize.num(b.updatedAt);
    if (b.lastVisitedAt != null) clean.lastVisitedAt = Sanitize.num(b.lastVisitedAt);
    if (typeof b.favicon === 'string' && b.favicon.length <= FAVICON_MAX && FAVICON_RE.test(b.favicon)) clean.favicon = b.favicon;
    return clean;
  });

  const out = {
    version: 1,
    settings: {
      theme: Sanitize.oneOf(s.theme, ['system', 'light', 'dark', 'midnight', 'espresso', 'latte'], 'system'),
      viewMode: Sanitize.oneOf(s.viewMode, ['grid', 'compact', 'list', 'sections'], 'grid'),
      sortBy: Sanitize.oneOf(s.sortBy, ['custom', 'date-desc', 'date-asc', 'title-asc', 'title-desc', 'clicks'], 'custom'),
      openInNewTab: s.openInNewTab !== false,
      trackClicks: s.trackClicks !== false,
      copyFormat: Sanitize.oneOf(s.copyFormat, ['title-link', 'title-url', 'url-only'], 'title-link'),
      autoSave: s.autoSave !== false,
      fetchFavicons: s.fetchFavicons !== false,
      offlineIcons: s.offlineIcons === true,
    },
    categories,
    bookmarks,
  };
  if (input._lastSaved != null) out._lastSaved = Sanitize.num(input._lastSaved);
  if (input._backupTime != null) out._backupTime = Sanitize.num(input._backupTime);
  return out;
}

/* --------------------------------------------------------------------------
   FILE INTEGRITY
   The running page is the trusted reference: its own script text, security
   policy and build id are captured at startup. Before linking or saving, the
   file on disk is checked against it, so ProMarker never silently overwrites a
   file that isn't ProMarker, and notices when something else changed its code.
   -------------------------------------------------------------------------- */
const RUNNING = {
  script: (document.currentScript && document.currentScript.textContent) || '',
  build: (document.querySelector('meta[name="promarker-build"]') || {}).content || '',
  csp: (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '',
  // Clean copy of the page as loaded, used as the template for every save
  pristine: document.documentElement.cloneNode(true),
};

const DANGEROUS_TAGS = 'iframe, frame, frameset, object, embed, base, link, applet, portal, animate, set, animateMotion, animateTransform, foreignObject, meta[http-equiv="refresh" i]';

function hasUnsafeAttrUrl(name, value) {
  if (/^srcdoc$/i.test(name)) return true;
  if (!/^(href|src|xlink:href|action|formaction)$/i.test(name)) return false;
  const normalized = String(value || '').replace(/[\s\u0000-\u001f]+/g, '');
  return !/^#/.test(normalized) && /^(javascript|vbscript|data):/i.test(normalized);
}

// Things ProMarker itself never produces. Returns a list of human-readable problems.
function findForeignContent(root) {
  const problems = [];
  const scripts = Array.from(root.querySelectorAll('script')).filter(sc => sc.id !== 'promarker-data');
  if (scripts.length !== 1 || scripts.some(sc => sc.hasAttribute('src'))) problems.push('extra or external scripts');
  const dataScript = root.querySelector('script#promarker-data');
  if (dataScript && dataScript.getAttribute('type') !== 'application/json') problems.push('the data block was made executable');
  if (root.querySelector(DANGEROUS_TAGS)) problems.push('embedded frames, objects or redirects');
  const hasHandler = Array.from(root.querySelectorAll('*')).some(el =>
    Array.from(el.attributes).some(a => /^on/i.test(a.name) || hasUnsafeAttrUrl(a.name, a.value)));
  if (hasHandler) problems.push('inline event handlers or script links');
  return problems;
}

// Inspect the text of a file on disk.
function inspectProMarkerFile(text) {
  const result = { isProMarker: false, data: null, build: '', newer: false, problems: [] };
  let doc;
  try { doc = new DOMParser().parseFromString(text, 'text/html'); } catch (e) { return result; }
  const dataEl = doc.querySelector('script#promarker-data');
  if (!dataEl) return result;
  try { result.data = sanitizeData(JSON.parse(dataEl.textContent)); } catch (e) { result.data = null; }
  if (!result.data) return result;
  result.isProMarker = true;

  const meta = doc.querySelector('meta[name="promarker-build"]');
  result.build = meta ? meta.getAttribute('content') || '' : '';
  result.newer = !!result.build && result.build > RUNNING.build;

  result.problems = findForeignContent(doc);
  if (result.build && result.build === RUNNING.build) {
    // Same version as this page: code and security policy must be byte-identical
    const appScript = Array.from(doc.querySelectorAll('script')).find(sc => sc.id !== 'promarker-data');
    if (!appScript || appScript.textContent !== RUNNING.script) result.problems.push('the app code was edited');
    const csp = doc.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!csp || csp.getAttribute('content') !== RUNNING.csp) result.problems.push('the security policy was changed or removed');
  }
  return result;
}

// Strip anything ProMarker never produces from a document about to be saved.
function cleanseDocument(root) {
  root.querySelectorAll('script').forEach(sc => {
    if (sc.id === 'promarker-data') { sc.setAttribute('type', 'application/json'); return; }
    if (sc.hasAttribute('src') || sc.textContent !== RUNNING.script) sc.remove();
  });
  root.querySelectorAll(DANGEROUS_TAGS).forEach(el => el.remove());
  root.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(a => {
      if (/^on/i.test(a.name) || hasUnsafeAttrUrl(a.name, a.value)) el.removeAttribute(a.name);
    });
  });
  return root;
}
