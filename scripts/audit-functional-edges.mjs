import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function contentType(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      let target = path.resolve(rootDir, pathname.replace(/^\/+/, '') || 'index.html');
      if (!target.startsWith(`${rootDir}${path.sep}`) && target !== rootDir) { res.writeHead(403); res.end('Forbidden'); return; }
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': contentType(target), 'Cache-Control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    } catch (error) {
      res.writeHead(500); res.end(String(error.message || error));
    }
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });

  async function scenario(name, routePath, run, options = {}) {
    const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: options.timezoneId });
    if (options.initScript) await context.addInitScript(options.initScript);
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (url.startsWith(`${base}/`)) return route.continue();
      if (options.externalRoute) {
        const handled = await options.externalRoute(route);
        if (handled) return;
      }
      return route.abort('failed');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    try {
      const response = await page.goto(`${base}${routePath}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      assert(response?.ok(), `${routePath} returned ${response?.status() || 'no response'}`);
      await run(page);
      assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);
      passed += 1;
    } catch (error) {
      failures.push(`${name}: ${error.message || error}`);
    } finally {
      await context.close().catch(() => {});
    }
  }

  await scenario('English wage decimals and neutral rules', '/special-chars/en/wage-calc/', async page => {
    assert(await page.locator('#weeklyHol').count() === 0, 'country-specific weekly allowance control still exists');
    await page.fill('#hourly', '15.50');
    const values = await page.evaluate(() => ({ hourly: rHourly.textContent, monthly: rMonthly.textContent, yearly: rYearly.textContent }));
    assert(values.hourly === '$15.50' && values.monthly === '$2,686.67' && values.yearly === '$32,240.00', `decimal wage conversion is wrong: ${JSON.stringify(values)}`);
    await page.evaluate(() => applyMinWage());
    const minimum = await page.evaluate(() => ({ input: hourly.value, hourly: rHourly.textContent, monthly: rMonthly.textContent }));
    assert(minimum.input === '7.25' && minimum.hourly === '$7.25' && minimum.monthly === '$1,256.67', `quick decimal rate is wrong: ${JSON.stringify(minimum)}`);
  });

  for (const [name, routePath, input, expected] of [
    ['Korean zodiac date-only parsing', '/special-chars/zodiac-calc/', '2024-03-21', '양자리'],
    ['English zodiac date-only parsing', '/special-chars/en/zodiac-calc/', '2024-03-21', 'Aries'],
    ['Lunar zodiac date-only parsing', '/special-chars/zodiac-animal/', '2024-02-10', '용띠']
  ]) {
    await scenario(name, routePath, async page => {
      await page.fill('#birthDate', input);
      const result = await page.locator('#resultName, #animalName').first().innerText();
      assert(result.includes(expected), `expected ${expected}, got ${result}`);
    }, { timezoneId: 'America/Los_Angeles' });
  }

  for (const [name, routePath, expectedMessage] of [
    ['Korean date adjustment bounds', '/special-chars/date-calc/', '-100,000'],
    ['English date adjustment bounds', '/special-chars/en/date-calc/', '-100,000']
  ]) {
    await scenario(name, routePath, async page => {
      const state = await page.evaluate(() => {
        dateBase.value = '2026-01-01'; dateDays.value = '1000000000'; calcDateAdd();
        return { result: dateAddValue.textContent, message: dateAddSub.textContent, invalid: dateDays.getAttribute('aria-invalid') };
      });
      assert(state.result === '-' && state.invalid === 'true' && state.message.includes(expectedMessage), `huge day adjustment leaked: ${JSON.stringify(state)}`);
    });
  }

  for (const [name, routePath] of [
    ['Korean strict color parsing', '/special-chars/color-conv/'],
    ['English strict color parsing', '/special-chars/en/color-conv/']
  ]) {
    await scenario(name, routePath, async page => {
      const state = await page.evaluate(() => ({
        badHex: fromHex('fffffg'), hexInvalid: hexInput.getAttribute('aria-invalid'),
        badRgb: fromRgb('rgb(999, 0, 0)'), rgbInvalid: rgbInput.getAttribute('aria-invalid'),
        badHsl: fromHsl('hsl(0, 101%, 50%)'), hslInvalid: hslInput.getAttribute('aria-invalid'),
        unchanged: JSON.stringify(currentRgb)
      }));
      assert(state.badHex === false && state.badRgb === false && state.badHsl === false, `invalid color was accepted: ${JSON.stringify(state)}`);
      assert(state.hexInvalid === 'true' && state.rgbInvalid === 'true' && state.hslInvalid === 'true' && state.unchanged === '{"r":83,"g":52,"b":131}', `invalid color mutated state: ${JSON.stringify(state)}`);
      const valid = await page.evaluate(() => ({ accepted: fromHsl('hsl(120, 100%, 50%)'), color: rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b) }));
      assert(valid.accepted === true && valid.color === '#00ff00', `valid HSL was rejected: ${JSON.stringify(valid)}`);
    });
  }

  for (const [name, routePath] of [
    ['Korean grapheme and EUC-KR handling', '/special-chars/char-counter/'],
    ['English grapheme and EUC-KR handling', '/special-chars/en/char-counter/']
  ]) {
    await scenario(name, routePath, async page => {
      await page.fill('#counterInput', '👨‍👩‍👧‍👦');
      await page.selectOption('#limitType', 'bytes-euckr');
      const emoji = await page.evaluate(() => ({ chars: statChars.textContent, bytes: statBytes.textContent, type: statBytesType.textContent }));
      assert(emoji.chars === '1' && emoji.bytes === '—' && /불가|unsupported/.test(emoji.type), `combined emoji was miscounted: ${JSON.stringify(emoji)}`);
      await page.fill('#counterInput', '한글');
      const korean = await page.evaluate(() => ({ chars: statChars.textContent, bytes: statBytes.textContent }));
      assert(korean.chars === '2' && korean.bytes === '4', `representable EUC-KR text is wrong: ${JSON.stringify(korean)}`);
    });
  }

  for (const [name, routePath] of [
    ['Korean timer elapsed-time reconciliation', '/special-chars/timer/'],
    ['English timer elapsed-time reconciliation', '/special-chars/en/timer/']
  ]) {
    await scenario(name, routePath, async page => {
      const state = await page.evaluate(() => {
        window.__alarms = 0; playAlarm = () => { window.__alarms += 1; };
        tHour.value = '0'; tMin.value = '0'; tSec.value = '1'; syncTimerFromInputs(); doStartStop();
        timerEndTime = Date.now() - 1; reconcileRunningClock();
        return { running, timerFinished, display: display.textContent, alarms: window.__alarms };
      });
      assert(!state.running && state.timerFinished && state.display === '00:00' && state.alarms === 1, `expired timer did not reconcile: ${JSON.stringify(state)}`);
    });
  }

  const visitRequests = [];
  const firebaseMock = async route => {
    if (!route.request().url().startsWith('https://teemozipsa-default-rtdb.firebaseio.com/')) return false;
    const request = route.request();
    visitRequests.push({ method: request.method(), headers: request.headers(), body: request.postData() });
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, if-match, x-firebase-etag', 'Access-Control-Expose-Headers': 'ETag' };
    if (request.method() === 'OPTIONS') await route.fulfill({ status: 204, headers: cors, body: '' });
    else if (request.method() === 'GET') await route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json', ETag: '"v1"' }, body: '10' });
    else await route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: '11' });
    return true;
  };

  await scenario('homepage atomic visit and corrupt storage', '/', async page => {
    await page.waitForFunction(() => globalVisitCount === 11);
    const state = await page.evaluate(() => ({ count: globalVisitCount, favorites, recentTools }));
    assert(state.count === 11 && state.favorites.length === 0 && state.recentTools.length === 0, `homepage recovery failed: ${JSON.stringify(state)}`);
    const put = visitRequests.find(request => request.method === 'PUT');
    assert(put?.headers['if-match'] === '"v1"' && put.body === '11', `visitor update was not conditional: ${JSON.stringify(visitRequests)}`);
  }, {
    initScript: () => { localStorage.setItem('favorites', '{bad'); localStorage.setItem('recentTools', '{bad'); localStorage.setItem('toolOrder', '{bad'); },
    externalRoute: firebaseMock
  });

  await scenario('English homepage without localStorage', '/en/', async page => {
    await page.waitForFunction(() => globalVisitCount === 10);
    assert(await page.evaluate(() => Array.isArray(favorites) && Array.isArray(recentTools)), 'homepage state did not fall back to empty arrays');
  }, {
    initScript: () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } }); },
    externalRoute: firebaseMock
  });

  await browser.close();
  await new Promise(resolve => server.close(resolve));
  if (failures.length) {
    console.error(`Focused functional regressions failed (${failures.length}/${passed + failures.length}):`);
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exitCode = 1;
  } else {
    console.log(`Focused functional regressions passed (${passed} real-page scenarios).`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
