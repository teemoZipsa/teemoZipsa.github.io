import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const cases = JSON.parse(fs.readFileSync(path.join(scriptDir, 'audit-cases.json'), 'utf8'));
const failures = [];
const exercised = new Set();
const startedAt = Date.now();

const routes = {
  'loan-calc': '/special-chars/loan-calc/',
  'discount-calc': '/special-chars/discount-calc/',
  'biz-day-calc': '/special-chars/biz-day-calc/',
  'broker-fee-calc': '/special-chars/broker-fee-calc/',
  'pet-food-calc': '/special-chars/pet-food-calc/',
  'pet-bmi-calc': '/special-chars/pet-bmi-calc/',
  'pet-age-calc': '/special-chars/pet-age-calc/',
  'taxi-calc': '/special-chars/taxi-calc/',
  'gpa-calc': '/special-chars/gpa-calc/',
  'fuel-calc': '/special-chars/fuel-calc/'
};

function contentType(file) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2'
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      let target = path.resolve(rootDir, pathname.replace(/^\/+/, '') || 'index.html');
      if (!target.startsWith(`${rootDir}${path.sep}`) && target !== rootDir) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType(target), 'Cache-Control': 'no-store' });
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

function keyFor(caseItem) {
  return `${caseItem.tool}/${caseItem.caseId}`;
}

function compare(caseItem, actual) {
  if (!actual || typeof actual !== 'object') {
    failures.push(`${keyFor(caseItem)}: page adapter returned ${String(actual)}`);
    return;
  }

  for (const [field, expected] of Object.entries(caseItem.expected)) {
    const received = actual[field];
    const tolerance = caseItem.tool.startsWith('pet-') && typeof expected === 'number' ? 0.01 : 0;
    const matches = typeof expected === 'number'
      ? typeof received === 'number' && Number.isFinite(received) && Math.abs(received - expected) <= tolerance
      : Object.is(received, expected);
    if (!matches) {
      failures.push(`${keyFor(caseItem)}: expected ${field}=${JSON.stringify(expected)}, got ${JSON.stringify(received)}`);
    }
  }
}

const runners = {
  'loan-calc': (page, caseItem) => page.evaluate(inputs => {
    const numberFrom = value => {
      const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    };
    document.getElementById('principal').value = String(inputs.principal);
    document.getElementById('rate').value = String(inputs.annualRate);
    document.getElementById('years').value = String(inputs.years);
    setMethod({ equalPayment: 0, equalPrincipal: 1, bullet: 2 }[inputs.method]);
    return {
      firstPayment: numberFrom(document.getElementById('r-monthly').textContent),
      totalInterest: numberFrom(document.getElementById('r-interest').textContent),
      totalPayment: numberFrom(document.getElementById('r-total').textContent)
    };
  }, caseItem.inputs),

  'discount-calc': (page, caseItem) => page.evaluate(inputs => {
    const numberFrom = value => {
      const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    };
    document.getElementById('price').value = String(inputs.price);
    document.getElementById('vatToggle').checked = Boolean(inputs.vat);
    document.getElementById('vatExToggle').checked = Boolean(inputs.preTax);
    if (Object.hasOwn(inputs, 'discountAmount')) {
      document.getElementById('discountAmt').value = String(inputs.discountAmount);
      calcByAmt();
    } else {
      document.getElementById('discountRate').value = String(inputs.discountRate);
      calc();
    }
    const reportText = document.getElementById('analysisReport').textContent.replace(/\s+/g, ' ');
    const baseMatch = reportText.match(/세전 원금[^0-9]*([\d,]+)원/);
    return {
      base: baseMatch ? numberFrom(baseMatch[1]) : null,
      discountAmount: numberFrom(document.getElementById('resDiscount').textContent),
      afterDiscount: numberFrom(document.getElementById('resAfterDiscount').textContent),
      vatAmount: numberFrom(document.getElementById('resVat').textContent),
      finalAmount: numberFrom(document.getElementById('resFinal').textContent)
    };
  }, caseItem.inputs),

  'biz-day-calc': (page, caseItem) => page.evaluate(inputs => {
    const numberFrom = value => {
      const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    };
    setMode(inputs.operation);
    document.getElementById('excludeHolidays').checked = Boolean(inputs.excludeHolidays);
    document.getElementById('includeSaturday').checked = Boolean(inputs.includeSaturday);
    if (inputs.operation === 'add') {
      document.getElementById('startDate').value = inputs.startDate;
      document.getElementById('bizDays').value = String(inputs.businessDays);
    } else {
      document.getElementById('fromDate').value = inputs.fromDate;
      document.getElementById('toDate').value = inputs.toDate;
    }
    calculate();

    const values = [...document.querySelectorAll('#resultDetail .detail-box .value')]
      .map(element => numberFrom(element.textContent));
    const resultText = document.getElementById('resultDate').textContent.trim();
    if (inputs.operation === 'between') {
      return { businessDays: numberFrom(resultText), totalDays: values[0], weekendDays: values[1], holidayCount: values[2] };
    }
    const match = resultText.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
    return {
      targetDate: match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : null,
      totalDays: values[0],
      weekendDays: values[1],
      holidayCount: values[2]
    };
  }, caseItem.inputs),

  'broker-fee-calc': (page, caseItem) => page.evaluate(({ inputs, caseId }) => {
    const numberFrom = value => {
      const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    };
    setTrade({ sale: 0, lease: 1, monthlyRent: 2 }[inputs.tradeType]);
    setProp({ housing: 0, officetel: 1, nonHousing: 2 }[inputs.propertyType]);
    document.getElementById('price').value = String(inputs.amount ?? inputs.deposit);
    document.getElementById('monthlyRent').value = String(inputs.monthlyRent ?? 0);
    document.getElementById('area').value = String(inputs.area ?? 60);
    // This legacy fixture names a residential officetel but predates the explicit UI control.
    document.getElementById('residentialRequirements').value = caseId === 'residential-officetel-lease' ? 'yes' : 'no';
    document.getElementById('vatOption').value = inputs.vat === 'general' ? 'add' : 'noadd';
    calc();

    const cards = [...document.querySelectorAll('#summary .summary-card')].map(card => ({
      label: card.querySelector('.s-label')?.textContent.trim() || '',
      value: numberFrom(card.querySelector('.s-value')?.textContent)
    }));
    const total = cards.find(card => card.label.startsWith('중개수수료'))?.value ?? null;
    const ratePercent = cards.find(card => card.label === '적용 요율')?.value ?? null;
    const fee = cards.find(card => card.label.startsWith('중개보수'))?.value ?? null;
    return {
      convertedAmount: getConvertedAmount().amount,
      fee,
      rate: ratePercent === null ? null : ratePercent / 100,
      vat: total === null || fee === null ? null : total - fee,
      total
    };
  }, { inputs: caseItem.inputs, caseId: caseItem.caseId }),

  'pet-food-calc': (page, caseItem) => page.evaluate(inputs => {
    const numberFrom = value => {
      const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    };
    setType(inputs.petType);
    document.getElementById('weight').value = String(inputs.weightKg);
    document.getElementById('lifeStage').value = inputs.stage;
    document.getElementById('activity').value = inputs.activity;
    document.getElementById('neutered').value = inputs.neutered;
    calc();
    return {
      rer: numberFrom(document.getElementById('r-rer').textContent),
      factor: numberFrom(document.getElementById('r-factor').textContent),
      der: numberFrom(document.getElementById('r-der').textContent),
      dailyGrams: numberFrom(document.getElementById('r-daily-grams').textContent)
    };
  }, caseItem.inputs),

  'pet-bmi-calc': (page, caseItem) => page.evaluate(inputs => {
    selectBcs(inputs.bcs);
    return {
      status: document.getElementById('status').textContent.trim(),
      bcs: Number(document.getElementById('r-bcs').textContent)
    };
  }, caseItem.inputs),

  'pet-age-calc': (page, caseItem) => page.evaluate(inputs => {
    const numberFrom = value => {
      const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    };
    setType(inputs.petType);
    if (inputs.petType === 'dog') setSize(inputs.size);
    const input = document.getElementById('petAge');
    input.value = String(inputs.ageYears);
    calc();
    const valid = input.getAttribute('aria-invalid') !== 'true';
    return {
      valid,
      humanAge: valid ? numberFrom(document.getElementById('r-human-age').textContent) : null
    };
  }, caseItem.inputs),

  'taxi-calc': (page, caseItem) => page.evaluate(inputs => {
    document.getElementById('region').value = '서울';
    document.getElementById('distance').value = String(inputs.distanceKm);
    document.getElementById('lowSpeedMinutes').value = String(inputs.lowSpeedMinutes ?? 0);
    document.getElementById('outSurcharge').value = String(inputs.outRatePercent ?? 0);
    document.getElementById('tollFee').value = '0';
    document.getElementById('callFee').value = '0';
    document.getElementById('additionalFee').value = '0';
    document.getElementById('people').value = '1';
    if (isNight !== Boolean(inputs.night)) toggleNight();
    if (isRound) toggleRound();
    const result = calcFare();
    calc();
    return result ? { valid: true, meterEstimateOne: result.meterEstimateOne } : { valid: false };
  }, caseItem.inputs),

  'gpa-calc': (page, caseItem) => page.evaluate(inputs => {
    document.getElementById('courseBody').replaceChildren();
    setScale(inputs.scale);
    for (const course of inputs.courses) {
      addCourse();
      const row = document.querySelector('#courseBody tr:last-child');
      row.querySelector('input[type="number"]').value = String(course.credit);
      row.querySelector('select').value = course.grade;
    }

    let captured = null;
    const originalUpdateReport = updateReport;
    updateReport = params => {
      captured = { ...params };
      return originalUpdateReport(params);
    };
    try {
      calculate();
    } finally {
      updateReport = originalUpdateReport;
    }
    return captured ? {
      valid: captured.enteredCourseCount > 0,
      gpa: captured.gpa === null ? null : Number(captured.gpa),
      gpaCredits: captured.gpaCredits,
      earnedCredits: captured.earnedCredits,
      enteredCourseCount: captured.enteredCourseCount,
      invalidCreditCount: captured.invalidCreditCount
    } : { valid: false };
  }, caseItem.inputs),

  'fuel-calc': (page, caseItem) => page.evaluate(inputs => {
    const numberFrom = value => {
      const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    };
    document.getElementById('distance').value = String(inputs.distanceKm);
    document.getElementById('efficiency').value = String(inputs.efficiencyKmpl);
    document.getElementById('fuelPrice').value = String(inputs.pricePerLiter);
    document.getElementById('people').value = String(inputs.people);
    document.getElementById('roundTrip').checked = Boolean(inputs.roundTrip);
    calc();

    const details = Object.fromEntries([...document.querySelectorAll('#detailBox .detail-row')].map(row => [
      row.querySelector('.detail-label')?.textContent.trim(),
      row.querySelector('.detail-value')?.textContent.trim()
    ]));
    const cards = Object.fromEntries([...document.querySelectorAll('#summary .summary-card')].map(card => [
      card.querySelector('.s-label')?.textContent.trim(),
      card.querySelector('.s-value')?.textContent.trim()
    ]));
    const valid = Object.keys(cards).length > 0;
    const totalCost = numberFrom(details['총 유류비']);
    return valid ? {
      valid: true,
      actualDistanceKm: numberFrom(inputs.roundTrip ? details['왕복 거리'] : details['주행 거리']),
      fuelLiters: numberFrom(details['필요 연료량']),
      totalCost,
      perPerson: inputs.people > 1 ? numberFrom(details[`1인당 (÷${inputs.people})`]) : totalCost,
      roundTripCost: inputs.roundTrip ? null : numberFrom(cards['왕복 시'])
    } : { valid: false };
  }, caseItem.inputs)
};

async function main() {
  const fixtureKeys = cases.map(keyFor);
  const uniqueFixtureKeys = new Set(fixtureKeys);
  if (uniqueFixtureKeys.size !== fixtureKeys.length) {
    const duplicates = fixtureKeys.filter((key, index) => fixtureKeys.indexOf(key) !== index);
    throw new Error(`Duplicate audit case IDs: ${[...new Set(duplicates)].join(', ')}`);
  }

  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
    await context.route('**/*', route => {
      const url = route.request().url();
      return url.startsWith(`${base}/`) ? route.continue() : route.abort('failed');
    });

    for (const [tool, routePath] of Object.entries(routes)) {
      const toolCases = cases.filter(caseItem => caseItem.tool === tool);
      const runner = runners[tool];
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));

      try {
        const response = await page.goto(`${base}${routePath}`, { waitUntil: 'networkidle', timeout: 10000 });
        if (!response?.ok()) throw new Error(`${routePath} returned ${response?.status() || 'no response'}`);
        if (typeof runner !== 'function') throw new Error('no real-page adapter registered');

        for (const caseItem of toolCases) {
          exercised.add(keyFor(caseItem));
          try {
            compare(caseItem, await runner(page, caseItem));
          } catch (error) {
            failures.push(`${keyFor(caseItem)}: ${error.message || error}`);
          }
        }
        for (const message of pageErrors) {
          for (const caseItem of toolCases) failures.push(`${keyFor(caseItem)}: page error: ${message}`);
        }
      } catch (error) {
        for (const caseItem of toolCases) failures.push(`${keyFor(caseItem)}: page setup failed: ${error.message || error}`);
      } finally {
        await page.close().catch(() => {});
      }
    }

    const unknownTools = [...new Set(cases.map(caseItem => caseItem.tool))].filter(tool => !routes[tool] || !runners[tool]);
    for (const tool of unknownTools) {
      for (const caseItem of cases.filter(item => item.tool === tool)) failures.push(`${keyFor(caseItem)}: no page route/adapter registered`);
    }

    const missing = fixtureKeys.filter(key => !exercised.has(key));
    for (const key of missing) failures.push(`${key}: case was not exercised against its page`);

    const coverage = [...new Set(cases.map(caseItem => caseItem.tool))]
      .map(tool => `${tool}=${cases.filter(caseItem => caseItem.tool === tool && exercised.has(keyFor(caseItem))).length}/${cases.filter(caseItem => caseItem.tool === tool).length}`)
      .join(', ');
    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`Real-page formula coverage: ${exercised.size}/${cases.length} cases; ${coverage}.`);

    if (failures.length) {
      console.error(`Real-page formula audit failed (${failures.length} issue${failures.length === 1 ? '' : 's'}, ${elapsedSeconds}s):`);
      failures.forEach(failure => console.error(`- ${failure}`));
      process.exitCode = 1;
    } else {
      console.log(`Real-page formula audit passed: ${cases.length}/${cases.length} cases across ${Object.keys(routes).length} tools (${elapsedSeconds}s).`);
    }
  } finally {
    await browser?.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
