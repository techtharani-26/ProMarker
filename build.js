#!/usr/bin/env node
/*
 * ProMarker build — stitches src/ into one self-contained HTML file.
 *
 *   node build.js                     rebuild index.html, keeping the bookmarks already inside it
 *   node build.js --out other.html    build a different file (its bookmarks are kept too)
 *   node build.js --data some.html    take bookmarks from another ProMarker file (or a .json file)
 *   node build.js --fresh             start from the starter bookmarks in src/seed.json
 *
 * Before overwriting, the previous file is copied to backups/ (last 10 kept).
 * Close or reload any open ProMarker tab after building: open tabs still run the old code.
 *
 * No dependencies. Order of styles and scripts = alphabetical file names (use number prefixes).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DATA_RE = /<script id="promarker-data" type="application\/json">([\s\S]*?)<\/script>/i;

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] || null);
}
const flag = (name) => process.argv.includes(name);

const outPath = path.resolve(ROOT, arg('--out') || 'index.html');
const dataArg = arg('--data');

function readSorted(dir, ext) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => ({ name: f, text: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

const indent = (text, n) => text.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

// ---------- 1. Bookmark data (kept verbatim so nothing is re-encoded) ----------
function dataFromFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.json')) return text.replace(/</g, '\\u003c').trim();
  const m = text.match(DATA_RE);
  if (!m) throw new Error(`No ProMarker data block found in ${file}`);
  return m[1].trim();
}

let dataText;
let dataSource;
if (flag('--fresh')) {
  dataSource = 'src/seed.json';
  dataText = dataFromFile(path.join(SRC, 'seed.json'));
} else if (dataArg) {
  dataSource = dataArg;
  dataText = dataFromFile(path.resolve(ROOT, dataArg));
} else if (fs.existsSync(outPath)) {
  dataSource = path.basename(outPath) + ' (existing bookmarks)';
  dataText = dataFromFile(outPath);
} else {
  dataSource = 'src/seed.json';
  dataText = dataFromFile(path.join(SRC, 'seed.json'));
}

let data;
try {
  data = JSON.parse(dataText);
} catch (e) {
  console.error(`✗ Bookmark data from ${dataSource} is not valid JSON — aborting, nothing written.`);
  process.exit(1);
}
// Always escape "<" so neither closing script tags nor HTML comments ("<!--") can affect the HTML parser
dataText = dataText.replace(/</g, '\\u003c');

// ---------- 2. Code ----------
const styles = readSorted(path.join(SRC, 'styles'), '.css');
const scripts = readSorted(path.join(SRC, 'js'), '.js');

// Bundled fonts (src/fonts/*.woff2) are embedded as base64 so the page needs no network
const FONT_RANGE = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const fontDir = path.join(SRC, 'fonts');
const fontCss = fs.existsSync(fontDir) ? fs.readdirSync(fontDir).filter((f) => f.endsWith('.woff2')).sort().map((f) => {
  const b64 = fs.readFileSync(path.join(fontDir, f)).toString('base64');
  return `/* ===== fonts/${f} (SIL OFL 1.1) ===== */\n@font-face { font-family: "Inter"; font-style: normal; font-weight: 100 900; font-display: swap; ` +
    `src: url("data:font/woff2;base64,${b64}") format("woff2"); unicode-range: ${FONT_RANGE}; }`;
}) : [];

const css = [...fontCss.map((t) => indent(t, 4))].concat(styles.map((f) => indent(`/* ===== ${f.name} ===== */\n${f.text.trimEnd()}`, 4))).join('\n\n');
const js = scripts.map((f) => indent(`/* ===== src/js/${f.name} ===== */\n${f.text.trimEnd()}`, 6)).join('\n\n');

for (const f of scripts) {
  if (/<\/script/i.test(f.text)) {
    console.error(`✗ src/js/${f.name} contains a literal closing script tag, which would break the page. Split it like '<' + '/script'.`);
    process.exit(1);
  }
}

const theme = data && data.settings && data.settings.theme;
const buildId = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '') + '-' + Math.random().toString(36).slice(2, 6);

const fill = (tpl, map) => Object.keys(map).reduce((s, k) => s.split(`{{${k}}}`).join(map[k]), tpl);
let html = fill(fs.readFileSync(path.join(SRC, 'template.html'), 'utf8'), {
  THEME_ATTR: theme && theme !== 'system' ? ` data-theme="${String(theme).replace(/[^a-z-]/gi, '')}"` : '',
  BUILD_ID: buildId,
  STYLES: css,
  ICONS: indent(fs.readFileSync(path.join(SRC, 'icons.svg'), 'utf8').trimEnd(), 2),
  DATA: dataText,
  SCRIPT: js,
});

// ---------- 3. Syntax check the combined script, then pin it in the security policy ----------
const scriptBody = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
try {
  new Function(scriptBody); // parse only, never run
} catch (e) {
  console.error('✗ Script has a syntax error — nothing written:\n  ' + e.message);
  process.exit(1);
}

// The browser hashes the script's exact text; only a script with this hash may run.
const scriptHash = 'sha256-' + require('crypto').createHash('sha256').update(scriptBody, 'utf8').digest('base64');
html = html.split('{{SCRIPT_HASH}}').join(scriptHash);
if (html.includes('{{')) {
  console.error('✗ Unfilled placeholder left in template — nothing written.');
  process.exit(1);
}

// ---------- 4. Back up, then write ----------
if (fs.existsSync(outPath)) {
  const dir = path.join(ROOT, 'backups');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '');
  const base = path.basename(outPath, '.html');
  const backupPath = path.join(dir, `${base}-${stamp}.html`);
  fs.copyFileSync(outPath, backupPath);
  try { fs.chmodSync(backupPath, 0o600); } catch (e) {}
  const old = fs.readdirSync(dir).filter((f) => f.startsWith(base + '-')).sort();
  old.slice(0, Math.max(0, old.length - 10)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
}
fs.writeFileSync(outPath, html);

const n = (data && data.bookmarks && data.bookmarks.length) || 0;
console.log(`✓ Built ${path.relative(ROOT, outPath)} (${(html.length / 1024).toFixed(0)} KB, build ${buildId})`);
console.log(`  ${styles.length} style files, ${fontCss.length} font, ${scripts.length} script files, ${n} bookmarks from ${dataSource}`);
console.log('  Reload any open ProMarker tab before editing, so it runs the new code.');
