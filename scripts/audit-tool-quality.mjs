import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';

const rootDir = process.cwd();
const origin = 'https://teemozipsa.com';
const homepagePath = path.join(rootDir, 'index.html');
const toolsRoot = path.join(rootDir, 'special-chars');
const validCategories = new Set(['writing', 'files', 'schedule', 'numbers', 'web']);
const failures = [];

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function attrs(node) {
  return new Map((node.attrs || []).map(attribute => [attribute.name, attribute.value]));
}

function classes(node) {
  return new Set((attrs(node).get('class') || '').split(/\s+/).filter(Boolean));
}

function nodeText(node) {
  if (node.nodeName === '#text') return node.value || '';
  return (node.childNodes || []).map(nodeText).join(' ');
}

function findAll(node, predicate, out = []) {
  if (predicate(node)) out.push(node);
  for (const child of node.childNodes || []) findAll(child, predicate, out);
  return out;
}

function findById(document, id) {
  return findAll(document, node => attrs(node).get('id') === id)[0];
}

function hasNoindex(html) {
  return /<meta\s+[^>]*(?:name|property)=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expectedFileForHref(href) {
  const url = new URL(href, origin);
  if (url.origin !== origin || !url.pathname.startsWith('/special-chars/')) return null;
  if (url.pathname === '/special-chars/') return path.join(toolsRoot, 'index.html');
  return path.join(rootDir, url.pathname.slice(1), 'index.html');
}

function directKoreanToolPages() {
  const pages = [path.join(toolsRoot, 'index.html')];
  for (const entry of fs.readdirSync(toolsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'en' || entry.name === 'data' || entry.name === 'vendor') continue;
    const page = path.join(toolsRoot, entry.name, 'index.html');
    if (fs.existsSync(page)) pages.push(page);
  }
  return pages;
}

function hrefForFile(file) {
  const relative = path.relative(rootDir, file).replace(/\\/g, '/');
  return `/${relative.slice(0, -'index.html'.length)}`;
}

const homepage = read(homepagePath);
const homepageDocument = parse(homepage);
const toolsGrid = findById(homepageDocument, 'toolsGrid');
if (!toolsGrid) {
  failures.push('index.html: #toolsGrid가 없습니다.');
}

const cards = toolsGrid
  ? findAll(toolsGrid, node => node.tagName === 'a' && classes(node).has('tool-card'))
  : [];
const cardHrefs = new Set();

for (const card of cards) {
  const attributes = attrs(card);
  const href = attributes.get('href') || '';
  const category = attributes.get('data-category') || '';
  const keywords = (attributes.get('data-keywords') || '').trim();
  const nameNode = findAll(card, node => classes(node).has('tool-name'))[0];
  const descNode = findAll(card, node => classes(node).has('tool-desc'))[0];
  const name = nodeText(nameNode || {}).replace(/\s+/g, ' ').trim();
  const description = nodeText(descNode || {}).replace(/\s+/g, ' ').trim();

  if (!href) failures.push(`홈 도구 카드 '${name || '(이름 없음)'}': href가 없습니다.`);
  if (cardHrefs.has(href)) failures.push(`홈 도구 카드 href 중복: ${href}`);
  cardHrefs.add(href);
  if (!validCategories.has(category)) failures.push(`${href}: 알 수 없는 업무 카테고리 '${category}'`);
  if (keywords.length < 10) failures.push(`${href}: 검색 키워드가 업무 상황을 설명하기에 너무 짧습니다.`);
  if (name.length < 2) failures.push(`${href}: 도구 이름이 없습니다.`);
  if (description.length < 10) failures.push(`${href}: 카드 설명이 너무 짧습니다.`);

  const expectedFile = expectedFileForHref(href);
  if (expectedFile && !fs.existsSync(expectedFile)) {
    failures.push(`${href}: 연결된 로컬 도구 페이지가 없습니다.`);
  } else if (expectedFile && hasNoindex(read(expectedFile))) {
    failures.push(`${href}: 검증 전 noindex 도구가 홈페이지 업무 카탈로그에 노출되어 있습니다.`);
  }
}

const toolPages = directKoreanToolPages();
const indexableToolPages = [];

for (const page of toolPages) {
  const href = hrefForFile(page);
  const html = read(page);
  if (hasNoindex(html)) continue;
  indexableToolPages.push(page);

  if (!cardHrefs.has(href)) failures.push(`${href}: 검색 공개 도구가 홈페이지 업무 카탈로그에 없습니다.`);

  const visibleText = stripHtml(html);
  const requirements = [
    ['업무 맥락 또는 사용 안내', /업무|문서|파일|계산|사용|활용|가이드|Q&A|자주\s*묻/],
    ['기준·예외·한계 안내', /주의|기준|한계|참고|출처|확인|오차|지원|제한/],
    ['입력·파일 처리 안내', /브라우저|서버|로컬|저장|개인정보|업로드/]
  ];

  if (visibleText.length < 900) {
    failures.push(`${href}: 검색 공개 도구의 정적 안내 본문이 900자 미만입니다 (${visibleText.length}자).`);
  }
  for (const [label, pattern] of requirements) {
    if (!pattern.test(visibleText)) failures.push(`${href}: 검색 공개 전 필요한 '${label}'가 정적 본문에 없습니다.`);
  }
}

for (const requiredPhrase of ['직장인을 위한 브라우저 업무 도구', '업무 상황으로 바로 찾기', '도구가 늘어날수록 기준도 함께 쌓입니다']) {
  if (!homepage.includes(requiredPhrase)) failures.push(`index.html: 포지셔닝 문구 누락 — ${requiredPhrase}`);
}

const blogHomepage = read(path.join(rootDir, 'blog', 'index.html'));
for (const searchFirstMarker of ['검색 제안', 'trends.json', '키워드 순위']) {
  if (blogHomepage.includes(searchFirstMarker)) failures.push(`blog/index.html: 검색 우선형 마커가 남아 있습니다 — ${searchFirstMarker}`);
}

if (!fs.existsSync(path.join(rootDir, 'tool-standards.html'))) {
  failures.push('tool-standards.html: 공개 도구 제작·검증 기준이 없습니다.');
}

if (failures.length) {
  console.error('Tool quality audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Tool quality audit passed: ${cards.length} work catalog cards, ${indexableToolPages.length} indexable Korean tools, and ${toolPages.length - indexableToolPages.length} staged noindex tools follow the publishing gate.`);
