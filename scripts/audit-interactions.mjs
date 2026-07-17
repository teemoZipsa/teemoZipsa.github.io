import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const failures = [];
let passed = 0;

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
    '.svg': 'image/svg+xml'
  })[ext] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      if (pathname === '/__blank') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><title>audit blank</title>');
        return;
      }
      let rel = pathname.replace(/^\/+/, '') || 'index.html';
      let target = path.resolve(rootDir, rel);
      if (!target.startsWith(`${rootDir}${path.sep}`) && target !== rootDir) {
        res.writeHead(403); res.end('Forbidden'); return;
      }
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404); res.end('Not found'); return;
      }
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
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });

  async function scenario(name, routePath, run, options = {}) {
    const context = await browser.newContext({
      serviceWorkers: options.serviceWorkers || 'block',
      timezoneId: options.timezoneId,
      viewport: options.viewport
    });
    if (!options.allowExternal) {
      await context.route('**/*', route => {
        if (route.request().url().startsWith(`${base}/`)) return route.continue();
        return route.abort('failed');
      });
    }
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    try {
      const response = await page.goto(`${base}${routePath}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      assert(response?.ok(), `${routePath} returned ${response?.status() || 'no response'}`);
      await run(page, context, base);
      assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);
      passed += 1;
    } catch (error) {
      failures.push(`${name}: ${error.message || error}`);
    } finally {
      await context.close().catch(() => {});
    }
  }

  await scenario('timezone conversion', '/special-chars/timezone-conv/', async page => {
    await page.selectOption('#fromTz', 'Asia/Seoul');
    await page.selectOption('#toTz', 'America/New_York');
    await page.evaluate(() => {
      document.querySelector('#fromDate').value = '2026-01-01';
      document.querySelector('#fromTime').value = '12:00';
      convert();
    });
    assert(await page.locator('#toResult').innerText() === '22:00', 'Seoul noon did not convert to 22:00 New York time');
    assert((await page.locator('#toResultDate').innerText()).startsWith('2025-12-31'), 'converted calendar date is wrong');
    const dst = await page.evaluate(() => {
      document.querySelector('#fromTz').value = 'America/New_York';
      document.querySelector('#toTz').value = 'Asia/Seoul';
      document.querySelector('#fromDate').value = '2026-03-08';
      document.querySelector('#fromTime').value = '02:30';
      convert();
      const nonexistent = { result: document.querySelector('#toResult').textContent, info: document.querySelector('#toResultInfo').textContent, invalid: document.querySelector('#fromTime').getAttribute('aria-invalid') };
      document.querySelector('#fromDate').value = '2026-11-01';
      document.querySelector('#fromTime').value = '01:30';
      convert();
      return { nonexistent, ambiguous: { result: document.querySelector('#toResult').textContent, info: document.querySelector('#toResultInfo').textContent } };
    });
    assert(dst.nonexistent.result === '--:--' && dst.nonexistent.info.includes('존재하지') && dst.nonexistent.invalid === 'true', `DST gap was accepted: ${JSON.stringify(dst)}`);
    assert(dst.ambiguous.result === '14:30' && dst.ambiguous.info.includes('두 번') && dst.ambiguous.info.includes('앞선'), `DST overlap was silent or wrong: ${JSON.stringify(dst)}`);
  }, { timezoneId: 'America/Los_Angeles' });

  await scenario('English DST boundary handling', '/special-chars/en/timezone-conv/', async page => {
    const state = await page.evaluate(() => {
      document.querySelector('#fromTz').value = 'America/New_York';
      document.querySelector('#toTz').value = 'Asia/Seoul';
      document.querySelector('#fromDate').value = '2026-03-08';
      document.querySelector('#fromTime').value = '02:30';
      convert();
      const gap = document.querySelector('#toResultInfo').textContent;
      document.querySelector('#fromDate').value = '2026-11-01';
      document.querySelector('#fromTime').value = '01:30';
      convert();
      return { gap, overlap: document.querySelector('#toResultInfo').textContent, result: document.querySelector('#toResult').textContent };
    });
    assert(state.gap.includes('does not exist') && state.overlap.includes('occurs twice') && state.result === '14:30', `English DST boundary handling failed: ${JSON.stringify(state)}`);
  });

  await scenario('VAT-inclusive discount', '/special-chars/discount-calc/', async page => {
    const result = await page.evaluate(() => {
      document.querySelector('#price').value = '11000';
      document.querySelector('#discountRate').value = '10';
      document.querySelector('#vatToggle').checked = true;
      document.querySelector('#vatExToggle').checked = false;
      calc();
      return document.querySelector('#resFinal').textContent;
    });
    assert(result.includes('9,900'), `expected 9,900, got ${result}`);
  });

  await scenario('discount bounds and report safety', '/special-chars/discount-calc/', async page => {
    const result = await page.evaluate(() => {
      window.__discountXss = 0;
      document.querySelector('#price').value = '50000';
      document.querySelector('#discountRate').value = '10<img src=x onerror="window.__discountXss=1">';
      calc();
      const injection = {
        marker: window.__discountXss,
        images: document.querySelectorAll('#analysisReport img').length,
        invalid: document.querySelector('#discountRate').getAttribute('aria-invalid')
      };
      document.querySelector('#price').value = '9'.repeat(400);
      document.querySelector('#discountRate').value = '10';
      calc();
      return { injection, output: document.querySelector('#resFinal').textContent };
    });
    assert(result.injection.marker === 0 && result.injection.images === 0 && result.injection.invalid === 'true', `discount report injection was accepted: ${JSON.stringify(result)}`);
    assert(!/Infinity|∞|NaN/.test(result.output) && result.output.includes('—'), `discount overflow leaked: ${JSON.stringify(result)}`);
  });

  await scenario('English discount overflow bounds', '/special-chars/en/discount-calc/', async page => {
    const result = await page.evaluate(() => {
      document.querySelector('#price').value = '9'.repeat(400);
      document.querySelector('#discountRate').value = '10';
      calc();
      return { output: document.querySelector('#resFinal').textContent, invalid: document.querySelector('#price').getAttribute('aria-invalid') };
    });
    assert(result.invalid === 'true' && !/Infinity|∞|NaN/.test(result.output) && result.output.includes('—'), `English discount overflow leaked: ${JSON.stringify(result)}`);
  });

  await scenario('weekly allowance eligibility', '/special-chars/wage-calc/', async page => {
    const label = await page.evaluate(() => {
      document.querySelector('#hoursDay').value = '2';
      document.querySelector('#daysWeek').value = '5';
      document.querySelector('#weeklyHol').value = 'yes';
      calc();
      return document.querySelector('#r-hol').textContent;
    });
    assert(label.includes('대상 아님'), `weekly allowance was not rejected for 10 hours: ${label}`);
  });

  await scenario('date direction and local parsing', '/special-chars/date-calc/', async page => {
    const result = await page.evaluate(() => {
      document.querySelector('#ddayStart').value = '2026-01-03';
      document.querySelector('#ddayEnd').value = '2026-01-01';
      document.querySelector('#ddayInclusive').checked = true;
      calcDday();
      document.querySelector('#dateBase').value = '2026-01-01';
      document.querySelector('#dateDays').value = '0';
      calcDateAdd();
      return { days: document.querySelector('#ddayValue').textContent, added: document.querySelector('#dateAddValue').textContent };
    });
    assert(result.days === '3일', `reverse inclusive range returned ${result.days}`);
    assert(result.added.startsWith('2026-01-01'), `+0 day shifted date: ${result.added}`);
  }, { timezoneId: 'America/Los_Angeles' });

  await scenario('average price validation', '/special-chars/avg-price/', async page => {
    const result = await page.evaluate(() => {
      document.querySelector('#curPrice').value = '0';
      document.querySelector('#curQty').value = '10';
      document.querySelector('#addPrice').value = '100';
      document.querySelector('#addQtyOrAmt').value = '1';
      calc();
      return { price: document.querySelector('#finalPrice').textContent, message: document.querySelector('#priceChange').textContent };
    });
    assert(result.price === '-' && result.message.includes('0보다 큰'), `invalid average-price input leaked a result: ${JSON.stringify(result)}`);
  });

  await scenario('officetel fee requirements', '/special-chars/broker-fee-calc/', async page => {
    const values = await page.evaluate(() => {
      setProp(1);
      document.querySelector('#price').value = '100000000';
      document.querySelector('#area').value = '60';
      document.querySelector('#residentialRequirements').value = 'no';
      calc();
      const ordinary = document.querySelector('#summary').textContent;
      document.querySelector('#residentialRequirements').value = 'yes';
      calc();
      return { ordinary, special: document.querySelector('#summary').textContent };
    });
    assert(values.ordinary.includes('900,000'), `safe default fee mismatch: ${values.ordinary}`);
    assert(values.special.includes('500,000'), `qualified special fee mismatch: ${values.special}`);
  });

  await scenario('timer state synchronization', '/special-chars/timer/', async page => {
    const quick = await page.evaluate(() => { setQuick(1); return document.querySelector('#display').textContent; });
    assert(quick === '01:00', `quick timer showed ${quick}`);
    await page.evaluate(() => { timerRemaining = 30000; running = false; document.querySelector('#tMin').value = '2'; syncTimerFromInputs(); });
    const edited = await page.evaluate(() => ({ display: document.querySelector('#display').textContent, remaining: timerRemaining }));
    assert(edited.display === '02:00' && edited.remaining === 120000, `paused edit was stale: ${JSON.stringify(edited)}`);
  });

  await scenario('compound bounds and zero rate', '/special-chars/compound-interest/', async page => {
    const result = await page.evaluate(() => {
      document.querySelector('#rate').value = '0'; document.querySelector('#times').value = '2'; calculate();
      const zero = document.querySelector('#sumRate').textContent;
      document.querySelector('#rate').value = '-10'; calculate();
      const negative = document.querySelector('.trade-item:last-child .trade-detail').textContent;
      document.querySelector('#times').value = '100000'; calculate();
      return { zero, negative, hidden: getComputedStyle(document.querySelector('#summary')).display, validation: document.querySelector('#times').validationMessage };
    });
    assert(result.zero === '0.0%', `zero rate failed: ${result.zero}`);
    assert(!result.negative.includes('+-'), `negative return formatting failed: ${result.negative}`);
    assert(result.hidden === 'none' && result.validation, 'period cap was not enforced');
  });

  await scenario('loan zero rate and overflow bounds', '/special-chars/loan-calc/', async page => {
    const result = await page.evaluate(() => {
      document.querySelector('#principal').value = '1200'; document.querySelector('#rate').value = '0'; document.querySelector('#years').value = '1'; calc();
      const zero = document.querySelector('#summary').textContent;
      document.querySelector('#principal').value = '1e308'; document.querySelector('#rate').value = '30'; document.querySelector('#years').value = '50'; calc();
      return { zero, overflow: document.querySelector('#summary').textContent };
    });
    assert(result.zero.includes('100') && result.zero.includes('총 이자') && result.zero.includes('0'), `0% loan failed: ${result.zero}`);
    assert(result.overflow === '', `oversized principal leaked a result: ${result.overflow}`);
  });

  await scenario('BMI extreme valid boundary', '/special-chars/bmi-calc/', async page => {
    const result = await page.evaluate(() => {
      document.querySelector('#height').value = '50'; document.querySelector('#weight').value = '300'; calc();
      return { value: document.querySelector('#bmiValue').textContent, label: document.querySelector('#bmiLabel').textContent };
    });
    assert(result.value === '1200.0' && result.label === '3단계 비만', `extreme BMI failed: ${JSON.stringify(result)}`);
  });

  await scenario('100 percent reverse discount', '/special-chars/percent-calc/', async page => {
    const result = await page.evaluate(() => {
      document.querySelector('#m3a').value = '10000'; document.querySelector('#m3b').value = '100'; calc3();
      return document.querySelector('#r3').textContent;
    });
    assert(result.includes('100% 미만'), `100% discount was not rejected: ${result}`);
  });

  await scenario('music dependent results', '/special-chars/music-calc/', async page => {
    const result = await page.evaluate(() => {
      calcReverse(); const bars120 = document.querySelector('#reverseDetail').textContent;
      document.querySelector('#songBpm').value = '60'; calcSong(); calcReverse(); const bars60 = document.querySelector('#reverseDetail').textContent;
      document.querySelector('#hzInput').value = '440'; calcHzToNote(); const hz440 = document.querySelector('#hzToNoteResult').textContent;
      document.querySelector('#refHz').value = '442'; calcNote(); calcHzToNote(); const hz442 = document.querySelector('#hzToNoteResult').textContent;
      document.querySelector('#delayBpm').value = '-120'; calcDelay();
      return { bars120, bars60, hz440, hz442, delay: document.querySelector('#delayQuarter').textContent };
    });
    assert(result.bars120 !== result.bars60, 'reverse bar count stayed stale after BPM change');
    assert(result.hz440 !== result.hz442, 'Hz-to-note result stayed stale after reference change');
    assert(result.delay.includes('유효한 BPM'), `negative BPM produced ${result.delay}`);
  });

  for (const [name, routePath, input, resultSelector] of [
    ['calorie stale result', '/special-chars/calorie-calc/', '#weight', '#res-cal'],
    ['BMI stale result', '/special-chars/bmi-calc/', '#weight', '#bmiValue'],
    ['pet-food stale result', '/special-chars/pet-food-calc/', '#weight', '#dailyKcal']
  ]) {
    await scenario(name, routePath, async page => {
      await page.locator(input).fill('');
      const value = (await page.locator(resultSelector).innerText()).trim();
      assert(value.startsWith('—') || value === '-', `stale value remained: ${value}`);
    });
  }

  await scenario('fractional fuel display', '/special-chars/fuel-calc/', async page => {
    const text = await page.evaluate(() => {
      document.querySelector('#distance').value = '0.1'; document.querySelector('#efficiency').value = '15';
      document.querySelector('#fuelPrice').value = '2000'; document.querySelector('#people').value = '1'; calc();
      return document.querySelector('#summary').textContent;
    });
    assert(text.includes('0.1km') && text.includes('0.007'), `fractional evidence was rounded away: ${text}`);
  });

  await scenario('speech preset state', '/special-chars/speech-timer/', async page => {
    const state = await page.evaluate(() => { setSpeed(400); return { active: document.querySelectorAll('.speed-preset.active').length, pressed: document.querySelectorAll('.speed-preset[aria-pressed="true"]').length }; });
    assert(state.active === 1 && state.pressed === 1, `preset state mismatch: ${JSON.stringify(state)}`);
  });

  await scenario('mobile home card layout', '/', async page => {
    const layout = await page.evaluate(() => {
      const card = document.querySelector('.tool-card');
      const fav = card?.querySelector('.fav-btn');
      const cardRect = card?.getBoundingClientRect();
      const favRect = fav?.getBoundingClientRect();
      return { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, cardRight: cardRect?.right, favRight: favRect?.right };
    });
    assert(layout.scroll <= layout.client && layout.cardRight <= layout.client && layout.favRight <= layout.client, `mobile overflow: ${JSON.stringify(layout)}`);
  }, { viewport: { width: 320, height: 800 } });

  await scenario('quick-reply safe custom actions', '/special-chars/quick-reply/', async page => {
    await page.evaluate(() => localStorage.setItem('qr_customs', JSON.stringify(['회의 "최종" <img src=x onerror=1>', '남길 문구'])));
    await page.reload({ waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(() => {
      switchTab('custom');
      document.querySelector('button[title="삭제"]').click();
      return { stored: JSON.parse(localStorage.getItem('qr_customs')), injected: document.querySelectorAll('.msg-text img').length, copyButtons: document.querySelectorAll('.msg-copy').length };
    });
    assert(result.stored.length === 1 && result.stored[0] === '남길 문구', `custom delete failed: ${JSON.stringify(result.stored)}`);
    assert(result.injected === 0 && result.copyButtons === 1, 'custom text escaped the safe DOM renderer');
  });

  await scenario('UTM URL preservation', '/special-chars/utm-builder/', async page => {
    const result = await page.evaluate(() => {
      document.querySelector('#urlInput').value = 'HTTP://example.com/path?product=123#details';
      document.querySelector('#utm_source').value = 'google'; generateURL();
      return document.querySelector('#resultURL').value;
    });
    assert(result.startsWith('http://example.com/path?'), `scheme was corrupted: ${result}`);
    assert(result.includes('product=123') && result.endsWith('#details'), `query or hash was lost: ${result}`);
  });

  await scenario('English zodiac image path', '/special-chars/en/zodiac-calc/', async page => {
    await page.evaluate(() => { document.querySelector('#birthDate').value = '2000-04-01'; calcZodiac(); });
    await page.waitForFunction(() => document.querySelector('#resultImage').complete);
    const image = await page.evaluate(() => ({ src: document.querySelector('#resultImage').getAttribute('src'), width: document.querySelector('#resultImage').naturalWidth }));
    assert(image.src.startsWith('/special-chars/zodiac-calc/images/') && image.width > 0, `zodiac image failed: ${JSON.stringify(image)}`);
  });

  await scenario('password group guarantees', '/special-chars/password-gen/', async page => {
    const failures = await page.evaluate(() => {
      document.querySelector('#pwLength').value = '4';
      let bad = 0;
      for (let i = 0; i < 100; i += 1) {
        generate();
        const value = document.querySelector('#pwText').textContent;
        if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) bad += 1;
      }
      return bad;
    });
    assert(failures === 0, `${failures} generated passwords omitted selected groups`);
  });

  await scenario('lottery cryptographic shuffle', '/special-chars/lotto-gen/', async page => {
    const result = await page.evaluate(() => {
      Math.random = () => { throw new Error('Math.random must not be used'); };
      generate();
      return { balls: document.querySelectorAll('#ballsView .ball').length, report: document.querySelector('#analysisReport').textContent };
    });
    assert(result.balls === 6, `lottery generated ${result.balls} balls`);
    assert(result.report.includes('암호학적 난수') && !result.report.includes('120~180'), 'lottery report still overclaims historical patterns');
  });

  await scenario('English lottery cryptographic shuffle', '/special-chars/en/lotto-gen/', async page => {
    const balls = await page.evaluate(() => {
      Math.random = () => { throw new Error('Math.random must not be used'); };
      generate();
      return document.querySelectorAll('#ballsView .ball').length;
    });
    assert(balls === 6, `English lottery generated ${balls} balls`);
  });

  await scenario('subscription name DOM safety', '/special-chars/sub-calc/', async page => {
    const result = await page.evaluate(() => {
      addItem('YouTube "Family" <img src=x onerror=1>', 1000);
      const last = document.querySelector('.sub-item:last-child .sub-name');
      const price = document.querySelector('.sub-item:last-child .sub-price');
      price.value = '9'.repeat(400);
      price.dispatchEvent(new Event('input', { bubbles: true }));
      return {
        value: last.value,
        injected: document.querySelectorAll('.sub-item img').length,
        invalid: price.getAttribute('aria-invalid'),
        total: document.querySelector('#monthlyTotal').textContent + document.querySelector('#inv5').textContent
      };
    });
    assert(result.value.includes('"Family"') && result.value.includes('<img') && result.injected === 0, `subscription value was corrupted: ${JSON.stringify(result)}`);
    assert(result.invalid === 'true' && !/Infinity|∞|NaN/.test(result.total), `subscription overflow leaked: ${JSON.stringify(result)}`);
  });

  await scenario('English subscription overflow bounds', '/special-chars/en/sub-calc/', async page => {
    const result = await page.evaluate(() => {
      const price = document.querySelector('.sub-price');
      price.value = '9'.repeat(400);
      price.dispatchEvent(new Event('input', { bubbles: true }));
      return { invalid: price.getAttribute('aria-invalid'), total: document.querySelector('#monthlyTotal').textContent + document.querySelector('#inv5').textContent };
    });
    assert(result.invalid === 'true' && !/Infinity|∞|NaN/.test(result.total), `English subscription overflow leaked: ${JSON.stringify(result)}`);
  });

  await scenario('Base64 limits and keyboard upload', '/special-chars/base64-tool/', async page => {
    await page.evaluate(() => {
      setMode('image');
      document.querySelector('#fileInput').click = () => { document.body.dataset.fileInputClicked = 'true'; };
    });
    await page.locator('#dropZone').press('Enter');
    assert(await page.locator('body').getAttribute('data-file-input-clicked') === 'true', 'Base64 drop zone did not activate its file input from the keyboard');
    const textError = await page.evaluate(() => {
      setMode('text');
      document.querySelector('#inputText').value = '가'.repeat(1_000_001);
      encode();
      return document.querySelector('#textError').textContent;
    });
    assert(textError.includes('1,000,000'), `Base64 text limit was not enforced: ${textError}`);
    await page.evaluate(() => setMode('image'));
    await page.locator('#fileInput').setInputFiles({
      name: 'oversized.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1)
    });
    assert((await page.locator('#fileError').innerText()).includes('10MB'), 'Base64 image size limit was not enforced');
    assert(await page.locator('#previewImg').getAttribute('alt'), 'Base64 preview image has no alternative text');
  });

  await scenario('English Base64 filename safety', '/special-chars/en/base64-tool/', async page => {
    const transparent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=', 'base64');
    await page.evaluate(() => { window.__base64Xss = 0; setMode('image'); });
    await page.locator('#fileInput').setInputFiles({
      name: 'evil<img src=x onerror="window.__base64Xss=1">.png',
      mimeType: 'image/png',
      buffer: transparent
    });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#reportBox')).display !== 'none');
    await page.waitForTimeout(50);
    const state = await page.evaluate(() => ({ marker: window.__base64Xss, images: document.querySelectorAll('#reportBox img').length }));
    assert(state.marker === 0 && state.images === 0, `Base64 filename injected markup: ${JSON.stringify(state)}`);
  });

  await scenario('QR saved-input clearing', '/special-chars/qr-code/', async page => {
    const state = await page.evaluate(() => {
      document.querySelector('#qrInput').value = 'private value';
      localStorage.setItem('qrCode_text', 'private value');
      clearStoredInput();
      return { value: document.querySelector('#qrInput').value, saved: localStorage.getItem('qrCode_text') };
    });
    assert(state.value === '' && state.saved === null, `QR input was not fully cleared: ${JSON.stringify(state)}`);
  });

  await scenario('prompt saved-input clearing', '/special-chars/prompt-gen/', async page => {
    const state = await page.evaluate(() => {
      document.querySelector('#role').value = 'private role';
      localStorage.setItem('promptGen_role', 'private role');
      clearAll();
      return { value: document.querySelector('#role').value, saved: localStorage.getItem('promptGen_role'), status: document.querySelector('#storageStatus').textContent };
    });
    assert(state.value === '' && state.saved === null && state.status, `prompt input was not fully cleared: ${JSON.stringify(state)}`);
  });

  await scenario('related color selection', '/special-chars/color-conv/', async page => {
    const values = await page.evaluate(() => {
      const before = document.querySelector('#hexInput').value;
      document.querySelector('.related-chip').click();
      return { before, after: document.querySelector('#hexInput').value, buttons: document.querySelectorAll('button.related-chip').length };
    });
    assert(values.buttons > 0 && values.after !== values.before, `related color did not update HEX: ${JSON.stringify(values)}`);
  });

  await scenario('emoji random retry cap', '/special-chars/emoji-mixer/', async page => {
    let imageRequests = 0;
    page.on('request', request => { if (request.url().includes('gstatic.com/android/keyboard/emojikitchen')) imageRequests += 1; });
    await page.waitForFunction(() => window.emojiData && window.emojiData.data, null, { timeout: 5000 }).catch(async () => {
      await page.waitForFunction(() => document.querySelector('#mainContent').style.display === 'block');
    });
    await page.evaluate(() => randomCombo());
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#noResult')).display !== 'none', null, { timeout: 5000 });
    assert(imageRequests > 0 && imageRequests <= 8, `random fallback made ${imageRequests} image requests`);
  });

  await scenario('PDF loader retry and image drop', '/special-chars/pdf-tool/', async page => {
    const results = await page.evaluate(async () => {
      const settle = () => Promise.race([
        ensurePdfLibs().then(() => 'resolved', () => 'rejected'),
        new Promise(resolve => setTimeout(() => resolve('timeout'), 2000))
      ]);
      return [await settle(), await settle()];
    });
    assert(results[0] === 'rejected' && results[1] === 'rejected', `PDF retries did not settle: ${results.join(', ')}`);
    await page.evaluate(() => {
      // The drop filter itself is independent of the CDN. Mark libraries as
      // ready so this assertion can exercise the accepted-file path offline.
      pdfLibsPromise = Promise.resolve();
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'sample.png', { type: 'image/png' }));
      document.querySelector('#img2pdfDropZone').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    assert(await page.locator('#img2pdfFileList .file-item').count() === 1, 'image-to-PDF drop rejected a PNG');
    await page.evaluate(() => {
      window.__pdfXss = 0;
      updateReport('<img src=x onerror="window.__pdfXss=1">', 'evil.pdf', 1, '<img src=x onerror="window.__pdfXss=1">', '<img src=x onerror="window.__pdfXss=1">');
    });
    await page.waitForTimeout(50);
    const reportState = await page.evaluate(() => ({ marker: window.__pdfXss, images: document.querySelectorAll('#reportContainer img').length }));
    assert(reportState.marker === 0 && reportState.images === 0, `PDF report injected markup: ${JSON.stringify(reportState)}`);
  });

  await scenario('background remover CDN failure', '/special-chars/bg-remover/', async page => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X2NDWQAAAABJRU5ErkJggg==', 'base64');
    await page.locator('#fileInput').setInputFiles({ name: 'one.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#retryBtn')).display !== 'none', null, { timeout: 5000 });
    const message = await page.locator('#progressSub').innerText();
    assert(message.includes('AI 모듈'), `missing actionable module error: ${message}`);
    const moduleSource = (await page.locator('script[type="module"]').allTextContents()).join('\n');
    assert(moduleSource.includes('escapeHtml(origFile.name)'), 'background-remover report does not escape the selected filename');
  });

  await scenario('image compression errors and transparency', '/special-chars/image-compress/', async page => {
    const transparent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=', 'base64');
    await page.locator('#fileInput').setInputFiles({ name: 'transparent.png', mimeType: 'image/png', buffer: transparent });
    await page.waitForFunction(() => document.querySelector('#compImg').naturalWidth > 0, null, { timeout: 5000 });
    const rgba = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
      canvas.getContext('2d').drawImage(document.querySelector('#compImg'), 0, 0, 1, 1);
      return [...canvas.getContext('2d').getImageData(0, 0, 1, 1).data];
    });
    assert(rgba[0] > 245 && rgba[1] > 245 && rgba[2] > 245 && rgba[3] === 255, `transparent pixel was not composited white: ${rgba}`);
    await page.locator('#fileInput').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') });
    await page.waitForFunction(() => document.querySelector('#saved').textContent.includes('손상'));
    assert(await page.locator('#dlBtn').evaluate(element => getComputedStyle(element).display === 'none'), 'broken image left download enabled');
    await page.evaluate(() => {
      window.__compressFilenameXss = 0;
      updateReport(
        { name: '<img src=x onerror="window.__compressFilenameXss=1">.png', size: 100, type: 'image/png' },
        new Blob([new Uint8Array(10)], { type: 'image/jpeg' }),
        1, 1, 1, 1, 90
      );
    });
    await page.waitForTimeout(50);
    const reportState = await page.evaluate(() => ({ marker: window.__compressFilenameXss, images: document.querySelectorAll('#reportContainer img').length }));
    assert(reportState.marker === 0 && reportState.images === 0, `image-compressor filename injected markup: ${JSON.stringify(reportState)}`);
  });

  await scenario('PWA scope and cache ownership', '/__blank', async (page, context, baseUrl) => {
    await page.evaluate(async () => {
      await caches.open('emoji-kitchen-db-v1');
      await caches.open('teemozipsa-shell-v1.2');
      await caches.open('teemozipsa-v1.2');
      const foreign = await caches.open('foreign-cache');
      await foreign.put('/special-chars/theme.css', new Response('foreign poison', { headers: { 'Content-Type': 'text/css' } }));
    });
    await page.goto(`${baseUrl}/special-chars/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(300);
    const state = await page.evaluate(async () => ({
      caches: await caches.keys(),
      scopes: (await navigator.serviceWorker.getRegistrations()).map(reg => reg.scope),
      manifest: await fetch('/special-chars/manifest.json').then(response => response.json()),
      theme: await fetch('/special-chars/theme.css').then(response => response.text())
    }));
    assert(state.caches.includes('emoji-kitchen-db-v1'), `foreign cache was deleted: ${state.caches}`);
    assert(!state.caches.includes('teemozipsa-shell-v1.2'), `old owned cache was not deleted: ${state.caches}`);
    assert(!state.caches.includes('teemozipsa-v1.2'), `legacy cache was not migrated: ${state.caches}`);
    assert(state.caches.includes('foreign-cache') && state.theme !== 'foreign poison' && state.theme.includes('--bg-body'), 'service worker read a foreign cache entry');
    assert(state.scopes.every(scope => scope.endsWith('/special-chars/')), `unexpected service worker scope: ${state.scopes}`);
    assert(state.manifest.start_url === '/special-chars/' && state.manifest.scope === '/special-chars/', 'manifest and service-worker scope differ');
  }, { serviceWorkers: 'allow' });

  await browser.close().catch(() => {});
  await new Promise(resolve => server.close(resolve));

  if (failures.length) {
    console.error(`Interaction audit failed (${failures.length}):`);
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log(`Interaction audit passed: ${passed} browser regression scenarios.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
