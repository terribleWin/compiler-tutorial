import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chapters, extras } from './catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const base = '/compiler-tutorial/';
const origin = 'https://sprout.example';
const errors = [];
const htmlCache = new Map();
const decode = text => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : file.endsWith('.html') ? [file] : [];
  });
}
function read(file) {
  if (!htmlCache.has(file)) htmlCache.set(file, fs.readFileSync(file, 'utf8'));
  return htmlCache.get(file);
}
function resolveFile(url) {
  const pathname = decodeURIComponent(url.pathname);
  if (pathname !== base.slice(0, -1) && !pathname.startsWith(base)) return null;
  const relative = pathname === base.slice(0, -1) ? '' : pathname.slice(base.length);
  const file = path.resolve(docs, relative || 'index.html');
  if (file !== docs && !file.startsWith(docs + path.sep)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  for (const alternative of [file + '.html', path.join(file, 'index.html')]) {
    if (fs.existsSync(alternative) && fs.statSync(alternative).isFile()) return alternative;
  }
  return file;
}

for (const entry of [...chapters, ...extras, { id: 'index' }, { id: 'spec' }, { id: 'exercises' }, { id: 'implementation' }]) {
  if (!fs.existsSync(path.join(docs, entry.id + '.html'))) errors.push('Missing page ' + entry.id);
}
const release = JSON.parse(fs.readFileSync(path.join(root, 'site-release.json'), 'utf8'));
const publishedRelease = JSON.parse(fs.readFileSync(path.join(docs, 'release.json'), 'utf8'));
if (release.version !== publishedRelease.version) errors.push('Published release metadata differs');
if (!fs.readFileSync(path.join(root, 'README.md'), 'utf8').includes('?v=' + release.version)) errors.push('README entry is out of date');
const files = walk(docs);
let links = 0;
let anchors = 0;
let numberedBlocks = 0;
for (const file of files) {
  const html = read(file);
  const relative = path.relative(docs, file).split(path.sep).join('/');
  if (!html.includes('name="sprout-release" content="' + release.version + '"')) errors.push(relative + ': outdated release marker');
  if (html.includes('class="VPFooter')) errors.push(relative + ': redundant footer');
  const pageUrl = new URL(base + relative, origin);
  if (!/<html\b[^>]*\blang=["']zh-CN["']/.test(html)) errors.push(relative + ': missing Chinese document language');
  if ((relative !== '404.html' && !html.includes('VPNav')) || !html.toLowerCase().includes('vitepress')) errors.push(relative + ': missing VitePress layout/runtime');
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => decode(match[1]));
  if (new Set(ids).size !== ids.length) errors.push(relative + ': duplicate element IDs');
  numberedBlocks += (html.match(/class=["'][^"']*line-numbers-mode/g) || []).length;
  // Parse rendered tags only, so attributes shown as escaped example code are ignored.
  for (const tag of html.matchAll(/<[A-Za-z][^>]*>/g)) {
    for (const match of tag[0].matchAll(/\b(?:href|src)=["']([^"']*)["']/g)) {
      const raw = decode(match[1]);
      if (!raw || /^(?:mailto:|tel:|data:|blob:|javascript:)/i.test(raw)) continue;
      let url;
      try { url = new URL(raw, pageUrl); } catch { errors.push(relative + ': malformed URL ' + raw); continue; }
      if (url.origin !== origin) continue;
      links++;
      const target = resolveFile(url);
      if (!target) { errors.push(relative + ': link escapes deployment base ' + raw); continue; }
      if (!fs.existsSync(target)) { errors.push(relative + ': broken resource ' + raw); continue; }
      if (url.hash && target.endsWith('.html')) {
        const id = decodeURIComponent(url.hash.slice(1));
        const targetIds = [...read(target).matchAll(/\bid=["']([^"']+)["']/g)].map(item => decode(item[1]));
        if (!targetIds.includes(id)) errors.push(relative + ': missing heading ' + raw);
        anchors++;
      }
    }
  }
}
for (const file of ['logo-mark.svg', 'logo-lockup.svg', 'logo-mark-mono.svg', 'favicon.svg']) {
  const p = path.join(docs, 'brand', file);
  if (!fs.existsSync(p) || !/<svg\b/.test(fs.readFileSync(p, 'utf8'))) errors.push('Missing/invalid brand SVG: ' + file);
}
const archive = path.join(docs, 'downloads', 'sprout-source.zip');
let archiveFiles = 0;
if (!fs.existsSync(archive)) errors.push('Missing source download');
else {
  try {
    const result = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c',
      'import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; names=z.namelist(); assert "compiler/src/sprout.cpp" in names; assert "compiler/experiments/ai_pipeline_demo.py" in names; print(json.dumps({"files":len(names)}))', archive],
    { encoding: 'utf8' }));
    archiveFiles = result.files;
  } catch (error) { errors.push('Invalid source archive: ' + error.message); }
}
if (numberedBlocks < 100) errors.push('Expected course-wide numbered code blocks');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
const report = { pages: files.length, chapters: chapters.length, localLinks: links, checkedAnchors: anchors, numberedCodeBlocks: numberedBlocks, sourceArchiveFiles: archiveFiles, deploymentBase: base, errors };
fs.mkdirSync(path.join(root, 'verification'), { recursive: true });
fs.writeFileSync(path.join(root, 'verification/vitepress-static-results.json'), JSON.stringify(report, null, 2));
console.log(`PASS: ${files.length} VitePress pages, ${chapters.length} chapters, ${links} local resources, ${anchors} anchors, ${numberedBlocks} numbered code blocks, valid ${archiveFiles}-file source ZIP`);
