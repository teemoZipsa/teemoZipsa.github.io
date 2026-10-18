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
    ['ordinary', `${year}-01-01`, '신정'],
    ['national', `${year}-03-01`, '삼일절'],
    ...(year >= 2026 ? [['labor', `${year}-05-01`, '노동절']] : []),
    ['children', `${year}-05-05`, '어린이날'],
    ['ordinary', `${year}-06-06`, '현충일'],
    ...(year >= 2026 ? [['national', `${year}-07-17`, '제헌절']] : []),
    ['national', `${year}-08-15`, '광복절'],
    ['national', `${year}-10-03`, '개천절'],
    ['national', `${year}-10-09`, '한글날'],
    ['christmas', `${year}-12-25`, '기독탄신일']
  ];
  return rules.map(([kind, date, name]) => ({ kind, date, name }));
}

const lunarHolidays = {
  2024: [
    { kind: 'lunarNewYear', date: '2024-02-09', name: '설날 연휴' },
    { kind: 'lunarNewYear', date: '2024-02-10', name: '설날' },
    { kind: 'lunarNewYear', date: '2024-02-11', name: '설날 연휴' },
    { kind: 'buddha', date: '2024-05-15', name: '부처님오신날' },
    { kind: 'chuseok', date: '2024-09-16', name: '추석 연휴' },
    { kind: 'chuseok', date: '2024-09-17', name: '추석' },
    { kind: 'chuseok', date: '2024-09-18', name: '추석 연휴' }
  ],
  2025: [
    { kind: 'lunarNewYear', date: '2025-01-28', name: '설날 연휴' },
    { kind: 'lunarNewYear', date: '2025-01-29', name: '설날' },
    { kind: 'lunarNewYear', date: '2025-01-30', name: '설날 연휴' },
    { kind: 'buddha', date: '2025-05-05', name: '부처님오신날' },
    { kind: 'chuseok', date: '2025-10-05', name: '추석 연휴' },
    { kind: 'chuseok', date: '2025-10-06', name: '추석' },
    { kind: 'chuseok', date: '2025-10-07', name: '추석 연휴' }
  ],
  2026: [
    { kind: 'lunarNewYear', date: '2026-02-16', name: '설날 연휴' },
    { kind: 'lunarNewYear', date: '2026-02-17', name: '설날' },
    { kind: 'lunarNewYear', date: '2026-02-18', name: '설날 연휴' },
    { kind: 'buddha', date: '2026-05-24', name: '부처님오신날' },
    { kind: 'chuseok', date: '2026-09-24', name: '추석 연휴' },
    { kind: 'chuseok', date: '2026-09-25', name: '추석' },
    { kind: 'chuseok', date: '2026-09-26', name: '추석 연휴' }
  ],
  2027: [
    { kind: 'lunarNewYear', date: '2027-02-06', name: '설날 연휴' },
    { kind: 'lunarNewYear', date: '2027-02-07', name: '설날' },
    { kind: 'lunarNewYear', date: '2027-02-08', name: '설날 연휴' },
    { kind: 'buddha', date: '2027-05-13', name: '부처님오신날' },
    { kind: 'chuseok', date: '2027-09-14', name: '추석 연휴' },
    { kind: 'chuseok', date: '2027-09-15', name: '추석' },
    { kind: 'chuseok', date: '2027-09-16', name: '추석 연휴' }
  ],
  // 2028~2030: 한국천문연구원 음양력 변환(astro.kasi.re.kr /life/lunc) 음력 1/1·4/8·8/15 조회값, 2026-09-28 확인.
  // 2028 설날은 한국 기준 1/27(중국 춘절 1/26과 다름).
  2028: [
    { kind: 'lunarNewYear', date: '2028-01-26', name: '설날 연휴' },
    { kind: 'lunarNewYear', date: '2028-01-27', name: '설날' },
    { kind: 'lunarNewYear', date: '2028-01-28', name: '설날 연휴' },
    { kind: 'buddha', date: '2028-05-02', name: '부처님오신날' },
    { kind: 'chuseok', date: '2028-10-02', name: '추석 연휴' },
    { kind: 'chuseok', date: '2028-10-03', name: '추석' },
    { kind: 'chuseok', date: '2028-10-04', name: '추석 연휴' }
  ],
  2029: [
    { kind: 'lunarNewYear', date: '2029-02-12', name: '설날 연휴' },
    { kind: 'lunarNewYear', date: '2029-02-13', name: '설날' },
    { kind: 'lunarNewYear', date: '2029-02-14', name: '설날 연휴' },
    { kind: 'buddha', date: '2029-05-20', name: '부처님오신날' },
    { kind: 'chuseok', date: '2029-09-21', name: '추석 연휴' },
    { kind: 'chuseok', date: '2029-09-22', name: '추석' },
    { kind: 'chuseok', date: '2029-09-23', name: '추석 연휴' }
  ],
  2030: [
    { kind: 'lunarNewYear', date: '2030-02-02', name: '설날 연휴' },
    { kind: 'lunarNewYear', date: '2030-02-03', name: '설날' },
    { kind: 'lunarNewYear', date: '2030-02-04', name: '설날 연휴' },
    { kind: 'buddha', date: '2030-05-09', name: '부처님오신날' },
    { kind: 'chuseok', date: '2030-09-11', name: '추석 연휴' },
    { kind: 'chuseok', date: '2030-09-12', name: '추석' },
    { kind: 'chuseok', date: '2030-09-13', name: '추석 연휴' }
  ]
};

function substituteEligible(rule, allHolidayDates) {
  const date = dateFromIso(rule.date);
  const day = date.getDay();
  const overlapsOtherHoliday = allHolidayDates.get(rule.date) > 1;
  if (['national', 'buddha', 'labor', 'children', 'christmas'].includes(rule.kind)) {
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
  const manualItems = manual.years[String(year)] || [];
  manualItems.forEach(item => holidayIsoSet.add(item.date));

  const rulesByOriginalDate = new Map();
  for (const rule of base) {
    if (!rulesByOriginalDate.has(rule.date)) rulesByOriginalDate.set(rule.date, []);
    rulesByOriginalDate.get(rule.date).push(rule);
  }

  for (const [originalDate, sameDateRules] of rulesByOriginalDate) {
    if (!sameDateRules.some(rule => substituteEligible(rule, counts))) continue;
    let candidate = addDays(dateFromIso(originalDate), 1);
    while ([0, 6].includes(candidate.getDay()) || holidayIsoSet.has(isoDate(candidate))) {
      candidate = addDays(candidate, 1);
    }
    const candidateIso = isoDate(candidate);
    holidayIsoSet.add(candidateIso);
    const names = sameDateRules.map(rule => rule.name).join('·');
    holidays.push({ date: candidate, name: `대체공휴일(${names})`, substitute: true });
  }

  for (const item of manualItems) {
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

// includeStart (default true) follows Excel NETWORKDAYS: both endpoints are counted.
// includeStart=false keeps the older rule: start excluded, end included.
function businessBetween({ fromDate, toDate, excludeHolidays, includeSaturday, includeStart = true }) {
  let from = dateFromIso(fromDate);
  let to = dateFromIso(toDate);
  if (from > to) [from, to] = [to, from];
  let current = includeStart ? addDays(from, -1) : new Date(from);
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

// Installment-rounded model (2026-09-28): each month's interest is round(balance*r) in KRW,
// the equal payment / equal principal share is rounded to KRW, and the last installment settles
// the remaining balance so the schedule's principal column sums exactly to P.
function loanCalc({ principal: P, annualRate, years, months: monthInput, method }) {
  const months = monthInput ?? years * 12;
  const r = annualRate / 100 / 12;
  const payments = [];
  let balance = P;
  let totalInterest = 0;
  if (method === 'equalPayment') {
    const level = r === 0 ? Math.floor(P / months) : roundWon(P * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1));
    for (let i = 1; i <= months; i++) {
      const interest = roundWon(balance * r);
      const principal = i === months ? balance : Math.min(balance, Math.max(0, level - interest));
      balance -= principal;
      totalInterest += interest;
      payments.push(principal + interest);
    }
  } else if (method === 'equalPrincipal') {
    let share = roundWon(P / months);
    if (share * (months - 1) > P) share = Math.floor(P / months);
    for (let i = 1; i <= months; i++) {
      const interest = roundWon(balance * r);
      const principal = i === months ? balance : share;
      balance -= principal;
      totalInterest += interest;
      payments.push(principal + interest);
    }
  } else {
    const interest = roundWon(P * r);
    for (let i = 1; i <= months; i++) {
      totalInterest += interest;
      payments.push(interest + (i === months ? P : 0));
    }
  }
  return {
    firstPayment: payments[0],
    lastPayment: payments[payments.length - 1],
    totalInterest,
    totalPayment: P + totalInterest
  };
}

// 원 미만 절사 정책: 할인액·부가세는 버리고, 나머지는 뺄셈·덧셈으로 구해 항목 합계가 맞도록 한다.
function discountCalc(input) {
  const truncate = n => Math.floor(n + 1e-7);
  const price = input.price;
  const discountAmount = input.discountAmount ?? truncate(price * input.discountRate / 100);
  if (input.vatMode === 'inclusive') {
    const finalAmount = price - discountAmount;
    const vatAmount = truncate(finalAmount * 10 / 110);
    return {
      base: price - truncate(price * 10 / 110),
      discountAmount,
      afterDiscount: finalAmount - vatAmount,
      vatAmount,
      finalAmount
    };
  }
  const afterDiscount = price - discountAmount;
  const vatAmount = input.vatMode === 'exclusive' ? truncate(afterDiscount * 0.1) : 0;
  return { discountAmount, afterDiscount, vatAmount, finalAmount: afterDiscount + vatAmount };
}

// 월 환산 시간: (주 소정근로 + 주휴) × 365 ÷ 7 ÷ 12를 정수로 반올림(주 40시간 = 209시간, 고용노동부 월 환산 관행).
function wageCalc(input) {
  const weeksPerMonth = 365 / 7 / 12;
  const scheduledWeekly = Math.min(Math.min(input.hoursDay, 8) * input.daysWeek, 40);
  const overtimeWeekly = input.hoursDay * input.daysWeek - scheduledWeekly + (input.extraOvertime ?? 0);
  const holidayHours = input.weeklyHoliday !== false && scheduledWeekly >= 15 ? 8 * scheduledWeekly / 40 : 0;
  const monthlyHours = Math.round((scheduledWeekly + holidayHours) * weeksPerMonth);
  const overtimeMultiplier = input.bizSize === 'under5' ? 1 : 1.5;
  const nightPremium = input.bizSize === 'under5' ? 0 : 0.5;
  const paidHours = monthlyHours + (overtimeWeekly * overtimeMultiplier + (input.nightHours ?? 0) * nightPremium) * weeksPerMonth;
  let hourly;
  let monthly;
  if (input.hourly !== undefined) {
    hourly = input.hourly;
    monthly = hourly * paidHours;
  } else {
    monthly = input.monthly ?? input.yearly / 12;
    hourly = monthly / paidHours;
  }
  const result = { hourly: roundWon(hourly), monthly: roundWon(monthly), yearly: roundWon(monthly * 12), monthlyHours };
  if (input.taxType === 'insurance') {
    const rates = {
      2026: { pension: 0.0475, health: 0.03595, employment: 0.009 },
      2027: { pension: 0.05, health: 0.03595, employment: 0.009 }
    }[input.year];
    const floor10 = n => Math.floor((n + 1e-7) / 10) * 10;
    const gross = roundWon(monthly);
    const pensionBase = Math.min(6590000, Math.max(410000, Math.floor(gross / 1000) * 1000));
    const pension = floor10(pensionBase * rates.pension);
    const health = floor10(gross * rates.health);
    const longTermCare = floor10(health * 0.9448 / 7.19);
    const employment = floor10(gross * rates.employment);
    result.deductions = pension + health + longTermCare + employment;
    result.netMonthly = gross - result.deductions;
  }
  return result;
}

function compoundCalc({ start, ratePercent, periods, decimals = 2, target }) {
  const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
  const finalValue = start * (1 + ratePercent / 100) ** periods;
  const result = {
    finalValue: round(finalValue, decimals),
    totalRatePercent: round((finalValue / start - 1) * 100, 1)
  };
  if (target !== undefined) result.requiredRatePercent = round(((target / start) ** (1 / periods) - 1) * 100, 2);
  return result;
}

function percentCalc({ mode, a, b, reverseType = 'discount', rounding = 'auto', asPercent = false }) {
  const money = n => rounding === 'round' ? Math.round(n) : rounding === 'floor' ? Math.floor(n) : Math.round(n * 1e4) / 1e4;
  const pct = n => Math.round(n * 100) / 100;
  if (mode === 'of') return { result: money(a * b / 100) };
  if (mode === 'change') return { result: asPercent ? pct(b - a) : pct((b - a) / Math.abs(a) * 100) };
  if (mode === 'ratio') return { result: pct(a / b * 100) };
  return { result: money(a / (reverseType === 'markup' ? 1 + b / 100 : 1 - b / 100)) };
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

function petBmiCalc({ bcs }) {
  if (!Number.isInteger(bcs) || bcs < 1 || bcs > 9) throw new Error(`Invalid 9-point BCS ${bcs}`);
  let status;
  if (bcs <= 3) status = '이상 체형 미만';
  else if (bcs <= 5) status = '이상적';
  else if (bcs <= 7) status = '이상 체형 초과';
  else status = '비만 구간';
  return { status, bcs };
}

function petAgeCalc({ petType, size, ageYears }) {
  const valid = ['dog', 'cat'].includes(petType) && Number.isInteger(ageYears) && ageYears >= 0 && ageYears <= 30 &&
    (petType === 'cat' || ['small', 'medium', 'large'].includes(size));
  if (!valid) return { valid: false };
  if (ageYears === 0) return { valid: true, humanAge: 0 };
  if (ageYears <= 1) return { valid: true, humanAge: 15 };
  if (ageYears <= 2) return { valid: true, humanAge: 24 };
  if (petType === 'cat') return { valid: true, humanAge: roundWon(24 + (ageYears - 2) * 4) };
  const rates = { small: 4, medium: 5, large: 7 };
  return { valid: true, humanAge: roundWon(24 + (ageYears - 2) * rates[size]) };
}

// Seoul medium taxi, partial simultaneous charging (부분 동시병산): distance ticks and low-speed time ticks are both
// charged. Night is 0/20/40% using the published night tables; out-of-city is an on/off 20% toggle applied as a
// combined rate to the daytime meter (max 60%).
function taxiCalc({ distanceKm, lowSpeedMinutes = 0, night = false, nightRate, outRatePercent = 0 }) {
  const nightLevel = nightRate ?? (night ? 40 : 0);
  const valid = Number.isFinite(distanceKm) && distanceKm >= 0.1 && distanceKm <= 1000 &&
    Number.isFinite(lowSpeedMinutes) && lowSpeedMinutes >= 0 && lowSpeedMinutes <= 1440 &&
    [0, 20].includes(outRatePercent) && [0, 20, 40].includes(nightLevel);
  if (!valid) return { valid: false };
  const data = { base: 4800, baseDist: 1600, distPer: 131, distFee: 100, timePer: 30, timeFee: 100, thresholdKmh: 15.72 };
  const nightTables = { 20: { base: 5800, fee: 120 }, 40: { base: 6700, fee: 140 } };
  const distanceTicks = Math.floor(Math.max(0, distanceKm * 1000 - data.baseDist) / data.distPer);
  const baseTimeSeconds = data.baseDist / (data.thresholdKmh / 3.6);
  const timeTicks = Math.floor(Math.max(0, lowSpeedMinutes * 60 - baseTimeSeconds) / data.timePer);
  const dayMeter = data.base + distanceTicks * data.distFee + timeTicks * data.timeFee;
  const table = nightTables[nightLevel];
  const nightMeter = table ? table.base + (distanceTicks + timeTicks) * table.fee : dayMeter;
  const combinedMeter = outRatePercent === 20 ? dayMeter * (1 + nightLevel / 100 + 0.2) : nightMeter;
  return { valid: true, meterEstimateOne: Math.round(combinedMeter / 10) * 10 };
}

function gpaCalc({ scale, courses = [] }) {
  const gradeTables = {
    4.5: { 'A+':4.5,'A0':4.0,'B+':3.5,'B0':3.0,'C+':2.5,'C0':2.0,'D+':1.5,'D0':1.0,'F':0,'P':-1 },
    // 4.3 and US-style 4.0 tables include minus grades (A-=3.7, B-=2.7, C-=1.7, D-=0.7); 4.5 has none.
    4.3: { 'A+':4.3,'A0':4.0,'A-':3.7,'B+':3.3,'B0':3.0,'B-':2.7,'C+':2.3,'C0':2.0,'C-':1.7,'D+':1.3,'D0':1.0,'D-':0.7,'F':0,'P':-1 },
    4.0: { 'A+':4.0,'A0':4.0,'A-':3.7,'B+':3.3,'B0':3.0,'B-':2.7,'C+':2.3,'C0':2.0,'C-':1.7,'D+':1.3,'D0':1.0,'D-':0.7,'F':0,'P':-1 }
  };
  const table = gradeTables[scale];
  if (!table || !Array.isArray(courses)) return { valid: false };

  let gpaCredits = 0;
  let earnedCredits = 0;
  let totalPoints = 0;
  let gradedCourseCount = 0;
  let enteredCourseCount = 0;
  let invalidCreditCount = 0;

  for (const course of courses) {
    if (!course || !Object.hasOwn(table, course.grade)) continue;
    const credit = Number(course.credit);
    const validCredit = Number.isFinite(credit) && credit >= 0.5 && credit <= 9 && Number.isInteger(credit * 2);
    if (!validCredit) {
      invalidCreditCount++;
      continue;
    }
    enteredCourseCount++;
    const gradePoint = table[course.grade];
    if (gradePoint === -1) {
      earnedCredits += credit;
      continue;
    }
    gpaCredits += credit;
    totalPoints += credit * gradePoint;
    gradedCourseCount++;
    if (gradePoint > 0) earnedCredits += credit;
  }

  const hasGpa = gradedCourseCount > 0 && gpaCredits > 0;
  return {
    valid: true,
    gpa: hasGpa ? Number((totalPoints / gpaCredits).toFixed(2)) : null,
    gpaCredits,
    earnedCredits,
    enteredCourseCount,
    invalidCreditCount
  };
}

function fuelCalc({ distanceKm, efficiencyKmpl, pricePerLiter, people = 1, roundTrip = false }) {
  const valid = Number.isFinite(distanceKm) && distanceKm >= 0.1 && distanceKm <= 100000 &&
    Number.isFinite(efficiencyKmpl) && efficiencyKmpl >= 0.1 && efficiencyKmpl <= 1000 &&
    Number.isFinite(pricePerLiter) && pricePerLiter >= 1 && pricePerLiter <= 1000000 &&
    Number.isInteger(people) && people >= 1 && people <= 20;
  if (!valid) return { valid: false };

  const actualDistanceKm = roundTrip ? distanceKm * 2 : distanceKm;
  const fuelLiters = actualDistanceKm / efficiencyKmpl;
  const totalCost = fuelLiters * pricePerLiter;
  return {
    valid: true,
    actualDistanceKm,
    fuelLiters: Number(fuelLiters.toFixed(1)),
    totalCost: roundWon(totalCost),
    perPerson: roundWon(totalCost / people),
    roundTripCost: roundTrip ? null : roundWon(totalCost * 2)
  };
}

const calculators = {
  'loan-calc': loanCalc,
  'discount-calc': discountCalc,
  'broker-fee-calc': brokerCalc,
  'pet-food-calc': petFoodCalc,
  'pet-bmi-calc': petBmiCalc,
  'pet-age-calc': petAgeCalc,
  'taxi-calc': taxiCalc,
  'gpa-calc': gpaCalc,
  'fuel-calc': fuelCalc,
  'wage-calc': wageCalc,
  'compound-interest': compoundCalc,
  'percent-calc': percentCalc,
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
