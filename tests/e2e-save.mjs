/*
 * End-to-end save test (real headless Chrome, no dependencies).
 *   node tests/e2e-save.mjs
 * The file picker is replaced by a file in the browser's private storage (OPFS),
 * which has the same FileSystemFileHandle API as a real file on disk.
 * Checks: link once -> autosave + Ctrl+S into the same file, link remembered after
 * reload, no lost edits, dialogs/search survive background saves, separate copies,
 * browsers without file access, and the "newer version on disk" guard.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CH = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promarker-e2e-'));
const prof = path.join(tmp, 'profile');
// The built app with the starter bookmarks from src/seed.json, so results never depend on what's in your own file
const seedData = fs.readFileSync(path.join(ROOT, 'src', 'seed.json'), 'utf8').replace(/</g, '\\u003c').trim();
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .replace(/(<script id="promarker-data" type="application\/json">)[\s\S]*?(<\/script>)/, (m, open, close) => `${open}\n${seedData}\n${close}`);
// A tampered copy: injected script, inline handler, and malicious bookmark data
const evilData = JSON.stringify({ version: 1, settings: { theme: 'light' },
  categories: [{ id: 'c1"><img src=x onerror="window.__pwned=3">', name: 'Evil<img src=x onerror="window.__pwned=4">', icon: 'x"/><script>window.__pwned=5</script>', color: 'red;background:url(//evil)' }],
  bookmarks: [{ id: 'b1"><svg onload="window.__pwned=6">', title: 'Click me', url: 'javascript:window.__pwned=7', categoryId: 'c1"><img src=x onerror="window.__pwned=3">', tags: ['x'] }] }).replace(/</g, '\\u003c');
const evilPage = page
  .replace(/(<script id="promarker-data" type="application\/json">)[\s\S]*?(<\/script>)/, `$1\n${evilData}\n$2`)
  .replace('<body>', '<body><script>window.__pwned=1</script><img src="x" onerror="window.__pwned=2">');
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://x').pathname.slice(1);
  const send = (body) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(body); };
  if (['index.html', 'copy.html', 'tamper.html', 'order.html', 'conflict-keep.html', 'conflict-disk.html'].includes(name)) send(page);
  else if (name === 'evil.html') send(evilPage);
  else if (name === 'notes.html') send('<!DOCTYPE html><html><body><h1>My notes — not ProMarker</h1></body></html>');
  else { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const PORT = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
for (let i = 0; i < 50; i++) { try { const t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const pg = t.find(x => x.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break; } } catch {} await sleep(200); }
await new Promise(r => ws.onopen = r);
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const results = []; const check = (name, ok, info = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

await send('Page.enable'); await send('Runtime.enable');
await send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});
const MOCK = `
  window.__pickerCalls = Number(localStorage.getItem('__pickerCalls') || 0);
  if (location.search.includes('nofs')) { delete window.showOpenFilePicker; delete window.showSaveFilePicker;
    window.showOpenFilePicker = undefined; window.showSaveFilePicker = undefined; window.__downloads = 0;
    const oc = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function(){ if (this.download) { window.__downloads++; return; } return oc.call(this); };
  } else {
    window.showOpenFilePicker = async () => {
      window.__pickerCalls++; localStorage.setItem('__pickerCalls', window.__pickerCalls);
      const root = await navigator.storage.getDirectory();
      const name = window.__pickName || location.pathname.split('/').pop();
      const h = await root.getFileHandle(name, { create: true });
      if ((await h.getFile()).size === 0) { const w = await h.createWritable(); await w.write(await (await fetch('/' + name)).text()); await w.close(); }
      return [h];
    };
  }`;
await send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK });
const load = async (path) => { await send('Page.navigate', { url: base + path }); await sleep(1200); };
const disk = (name) => ev(`const r=await navigator.storage.getDirectory(); try{const h=await r.getFileHandle('${name}'); return await (await h.getFile()).text();}catch(e){return ''}`);
const status = () => ev(`return document.querySelector('.save-status-card').innerText.replace(/\\s+/g,' ').trim()`);
const addBookmark = async (title) => { const r = await ev(`const mc=document.getElementById('modal-container'); const pre=mc.innerHTML.slice(0,120); document.getElementById('btn-new-bookmark').click(); await new Promise(r=>setTimeout(r,50)); if(!document.getElementById('bm-url')) return 'NO MODAL; before: '+pre+' | active: '+document.activeElement.id;
  document.getElementById('bm-url').value='https://example.com/${title}'; document.getElementById('bm-title').value='${title}';
  document.getElementById('btn-submit-bookmark').click(); return true;`); if (r !== true) results.push('NOTE addBookmark(' + title + '): ' + r); };

try {
// ---- 1. Link once, then autosave writes into the same file
await load('/index.html');
check('banner offers linking', await ev(`return !!document.getElementById('btn-banner-link')`));
await ev(`document.getElementById('btn-banner-link').click(); await new Promise(r=>setTimeout(r,600)); return true`);
check('linked after one picker', (await ev('return window.__pickerCalls')) === 1, await status());
await addBookmark('AutosaveOne'); await sleep(1600);
check('autosave wrote edit into linked file', (await disk('index.html')).includes('AutosaveOne'), await status());
check('status says Saved', /Saved/.test(await status()), await status());

// ---- 2. Ctrl+S saves into the same file, no picker
await addBookmark('CtrlSTwo');
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',metaKey:true,bubbles:true})); await new Promise(r=>setTimeout(r,700)); return true`);
check('Ctrl+S wrote into same file', (await disk('index.html')).includes('CtrlSTwo'));
check('Ctrl+S did not open a picker', (await ev('return window.__pickerCalls')) === 1);

// ---- 3. Reload: link remembered, edits keep saving with no picker
await load('/index.html');
check('link remembered after reload', /Saved|Unsaved/.test(await status()) && !(await ev(`return !!document.getElementById('btn-banner-link')`)), await status());
await addBookmark('AfterReload'); await sleep(1600);
check('autosave after reload into same file', (await disk('index.html')).includes('AfterReload'), await status());
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true})); await new Promise(r=>setTimeout(r,700)); return true`);
check('still only one picker ever', (await ev('return window.__pickerCalls')) === 1, 'picker calls = ' + await ev('return window.__pickerCalls'));

// ---- 4. Instant Ctrl+S right after load waits for the remembered link
await send('Page.navigate', { url: base + '/index.html' }); await sleep(150);
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',metaKey:true,bubbles:true})); await new Promise(r=>setTimeout(r,800)); return true`);
check('immediate Ctrl+S after load did not ask for a file', (await ev('return window.__pickerCalls')) === 1);

// ---- 5. Edits typed while a save is writing are not lost
await sleep(800);
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',metaKey:true,bubbles:true})); return true`);
await addBookmark('DuringWrite'); await sleep(2000);
check('edit made during a write still reaches the file', (await disk('index.html')).includes('DuringWrite'), await status());

// ---- 5b. Dialog + search survive background saves
await addBookmark('Trigger'); // schedules autosave in 800ms
await ev(`document.getElementById('btn-new-bookmark').click(); document.getElementById('bm-title').value='half typed'; return true`);
await sleep(1800);
check('open dialog survives autosave', await ev(`return document.getElementById('bm-title')?.value === 'half typed'`));
await ev(`document.getElementById('modal-container').innerHTML=''; return true`);
await addBookmark('Trigger2');
await ev(`const s=document.getElementById('global-search'); s.focus(); s.value='exa'; return true`);
await sleep(1800);
check('search keeps focus through autosave', await ev(`return document.activeElement.id === 'global-search'`));
await ev(`const s=document.getElementById('global-search'); s.value=''; s.dispatchEvent(new Event('input')); s.blur(); return true`);

// ---- 6. A different copy does not hijack index.html's link
await load('/copy.html');
check('copy.html is not linked to index.html', !!(await ev(`return !!document.getElementById('btn-banner-link')`)), await status());

// ---- 7. Unsaved edits survive linking (old bug: they were discarded)
await addBookmark('BeforeLinking'); await sleep(300);
await ev(`document.getElementById('btn-banner-link').click(); await new Promise(r=>setTimeout(r,1200)); return true`);
check('edits made before linking are kept', await ev(`return document.body.innerText.includes('BeforeLinking')`));
check('...and written into the newly linked file', (await disk('copy.html')).includes('BeforeLinking'), await status());

// ---- 7b. Linking a file that was saved elsewhere after our edits asks which version wins
const conflictRun = async (name, edit, choice) => {
  await load('/' + name);
  // The file on disk was saved "later" by another browser and holds a bookmark we don't have
  await ev(`const t = await (await fetch('/${name}')).text();
    const re = /(<script id="promarker-data" type="application\\/json">)([\\s\\S]*?)(<\\/script>)/;
    const d = JSON.parse(t.match(re)[2]); d._lastSaved = Date.now() + 600000;
    d.bookmarks.push({ id: 'bm-disk', title: 'DiskVersion', url: 'https://example.com/disk', categoryId: d.categories[0].id, tags: [] });
    const h = await (await navigator.storage.getDirectory()).getFileHandle('${name}', { create: true });
    const w = await h.createWritable(); await w.write(t.replace(re, (m, a, b, c) => a + JSON.stringify(d).replace(/</g, '\\\\u003c') + c)); await w.close(); return true`);
  await addBookmark(edit); await sleep(300);
  await ev(`document.getElementById('btn-banner-link').click(); await new Promise(r=>setTimeout(r,600)); return true`);
  const title = await ev(`return document.getElementById('confirm-title')?.textContent || ''`);
  await ev(`[...document.querySelectorAll('[data-confirm]')].find(b => b.textContent.includes('${choice}')).click(); await new Promise(r=>setTimeout(r,1500)); return true`);
  return title;
};
check('conflict asks which version to keep', /newer changes/.test(await conflictRun('conflict-keep.html', 'LocalEdit', 'Keep my edits')));
check('"Keep my edits" writes them into the file', (await disk('conflict-keep.html')).includes('LocalEdit') && !(await disk('conflict-keep.html')).includes('DiskVersion'), await status());
await conflictRun('conflict-disk.html', 'LocalEdit2', 'file’s version');
check('"Use the file’s version" loads the file', await ev(`return document.body.innerText.includes('DiskVersion') && !document.body.innerText.includes('LocalEdit2')`), await status());
check('...and leaves the file as it was', (await disk('conflict-disk.html')).includes('DiskVersion') && !(await disk('conflict-disk.html')).includes('LocalEdit2'));

// ---- 8. Browser without file access (Brave default / Safari / Firefox)
await load('/copy.html?nofs');
check('explains missing file access', await ev(`return !!document.getElementById('file-support-banner')`));
await addBookmark('NoFsEdit');
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',metaKey:true,bubbles:true})); await new Promise(r=>setTimeout(r,400)); return true`);
check('save downloads a copy', (await ev('return window.__downloads')) === 1);
check('status says copy downloaded', /Copy downloaded/.test(await status()), await status());
check('browser backup kept after download', await ev(`return Object.keys(localStorage).some(k=>k.startsWith('promarker_local_backup') && localStorage.getItem(k).includes('NoFsEdit'))`));
await load('/copy.html?nofs');
check('edit restored when reopening the original', await ev(`return document.body.innerText.includes('NoFsEdit')`));
await ev(`document.getElementById('btn-file-help').click(); return true`);
check('help dialog opens', await ev(`return document.querySelector('.modal-title')?.innerText || ''`) !== '', await ev(`return document.querySelector('.modal-title')?.innerText`));


// ---- 9. Old tab must not overwrite a newer ProMarker version on disk
await load('/index.html');
await ev(`const r=await navigator.storage.getDirectory(); const h=await r.getFileHandle('index.html'); const t=await (await h.getFile()).text();
  const w=await h.createWritable(); await w.write(t.replace(/(<meta name="promarker-build" content=")[^"]*/, '$199999999T999999-zzzz')); await w.close(); return true`);
await addBookmark('FromOldTab'); await sleep(1800);
const after = await disk('index.html');
check('old tab does not overwrite newer version', after.includes('99999999T999999-zzzz') && !after.includes('FromOldTab'), await status());
check('old tab asks to reload', /Newer version/.test(await status()), await status());

// ---- 10. Security: a tampered file cannot run injected code
await load('/evil.html');
check('injected script / handlers / data did not run', (await ev('return window.__pwned === undefined')), 'pwned = ' + await ev('return String(window.__pwned)'));
check('javascript: bookmark is not clickable', await ev(`return document.querySelector('.card-title').getAttribute('href') === '#blocked-link'`));
check('malicious ids/icons/colors were neutralised', await ev(`return !document.querySelector('#app img[src="x"], #app svg[onload], #app script') && document.querySelectorAll('.bookmark-card').length === 1`));
await ev(`document.querySelector('.card-title').click(); await new Promise(r=>setTimeout(r,300)); return true`);
check('clicking it is blocked with a notice', (await ev('return window.__pwned === undefined')) && /unsafe/i.test(await ev(`return document.getElementById('toast-container').innerText`)));

// ---- 11. Security: refuse to link a file that isn't ProMarker
await load('/tamper.html');
await ev(`window.__pickName = 'notes.html'; document.getElementById('btn-banner-link').click(); await new Promise(r=>setTimeout(r,800)); return true`);
check('non-ProMarker file is refused', /Not a ProMarker file/.test(await ev(`return document.querySelector('.modal-title')?.innerText || ''`)) && !!(await ev(`return !!document.getElementById('btn-banner-link')`)));
check('...and left untouched', (await disk('notes.html')).includes('My notes') && !(await disk('notes.html')).includes('promarker-data'));

// ---- 12. Security: code changed on disk while open -> saving pauses, can be repaired
await ev(`document.getElementById('modal-container').innerHTML=''; window.__pickName = ''; document.getElementById('btn-banner-link').click(); await new Promise(r=>setTimeout(r,800)); return true`);
await ev(`const r=await navigator.storage.getDirectory(); const h=await r.getFileHandle('tamper.html'); const t=await (await h.getFile()).text();
  const w=await h.createWritable(); await w.write(t.replace('<body>', '<body><script>window.__pwned=9</script>')); await w.close(); return true`);
await addBookmark('AfterTamper'); await sleep(1800);
const tampered = await disk('tamper.html');
check('save refused over tampered file', tampered.includes('__pwned=9') && !tampered.includes('AfterTamper'), await status());
check('user is alerted', /Saving paused/.test(await ev(`return document.querySelector('.modal-title')?.innerText || ''`)) && /paused/i.test(await status()), await status());
await ev(`[...document.querySelectorAll('[data-sec-action]')].find(b=>/Restore clean/.test(b.innerText)).click(); await new Promise(r=>setTimeout(r,1200)); return true`);
const repaired = await disk('tamper.html');
check('restore writes a clean file with current bookmarks', !repaired.includes('__pwned') && repaired.includes('AfterTamper'), await status());
check('saving resumes after restore', /Saved/.test(await status()), await status());

// ---- 13. A / B / 1–9 shortcuts and category reordering saved into the file
await load('/order.html');
await ev(`window.__pickName = ''; document.getElementById('btn-banner-link').click(); await new Promise(r=>setTimeout(r,800)); document.getElementById('modal-container').innerHTML=''; return true`);
const press = (key) => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'${key}',bubbles:true,cancelable:true})); await new Promise(r=>setTimeout(r,80)); return document.querySelector('.category-title').firstChild.textContent.trim()`);
const sidebarCats = () => ev(`return [...document.querySelectorAll('#category-nav-list .nav-item')].map(li => li.querySelector('.nav-label').textContent.trim())`);
const before = await sidebarCats();
check('B opens Favorites', (await press('b')) === 'Favorites');
check('2 opens the second category', (await press('2')) === before[1], before[1]);
check('A opens All Bookmarks', (await press('a')) === 'All Bookmarks');
// drag the 2nd category above the 1st
await ev(`const li=[...document.querySelectorAll('#category-nav-list .nav-item')]; const dt=new DataTransfer();
  const r=li[0].getBoundingClientRect();
  li[1].dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));
  li[0].dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientY:r.top+2}));
  li[0].dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientY:r.top+2}));
  return true`);
const afterDrag = await sidebarCats();
check('dragging reorders the sidebar', afterDrag[0] === before[1] && afterDrag[1] === before[0], afterDrag.join(', '));
check('1 follows the new order', (await press('1')) === before[1]);
// context menu: move the (now) first category down again
await ev(`const li=document.querySelector('#category-nav-list .nav-item'); const r=li.getBoundingClientRect();
  li.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+20,clientY:r.top+10}));
  [...document.querySelectorAll('#custom-context-menu .context-menu-item')].find(x=>/Move Down/.test(x.innerText)).click(); return true`);
check('Move Down from the menu works', (await sidebarCats())[0] === before[0]);
await ev(`const li=[...document.querySelectorAll('#category-nav-list .nav-item')]; const dt=new DataTransfer(); const r=li[0].getBoundingClientRect();
  li[1].dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));
  li[0].dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientY:r.top+2}));
  li[0].dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientY:r.top+2})); return true`);
await sleep(1800);
const saved = JSON.parse((await disk('order.html')).match(/<script id="promarker-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
check('category order is saved into the file', saved.categories[0].name === before[1] && saved.categories.every((c, i) => c.order === i), saved.categories.map(c => c.name).join(', '));
} catch (e) { results.push('ERROR ' + String(e.message).slice(0, 300)); }
console.log(results.join('\n'));
console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
ws.close(); chrome.kill(); server.close();
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
process.exit(results.every(r => !r.startsWith('FAIL') && !r.startsWith('ERROR')) ? 0 : 1);
