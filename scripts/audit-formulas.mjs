import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const casesPath = path.join(__dirname, 'audit-cases.json');
const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

const requiredMeta = ['source', 'checkedAt', 'effectiveFrom', 'formula', 'roundingRule', 'crossCheckedWith'];
const failures = [];

function roundWon(n) {
  return Math.round(n);
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateFromIso(value) {
  return new Date(`${value}T00:00:00`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDate(a, b) {
  return isoDate(a) === isoDate(b);
}

function fixedHolidayRules(year) {
  const rules = [
    ['national', `${year}-03-01`, '삼일절'],
    ['fixed', `${year}-05-01`, '노동절'],
    ['fixed', `${year}-05-05`, '어린이날'],
    ['fixed', `${year}-06-06`, '현충일'],
    ['national', `${year}-07-17`, '제헌절'],
    ['national', `${year}-08-15`, '광복절'],
    ['national', `${year}-10-03`, '개천절'],
    ['national', `${year}-10-09`, '한글날'],
    ['fixed', `${year}-12-25`, '기독탄신일']
  ];
  return rules.map(([kind, date, name]) => ({ kind, date, name }));
}

const lunarHolidays = {
  2026: [
    { kind: 'lunarNewYear', date: '2026-02-16', name: '설날 연휴' },
    { kind: 'lunarNewYear', date: '2026-02-17', name: '설날' },
    { kind: 'lunarNewYear', date: '2026-02-18', name: '설날 연휴' },
    { kind: 'buddha', date: '2026-05-24', name: '부처님오신날' },
    { kind: 'chuseok', date: '2026-09-24', name: '추석 연휴' },
    { kind: 'chuseok', date: '2026-09-25', name: '추석' },
    { kind: 'chuseok', date: '2026-09-26', name: '추석 연휴' }
  ]
};

function substituteEligible(rule, allHolidayDates) {
  const date = dateFromIso(rule.date);
  const day = date.getDay();
  const overlapsOtherHoliday = allHolidayDates.get(rule.date) > 1;
  if (['national', 'fixed', 'buddha'].includes(rule.kind)) {
    return day === 0 || day === 6 || overlapsOtherHoliday;
  }
  if (['lunarNewYear', 'chuseok'].includes(rule.kind)) {
    return day === 0 || overlapsOtherHoliday;
  }
  return false;
}

function buildHolidays(year) {
  const manual = JSON.parse(fs.readFileSync(path.join(rootDir, 'special-chars/data/kr-holidays-extra.json'), 'utf8'));
  const base = [...fixedHolidayRules(year), ...(lunarHolidays[year] || [])];
  const counts = new Map();
  base.forEach(h => counts.set(h.date, (counts.get(h.date) || 0) + 1));
  const holidays = base.map(h => ({ date: dateFromIso(h.date), name: h.name, substitute: false }));
  const holidayIsoSet = new Set(base.map(h => h.date));

  for (const rule of base) {
    if (!substituteEligible(rule, counts)) continue;
    let candidate = addDays(dateFromIso(rule.date), 1);
    while (candidate.getDay() === 6 || holidayIsoSet.has(isoDate(candidate))) {
      candidate = addDays(candidate, 1);
    }
    const candidateIso = isoDate(candidate);
    holidayIsoSet.add(candidateIso);
    holidays.push({ date: candidate, name: `대체공휴일(${rule.name})`, substitute: true });
  }

  for (const item of manual.years[String(year)] || []) {
    holidays.push({ date: dateFromIso(item.date), name: item.name, substitute: false });
  }
  return holidays;
}

function isWeekend(date, includeSaturday) {
  const day = date.getDay();
  return day === 0 || (day === 6 && !includeSaturday);
}

function holidayFor(date, excludeHolidays) {
  if (!excludeHolidays) return null;
  return buildHolidays(date.getFullYear()).find(h => sameDate(h.date, date)) || null;
}

function businessAdd({ startDate, businessDays, excludeHolidays, includeSaturday }) {
  const direction = businessDays > 0 ? 1 : -1;
  let current = dateFromIso(startDate);
  let remaining = Math.abs(businessDays);
  let totalDays = 0;
  let weekendDays = 0;
  const holidays = [];
  while (remaining > 0) {
    current = addDays(current, direction);
    totalDays++;
    if (isWeekend(current, includeSaturday)) {
      weekendDays++;
      continue;
    }
    const holiday = holidayFor(current, excludeHolidays);
    if (holiday) {
      holidays.push(holiday);
      continue;
    }
    remaining--;
  }
  return { targetDate: isoDate(current), totalDays, weekendDays, holidayCount: holidays.length };
}

function businessBetween({ fromDate, toDate, excludeHolidays, includeSaturday }) {
  let from = dateFromIso(fromDate);
  let to = dateFromIso(toDate);
  if (from > to) [from, to] = [to, from];
  let current = new Date(from);
  let businessDays = 0;
  let totalDays = 0;
  let weekendDays = 0;
  const holidays = [];
  while (current < to) {
    current = addDays(current, 1);
    totalDays++;
    if (isWeekend(current, includeSaturday)) {
      weekendDays++;
      continue;
    }
    const holiday = holidayFor(current, excludeHolidays);
    if (holiday) {
      holidays.push(holiday);
      continue;
    }
    businessDays++;
  }
  return { businessDays, totalDays, weekendDays, holidayCount: holidays.length };
}

function loanCalc({ principal: P, annualRate, years, method }) {
  const months = years * 12;
  const r = annualRate / 100 / 12;
  let totalInterest = 0;
  let firstPayment = 0;
  if (method === 'equalPayment') {
    const monthly = P * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
    firstPayment = monthly;
    let remaining = P;
    for (let i = 1; i <= months; i++) {
      const interest = remaining * r;
      const principal = monthly - interest;
      remaining -= principal;
      totalInterest += interest;
    }
  } else if (method === 'equalPrincipal') {
    const monthlyPrincipal = P / months;
    let remaining = P;
    for (let i = 1; i <= months; i++) {
      const interest = remaining * r;
      const payment = monthlyPrincipal + interest;
      if (i === 1) firstPayment = payment;
      remaining -= monthlyPrincipal;
      totalInterest += interest;
    }
  } else {
    const monthlyInterest = P * r;
    firstPayment = monthlyInterest;
    totalInterest = monthlyInterest * months;
  }
  return {
    firstPayment: roundWon(firstPayment),
    totalInterest: roundWon(totalInterest),
    totalPayment: roundWon(P + totalInterest)
  };
}

function discountCalc(input) {
  const discountAmount = input.discountAmount ?? input.price * input.discountRate / 100;
  const base = input.vat && !input.preTax ? input.price / 1.1 : input.price;
  const afterDiscount = base - discountAmount;
  const vatAmount = input.vat ? afterDiscount * 0.1 : 0;
  const result = {
    discountAmount: roundWon(discountAmount),
    afterDiscount: roundWon(afterDiscount),
    vatAmount: roundWon(vatAmount),
    finalAmount: roundWon(Math.max(0, afterDiscount + vatAmount))
  };
  if (input.vat && !input.preTax) result.base = roundWon(base);
  return result;
}

const housingSale = [
  { max: 50000000, rate: 0.006, limit: 250000 },
  { max: 200000000, rate: 0.005, limit: 800000 },
  { max: 900000000, rate: 0.004, limit: null },
  { max: 1200000000, rate: 0.005, limit: null },
  { max: 1500000000, rate: 0.006, limit: null },
  { max: Infinity, rate: 0.007, limit: null }
];
const housingLease = [
  { max: 50000000, rate: 0.005, limit: 200000 },
  { max: 100000000, rate: 0.004, limit: 300000 },
  { max: 300000000, rate: 0.003, limit: null },
  { max: 600000000, rate: 0.003, limit: null },
  { max: 1200000000, rate: 0.004, limit: null },
  { max: 1500000000, rate: 0.005, limit: null },
  { max: Infinity, rate: 0.006, limit: null }
];

function brokerCalc(input) {
  let amount = input.amount ?? input.deposit;
  if (input.tradeType === 'monthlyRent') {
    amount = input.deposit + input.monthlyRent * 100;
    if (amount < 50000000) amount = input.deposit + input.monthlyRent * 70;
  }
  let rate;
  let limit = null;
  if (input.propertyType === 'nonHousing') {
    rate = 0.009;
  } else if (input.propertyType === 'officetel') {
    rate = input.area <= 85 ? (input.tradeType === 'sale' ? 0.005 : 0.004) : 0.009;
  } else {
    const table = input.tradeType === 'sale' ? housingSale : housingLease;
    const row = table.find(r => amount < r.max);
    rate = row.rate;
    limit = row.limit;
  }
  let fee = amount * rate;
  if (limit !== null && fee > limit) fee = limit;
  const vat = input.vat === 'general' ? fee * 0.1 : 0;
  return {
    convertedAmount: roundWon(amount),
    fee: roundWon(fee),
    rate,
    vat: roundWon(vat),
    total: roundWon(fee + vat)
  };
}

function petFoodCalc({ petType, weightKg, stage, activity, neutered }) {
  const rer = 70 * Math.pow(weightKg, 0.75);
  let factor;
  if (petType === 'dog') {
    if (stage === 'puppy') factor = activity === 'high' ? 3.0 : activity === 'normal' ? 2.5 : 2.0;
    else if (stage === 'senior') factor = activity === 'high' ? 1.4 : activity === 'normal' ? 1.2 : 1.0;
    else factor = activity === 'high' ? 1.8 : activity === 'normal' ? 1.4 : 1.0;
  } else {
    if (stage === 'puppy') factor = 2.5;
    else if (stage === 'senior') factor = activity === 'high' ? 1.2 : 1.0;
    else factor = activity === 'high' ? 1.4 : activity === 'normal' ? 1.2 : 1.0;
  }
  if (neutered === 'yes' && stage !== 'puppy') factor *= 0.85;
  const der = rer * factor;
  return { rer: roundWon(rer), factor: Number(factor.toFixed(2)), der: roundWon(der), dailyGrams: roundWon((der / 3600) * 1000) };
}

function petBmiCalc({ petType, breed, weightKg }) {
  const table = petType === 'dog' ? { '말티즈': { min: 2.5, max: 4.5 } } : {};
  const selected = table[breed];
  if (!selected) throw new Error(`Missing fixture breed ${breed}`);
  const idealWeight = (selected.min + selected.max) / 2;
  let status = '이상적';
  if (weightKg < selected.min) status = '저체중';
  if (weightKg > selected.max) status = '약간 과체중';
  return { status, idealWeight: Number(idealWeight.toFixed(1)), diffKg: Number((weightKg - idealWeight).toFixed(1)) };
}

function petAgeCalc({ petType, size, ageYears }) {
  if (ageYears <= 0) return { humanAge: 0 };
  if (ageYears <= 1) return { humanAge: 15 };
  if (ageYears <= 2) return { humanAge: 24 };
  if (petType === 'cat') return { humanAge: roundWon(24 + (ageYears - 2) * 4) };
  const rates = { small: 4, medium: 5, large: 7 };
  return { humanAge: roundWon(24 + (ageYears - 2) * rates[size]) };
}

const calculators = {
  'loan-calc': loanCalc,
  'discount-calc': discountCalc,
  'broker-fee-calc': brokerCalc,
  'pet-food-calc': petFoodCalc,
  'pet-bmi-calc': petBmiCalc,
  'pet-age-calc': petAgeCalc,
  'biz-day-calc': inputs => inputs.operation === 'add' ? businessAdd(inputs) : businessBetween(inputs)
};

function compare(caseItem, actual) {
  for (const [key, expectedValue] of Object.entries(caseItem.expected)) {
    const actualValue = actual[key];
    const tolerance = caseItem.tool.startsWith('pet-') && typeof expectedValue === 'number' ? 0.01 : 0;
    const ok = typeof expectedValue === 'number'
      ? Math.abs(actualValue - expectedValue) <= tolerance
      : actualValue === expectedValue;
    if (!ok) {
      failures.push(`${caseItem.tool}/${caseItem.caseId}: expected ${key}=${expectedValue}, got ${actualValue}`);
    }
  }
}

for (const caseItem of cases) {
  for (const key of requiredMeta) {
    if (!caseItem[key] || (typeof caseItem[key] === 'string' && !caseItem[key].trim())) {
      failures.push(`${caseItem.tool}/${caseItem.caseId}: missing fixture metadata '${key}'`);
    }
  }
  const fn = calculators[caseItem.tool];
  if (!fn) {
    failures.push(`${caseItem.tool}/${caseItem.caseId}: no audit calculator registered`);
    continue;
  }
  compare(caseItem, fn(caseItem.inputs));
}

if (failures.length) {
  console.error(`Formula audit failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  failures.forEach(f => console.error(`- ${f}`));
  process.exit(1);
}

console.log(`Formula audit passed: ${cases.length} high-risk cases with required oracle metadata.`);
