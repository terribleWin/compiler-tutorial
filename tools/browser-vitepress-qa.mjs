// Optional browser QA. Override PLAYWRIGHT_MODULE and BROWSER_PATH outside Codex.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const deploymentBase = '/compiler-tutorial/';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/skam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.zip': 'application/zip' };
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end(); return; }
  if (pathname === deploymentBase.slice(0, -1)) { res.writeHead(302, { Location: deploymentBase }); res.end(); return; }
  if (!pathname.startsWith(deploymentBase)) { res.writeHead(404); res.end(); return; }
  const relative = pathname.slice(deploymentBase.length);
  let file = path.resolve(docs, relative || 'index.html');
  if (!file.startsWith(docs + path.sep)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && !path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const base = origin + deploymentBase;
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
await context.addInitScript(() => {
  if (!localStorage.getItem('sprout-progress')) localStorage.setItem('sprout-progress', JSON.stringify(['chapter01', 'chapter10']));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__sproutQaCopied = text; } } });
});
const page = await context.newPage();
const errors = [];
const failedResources = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`); });
const screenshotDir = path.join(root, 'verification/browser-vitepress');
fs.mkdirSync(screenshotDir, { recursive: true });
let checks = 0;
const evidence = [];
function check(condition, description) { assert.ok(condition, description); checks++; evidence.push(description); }
const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
async function screenshot(name, fullPage = false) { await page.screenshot({ path: path.join(screenshotDir, name + '.png'), fullPage }); }
async function navigate(name) {
  await page.goto(base + name);
  await page.locator('.VPNavBar').waitFor();
  await page.waitForFunction(() => !!document.querySelector('#app')?.__vue_app__);
}
async function spa(name) {
  await page.evaluate(() => { window.__sproutQaSpaMarker ||= 'preserve-app-instance'; });
  const href = deploymentBase + name;
  const extensionless = href.replace(/\.html$/, '');
  const link = page.locator(`a[href="${href}"], a[href="${extensionless}"]`).first();
  assert.ok(await link.count(), 'Existing internal route link: ' + name);
  await link.evaluate(element => element.click());
  await page.waitForURL(new RegExp('/' + name.replace('.', '\\.') + '$'));
  await page.waitForFunction(() => !!document.querySelector('#app')?.__vue_app__);
  check(await page.evaluate(() => window.__sproutQaSpaMarker === 'preserve-app-instance'), 'SPA navigation retains application: ' + name);
}

try {
  await navigate('');
  check((await page.title()).includes('Sprout'), 'VitePress home title');
  check(await page.locator('.VPHomeHero').count() === 1, 'Native VitePress home layout');
  const logo = page.locator('.VPNavBarTitle img.logo').first();
  await logo.waitFor();
  check(await logo.evaluate(img => img.complete && img.naturalWidth > 0 && img.currentSrc.includes('/brand/logo-mark.svg')), 'Brand SVG loads in navigation');
  check(await page.locator('.VPFeature').count() === 3, 'Minimal homepage has three course entries');
  check(await page.locator('.VPFooter').count() === 0, 'Redundant site footer removed');
  check(await page.locator('.sprout-practice-card img').count() === 2, 'Two educational experiment illustrations');
  for(const picture of await page.locator('.sprout-practice-card img').all()) {
    await picture.scrollIntoViewIfNeeded();
    await picture.evaluate(img => img.decode());
    check(await picture.evaluate(img => img.naturalWidth > 0), 'Educational illustration loads');
  }
  await page.evaluate(() => scrollTo(0, 0));
  check(await noOverflow(), 'Desktop homepage fits viewport');
  await screenshot('home-desktop', true);
  await page.locator('.VPNavBar .VPSwitchAppearance').first().click();
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  await screenshot('home-dark', true);
  await page.locator('.VPNavBar .VPSwitchAppearance').first().click();
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));

  await navigate('chapter07.html');
  check(await page.locator('.VPSidebar').count() === 1, 'Native VitePress course sidebar');
  check(await page.locator('.VPSidebar a[href*="chapter"]').count() >= 25, 'All 25 chapters in sidebar');
  const desktopFont = await page.locator('.vp-doc p').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  check(desktopFont >= 18, 'Desktop body text is at least 18 px');
  check(await page.locator('#progress-count').textContent().then(text => text.includes('2 / 25')), 'Existing learning progress migrates');
  await page.locator('#mark-complete').check();
  await page.reload();
  await page.locator('#mark-complete').waitFor();
  check(await page.locator('#mark-complete').isChecked(), 'Chapter progress survives reload');
  check((await page.locator('#progress-count').textContent()).includes('3 / 25'), 'Progress count updates');

  const themeSwitch = page.locator('.VPNavBar .VPSwitchAppearance').first();
  await themeSwitch.click();
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  check(await page.locator('html').evaluate(element => element.classList.contains('dark')), 'Dark appearance toggle');
  await page.reload();
  check(await page.locator('html').evaluate(element => element.classList.contains('dark')), 'Appearance preference survives reload');
  await screenshot('chapter-dark');
  await page.locator('.VPNavBar .VPSwitchAppearance').first().click();
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));

  await page.locator('.VPNavBarSearch button').first().click();
  await page.locator('#localsearch-input').fill('SSA');
  await page.locator('.VPLocalSearchBox .result').first().waitFor();
  check(await page.locator('.VPLocalSearchBox .result').count() > 0, 'Built-in local full-text search finds SSA');
  await page.locator('#localsearch-input').fill('作用域');
  await page.waitForFunction(() => [...document.querySelectorAll('.VPLocalSearchBox .result')].some(el => el.textContent.includes('作用域')));
  check(await page.locator('.VPLocalSearchBox .result').count() > 0, 'Built-in search supports Chinese keywords');
  await page.keyboard.press('Escape');
  await page.locator('.VPLocalSearchBox').waitFor({ state: 'detached' });

  await spa('chapter23.html');
  const block = page.locator('.vp-doc div.language-python').first();
  await block.locator('.sprout-code-toolbar').waitFor();
  check(await block.locator('.line-numbers-wrapper .line-number').count() > 20, 'Native code line numbers');
  check(await block.locator('pre code span[style]').count() > 20, 'Shiki code syntax colors');
  const originalCode = await block.locator('pre code').textContent();
  await block.locator('button.copy').click({ force: true });
  await page.waitForFunction(() => typeof window.__sproutQaCopied === 'string');
  const copied = await page.evaluate(() => window.__sproutQaCopied);
  check(copied === originalCode, 'Native copy preserves exact code and newlines without line-number gutter');
  check(copied.includes('\n\n') && copied.includes('def '), 'Copied Python retains blank lines and indentation');
  for (const [action, className] of [['lines', 'sprout-code-no-lines'], ['wrap', 'sprout-code-wrap'], ['fold', 'sprout-code-folded']]) {
    await block.locator(`[data-action="${action}"]`).click();
    check(await block.evaluate((element, name) => element.classList.contains(name), className), 'Code control: ' + action);
    if (action === 'wrap') {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const alignment = await block.evaluate(element => {
        const lines = [...element.querySelectorAll('pre code .line')];
        const numbers = [...element.querySelectorAll('.line-numbers-wrapper .line-number')];
        const first = lines.findIndex(line => line.textContent.length > 0);
        const baseline = lines[first].getBoundingClientRect().top - numbers[first].getBoundingClientRect().top;
        const wrapped = lines.findIndex(line => line.getClientRects().length > 1);
        return { wrapped, delta: wrapped < 0 ? 0 : Math.abs(lines[wrapped].getBoundingClientRect().top - numbers[wrapped].getBoundingClientRect().top - baseline) };
      });
      check(alignment.wrapped < 0 || alignment.delta < 3, 'Wrapped code line numbers align with their source lines');
    }
    await block.locator(`[data-action="${action}"]`).click();
    check(!(await block.evaluate((element, name) => element.classList.contains(name), className)), 'Code control restores: ' + action);
  }
  await block.locator('[data-action="fullscreen"]').click();
  check(await block.evaluate(element => element.classList.contains('sprout-code-fullscreen')), 'Code fullscreen');
  check(await block.evaluate(element => {
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(box.left + box.width / 2, box.top + 22));
  }), 'Fullscreen code toolbar renders above site navigation');
  await screenshot('code-fullscreen');
  await page.keyboard.press('Escape');
  check(!(await block.evaluate(element => element.classList.contains('sprout-code-fullscreen'))), 'Escape exits code fullscreen');
  await block.evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => scrollBy(0, -110));
  await screenshot('code-desktop');

  await spa('lab.html');
  await page.locator('#expression').waitFor();
  check(await page.locator('#expression').count() === 1, 'One expression component after SPA entry');
  await page.locator('#run').click();
  check(await page.locator('#lab-result').textContent() === '11', 'Expression compiler default result');
  await page.locator('[data-expression="20 - 5 - 3"]').click();
  await page.locator('#run').click();
  check(await page.locator('#lab-result').textContent() === '12', 'Expression left-associativity');
  await page.locator('[data-expression="1 / (3 - 3)"]').click();
  await page.locator('#run').click();
  check((await page.locator('#lab-error').textContent()).includes('0'), 'Expression division-by-zero diagnostic');
  await page.locator('[data-expression="2147483647 + 1"]').click();
  await page.locator('#run').click();
  check((await page.locator('#lab-error').textContent()).includes('溢出'), 'Expression int32 overflow diagnostic');
  await page.locator('#expression').fill('-2147483648 % -1');
  await page.locator('#compile').click();
  await page.locator('#run').click();
  check(await page.locator('#lab-result').textContent() === '0', 'Expression minimum-int remainder');
  await page.locator('#expression').fill('2 + 3 * 4');
  await page.locator('#compile').click();
  await page.locator('#step').click();
  check(await page.locator('#lab-stack').textContent() === '[2]', 'Single instruction per step click');
  await page.locator('[data-tab="bytecode"]').click();
  check((await page.locator('#lab-output').textContent()).includes('MUL'), 'Expression bytecode view');
  await screenshot('expression-desktop');

  await spa('tensor-lab.html');
  await page.locator('#tensor-step').waitFor();
  await page.locator('#tensor-step').click();
  check((await page.locator('#tensor-counter').textContent()).startsWith('1 /'), 'Tensor single-block stepping');
  check(await page.locator('.matrix-cell.selected').count() === 12, 'Tensor active A/B/C tile regions');
  await page.locator('#tensor-run').click();
  check((await page.locator('#tensor-verdict').textContent()).includes('验证通过'), 'Tensor reference verification');
  check(await page.locator('#tensor-loads').textContent() === '64', 'Tensor ideal input-load count');
  check(await page.locator('#tensor-flops').textContent() === '128', 'Tensor arithmetic count');
  for (const n of ['4', '8']) for (const tile of ['1', '2', '4']) {
    await page.locator('#matrix-size').selectOption(n);
    await page.locator('#tile-size').selectOption(tile);
    await page.locator('#tensor-run').click();
    check((await page.locator('#tensor-verdict').textContent()).includes('验证通过'), `Tensor exact result ${n}/${tile}`);
  }
  await screenshot('tensor-desktop');
  for (let round = 0; round < 2; round++) {
    await spa('lab.html');
    await page.locator('#run').waitFor();
    await page.locator('#run').click();
    check(await page.locator('#lab-result').textContent() === '11', 'Expression component remount resets state ' + round);
    await page.locator('#reset').click();
    await page.locator('#step').click();
    check(await page.locator('#lab-pc').textContent() === '1', 'No duplicate expression listeners ' + round);
    await spa('tensor-lab.html');
    await page.locator('#tensor-step').waitFor();
    await page.locator('#tensor-step').click();
    check((await page.locator('#tensor-counter').textContent()).startsWith('1 /'), 'No duplicate tensor listeners ' + round);
  }

  const response = await page.request.get(base + 'downloads/sprout-source.zip');
  const zip = await response.body();
  check(response.status() === 200 && zip.subarray(0, 2).toString() === 'PK' && zip.includes(Buffer.from('compiler/src/sprout.cpp')), 'Source archive download works under deployment base');
  for (const name of ['index.html', 'chapter08.html', 'chapter23.html', 'lab.html', 'tensor-lab.html']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await navigate(name);
    check(await noOverflow(), name + ' mobile page has no horizontal overflow');
    if (name === 'chapter08.html') {
      const font = await page.locator('.vp-doc p').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize));
      check(font >= 17, 'Mobile body text is at least 17 px');
      await page.locator('.VPLocalNav button.menu').click();
      check(await page.locator('.VPSidebar').evaluate(element => element.classList.contains('open')), 'Mobile chapter navigation opens');
      await page.locator('.VPBackdrop').click({ position: { x: 382, y: 400 } });
      await page.waitForFunction(() => !document.querySelector('.VPSidebar')?.classList.contains('open'));
      await page.locator('.VPBackdrop').waitFor({ state: 'hidden' });
      check(page.url().endsWith('chapter08.html'), 'Closing mobile sidebar preserves current chapter');
    }
    await screenshot(name.replace('.html', '') + '-mobile');
  }
  const release = JSON.parse(fs.readFileSync(path.join(root, 'site-release.json'), 'utf8'));
  const cachedEntry = base + '?stale-test=1';
  await page.route(cachedEntry, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replaceAll(release.version, 'obsolete-cached-release');
    await route.fulfill({response, body});
  });
  await page.goto(cachedEntry + '#practice-title').catch(error => {if(!error.message.includes('ERR_ABORTED'))throw error});
  await page.waitForURL(url => url.searchParams.get('v') === release.version);
  await page.waitForFunction(() => !!document.querySelector('#app')?.__vue_app__);
  const refreshed = new URL(page.url());
  check(refreshed.searchParams.get('stale-test') === '1' && refreshed.hash === '#practice-title', 'Stale page refresh preserves route query and anchor');
  check(await page.locator('meta[name="sprout-release"]').getAttribute('content') === release.version, 'Stale cached HTML refreshes to current release');
  await page.unroute(cachedEntry);
  check(errors.length === 0, 'No uncaught browser JavaScript errors: ' + errors.join('; '));
  check(failedResources.length === 0, 'No failed same-origin resources: ' + failedResources.join('; '));
  const report = { browser: 'Microsoft Edge (Chromium), headless', viewports: ['1440x1000', '390x844'], deploymentBase, bodyFontPx: { desktop: desktopFont, mobileMinimum: 17 }, passed: checks, checks: evidence, errors, failedResources };
  fs.writeFileSync(path.join(root, 'verification/vitepress-browser-results.json'), JSON.stringify(report, null, 2));
  console.log(`PASS ${checks} VitePress browser checks`);
} catch (error) {
  await screenshot('failure').catch(() => {});
  console.error(JSON.stringify({ completedChecks: checks, lastUrl: page.url(), browserErrors: errors, failedResources }, null, 2));
  throw error;
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
