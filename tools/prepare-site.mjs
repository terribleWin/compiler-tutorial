import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chapters, extras } from './catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
fs.mkdirSync(site, { recursive: true });

function page(id, title, body, extra = {}) {
  body = body.replace(/\[([^\]]+)\]\((downloads\/[^)]+)\)/g,
    (_, label, url) => `<a href="/compiler-tutorial/${url}" download>${label}</a>`);
  const header = Object.entries({ title, ...extra }).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
  fs.writeFileSync(path.join(site, `${id}.md`), `---\n${header}\n---\n\n${body}\n`);
}

for (const entry of [...chapters, ...extras]) {
  let body = read(`content/${entry.id}.md`);
  if (entry.id === 'lab') body = body.replace(/<div class="lab-box">[\s\S]*?<script defer src="assets\/lab\.js"><\/script>/, '<ExpressionLab />');
  if (entry.id === 'tensor-lab') body = body.replace(/<div class="lab-box" id="tensor-lab">[\s\S]*?<script defer src="assets\/tensor-lab\.js"><\/script>/, '<TensorLab />');
  if (entry.id === 'references') {
    for (const note of ['front', 'back', 'ai23']) body += '\n\n' + read(`content/source-notes-${note}.md`).replace(/^#/gm, '##');
    body += '\n\n' + read('compiler/experiments/AI-TUNING-NOTES.md').replace(/^#/gm, '##');
  }
  const chapter = chapters.find(item => item.id === entry.id);
  const meta = chapter ? {
    chapterId: chapter.id,
    prev: chapter.number > 1 ? { text: chapters[chapter.number - 2].title, link: `/${chapters[chapter.number - 2].id}` } : { text: '课程总览', link: '/' },
    next: chapter.number < chapters.length ? { text: chapters[chapter.number].title, link: `/${chapters[chapter.number].id}` } : { text: '结业与学习路线', link: '/roadmap' }
  } : {};
  page(entry.id, entry.title, body, meta);
}

page('spec', 'Sprout 完整语言规范', read('compiler/SPEC.md'));
page('exercises', '从零实现的八个实验', read('compiler/LABS.md'));
page('implementation', 'Sprout 编译器完整实现', '# Sprout 编译器完整实现\n\n建议结合[源码导读](source.html)和[语言规范](spec.html)阅读。源码可通过代码块右上角复制，或[下载单文件](downloads/sprout.cpp)。\n\n```cpp\n' + read('compiler/src/sprout.cpp') + '\n```\n', { outline: false, search: false });

const publicDir = path.join(site, 'public');
const downloads = path.join(publicDir, 'downloads');
fs.mkdirSync(downloads, { recursive: true });
fs.copyFileSync(path.join(root, 'compiler/src/sprout.cpp'), path.join(downloads, 'sprout.cpp'));
for (const name of fs.readdirSync(path.join(root, 'compiler/experiments'))) {
  if (name.endsWith('.py')) fs.copyFileSync(path.join(root, 'compiler/experiments', name), path.join(downloads, name));
}
fs.cpSync(path.join(root, 'brand'), path.join(publicDir, 'brand'), { recursive: true });
fs.writeFileSync(path.join(publicDir, '.nojekyll'), '');
console.log(`Prepared ${chapters.length} chapters and ${extras.length + 3} supporting pages; original Markdown unchanged.`);
