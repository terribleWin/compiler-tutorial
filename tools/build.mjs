import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'vitepress';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import('./prepare-site.mjs');
const python = process.env.PYTHON || 'python';
const packaged = spawnSync(python, ['tools/package.py', '--output', 'site/public/downloads/sprout-source.zip'], { cwd: root, stdio: 'inherit' });
if (packaged.status !== 0) throw new Error('Source packaging failed');
const out = path.resolve(root, 'docs');
// The only removed directory is the reproducible output folder inside this project.
if (path.dirname(out) !== root || path.basename(out) !== 'docs') throw new Error('Unexpected output path');
fs.rmSync(out, { recursive: true, force: true });
await build(path.join(root, 'site'));
console.log('VitePress build complete: docs/ (base /compiler-tutorial/)');
