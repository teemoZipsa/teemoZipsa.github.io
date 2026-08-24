import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, firefox, webkit } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const failures = [];
const results = [];
let interactionScenarioTotal = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8'
  })[ext] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      let relative = pathname.replace(/^\/+/, '') || 'index.html';
      let target = path.resolve(rootDir, relative);
      if (!target.startsWith(`${rootDir}${path.sep}`) && target !== rootDir) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        target = path.join(target, 'index.html');
      }
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentType(target)
      });
      fs.createReadStream(target).pipe(res);
    } catch (error) {
      res.writeHead(500);
      res.end(String(error.message || error));
    }
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function indexedPaths() {
  const xml = fs.readFileSync(path.join(rootDir, 'sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>(https:\/\/teemozipsa\.com[^<]+)<\/loc>/g)]
    .map(match => new URL(match[1]));
  assert(urls.length > 0, 'sitemap.xml contains no indexed URLs');
  return urls.map(url => `${url.pathname}${url.search}`);
}

function toolPaths() {
  const toolsRoot = path.join(rootDir, 'special-chars');
  const paths = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(target);
      } else if (entry.name.toLowerCase() === 'index.html') {
        const relativeDirectory = path.relative(rootDir, directory).split(path.sep).join('/');
        paths.push(`/${relativeDirectory}/`);
      }
    }
  }

  walk(toolsRoot);
  assert(paths.length > 0, 'No special-chars tool pages were found');
  return paths.sort();
}

function auditedPaths() {
  const indexed = indexedPaths();
  const tools = toolPaths();
  return {
    indexedCount: indexed.length,
    toolCount: tools.length,
    paths: [...new Set([...indexed, ...tools])]
  };
}

async function layoutState(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    const offenders = [...document.body.querySelectorAll('*')]
      .filter(element => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.right > viewportWidth + 1 || rect.left < -1);
      })
      .slice(0, 5)
      .map(element => {
        const tag = element.tagName.toLowerCase();
        if (element.id) return `${tag}#${element.id}`;
        const classes = [...element.classList].slice(0, 2);
        return `${tag}${classes.length ? `.${classes.join('.')}` : ''}`;
      });
    const smallTargets = [...document.querySelectorAll('button, [role="button"], [role="tab"]')]
      .filter(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return !element.disabled && style.display !== 'none' && style.visibility !== 'hidden' &&
          rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24);
      })
      .slice(0, 8)
      .map(element => {
        const rect = element.getBoundingClientRect();
        const name = element.id ? `#${element.id}` :
          (element.getAttribute('aria-label') || element.textContent || element.tagName).trim().replace(/\s+/g, ' ').slice(0, 30);
        return `${name} (${rect.width.toFixed(1)}x${rect.height.toFixed(1)})`;
      });
    return {
      bodyChars: document.body?.innerText.trim().length || 0,
      hasViewportMeta: Boolean(document.querySelector('meta[name="viewport"]')),
      viewportWidth,
      scrollWidth,
      overflow: Math.max(0, scrollWidth - viewportWidth),
      offenders,
      smallTargets
    };
  });
}

function attachDiagnostics(page, base) {
  const problems = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // Third-party scripts are deliberately blocked so the audit remains local.
    if (/^Failed to load resource:/i.test(text)) return;
    if (/Cross-Origin Request Blocked:/i.test(text)) return;
    if (/integrity attribute match/i.test(text)) return;
    problems.push(`console: ${text}`);
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith(`${base}/`)) {
      problems.push(`request failed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`);
    }
  });
  page.on('response', response => {
    if (response.url().startsWith(`${base}/`) && response.status() >= 400) {
      problems.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  return problems;
}

async function openPage(context, base, routePath) {
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const problems = attachDiagnostics(page, base);
  const separator = routePath.includes('?') ? '&' : '?';
  const response = await page.goto(`${base}${routePath}${separator}browser_matrix=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000
  });
  assert(response?.ok(), `${routePath} returned ${response?.status() || 'no response'}`);
  await page.waitForTimeout(100);
  return { page, problems };
}

async function smokeAuditedPages(context, base, paths, config) {
  let passed = 0;
  for (const routePath of paths) {
    let page;
    try {
      const opened = await openPage(context, base, routePath);
      page = opened.page;
      const { problems } = opened;
      const layout = await layoutState(page);
      assert(layout.bodyChars >= 20, `${routePath} body text is too short (${layout.bodyChars})`);
      assert(layout.hasViewportMeta, `${routePath} is missing a viewport meta tag`);
      assert(
        layout.overflow <= 1,
        `${routePath} overflows horizontally by ${layout.overflow}px${layout.offenders.length ? ` (${layout.offenders.join(', ')})` : ''}`
      );
      if (config.hasTouch) {
        assert(
          layout.smallTargets.length === 0,
          `${routePath} has touch targets smaller than 24px: ${layout.smallTargets.join(', ')}`
        );
      }
      assert(problems.length === 0, `${routePath}: ${problems.slice(0, 4).join(' | ')}`);
      passed += 1;
    } catch (error) {
      failures.push(`${config.name} / ${routePath}: ${error.message || error}`);
    } finally {
      await page?.close().catch(() => {});
    }
  }
  results.push(`${config.name}: ${passed}/${paths.length} audited pages rendered without errors or horizontal overflow`);
}

async function runScenario(context, base, config, name, routePath, run) {
  const { page, problems } = await openPage(context, base, routePath);
  try {
    await run(page);
    await page.waitForTimeout(50);
    const layout = await layoutState(page);
    assert(layout.overflow <= 1, `interaction caused ${layout.overflow}px horizontal overflow`);
    assert(problems.length === 0, problems.slice(0, 4).join(' | '));
    return true;
  } catch (error) {
    failures.push(`${config.name} / ${name}: ${error.message || error}`);
    return false;
  } finally {
    await page.close();
  }
}

async function runInteractions(context, base, config) {
  const activate = locator => config.hasTouch ? locator.tap() : locator.click();
  const scenarios = [
    ['timezone conversion', '/special-chars/timezone-conv/', async page => {
      await page.locator('#fromTz').selectOption('Asia/Seoul');
      await page.locator('#toTz').selectOption('America/New_York');
      await page.locator('#fromDate').fill('2026-01-01');
      await page.locator('#fromTime').fill('12:00');
      await page.locator('#fromTime').dispatchEvent('change');
      await page.waitForFunction(() => document.querySelector('#toResult')?.textContent.trim() !== '--:--');
      assert(await page.locator('#toResult').innerText() === '22:00', 'Seoul noon did not convert to 22:00 New York time');
      assert((await page.locator('#toResultDate').innerText()).startsWith('2025-12-31'), 'converted calendar date is wrong');
    }],
    ['VAT-inclusive discount', '/special-chars/discount-calc/', async page => {
      await page.locator('#price').fill('11000');
      await page.locator('#discountRate').fill('10');
      await activate(page.locator('.toggle-row').nth(0));
      await activate(page.locator('.toggle-row').nth(1));
      assert(await page.locator('#vatToggle').isChecked(), 'the visible VAT toggle did not select VAT');
      assert(!await page.locator('#vatExToggle').isChecked(), 'the visible tax-exclusive toggle did not turn off');
      assert((await page.locator('#resFinal').innerText()).includes('9,900'), 'expected a final price of 9,900');
    }],
    ['password touch and generation', '/special-chars/password-gen/', async page => {
      await page.locator('#pwLength').fill('20');
      await page.locator('#pwLength').dispatchEvent('input');
      await activate(page.locator('.btn-regen'));
      const password = (await page.locator('#pwText').innerText()).trim();
      assert(password.length === 20, `expected 20 characters, got ${password.length}`);
      assert(/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password), 'generated password omitted a selected character group');
      assert(/[^A-Za-z0-9]/.test(password), 'generated password omitted the selected special-character group');
    }],
    ['timer touch controls', '/special-chars/timer/', async page => {
      await activate(page.locator('.quick-btn').first());
      assert(await page.locator('#display').innerText() === '01:00', '1-minute quick setting did not update the display');
      await activate(page.locator('#btnStart'));
      await page.waitForTimeout(120);
      await activate(page.locator('#btnStart'));
      assert((await page.locator('#display').innerText()).startsWith('00:59'), 'timer did not start and stop through the visible control');
    }],
    ['daily quest tab linkage', '/special-chars/daily-quest/', async page => {
      await activate(page.locator('#journeyGameTab'));
      assert(await page.locator('#journeyGamePanel').isVisible(), 'game tab did not reveal the quest progress panel');
      await activate(page.locator('#journeyShopTab'));
      assert(await page.locator('#journeyShopPanel').isVisible(), 'shop tab did not reveal quest rewards');
      assert(await page.locator('.shop-item').count() === 6, 'daily quest shop inventory was incomplete');
    }]
  ];

  if (config.testAudioWorklet) {
    scenarios.push(['sample-accurate metronome lifecycle', '/special-chars/music-calc/', async page => {
      await page.evaluate(() => {
        switchTab(1);
        window.__browserMatrixMetroFrames = [];
        const dots = document.querySelector('#beatDots');
        new MutationObserver(() => {
          const frame = Number(dots.dataset.lastAudioFrame);
          if (Number.isFinite(frame) && window.__browserMatrixMetroFrames.at(-1) !== frame) {
            window.__browserMatrixMetroFrames.push(frame);
          }
        }).observe(dots, { attributes: true, attributeFilter: ['data-last-audio-frame'] });
        // 173 BPM yields a fractional frame interval at common 44.1/48 kHz
        // sample rates, so the test catches cumulative rounding drift too.
        setMetroBpm(173);
      });
      await activate(page.locator('#metroPlayBtn'));
      await page.waitForFunction(() => window.__browserMatrixMetroFrames.length >= 9, null, { timeout: 7000 });
      const state = await page.evaluate(() => ({
        engine: document.querySelector('#beatDots').dataset.engine,
        frames: window.__browserMatrixMetroFrames.slice(0, 9),
        sampleRate: Number(document.querySelector('#beatDots').dataset.sampleRate)
      }));
      assert(state.engine === 'audio-worklet', `metronome fell back to ${state.engine}`);
      const expectedFrames = state.sampleRate * 60 / 173;
      const intervals = state.frames.slice(1).map((frame, index) => frame - state.frames[index]);
      assert(intervals.every(interval => Math.abs(interval - expectedFrames) <= 2), `metronome frame drift: ${intervals.join(', ')} vs ${expectedFrames}`);
      assert(Math.abs((state.frames.at(-1) - state.frames[0]) - expectedFrames * 8) <= 2, 'metronome accumulated frame drift');

      await activate(page.locator('#metroPlayBtn'));
      await page.waitForFunction(() => metroCtx?.state === 'suspended');
      const framesBeforeRestart = await page.evaluate(() => window.__browserMatrixMetroFrames.length);
      await activate(page.locator('#metroPlayBtn'));
      await page.waitForFunction(previous => window.__browserMatrixMetroFrames.length > previous, framesBeforeRestart);
      await activate(page.locator('#metroPlayBtn'));
      await page.waitForFunction(() => metroCtx?.state === 'suspended');
    }]);
  }

  let passed = 0;
  interactionScenarioTotal += scenarios.length;
  for (const [name, routePath, run] of scenarios) {
    if (await runScenario(context, base, config, name, routePath, run)) passed += 1;
  }
  results.push(`${config.name}: ${passed}/${scenarios.length} high-risk interaction scenarios passed`);
}

async function auditConfiguration(config, base, paths) {
  let browser;
  try {
    browser = await config.browserType.launch({ headless: true });
  } catch (error) {
    throw new Error(`${config.name} could not launch. Run "npx playwright install ${config.installName}". ${error.message || error}`);
  }

  try {
    const context = await browser.newContext({
      ...config.contextOptions,
      serviceWorkers: 'block'
    });
    await context.route('**/*', route => {
      if (route.request().url().startsWith(`${base}/`)) return route.continue();
      return route.abort('blockedbyclient');
    });
    try {
      await smokeAuditedPages(context, base, paths, config);
      await runInteractions(context, base, config);
    } catch (error) {
      failures.push(`${config.name} / audited-page smoke: ${error.message || error}`);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const server = await startServer();
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const auditState = auditedPaths();
  const { paths } = auditState;
  const configurations = [
    {
      name: 'Chromium desktop',
      browserType: chromium,
      installName: 'chromium',
      hasTouch: false,
      testAudioWorklet: true,
      contextOptions: { viewport: { width: 1366, height: 768 } }
    },
    {
      name: 'Firefox desktop',
      browserType: firefox,
      installName: 'firefox',
      hasTouch: false,
      testAudioWorklet: true,
      contextOptions: { viewport: { width: 1366, height: 768 } }
    },
    {
      name: 'WebKit desktop',
      browserType: webkit,
      installName: 'webkit',
      hasTouch: false,
      contextOptions: { viewport: { width: 1366, height: 768 } }
    },
    {
      name: 'Pixel 7 Chromium emulation',
      browserType: chromium,
      installName: 'chromium',
      hasTouch: true,
      contextOptions: { ...devices['Pixel 7'] }
    },
    {
      name: 'iPhone 15 WebKit emulation',
      browserType: webkit,
      installName: 'webkit',
      hasTouch: true,
      contextOptions: { ...devices['iPhone 15'] }
    }
  ];

  try {
    for (const config of configurations) {
      await auditConfiguration(config, base, paths);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  results.forEach(result => console.log(`PASS ${result}`));
  if (failures.length) {
    console.error(`Browser matrix audit failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log(
    `Browser matrix audit passed: ${paths.length} unique pages (${auditState.toolCount} tool pages, ` +
    `${auditState.indexedCount} sitemap paths) across 5 desktop/mobile configurations and ` +
    `${interactionScenarioTotal} browser-profile interaction runs.`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
