import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chapters,extras} from './catalog.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),docs=path.join(root,'docs');
const errors=[];let links=0,blocks=0;const files=fs.readdirSync(docs).filter(x=>x.endsWith('.html'));
for(const c of [...chapters,...extras])if(!fs.existsSync(path.join(docs,c.id+'.html')))errors.push('Missing page '+c.id);
for(const file of files){const html=fs.readFileSync(path.join(docs,file),'utf8');if(!html.includes('lang="zh-CN"'))errors.push(file+': language');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);if(new Set(ids).size!==ids.length)errors.push(file+': duplicate IDs');for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){const url=match[1];if(/^(https?:|mailto:|data:)/.test(url))continue;links++;const [relative,hash]=url.split('#');const target=path.resolve(docs,decodeURIComponent(relative||file));if(!fs.existsSync(target)){errors.push(file+': broken link '+url);continue}if(hash&&target.endsWith('.html')){const targetText=target===path.join(docs,file)?html:fs.readFileSync(target,'utf8');if(!targetText.includes('id="'+hash+'"'))errors.push(file+': missing anchor '+url)}}blocks+=(html.match(/class="code-line"/g)||[]).length;if(/TODO|\[待补充\]|敬请期待/.test(html))errors.push(file+': unresolved placeholder');}
const index=JSON.parse(fs.readFileSync(path.join(docs,'assets/search.json'),'utf8'));if(index.length<28)errors.push('Incomplete search index');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}console.log(`PASS: ${files.length} HTML pages, ${links} local links, ${blocks} numbered code lines, ${index.length} search entries`);
