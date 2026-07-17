import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, firefox, webkit } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const failures = [];
let passed = 0;
let forcedFailurePath = null;
let forcedFailureHits = 0;
const cliFilter = process.argv.find(argument => argument.startsWith('--filter='))?.slice('--filter='.length) || '';
const scenarioFilters = [process.env.AUDIT_INTERACTION_FILTER, cliFilter]
  .filter(Boolean)
  .join('|')
  .split('|')
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);
const runBackgroundInference = process.env.AUDIT_BACKGROUND_INFERENCE === '1' || process.argv.includes('--background-inference');
const browserName = process.argv.find(argument => argument.startsWith('--browser='))?.slice('--browser='.length) || 'chromium';
const browserTypes = { chromium, firefox, webkit };
if (!browserTypes[browserName]) throw new Error(`Unsupported browser: ${browserName}`);
const isBackgroundInferenceOnly = runBackgroundInference
  && scenarioFilters.length > 0
  && scenarioFilters.every(filter => filter === 'background-removal');
if (browserName !== 'chromium' && !isBackgroundInferenceOnly) {
  throw new Error(`The ${browserName} option is supported only with --background-inference --filter=background-removal`);
}

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
    '.wasm': 'application/wasm'
  })[ext] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      if (forcedFailurePath && pathname === forcedFailurePath) {
        forcedFailureHits += 1;
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forced audit failure');
        return;
      }
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
  const browser = await browserTypes[browserName].launch({ headless: true });

  async function scenario(name, routePath, run, options = {}) {
    if (scenarioFilters.length && !scenarioFilters.some(filter => name.toLowerCase().includes(filter))) return;
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
      failures.push(`${browserName} / ${name}: ${error.message || error}`);
    } finally {
      await context.close().catch(() => {});
    }
  }

  async function auditQrGeneration(page, baseUrl, locale) {
    await page.waitForFunction(() => window.__qrUtf8Ready === true && typeof window.qrcode === 'function');
    const state = await page.evaluate(text => {
      document.querySelector('#qrInput').value = text;
      generate();
      const canvas = document.querySelector('#qrBox canvas');
      const script = document.querySelector('script[src*="qrcode-generator"]');
      const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '';
      return {
        canvasWidth: canvas?.width || 0,
        canvasHeight: canvas?.height || 0,
        canvasRole: canvas?.getAttribute('role'),
        canvasLabel: canvas?.getAttribute('aria-label') || '',
        dataUrl: currentDataUrl.slice(0, 22),
        libraryPath: script ? new URL(script.src).pathname : '',
        errorVisible: getComputedStyle(document.querySelector('#cdnError')).display !== 'none',
        csp,
        resources: performance.getEntriesByType('resource').map(entry => entry.name)
      };
    }, locale === 'ko' ? '안녕하세요 https://example.com/한글' : 'Hello https://example.com/english');
    assert(state.canvasWidth > 0 && state.canvasWidth === state.canvasHeight, `${locale} QR canvas was not generated: ${JSON.stringify(state)}`);
    assert(state.canvasRole === 'img' && state.canvasLabel, `${locale} QR canvas lacks accessible image semantics`);
    assert(state.dataUrl === 'data:image/png;base64,', `${locale} QR PNG data URL was not created: ${state.dataUrl}`);
    assert(state.libraryPath === '/special-chars/vendor/qrcode-generator/1.4.4/qrcode.js', `${locale} QR loaded the wrong library: ${state.libraryPath}`);
    assert(!state.errorVisible, `${locale} QR displayed a library-load error`);
    assert(state.csp.includes("script-src 'self'") && state.csp.includes("font-src 'self'"), `${locale} QR CSP is missing self-hosted resource directives: ${state.csp}`);
    assert(state.resources.every(resource => new URL(resource).origin === new URL(baseUrl).origin), `${locale} QR loaded a third-party resource: ${state.resources.join(', ')}`);
  }

  async function auditPdfKeyboardResetAndReorder(page, locale) {
    await page.waitForFunction(() => document.documentElement.dataset.pdfEngine === 'ready', null, { timeout: 10000 });
    await page.evaluate(() => {
      document.body.dataset.pdfInputClicks = '0';
      document.querySelector('#mergeFileInput').addEventListener('click', event => {
        event.preventDefault();
        document.body.dataset.pdfInputClicks = String(Number(document.body.dataset.pdfInputClicks) + 1);
      });
    });
    await page.locator('#mergeDropZone').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    assert(await page.locator('body').getAttribute('data-pdf-input-clicks') === '2', `${locale} PDF drop zone did not activate its file input with Enter and Space`);

    const pdfBytes = Buffer.from(await page.evaluate(async () => {
      const doc = await PDFDocument.create();
      doc.addPage([240, 320]);
      doc.addPage([320, 240]);
      return Array.from(await doc.save());
    }));
    const first = { name: 'first.pdf', mimeType: 'application/pdf', buffer: pdfBytes };
    const second = { name: 'second.pdf', mimeType: 'application/pdf', buffer: pdfBytes };

    await page.locator('#mergeFileInput').setInputFiles([first, second]);
    await page.waitForFunction(() => mergeFiles.length === 2 && document.querySelectorAll('#mergeFileList .file-item').length === 2);
    await page.locator('#mergeFileList .file-item').nth(1).locator('[data-direction="-1"]').evaluate(button => button.click());
    await page.waitForTimeout(30);
    const mergeOrder = await page.evaluate(() => ({
      names: mergeFiles.map(file => file.name),
      focusInsideMovedItem: document.querySelector('#mergeFileList .file-item')?.contains(document.activeElement)
    }));
    assert(mergeOrder.names.join(',') === 'second.pdf,first.pdf', `${locale} PDF keyboard file reorder failed: ${JSON.stringify(mergeOrder)}`);
    assert(mergeOrder.focusInsideMovedItem, `${locale} PDF file reorder lost keyboard focus`);

    await page.evaluate(() => resetAll());
    await page.locator('#rotateFileInput').setInputFiles(first);
    await page.waitForFunction(() => rotateAngles.length === 2 && document.querySelectorAll('#rotateThumbs .thumb-card').length === 2, null, { timeout: 10000 });
    const rotationState = await page.evaluate(async () => {
      document.querySelector('#rotateThumbs .rotate-badge').remove();
      rotateAll(90);
      let download = null;
      const originalDownload = downloadPdf;
      downloadPdf = (bytes, filename) => { download = { bytes: bytes.byteLength ?? bytes.length, filename }; };
      try { await doRotate(); } finally { downloadPdf = originalDownload; }
      return {
        angles: [...rotateAngles],
        visibleBadges: document.querySelectorAll('#rotateThumbs .rotate-badge.show').length,
        download
      };
    });
    assert(rotationState.angles.every(angle => angle === 90), `${locale} rotateAll did not update every angle: ${JSON.stringify(rotationState)}`);
    assert(rotationState.visibleBadges === 1, `${locale} rotateAll stopped after a missing badge: ${JSON.stringify(rotationState)}`);
    assert(rotationState.download?.filename === 'rotated.pdf' && rotationState.download.bytes > 0, `${locale} rotated PDF was not produced: ${JSON.stringify(rotationState)}`);

    await page.evaluate(() => {
      resetAll();
      document.querySelector('.mode-tab[data-tab="reorder"]').click();
    });
    await page.locator('#reorderFileInput').setInputFiles(first);
    await page.waitForFunction(() => reorderPages.length === 2 && document.querySelectorAll('#reorderThumbs .thumb-card').length === 2, null, { timeout: 10000 });
    await page.locator('#reorderThumbs .thumb-card').nth(1).locator('[data-direction="-1"]').evaluate(button => button.click());
    await page.waitForTimeout(30);
    const pageOrder = await page.evaluate(() => ({
      order: [...reorderPages],
      firstPage: document.querySelector('#reorderThumbs .thumb-card')?.dataset.page,
      focusInsideMovedCard: document.querySelector('#reorderThumbs .thumb-card')?.contains(document.activeElement)
    }));
    assert(pageOrder.order.join(',') === '1,0' && pageOrder.firstPage === '1', `${locale} PDF keyboard page reorder failed: ${JSON.stringify(pageOrder)}`);
    assert(pageOrder.focusInsideMovedCard, `${locale} PDF page reorder lost keyboard focus`);

    const resetState = await page.evaluate(() => {
      updateReport('audit', 'audit.pdf', 1, 'audit', 'audit');
      resetAll();
      return {
        arrays: [mergeFiles.length, rotateAngles.length, reorderPages.length, img2pdfFiles.length],
        bytes: [splitPdfBytes, rotatePdfBytes, reorderPdfBytes, wmPdfBytes, deletePdfBytes, pagenumPdfBytes, metadataPdfBytes, blankPdfBytes].map(value => value === null),
        lists: ['mergeFileList','img2pdfFileList','rotateThumbs','reorderThumbs','wmPreview'].map(id => document.getElementById(id).children.length),
        visibleControls: ['mergeBtn','splitInfo','rotateControls','reorderControls','watermarkControls','deleteInfo','img2pdfBtn','pagenumControls','metadataControls','blankControls'].filter(id => getComputedStyle(document.getElementById(id)).display !== 'none'),
        reportChildren: document.querySelector('#reportContainer').children.length,
        reportDisplay: getComputedStyle(document.querySelector('#reportContainer')).display,
        pageCounts: ['splitPageCount','deletePageCount','blankPageCount'].map(id => document.getElementById(id).textContent),
        loading: [...document.querySelectorAll('.loading.show')].length
      };
    });
    assert(resetState.arrays.every(value => value === 0) && resetState.bytes.every(Boolean), `${locale} PDF reset left stale state: ${JSON.stringify(resetState)}`);
    assert(resetState.lists.every(value => value === 0) && resetState.visibleControls.length === 0, `${locale} PDF reset left stale UI: ${JSON.stringify(resetState)}`);
    assert(resetState.reportChildren === 0 && resetState.reportDisplay === 'none' && resetState.pageCounts.every(value => value === '0') && resetState.loading === 0, `${locale} PDF reset left report/count/loading state: ${JSON.stringify(resetState)}`);
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

  await scenario('sample-accurate metronome engine', '/special-chars/music-calc/', async page => {
    await page.evaluate(() => {
      switchTab(1);
      window.__metroFrames = [];
      const dots = document.querySelector('#beatDots');
      new MutationObserver(() => {
        const frame = Number(dots.dataset.lastAudioFrame);
        if (Number.isFinite(frame) && window.__metroFrames.at(-1) !== frame) window.__metroFrames.push(frame);
      }).observe(dots, { attributes: true, attributeFilter: ['data-last-audio-frame'] });
      setMetroBpm(173);
    });
    await page.locator('#metroPlayBtn').click();
    await page.waitForFunction(() => ['audio-worklet', 'audio-clock-fallback'].includes(document.querySelector('#beatDots').dataset.engine));
    const initializedEngine = await page.locator('#beatDots').getAttribute('data-engine');
    assert(initializedEngine === 'audio-worklet', `metronome fell back to ${initializedEngine}`);
    await page.waitForFunction(() => window.__metroFrames.length >= 17, null, { timeout: 10000 });
    const state = await page.evaluate(() => {
      const frames = window.__metroFrames.slice(0, 17);
      const sampleRate = Number(document.querySelector('#beatDots').dataset.sampleRate);
      return {
        engine: document.querySelector('#beatDots').dataset.engine,
        frames,
        sampleRate,
        pressed: document.querySelector('#metroPlayBtn').getAttribute('aria-pressed')
      };
    });
    assert(state.engine === 'audio-worklet', `metronome changed engine mode to ${state.engine}`);
    assert(state.pressed === 'true', 'metronome play state is not exposed to assistive technology');
    const expectedFrames = state.sampleRate * 60 / 173;
    const intervals = state.frames.slice(1).map((frame, index) => frame - state.frames[index]);
    assert(intervals.every(interval => Math.abs(interval - expectedFrames) <= 2), `metronome frame drift: ${intervals.join(', ')} vs ${expectedFrames}`);
    assert(Math.abs((state.frames.at(-1) - state.frames[0]) - expectedFrames * 16) <= 2, 'metronome accumulated long-session frame drift');
    await page.locator('#metroPlayBtn').click();
    assert(await page.locator('#metroPlayBtn').getAttribute('aria-pressed') === 'false', 'metronome did not expose its stopped state');
    await page.waitForFunction(() => metroCtx?.state === 'suspended');
    const framesBeforeRestart = await page.evaluate(() => window.__metroFrames.length);
    await page.locator('#metroPlayBtn').click();
    await page.waitForFunction(previous => window.__metroFrames.length > previous, framesBeforeRestart);
    assert(await page.locator('#metroPlayBtn').getAttribute('aria-pressed') === 'true', 'metronome did not restart cleanly');
    await page.locator('#metroPlayBtn').click();
    await page.waitForFunction(() => metroCtx?.state === 'suspended');
  });

  await scenario('metronome fallback mute and stop lifecycle', '/special-chars/music-calc/', async page => {
    await page.evaluate(() => {
      switchTab(1);
      window.__fakeMetro = { oscillators: [], gains: [] };
      class FakeAudioParam {
        constructor() { this.value = 0; }
        setValueAtTime(value) { this.value = value; }
        exponentialRampToValueAtTime(value) { this.value = value; }
      }
      class FakeAudioContext {
        constructor() {
          this.currentTime = 1;
          this.sampleRate = 48000;
          this.state = 'suspended';
          this.destination = {};
          this.audioWorklet = null;
        }
        createOscillator() {
          const oscillator = {
            frequency: { value: 0 }, starts: [], stops: [], onended: null,
            connect() {}, disconnect() {},
            start(time) { this.starts.push(time); },
            stop(time) { this.stops.push(time); }
          };
          window.__fakeMetro.oscillators.push(oscillator);
          return oscillator;
        }
        createGain() {
          const gain = { gain: new FakeAudioParam(), connect() {}, disconnect() {} };
          window.__fakeMetro.gains.push(gain);
          return gain;
        }
        resume() { this.state = 'running'; return Promise.resolve(); }
        suspend() { this.state = 'suspended'; return Promise.resolve(); }
      }
      window.AudioContext = FakeAudioContext;
      window.webkitAudioContext = undefined;
      setMetroBpm(300);
      setMetroVolume(0);
    });
    await page.locator('#metroPlayBtn').click();
    await page.waitForFunction(() => document.querySelector('#beatDots').dataset.engine === 'audio-clock-fallback');
    assert(await page.evaluate(() => window.__fakeMetro.oscillators.length) === 0, 'muted fallback still scheduled an oscillator');
    await page.evaluate(() => setMetroVolume(80));
    await page.waitForFunction(() => window.__fakeMetro.oscillators.length > 0);
    await page.locator('#metroPlayBtn').click();
    const fallbackState = await page.evaluate(() => ({
      contextState: metroCtx.state,
      scheduledSources: fallbackScheduledSources.size,
      oscillators: window.__fakeMetro.oscillators.map(oscillator => ({ starts: oscillator.starts.length, stops: oscillator.stops.length }))
    }));
    assert(fallbackState.contextState === 'suspended', `fallback context stayed ${fallbackState.contextState}`);
    assert(fallbackState.scheduledSources === 0, 'fallback left scheduled sources after stop');
    assert(fallbackState.oscillators.every(oscillator => oscillator.starts === 1 && oscillator.stops >= 2), `fallback sources were not cancelled: ${JSON.stringify(fallbackState.oscillators)}`);
  });

  for (const [name, routePath] of [
    ['Korean metronome pending-start cancellation', '/special-chars/music-calc/'],
    ['English metronome pending-start cancellation', '/special-chars/en/music-calc/']
  ]) {
    await scenario(name, routePath, async page => {
      const state = await page.evaluate(async () => {
        switchTab(1);
        window.__fakeMetroLifecycle = { resumes: 0, suspends: 0 };
        class FakeAudioParam {
          setValueAtTime() {}
          exponentialRampToValueAtTime() {}
        }
        class DelayedAudioContext {
          constructor() {
            this.currentTime = 1;
            this.sampleRate = 48000;
            this.state = 'suspended';
            this.destination = {};
            this.audioWorklet = null;
          }
          createOscillator() {
            return {
              frequency: { value: 0 }, onended: null,
              connect() {}, disconnect() {}, start() {}, stop() {}
            };
          }
          createGain() {
            return { gain: new FakeAudioParam(), connect() {}, disconnect() {} };
          }
          resume() {
            window.__fakeMetroLifecycle.resumes += 1;
            return new Promise(resolve => setTimeout(() => {
              this.state = 'running';
              resolve();
            }, 100));
          }
          suspend() {
            window.__fakeMetroLifecycle.suspends += 1;
            this.state = 'suspended';
            return Promise.resolve();
          }
        }
        window.AudioContext = DelayedAudioContext;
        window.webkitAudioContext = undefined;
        const pendingStart = startMetronome();
        await new Promise(resolve => setTimeout(resolve, 10));
        window.dispatchEvent(new Event('pagehide'));
        const started = await pendingStart;
        await metroLifecyclePromise;
        return {
          started,
          desiredPlaying: metroDesiredPlaying,
          playing: metroPlaying,
          contextState: metroCtx.state,
          timerActive: fallbackTimerId !== null,
          scheduledSources: fallbackScheduledSources.size,
          lifecycle: window.__fakeMetroLifecycle
        };
      });
      assert(state.started === false, `cancelled start reported success: ${JSON.stringify(state)}`);
      assert(!state.desiredPlaying && !state.playing, `cancelled metronome restarted: ${JSON.stringify(state)}`);
      assert(state.contextState === 'suspended', `cancelled metronome context stayed ${state.contextState}`);
      assert(!state.timerActive && state.scheduledSources === 0, `cancelled metronome left fallback work: ${JSON.stringify(state)}`);
      assert(state.lifecycle.resumes === 1 && state.lifecycle.suspends >= 1, `lifecycle race was not exercised: ${JSON.stringify(state.lifecycle)}`);
    });
  }

  await scenario('English metronome AudioWorklet parity', '/special-chars/en/music-calc/', async page => {
    await page.evaluate(() => {
      switchTab(1);
      window.__metroFrames = [];
      const dots = document.querySelector('#beatDots');
      new MutationObserver(() => {
        const frame = Number(dots.dataset.lastAudioFrame);
        if (Number.isFinite(frame) && window.__metroFrames.at(-1) !== frame) window.__metroFrames.push(frame);
      }).observe(dots, { attributes: true, attributeFilter: ['data-last-audio-frame'] });
      setMetroBpm(181);
    });
    await page.locator('#metroPlayBtn').click();
    await page.waitForFunction(() => ['audio-worklet', 'audio-clock-fallback'].includes(document.querySelector('#beatDots').dataset.engine));
    const initializedEngine = await page.locator('#beatDots').getAttribute('data-engine');
    assert(initializedEngine === 'audio-worklet', `English metronome fell back to ${initializedEngine}`);
    await page.waitForFunction(() => window.__metroFrames.length >= 11, null, { timeout: 8000 });
    const state = await page.evaluate(() => ({
      engine: document.querySelector('#beatDots').dataset.engine,
      frames: window.__metroFrames.slice(0, 11),
      sampleRate: Number(document.querySelector('#beatDots').dataset.sampleRate)
    }));
    const expectedFrames = state.sampleRate * 60 / 181;
    assert(state.engine === 'audio-worklet', `English metronome fell back to ${state.engine}`);
    assert(Math.abs((state.frames.at(-1) - state.frames[0]) - expectedFrames * 10) <= 2, 'English metronome accumulated frame drift');
    await page.locator('#metroPlayBtn').click();
    await page.waitForFunction(() => metroCtx?.state === 'suspended');
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

  for (const [locale, routePath] of [['ko', '/special-chars/qr-code/'], ['en', '/special-chars/en/qr-code/']]) {
    await scenario(`${locale} QR local-library generation`, routePath, async (page, _context, baseUrl) => {
      await auditQrGeneration(page, baseUrl, locale);
    });
  }

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

  await scenario('self-hosted PDF engine, offline render, and image drop', '/special-chars/pdf-tool/', async (page, context, base) => {
    await page.waitForFunction(() => document.documentElement.dataset.pdfEngine === 'ready', null, { timeout: 10000 });
    const results = await page.evaluate(async () => {
      const settle = () => Promise.race([
        ensurePdfLibs().then(() => 'resolved', () => 'rejected'),
        new Promise(resolve => setTimeout(() => resolve('timeout'), 2000))
      ]);
      return [await settle(), await settle()];
    });
    assert(results[0] === 'resolved' && results[1] === 'resolved', `local PDF engine did not settle: ${results.join(', ')}`);
    const resourceOrigins = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => new URL(entry.name).origin));
    assert(resourceOrigins.every(origin => origin === new URL(base).origin), `PDF page loaded a third-party resource: ${resourceOrigins.join(', ')}`);
    await context.setOffline(true);
    const offlineResult = await page.evaluate(async () => {
      const document = await PDFDocument.create();
      const page = document.addPage([120, 120]);
      page.drawText('offline', { x: 10, y: 60, size: 12 });
      const bytes = await document.save();
      const byteLength = bytes.length;
      const thumb = await renderThumb(bytes, 1, 80);
      return { bytes: byteLength, width: thumb.width, height: thumb.height };
    });
    assert(offlineResult.bytes > 0 && offlineResult.width === 80 && offlineResult.height > 0, `offline PDF render failed: ${JSON.stringify(offlineResult)}`);
    await context.setOffline(false);
    await page.evaluate(() => {
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

  for (const [locale, routePath] of [['ko', '/special-chars/pdf-tool/'], ['en', '/special-chars/en/pdf-tool/']]) {
    await scenario(`${locale} PDF keyboard, rotate, reorder, and reset`, routePath, async page => {
      await auditPdfKeyboardResetAndReorder(page, locale);
    });
  }

  await scenario('self-hosted background-removal module', '/special-chars/bg-remover/', async (page, _context, base) => {
    const moduleState = await page.evaluate(async () => {
      const moduleUrl = '/special-chars/vendor/imgly-background-removal/1.5.5/background-removal.bundle.js';
      const assetUrl = new URL('/special-chars/vendor/imgly-background-removal/1.5.5/data/', window.location.origin).href;
      const module = await import(moduleUrl);
      const manifest = await fetch(`${assetUrl}resources.json`).then(response => response.json());
      return {
        type: typeof module.removeBackground,
        moduleUrl,
        assetUrl,
        model: 'isnet_quint8',
        resources: Object.keys(manifest)
      };
    });
    assert(moduleState.type === 'function', `local background-removal module did not load: ${JSON.stringify(moduleState)}`);
    assert(moduleState.moduleUrl.startsWith('/special-chars/vendor/') && moduleState.assetUrl.startsWith(new URL(base).origin), `background remover is not self-hosted: ${JSON.stringify(moduleState)}`);
    assert(moduleState.model === 'isnet_quint8' && moduleState.resources.includes('/models/isnet_quint8'), `quantized model manifest is incomplete: ${JSON.stringify(moduleState)}`);
    const resourceOrigins = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => new URL(entry.name).origin));
    assert(resourceOrigins.every(origin => origin === new URL(base).origin), `background remover loaded a third-party resource: ${resourceOrigins.join(', ')}`);
    const moduleSource = (await page.locator('script[type="module"]').allTextContents()).join('\n');
    assert(moduleSource.includes('escapeHtml(origFile.name)'), 'background-remover report does not escape the selected filename');
  });

  if (runBackgroundInference) {
    await scenario('background-removal real small-image inference', '/special-chars/bg-remover/', async (page, _context, baseUrl) => {
      const inferenceConsoleErrors = [];
      page.on('console', message => {
        if (message.type() === 'error') inferenceConsoleErrors.push(message.text());
      });
      const encodedInput = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        context.fillStyle = '#f4f5f7';
        context.fillRect(0, 0, 64, 64);
        context.fillStyle = '#ef4444';
        context.beginPath();
        context.arc(32, 32, 20, 0, Math.PI * 2);
        context.fill();
        return canvas.toDataURL('image/png').split(',')[1];
      });
      await page.locator('#fileInput').setInputFiles({
        name: 'background-removal-audit-64.png',
        mimeType: 'image/png',
        buffer: Buffer.from(encodedInput, 'base64')
      });
      const inferenceTimeout = browserName === 'webkit' ? 480000 : browserName === 'firefox' ? 300000 : 150000;
      try {
        await page.waitForFunction(() => (
          document.querySelector('#resultArea')?.classList.contains('active')
          || getComputedStyle(document.querySelector('#retryBtn')).display !== 'none'
        ), null, { timeout: inferenceTimeout });
      } catch (error) {
        const state = await page.evaluate(() => ({
          progress: document.querySelector('#progressText')?.textContent || '',
          detail: document.querySelector('#progressSub')?.textContent || '',
          progressActive: document.querySelector('#progressWrap')?.classList.contains('active') || false,
          dropzoneDisplay: getComputedStyle(document.querySelector('#dropzone')).display,
          retryVisible: getComputedStyle(document.querySelector('#retryBtn')).display !== 'none'
        }));
        throw new Error(`${error.message}; state=${JSON.stringify(state)}; console=${inferenceConsoleErrors.slice(0, 4).join(' | ')}`);
      }
      const result = await page.evaluate(async expectedOrigin => {
        const success = document.querySelector('#resultArea')?.classList.contains('active') || false;
        let output = { bytes: 0, type: '', width: 0, height: 0, pngSignature: false };
        if (success) {
          const blob = await fetch(document.querySelector('#resultImg').src).then(response => response.blob());
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const bitmap = await createImageBitmap(blob);
          output = {
            bytes: bytes.byteLength,
            type: blob.type,
            width: bitmap.width,
            height: bitmap.height,
            pngSignature: bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
          };
          bitmap.close();
        }
        const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '';
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        return {
          success,
          output,
          error: document.querySelector('#progressSub')?.textContent || '',
          retryVisible: getComputedStyle(document.querySelector('#retryBtn')).display !== 'none',
          csp,
          hasUnsafeEval: /(^|[\s;])'unsafe-eval'(?=[\s;]|$)/.test(csp),
          externalResources: resources.filter(resource => {
            const url = new URL(resource, location.href);
            return !['blob:', 'data:'].includes(url.protocol) && url.origin !== expectedOrigin;
          })
        };
      }, new URL(baseUrl).origin);
      assert(result.success && !result.retryVisible, `background-removal inference failed: ${JSON.stringify(result)}`);
      assert(result.output.type === 'image/png' && result.output.pngSignature && result.output.bytes > 0, `background-removal output is not a non-empty PNG: ${JSON.stringify(result.output)}`);
      assert(result.output.width === 64 && result.output.height === 64, `background-removal changed the 64x64 output dimensions: ${JSON.stringify(result.output)}`);
      assert(result.csp.includes("'wasm-unsafe-eval'") && !result.hasUnsafeEval, `background-removal CSP is broader than required: ${result.csp}`);
      assert(result.externalResources.length === 0, `background-removal inference loaded third-party resources: ${result.externalResources.join(', ')}`);
    });
  }

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

  await scenario('PWA offline self-hosted QR and PDF engines', '/special-chars/', async (page, context, baseUrl) => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    }

    await page.goto(`${baseUrl}/special-chars/qr-code/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__qrUtf8Ready === true && typeof window.qrcode === 'function');
    const onlineQr = await page.evaluate(() => {
      document.querySelector('#qrInput').value = 'online cache warmup';
      generate();
      return document.querySelector('#qrBox canvas')?.width || 0;
    });
    assert(onlineQr > 0, 'online QR cache warmup failed');

    await page.goto(`${baseUrl}/special-chars/pdf-tool/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.pdfEngine === 'ready', null, { timeout: 10000 });
    const onlinePdf = await page.evaluate(async () => {
      const doc = await PDFDocument.create();
      doc.addPage([120, 120]);
      const bytes = await doc.save();
      const thumb = await renderThumb(bytes, 1, 64);
      return { width: thumb.width, height: thumb.height };
    });
    assert(onlinePdf.width === 64 && onlinePdf.height > 0, `online PDF cache warmup failed: ${JSON.stringify(onlinePdf)}`);

    const cached = await page.evaluate(async () => {
      const paths = [
        '/special-chars/vendor/qrcode-generator/1.4.4/qrcode.js',
        '/special-chars/vendor/pdf-lib/1.17.1/pdf-lib.min.js',
        '/special-chars/vendor/pdfjs-dist/4.2.67/pdf.min.mjs',
        '/special-chars/vendor/pdfjs-dist/4.2.67/pdf.worker.min.mjs'
      ];
      const matches = await Promise.all(paths.map(async resource => Boolean(await caches.match(resource))));
      return Object.fromEntries(paths.map((resource, index) => [resource, matches[index]]));
    });
    assert(Object.values(cached).every(Boolean), `self-hosted QR/PDF assets were not cached: ${JSON.stringify(cached)}`);

    await context.setOffline(true);
    await page.goto(`${baseUrl}/special-chars/qr-code/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__qrUtf8Ready === true && typeof window.qrcode === 'function');
    const offlineQr = await page.evaluate(() => {
      document.querySelector('#qrInput').value = '오프라인 QR';
      generate();
      const canvas = document.querySelector('#qrBox canvas');
      return { width: canvas?.width || 0, dataUrl: currentDataUrl.slice(0, 22) };
    });
    assert(offlineQr.width > 0 && offlineQr.dataUrl === 'data:image/png;base64,', `cached QR failed offline: ${JSON.stringify(offlineQr)}`);

    await page.goto(`${baseUrl}/special-chars/pdf-tool/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.pdfEngine === 'ready', null, { timeout: 10000 });
    const offlinePdf = await page.evaluate(async () => {
      const doc = await PDFDocument.create();
      doc.addPage([100, 140]);
      const bytes = await doc.save();
      const thumb = await renderThumb(bytes, 1, 60);
      return { width: thumb.width, height: thumb.height, engine: document.documentElement.dataset.pdfEngine };
    });
    await context.setOffline(false);
    assert(offlinePdf.width === 60 && offlinePdf.height > 0 && offlinePdf.engine === 'ready', `cached PDF engine failed offline: ${JSON.stringify(offlinePdf)}`);
  }, { serviceWorkers: 'allow' });

  await scenario('PWA rejects an incomplete shell install', '/__blank', async (page, _context, baseUrl) => {
    forcedFailurePath = '/special-chars/icon-maskable-512.png';
    forcedFailureHits = 0;
    try {
      await page.goto(`${baseUrl}/special-chars/`, { waitUntil: 'domcontentloaded' });
      for (let attempt = 0; attempt < 100 && forcedFailureHits === 0; attempt += 1) await page.waitForTimeout(50);
      assert(forcedFailureHits > 0, 'service worker did not request the forced-failure shell asset');
      await page.waitForTimeout(250);
      const state = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration('/special-chars/');
        const cacheNames = await caches.keys();
        const shellName = cacheNames.find(name => name.startsWith('teemozipsa-shell-v'));
        const entries = shellName ? (await (await caches.open(shellName)).keys()).length : 0;
        return {
          controller: Boolean(navigator.serviceWorker.controller),
          active: Boolean(registration?.active || registration?.waiting),
          shellEntries: entries
        };
      });
      assert(!state.controller && !state.active && state.shellEntries === 0, `partial PWA shell activated: ${JSON.stringify(state)}`);
    } finally {
      forcedFailurePath = null;
      forcedFailureHits = 0;
    }
  }, { serviceWorkers: 'allow' });

  await scenario('PWA scope, installability, and cache ownership', '/__blank', async (page, context, baseUrl) => {
    await page.evaluate(async () => {
      await caches.open('emoji-kitchen-db-v1');
      await caches.open('teemozipsa-shell-v1.2');
      await caches.open('teemozipsa-vendor-v1');
      await caches.open('teemozipsa-v1.2');
      const foreign = await caches.open('foreign-cache');
      await foreign.put('/special-chars/theme.css', new Response('foreign poison', { headers: { 'Content-Type': 'text/css' } }));
    });
    await page.goto(`${baseUrl}/special-chars/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(300);
    const state = await page.evaluate(async () => {
      const manifest = await fetch('/special-chars/manifest.json').then(response => response.json());
      const icons = await Promise.all(manifest.icons.map(async icon => {
        const response = await fetch(new URL(icon.src, document.baseURI));
        const bitmap = await createImageBitmap(await response.blob());
        const result = { src: icon.src, purpose: icon.purpose, declared: icon.sizes, width: bitmap.width, height: bitmap.height };
        if ((icon.purpose || '').split(/\s+/).includes('maskable')) {
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const drawing = canvas.getContext('2d', { willReadFrequently: true });
          drawing.drawImage(bitmap, 0, 0);
          const pixels = drawing.getImageData(0, 0, bitmap.width, bitmap.height).data;
          const background = [pixels[0], pixels[1], pixels[2]];
          let maxForegroundRadius = 0;
          let minAlpha = 255;
          for (let y = 0; y < bitmap.height; y += 1) {
            for (let x = 0; x < bitmap.width; x += 1) {
              const offset = (y * bitmap.width + x) * 4;
              minAlpha = Math.min(minAlpha, pixels[offset + 3]);
              const colorDelta = Math.abs(pixels[offset] - background[0]) + Math.abs(pixels[offset + 1] - background[1]) + Math.abs(pixels[offset + 2] - background[2]);
              if (colorDelta > 12) {
                maxForegroundRadius = Math.max(maxForegroundRadius, Math.hypot(x + 0.5 - bitmap.width / 2, y + 0.5 - bitmap.height / 2));
              }
            }
          }
          result.maxForegroundRadius = maxForegroundRadius;
          result.safeRadius = bitmap.width * 0.4;
          result.minAlpha = minAlpha;
        }
        bitmap.close();
        return result;
      }));
      const cacheNames = await caches.keys();
      const ownedCacheName = cacheNames.find(name => name.startsWith('teemozipsa-shell-v'));
      const ownedCache = ownedCacheName ? await caches.open(ownedCacheName) : null;
      const cachedIcons = ownedCache ? await Promise.all(icons.map(icon => ownedCache.match(new URL(icon.src, document.baseURI)).then(Boolean))) : [];
      return {
        caches: cacheNames,
        scopes: (await navigator.serviceWorker.getRegistrations()).map(reg => reg.scope),
        manifest,
        icons,
        cachedIcons,
        theme: await fetch('/special-chars/theme.css').then(response => response.text())
      };
    });
    assert(state.caches.includes('emoji-kitchen-db-v1'), `foreign cache was deleted: ${state.caches}`);
    assert(!state.caches.includes('teemozipsa-shell-v1.2'), `old owned cache was not deleted: ${state.caches}`);
    assert(!state.caches.includes('teemozipsa-vendor-v1'), `old vendor cache generation was not deleted: ${state.caches}`);
    assert(!state.caches.includes('teemozipsa-v1.2'), `legacy cache was not migrated: ${state.caches}`);
    assert(state.caches.includes('foreign-cache') && state.theme !== 'foreign poison' && state.theme.includes('--bg-body'), 'service worker read a foreign cache entry');
    assert(state.scopes.every(scope => scope.endsWith('/special-chars/')), `unexpected service worker scope: ${state.scopes}`);
    assert(state.manifest.start_url === '/special-chars/' && state.manifest.scope === '/special-chars/', 'manifest and service-worker scope differ');
    assert(state.icons.some(icon => icon.purpose === 'any' && icon.declared === '192x192' && icon.width === 192 && icon.height === 192), `missing valid 192px PWA icon: ${JSON.stringify(state.icons)}`);
    assert(state.icons.some(icon => icon.purpose === 'maskable' && icon.declared === '512x512' && icon.width === 512 && icon.height === 512), `missing valid maskable PWA icon: ${JSON.stringify(state.icons)}`);
    const maskableIcon = state.icons.find(icon => icon.purpose === 'maskable');
    assert(maskableIcon.minAlpha === 255 && maskableIcon.maxForegroundRadius <= maskableIcon.safeRadius, `maskable artwork escapes its safe zone: ${JSON.stringify(maskableIcon)}`);
    assert(state.cachedIcons.length === state.icons.length && state.cachedIcons.every(Boolean), `PWA icons were not precached: ${state.cachedIcons}`);
    const vendorUrl = '/special-chars/vendor/pdf-lib/1.17.1/pdf-lib.min.js';
    const onlineVendorBytes = await page.evaluate(async url => (await (await fetch(url)).arrayBuffer()).byteLength, vendorUrl);
    const vendorCached = await page.evaluate(async url => Boolean(await (await caches.open('teemozipsa-vendor-v2')).match(url)), vendorUrl);
    assert(onlineVendorBytes > 500000 && vendorCached, `vendor asset did not complete its stable cache write: ${onlineVendorBytes}, ${vendorCached}`);
    const modelChunkUrl = await page.evaluate(async () => {
      const dataPath = '/special-chars/vendor/imgly-background-removal/1.5.5/data/';
      const resources = await fetch(`${dataPath}resources.json`).then(response => response.json());
      return `${dataPath}${resources['/models/isnet_quint8'].chunks[0].hash}`;
    });
    const onlineModelChunkBytes = await page.evaluate(async url => (await (await fetch(url)).arrayBuffer()).byteLength, modelChunkUrl);
    const modelChunkCached = await page.evaluate(async url => Boolean(await (await caches.open('teemozipsa-vendor-v2')).match(url)), modelChunkUrl);
    assert(onlineModelChunkBytes === 4194304 && modelChunkCached, `model chunk did not complete its stable cache write: ${onlineModelChunkBytes}, ${modelChunkCached}`);
    await context.setOffline(true);
    const offlineVendorBytes = await page.evaluate(async url => (await (await fetch(url)).arrayBuffer()).byteLength, vendorUrl);
    const offlineModelChunkBytes = await page.evaluate(async url => (await (await fetch(url)).arrayBuffer()).byteLength, modelChunkUrl);
    await context.setOffline(false);
    assert(offlineVendorBytes === onlineVendorBytes, `cached vendor asset failed offline: ${offlineVendorBytes} vs ${onlineVendorBytes}`);
    assert(offlineModelChunkBytes === onlineModelChunkBytes, `cached model chunk failed offline: ${offlineModelChunkBytes} vs ${onlineModelChunkBytes}`);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    const installability = await cdp.send('Page.getInstallabilityErrors');
    assert(installability.installabilityErrors.length === 0, `PWA installability errors: ${JSON.stringify(installability.installabilityErrors)}`);
  }, { serviceWorkers: 'allow' });

  await browser.close().catch(() => {});
  await new Promise(resolve => server.close(resolve));

  if (failures.length) {
    console.error(`Interaction audit failed (${failures.length}):`);
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log(`Interaction audit passed: ${passed} ${browserName} browser regression scenarios.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
