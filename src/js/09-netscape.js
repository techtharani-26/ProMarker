/* --------------------------------------------------------------------------
   4. NETSCAPE BOOKMARK FORMAT (IMPORT / EXPORT)
   -------------------------------------------------------------------------- */
const NetscapeEngine = {
  exportHTML() {
    const { categories, bookmarks } = AppState.data;
    let out = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;
    // Export categories and nested sub-category folders recursively
    const byId = new Map(categories.map(c => [c.id, c]));
    const roots = categories.filter(c => !c.parentId || !byId.has(c.parentId));
    const childrenOf = (pid) => categories.filter(c => c.parentId === pid);

    function writeFolder(cat, indent) {
      const pad = '    '.repeat(indent);
      const catBookmarks = bookmarks.filter(b => b.categoryId === cat.id && !b.isTrash);
      const subFolders = childrenOf(cat.id);
      out += `${pad}<DT><H3 ADD_DATE="${Math.floor(Date.now() / 1000)}">${escapeHTML(cat.name)}</H3>\n${pad}<DL><p>\n`;
      catBookmarks.forEach(b => {
        const addDate = Math.floor((b.createdAt || Date.now()) / 1000);
        const tags = (b.tags || []).join(',');
        out += `${pad}    <DT><A HREF="${escapeHTML(b.url)}" ADD_DATE="${addDate}" TAGS="${escapeHTML(tags)}">${escapeHTML(b.title || b.url)}</A>\n`;
      });
      subFolders.forEach(sub => writeFolder(sub, indent + 1));
      out += `${pad}</DL><p>\n`;
    }
    roots.forEach(cat => writeFolder(cat, 1));

    // Uncategorized
    const uncategorized = bookmarks.filter(b => !categories.some(c => c.id === b.categoryId) && !b.isTrash);
    if (uncategorized.length > 0) {
      out += `    <DT><H3>Other Bookmarks</H3>\n    <DL><p>\n`;
      uncategorized.forEach(b => {
        out += `        <DT><A HREF="${escapeHTML(b.url)}">${escapeHTML(b.title || b.url)}</A>\n`;
      });
      out += `    </DL><p>\n`;
    }

    out += `</DL><p>\n`;
    return out;
  },

  importHTML(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    let addedCount = 0;
    let skippedCount = 0;
    AppState.recordAction('Import Browser Bookmarks');
    const seen = new Set(AppState.data.bookmarks.map(b => normalizeUrlKey(b.url)));
    const fallbackCatId = () => {
      if (AppState.data.categories.length) return AppState.data.categories[0].id;
      const cat = { id: 'cat-imported', name: 'Imported', icon: 'folder', color: '#6366f1', order: 0, parentId: '' };
      AppState.data.categories.push(cat);
      return cat.id;
    };

    // Recursive helper to traverse DL/DT elements while preserving nested folder hierarchy
    function traverse(node, activeCatId) {
      let folderCatId = activeCatId;
      const children = Array.from(node.children);
      for (let i = 0; i < children.length; i++) {
        const el = children[i];
        if (el.tagName === 'H3') {
          const catName = Sanitize.text(el.textContent.trim(), 200) || 'Untitled';
          const parentId = activeCatId || '';
          let cat = AppState.data.categories.find(c =>
            c.name.toLowerCase() === catName.toLowerCase() && (c.parentId || '') === parentId
          );
          if (!cat && !parentId) {
            cat = AppState.data.categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
          }
          if (!cat) {
            cat = {
              id: 'cat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
              name: catName,
              icon: 'folder',
              color: '#6366f1',
              order: AppState.data.categories.length,
              parentId
            };
            AppState.data.categories.push(cat);
          }
          folderCatId = cat.id;
        } else if (el.tagName === 'A') {
          const rawUrl = el.getAttribute('href');
          const url = rawUrl ? Sanitize.text(rawUrl, 8192).trim() : '';
          if (url && /^https?:\/\//i.test(url) && isSafeUrl(url)) {
            const key = normalizeUrlKey(url);
            if (seen.has(key)) { skippedCount++; continue; }
            seen.add(key);
            const title = Sanitize.text(el.textContent.trim() || extractDomain(url), 1000);
            const addDate = parseInt(el.getAttribute('add_date') || '', 10);
            const tagsAttr = el.getAttribute('tags') || '';
            const tags = tagsAttr
              ? Array.from(new Set(tagsAttr.split(',').map(t => Sanitize.text(t, 60).trim()).filter(Boolean))).slice(0, 50)
              : [];

            AppState.data.bookmarks.push({
              id: 'bm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
              title: title,
              url: url,
              description: '',
              categoryId: folderCatId || fallbackCatId(),
              tags: tags,
              isFavorite: false,
              isArchived: false,
              isTrash: false,
              clickCount: 0,
              createdAt: addDate > 0 ? addDate * 1000 : Date.now(),
              order: AppState.data.bookmarks.length
            });
            addedCount++;
          }
        }
        if (el.children && el.children.length > 0) {
          traverse(el, el.tagName === 'DL' ? folderCatId : activeCatId);
        }
      }
    }

    traverse(doc.body, null);
    const cleaned = sanitizeData(AppState.data);
    if (cleaned) AppState.data = cleaned;
    AppState.saveDirty();
    this.lastSkipped = skippedCount;
    return addedCount;
  }
};
