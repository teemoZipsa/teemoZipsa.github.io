import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const warnings = [];

const pinnedFiles = new Map([
  ['special-chars/vendor/fonts/pretendard/1.3.9/PretendardVariable.woff2', '9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4'],
  ['special-chars/vendor/fonts/inter/5.2.8/inter-latin-wght-normal.woff2', '3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62'],
  ['special-chars/vendor/fonts/inter/5.2.8/inter-latin-ext-wght-normal.woff2', '34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956'],
  ['special-chars/vendor/pdf-lib/1.17.1/pdf-lib.min.js', '0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f'],
  ['special-chars/vendor/pdfjs-dist/4.2.67/pdf.min.mjs', 'c3caae2cf1fe9d6e25588d0d239d02454422778ed5897314981496a4656eab82'],
  ['special-chars/vendor/pdfjs-dist/4.2.67/pdf.worker.min.mjs', 'ee61de6dd3effd826b7083739409e50bae43c2e41a896f27ea8dd2d77e2f349b'],
  ['special-chars/vendor/qrcode-generator/1.4.4/qrcode.js', '18ae399f81182bc9de916e9c77b195df20cc58d6f2d55a62b085a299f1bf1780'],
  ['special-chars/vendor/imgly-background-removal/1.5.5/background-removal.bundle.js', '8653f52cbee8bf9831e984bfcb8b3b697bfa23595d08bf2103cc8b49ced1b09c'],
  ['special-chars/vendor/imgly-background-removal/1.5.5/background-removal.bundle.js.map', 'df5706323b15e1f5110081bd7cff23afb0d578a0183b0f939ba995df9bae0c3b'],
  ['special-chars/vendor/imgly-background-removal/1.5.5/ndarray-csp.cjs', '5cfbcce4a73babe5679a5b438ec8feefad991fcb25466a9666f79a8a23159901'],
  ['special-chars/vendor/imgly-background-removal/1.5.5/build.mjs', '5a8711861c5501691f16368fde67338b9e3f2c0b94fc478dfda6069532df1fac'],
  ['special-chars/vendor/imgly-background-removal/1.5.5/CSP-PATCH.md', '63388e7bdd1c11db0cc4cd5b2aee213bc36236d9c5ae06181516c353f4cc87b5'],
  ['special-chars/vendor/imgly-background-removal/1.5.5/data/resources.json', '1ab7a82dd2f08f9501400a75ad31dcbe5457b5c0f69cceac7a6c99ad78f3948f'],
]);

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && (entry.name === '.git' || entry.name === 'node_modules')) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(absolutePath));
    else if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

for (const [relativePath, expected] of pinnedFiles) {
  try {
    const actual = sha256(await readFile(path.join(root, relativePath)));
    if (actual !== expected) failures.push(`${relativePath}: SHA-256 mismatch (${actual})`);
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
  }
}

const dataDirectory = path.join(root, 'special-chars/vendor/imgly-background-removal/1.5.5/data');
for (const entry of await readdir(dataDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
  const actual = sha256(await readFile(path.join(dataDirectory, entry.name)));
  if (actual !== entry.name) failures.push(`IMG.LY content-addressed asset ${entry.name}: SHA-256 mismatch (${actual})`);
}

const backgroundRemovalDirectory = path.join(root, 'special-chars/vendor/imgly-background-removal/1.5.5');
try {
  const [bundleSource, sourceMapText, ndarraySource] = await Promise.all([
    readFile(path.join(backgroundRemovalDirectory, 'background-removal.bundle.js'), 'utf8'),
    readFile(path.join(backgroundRemovalDirectory, 'background-removal.bundle.js.map'), 'utf8'),
    readFile(path.join(backgroundRemovalDirectory, 'ndarray-csp.cjs'), 'utf8'),
  ]);
  if (/new\s+Function\s*\(/.test(bundleSource)) failures.push('IMG.LY bundle: CSP-incompatible dynamic ndarray constructor remains');
  const sourceMap = JSON.parse(sourceMapText);
  const ndarrayIndex = sourceMap.sources?.indexOf('csp-safe-ndarray:ndarray-csp.cjs') ?? -1;
  if (!Array.isArray(sourceMap.sourcesContent) || sourceMap.sourcesContent.length !== sourceMap.sources?.length) {
    failures.push('IMG.LY source map: every mapped source must have embedded sourcesContent');
  }
  if (ndarrayIndex < 0 || sourceMap.sourcesContent?.[ndarrayIndex] !== ndarraySource) {
    failures.push('IMG.LY source map: deployed CSP-safe ndarray source is missing or does not match ndarray-csp.cjs');
  }
  if (sourceMap.sources?.some(source => /(?:^[A-Za-z]:[\\/]|AppData[\\/]|[\\/]Temp[\\/])/i.test(source))) {
    failures.push('IMG.LY source map: temporary or machine-specific build paths remain');
  }
} catch (error) {
  failures.push(`IMG.LY bundle/source-map consistency check failed: ${error.message}`);
}

const pdfPages = [
  'special-chars/pdf-tool/index.html',
  'special-chars/en/pdf-tool/index.html',
];
for (const relativePath of pdfPages) {
  const source = await readFile(path.join(root, relativePath), 'utf8');
  if (!source.includes('/pdfjs-dist/4.2.67/pdf.min.mjs')) failures.push(`${relativePath}: PDF.js 4.2.67 module is not pinned`);
  if (!source.includes('isEvalSupported: false')) failures.push(`${relativePath}: PDF.js eval must be disabled`);
  if (source.includes('pdfjs-dist/3.11.174')) failures.push(`${relativePath}: vulnerable PDF.js 3.11.174 reference remains`);
}

const qrPages = ['special-chars/qr-code/index.html', 'special-chars/en/qr-code/index.html'];
for (const relativePath of qrPages) {
  const source = await readFile(path.join(root, relativePath), 'utf8');
  if (!source.includes('/vendor/qrcode-generator/1.4.4/qrcode.js')) failures.push(`${relativePath}: local QR library reference is missing`);
  if (/cdn\.jsdelivr\.net\/npm\/qrcode-generator/i.test(source)) failures.push(`${relativePath}: external QR CDN reference remains`);
}

const backgroundRemovalPages = ['special-chars/bg-remover/index.html', 'special-chars/en/bg-remover/index.html'];
for (const relativePath of backgroundRemovalPages) {
  const source = await readFile(path.join(root, relativePath), 'utf8');
  const csp = source.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i)?.[1] || '';
  if (!csp.includes("'wasm-unsafe-eval'")) failures.push(`${relativePath}: WASM CSP permission is missing`);
  if (/(^|[\s;])'unsafe-eval'(?=[\s;]|$)/.test(csp)) failures.push(`${relativePath}: broad unsafe-eval CSP permission is forbidden`);
}

const serviceWorkerSource = await readFile(path.join(root, 'special-chars/sw.js'), 'utf8');
if (!serviceWorkerSource.includes("const VENDOR_CACHE_NAME = 'teemozipsa-vendor-v2'")) {
  failures.push('special-chars/sw.js: vendor cache generation must invalidate the pre-CSP-patch IMG.LY bundle');
}

const themeSource = await readFile(path.join(root, 'special-chars/theme.css'), 'utf8');
for (const fontPath of [
  '/special-chars/vendor/fonts/pretendard/1.3.9/PretendardVariable.woff2',
  '/special-chars/vendor/fonts/inter/5.2.8/inter-latin-wght-normal.woff2',
  '/special-chars/vendor/fonts/inter/5.2.8/inter-latin-ext-wght-normal.woff2',
]) {
  if (!themeSource.includes(fontPath)) failures.push(`special-chars/theme.css: local font reference is missing (${fontPath})`);
}

for (const absolutePath of await listFiles(root)) {
  if (path.extname(absolutePath).toLowerCase() !== '.html') continue;
  const source = await readFile(absolutePath, 'utf8');
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com|orioncactus\/pretendard/i.test(source)) {
    failures.push(`${path.relative(root, absolutePath)}: external font reference remains`);
  }
}

if (!process.argv.includes('--integrity-only')) {
  const packages = {
    'pdfjs-dist': ['4.2.67'],
    'pdf-lib': ['1.17.1'],
    'qrcode-generator': ['1.4.4'],
    '@imgly/background-removal': ['1.5.5'],
    'onnxruntime-web': ['1.18.0'],
    zod: ['3.25.76'],
    ndarray: ['1.0.19'],
    'iota-array': ['1.0.0'],
    'is-buffer': ['1.1.6'],
    'lodash-es': ['4.17.21'],
  };
  const acknowledged = new Set([
    'GHSA-xxjr-mmjv-4gpg',
    'GHSA-r5fr-rjxr-66jc',
    'GHSA-f23m-r3pf-42rh',
  ]);
  try {
    const response = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(packages),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`registry returned HTTP ${response.status}`);
    const advisories = await response.json();
    for (const [packageName, records] of Object.entries(advisories)) {
      for (const record of records) {
        const id = record.url?.match(/GHSA-[\w-]+/)?.[0] ?? String(record.id);
        const message = `${packageName}: ${id} ${record.severity} - ${record.title}`;
        if (acknowledged.has(id)) warnings.push(`${message} (acknowledged as unreachable; see vendor README)`);
        else failures.push(message);
      }
    }
  } catch (error) {
    failures.push(`npm advisory lookup failed: ${error.message} (use --integrity-only only for an explicitly offline check)`);
  }
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Vendor audit passed: ${pinnedFiles.size} pinned files plus content-addressed AI assets verified${process.argv.includes('--integrity-only') ? ' (integrity only)' : '; no unacknowledged advisories'}.`);
}
