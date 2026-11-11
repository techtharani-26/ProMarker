/* --------------------------------------------------------------------------
   2. DOMAIN & FAVICON HELPERS
   -------------------------------------------------------------------------- */
function extractDomain(url) {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return String(url || '').replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0] || '';
  }
}

// Comparable form of a URL for duplicate checks (ignores scheme, www, trailing slash, #hash)
function normalizeUrlKey(url) {
  if (!url) return '';
  let u = String(url).trim().toLowerCase();
  if (!u) return '';
  u = u.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/#.*$/, '').replace(/\/+$/, '');
  return u;
}

// True only for public routable domain names (never localhost, IP literals, or private/intranet suffixes)
const PRIVATE_DOMAIN_RE = /\.(local|internal|lan|home|corp|intranet|private|localhost|test|example|invalid|onion)$/i;
function isPublicFaviconDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  const d = domain.trim().toLowerCase();
  if (!d || d === 'localhost' || !/\./.test(d) || d.endsWith('.')) return false;
  if (d.startsWith('[') || d.includes(':')) return false; // IPv6 literal or host:port
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(d)) return false;    // IPv4 literal
  if (PRIVATE_DOMAIN_RE.test(d)) return false;
  return /^[a-z0-9.-]+$/.test(d);
}

function getFaviconUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (/^\s*(file|mailto|ftp):/i.test(url)) return '';
  if (typeof AppState !== 'undefined' && AppState.data && AppState.data.settings && AppState.data.settings.fetchFavicons === false) {
    return '';
  }
  const domain = extractDomain(url);
  if (!isPublicFaviconDomain(domain)) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

// Generate a deterministic color for fallback badges
function getDomainColor(domain) {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6'
  ];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Search query → { tags: ['js'], words: ['react'] }. "#tag" tokens filter by tag.
function parseSearch(raw) {
  const tokens = String(raw || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const tags = [], words = [];
  tokens.forEach(t => {
    if (t.startsWith('#')) { if (t.length > 1) tags.push(t.slice(1)); }
    else words.push(t);
  });
  return { tags, words };
}

function matchesSearch(b, query) {
  const tags = (b.tags || []).map(t => String(t).toLowerCase());
  // Every #tag must match one of the bookmark's tags (exact or starts-with while typing)
  if (!query.tags.every(q => tags.some(t => t === q || t.startsWith(q)))) return false;
  if (!query.words.length) return true;
  const hay = [b.title, b.url, b.description, tags.join(' ')].filter(Boolean).join(' ').toLowerCase();
  return query.words.every(w => hay.includes(w));
}

/* --------------------------------------------------------------------------
   2A. CATEGORY HIERARCHY HELPERS (Sub-category Folders)
   -------------------------------------------------------------------------- */
function getCategoryTree(categories = (AppState && AppState.data && AppState.data.categories) || []) {
  const byId = new Map(categories.map(c => [c.id, c]));
  const childrenMap = new Map();
  const roots = [];

  categories.forEach(c => {
    const pid = c.parentId && byId.has(c.parentId) && c.parentId !== c.id ? c.parentId : '';
    if (!pid) {
      roots.push(c);
    } else {
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid).push(c);
    }
  });

  const out = [];
  const visited = new Set();
  function walk(cat, depth, parent) {
    if (!cat || visited.has(cat.id)) return;
    visited.add(cat.id);
    const kids = childrenMap.get(cat.id) || [];
    out.push({ cat, depth, children: kids, parent });
    kids.forEach(child => walk(child, depth + 1, cat));
  }
  roots.forEach(r => walk(r, 0, null));
  // Safety net: include any unvisited category if a cycle slipped through
  categories.forEach(c => { if (!visited.has(c.id)) walk(c, 0, null); });
  return out;
}

function getCategoryDescendants(catId, categories = (AppState && AppState.data && AppState.data.categories) || []) {
  const ids = new Set([catId]);
  let added = true;
  while (added) {
    added = false;
    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        added = true;
      }
    }
  }
  return ids;
}

function getCategoryPath(catId, categories = (AppState && AppState.data && AppState.data.categories) || []) {
  const byId = new Map(categories.map(c => [c.id, c]));
  const path = [];
  const seen = new Set();
  let cur = byId.get(catId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return path;
}

function getCategoryPathString(catId, categories = (AppState && AppState.data && AppState.data.categories) || [], sep = ' / ') {
  return getCategoryPath(catId, categories).map(c => c.name).join(sep);
}
