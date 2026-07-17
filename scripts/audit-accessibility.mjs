import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const toolsDir = path.join(rootDir, 'special-chars');
const axePath = path.join(rootDir, 'node_modules', 'axe-core', 'axe.min.js');
const themes = ['light', 'dark'];
const tabControlSelector = [
  '[role="tab"]',
  'button[class*="tab"]'
].join(', ');

function walkToolPages(dir, pages = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walkToolPages(target, pages);
    else if (entry.name.toLowerCase() === 'index.html') pages.push(target);
  }
  return pages;
}

function contentType(file) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      let relative = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
      if (!relative || relative.endsWith('/')) relative += 'index.html';
      const target = path.resolve(rootDir, relative);
      const insideRoot = target === rootDir || target.startsWith(`${rootDir}${path.sep}`);
      if (!insideRoot) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentType(target)
      });
      fs.createReadStream(target).pipe(res);
    } catch (error) {
      res.writeHead(500).end(String(error.message || error));
    }
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function formatViolation(violation) {
  const nodeLimit = 50;
  const nodes = violation.nodes.slice(0, nodeLimit).map(node => {
    const target = node.target.map(part => String(part)).join(' ');
    return `      ${target}: ${node.failureSummary?.replace(/\s+/g, ' ').trim() || 'No failure summary'}`;
  });
  const remainder = violation.nodes.length - nodes.length;
  if (remainder > 0) nodes.push(`      ... and ${remainder} more node(s)`);
  return [
    `  [${violation.impact || 'unscored'}] ${violation.id} (${violation.nodes.length})`,
    `    ${violation.help}: ${violation.helpUrl}`,
    ...nodes
  ].join('\n');
}

async function runAxe(page) {
  return page.evaluate(async () => window.axe.run(document, {
    resultTypes: ['violations'],
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']
    }
  }));
}

async function auditPageStates(page) {
  const tabs = page.locator(tabControlSelector);
  const tabCount = await tabs.count();
  if (!tabCount) return [{ name: 'initial', results: await runAxe(page) }];

  const states = [];
  for (let index = 0; index < tabCount; index++) {
    const tab = tabs.nth(index);
    if (!await tab.isVisible()) continue;
    const label = ((await tab.getAttribute('aria-label')) || (await tab.innerText()) || `tab ${index + 1}`)
      .replace(/\s+/g, ' ')
      .trim();
    await tab.click();
    await page.waitForTimeout(20);
    states.push({ name: `tab: ${label}`, results: await runAxe(page) });
  }

  if (!states.length) states.push({ name: 'initial', results: await runAxe(page) });
  return states;
}

async function main() {
  if (!fs.existsSync(axePath)) {
    throw new Error('axe-core is required. Run npm ci before the accessibility audit.');
  }

  const files = walkToolPages(toolsDir).sort();
  if (!files.length) throw new Error('No special-chars tool pages were found.');

  const server = await startServer();
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  const findings = [];
  let violationCount = 0;
  let affectedNodeCount = 0;
  let stateScanCount = 0;

  try {
    for (const theme of themes) {
      const context = await browser.newContext({ colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.addInitScript(selectedTheme => {
        try {
          localStorage.setItem('theme', selectedTheme);
        } catch {
          // The page-level theme script has the same matchMedia fallback.
        }
      }, theme);
      await context.route('**/*', route => {
        if (route.request().url().startsWith(`${base}/`)) return route.continue();
        return route.abort('blockedbyclient');
      });

      for (const file of files) {
        const relative = path.relative(rootDir, file).replace(/\\/g, '/');
        const route = `/${relative.replace(/index\.html$/i, '')}`;
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        try {
          const response = await page.goto(`${base}${route}?accessibility-audit=1`, {
            waitUntil: 'domcontentloaded',
            timeout: 10000
          });
          if (!response?.ok()) throw new Error(`HTTP ${response?.status() || 'no response'}`);
          // Freeze visual transitions before measuring contrast. Otherwise axe can
          // sample an in-between color from the global theme transition and report
          // a violation that does not exist in the page's settled state.
          await page.addStyleTag({
            content: '*,*::before,*::after{animation:none!important;transition:none!important}'
          });
          await page.waitForTimeout(50);
          await page.addScriptTag({ path: axePath });
          const states = await auditPageStates(page);
          stateScanCount += states.length;

          for (const state of states) {
            for (const violation of state.results.violations) {
              violationCount += 1;
              affectedNodeCount += violation.nodes.length;
              findings.push(`${relative} [${theme}; ${state.name}]\n${formatViolation(violation)}`);
            }
          }
        } catch (error) {
          findings.push(`${relative} [${theme}]\n  [critical] audit-runtime: ${error.message || error}`);
        } finally {
          await page.close().catch(() => {});
        }
      }

      await context.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  if (findings.length) {
    console.error(
      `Accessibility audit failed (${findings.length} enabled WCAG/best-practice violation or runtime finding(s), ` +
      `${violationCount} axe violation(s) affecting ${affectedNodeCount} node(s)):`
    );
    findings.forEach(item => console.error(`\n${item}`));
    process.exit(1);
  }

  console.log(
    `Accessibility audit passed: ${files.length} tool pages in ${themes.length} themes, ` +
    `${stateScanCount} initial/tab state scans, 0 enabled WCAG A/AA or best-practice violations.`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
