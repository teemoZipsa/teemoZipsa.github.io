import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.AUDIT_PORT || 4173);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['.git', 'node_modules'].includes(ent.name)) continue;
      walk(p, out);
    } else if (ent.name.toLowerCase() === 'index.html') {
      out.push(p);
    }
  }
  return out;
}

function discoverPages() {
  const pages = walk(rootDir).filter(file => {
    const rel = path.relative(rootDir, file);
    return !rel.startsWith(`scripts${path.sep}`);
  });
  for (const name of fs.readdirSync(rootDir).filter(name => name.toLowerCase().endsWith('.html'))) {
    const file = path.join(rootDir, name);
    if (fs.existsSync(file)) pages.push(file);
  }
  for (const name of [path.join('en', 'about.html'), path.join('en', 'privacy.html')]) {
    const file = path.join(rootDir, name);
    if (fs.existsSync(file)) pages.push(file);
  }
  return Array.from(new Set(pages)).sort();
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const target = path.normalize(path.join(rootDir, pathname));
      if (!target.startsWith(rootDir) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType(target), 'Cache-Control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err.message || err));
    }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch (err) {
    console.error('Playwright is required for page audit. Run npm ci and npx playwright install chromium.');
    process.exit(1);
  }

  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const context = await browser.newContext();
    await context.addInitScript(async () => {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
        await Promise.all(regs.map(r => r.unregister().catch(() => {})));
      }
      if ('caches' in window) {
        const keys = await caches.keys().catch(() => []);
        await Promise.all(keys.map(k => caches.delete(k).catch(() => {})));
      }
    });
    const files = discoverPages();
    for (const file of files) {
      const relFile = path.relative(rootDir, file).replace(/\\/g, '/');
      const rel = relFile.endsWith('/index.html') ? relFile.slice(0, -'index.html'.length) : relFile;
      const url = `http://127.0.0.1:${port}/${rel}?audit=${Date.now()}`;
      const page = await context.newPage();
      await page.route('**/*', route => {
        const reqUrl = route.request().url();
        if (reqUrl.startsWith(`http://127.0.0.1:${port}/`)) return route.continue();
        return route.abort();
      });
      const errors = [];
      page.on('console', msg => {
        const text = msg.text();
        const externalResourceNoise = /^Failed to load resource: net::ERR_(NETWORK_ACCESS_DENIED|FAILED|BLOCKED_BY_CLIENT)/.test(text);
        if (msg.type() === 'error' && !externalResourceNoise) errors.push(text);
      });
      page.on('pageerror', err => errors.push(err.message));
      const response = await page.goto(url, { waitUntil: 'commit', timeout: 10000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(250);
      const bodyChars = await page.locator('body').innerText({ timeout: 5000 }).then(t => t.length).catch(() => 0);
      if (!response || !response.ok()) failures.push(`${relFile}: HTTP ${response?.status() || 'no response'}`);
      if (bodyChars < 20) failures.push(`${relFile}: body text too short (${bodyChars})`);
      if (errors.length) failures.push(`${relFile}: console errors: ${errors.slice(0, 3).join(' | ')}`);
      await page.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
  if (failures.length) {
    console.error(`Page audit failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
    failures.forEach(f => console.error(`- ${f}`));
    process.exit(1);
  }
  console.log('Page audit passed: all indexed static pages render without console errors.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
