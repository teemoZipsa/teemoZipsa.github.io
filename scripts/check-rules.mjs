import fs from 'fs';
import path from 'path';
import { parse } from 'parse5';

const targetDir = process.cwd();

let hasError = false;

function logError(msg) {
  console.error(`❌ [Error]: ${msg}`);
  hasError = true;
}

function logSuccess(msg) {
  console.log(`✅ [Pass]: ${msg}`);
}

function rel(file) {
  return path.relative(targetDir, file).replace(/\\/g, '/');
}

function isToolPage(file) {
  const relative = rel(file);
  return relative.startsWith('special-chars/') && path.basename(file).toLowerCase() === 'index.html';
}

function hasNoindex(content) {
  return /<meta\s+[^>]*(?:name|property)=["']robots["'][^>]*content=["'][^"']*noindex/i.test(content);
}

function parsedFooterState(content) {
  const document = parse(content);
  const semanticFooters = [];
  let legacyDivFooter = false;

  function walk(node, ancestors = []) {
    const classValue = node.attrs?.find(attribute => attribute.name === 'class')?.value || '';
    const classes = new Set(classValue.split(/\s+/).filter(Boolean));
    const isElement = Boolean(node.tagName);
    const nextAncestors = isElement ? [...ancestors, node] : ancestors;

    if (classes.has('footer')) {
      if (node.tagName === 'footer') semanticFooters.push({ node, ancestors });
      if (node.tagName === 'div') legacyDivFooter = true;
    }

    for (const child of node.childNodes || []) walk(child, nextAncestors);
  }

  walk(document);

  const footerInsideApp = semanticFooters.length === 1 && semanticFooters[0].ancestors.some(node => {
    if (node.tagName !== 'div' && node.tagName !== 'main') return false;
    const classValue = node.attrs?.find(attribute => attribute.name === 'class')?.value || '';
    const classes = new Set(classValue.split(/\s+/).filter(Boolean));
    return classes.has('app') || classes.has('calc-app');
  });

  return { footerInsideApp, legacyDivFooter, semanticFooters };
}

function findFilesByExt(dir, extList, ignoreDirs = ['node_modules', 'dist', '.git', '.github']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!ignoreDirs.includes(file)) {
        results = results.concat(findFilesByExt(filePath, extList, ignoreDirs));
      }
    } else {
      if (extList.some(ext => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

function findFileByName(dir, targetName, ignoreDirs = ['node_modules', 'dist', '.git']) {
  if (!fs.existsSync(dir)) return null;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!ignoreDirs.includes(file)) {
        const found = findFileByName(filePath, targetName, ignoreDirs);
        if (found) return found;
      }
    } else {
      if (file === targetName) return filePath;
    }
  }
  return null;
}

console.log('🔍 프로젝트 구조를 자동으로 탐색하여 검사합니다...');

// 1 & 2. 모든 도구 페이지가 .app 안에 의미론적 footer를 하나씩 갖는지 검사
const componentFiles = findFilesByExt(targetDir, ['.tsx', '.jsx', '.vue', '.html']);
const toolPageFiles = componentFiles.filter(isToolPage);
let validSemanticFooters = 0;

for (const file of toolPageFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const { footerInsideApp, legacyDivFooter, semanticFooters } = parsedFooterState(content);

  if (legacyDivFooter) {
    logError(`[${rel(file)}] 레거시 div.footer가 남아 있습니다. 의미론적 footer 요소를 사용하세요.`);
  }
  if (semanticFooters.length !== 1) {
    logError(`[${rel(file)}] footer.footer가 정확히 1개여야 하지만 ${semanticFooters.length}개입니다.`);
  } else if (!footerInsideApp) {
    logError(`[${rel(file)}] footer.footer가 HTML 파싱 DOM 기준 앱 컨테이너 안에 있지 않습니다.`);
  } else if (!legacyDivFooter) {
    validSemanticFooters++;
  }
}

if (toolPageFiles.length === 0) {
  logError('special-chars 도구 페이지를 찾지 못해 footer 구조를 검사할 수 없습니다.');
} else if (validSemanticFooters === toolPageFiles.length) {
  logSuccess(`모든 도구 페이지가 앱 컨테이너 안에 의미론적 footer를 포함합니다. (${validSemanticFooters}개)`);
}

// 3. align-items 속성이 CSS에 사용되었는지 검사
const styleFiles = findFilesByExt(targetDir, ['.css', '.scss', '.sass', '.less']);
let alignItemsFound = false;

for (const cssFile of styleFiles) {
  const content = fs.readFileSync(cssFile, 'utf8');
  if (content.includes('align-items')) {
    alignItemsFound = true;
    logSuccess(`[${path.basename(cssFile)}] 파일에 align-items 속성이 사용되었습니다.`);
    break;
  }
}
if (!alignItemsFound) {
  logError('프로젝트 내 어떠한 스타일 파일(.css, .scss 등)에서도 align-items 속성이 누락되었습니다!');
}


// 4. sitemap에 색인 대상 도구만 올바르게 등록되어 있는지 검사
const sitemapFile = findFileByName(targetDir, 'sitemap.xml') || findFileByName(targetDir, 'sitemap.ts');

if (sitemapFile) {
  const sitemapContent = fs.readFileSync(sitemapFile, 'utf8');
  let toolPages = findFilesByExt(targetDir, ['.tsx', '.jsx', '.vue', '.html']);
  const excludeNames = ['layout', 'main', '404', 'app', 'vite-env.d', 'article-template', 'article_template'];
  
  toolPages = toolPages.filter(p => isToolPage(p) && !excludeNames.includes(path.basename(p, path.extname(p)).toLowerCase()));

  if (toolPages.length > 0) {
    let missingSitemapTools = 0;
    let noindexTools = 0;
    toolPages.forEach(page => {
      const routePath = '/' + rel(path.dirname(page)) + '/';
      const sitemapLoc = `<loc>https://teemozipsa.github.io${routePath}</loc>`;
      const content = fs.readFileSync(page, 'utf8');
      if (hasNoindex(content)) {
        noindexTools++;
        if (sitemapContent.includes(sitemapLoc)) {
          logError(`noindex 페이지: '${routePath}'가 사이트맵(${path.basename(sitemapFile)})에 포함되어 있습니다.`);
          missingSitemapTools++;
        }
        return;
      }
      
      if (!sitemapContent.includes(sitemapLoc)) {
        logError(`페이지: '${routePath}'가 사이트맵(${path.basename(sitemapFile)})에 누락되었습니다.`);
        missingSitemapTools++;
      }
    });

    if (missingSitemapTools === 0) {
      logSuccess(`색인 대상 도구 페이지가 사이트맵에 정상 등록되어 있습니다. (${toolPages.length - noindexTools}개 index, ${noindexTools}개 noindex)`);
    }
  } else {
      console.warn('⚠️ 검사할 도구 페이지 컴포넌트를 찾지 못했습니다.');
  }

} else {
  logError('프로젝트에서 sitemap.xml 또는 sitemap.ts 파일을 찾을 수 없습니다.');
}

if (hasError) {
  console.error('\n🚨 요구사항 검사 실패: 문제가 발견되었습니다. (로그 참조)');
  process.exit(1);
} else {
  console.log('\n🎉 모든 자동 규칙 검사를 통과했습니다!');
  process.exit(0);
}
