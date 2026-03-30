import fs from 'fs';
import path from 'path';

const targetDir = process.cwd();

let hasError = false;

function logError(msg) {
  console.error(`❌ [Error]: ${msg}`);
  hasError = true;
}

function logSuccess(msg) {
  console.log(`✅ [Pass]: ${msg}`);
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

// 1 & 2. footer가 .app 안에 위치하는지 검사
const componentFiles = findFilesByExt(targetDir, ['.tsx', '.jsx', '.vue', '.html']);
let footerFoundInApp = false;
let appComponentScanned = false;

for (const file of componentFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.toLowerCase().includes('<footer')) {
    appComponentScanned = true;
    
    // className="app" 또는 class="app" 내부에 <footer가 있는지 검증
    const appRegex = /(?:className|class)\s*=\s*["']app["'][^>]*>[\s\S]*?<footer/i;
    const generalAppRegex = /(?:className|class)\s*=\s*["']app["']/i;
    
    if (appRegex.test(content)) {
      footerFoundInApp = true;
      logSuccess(`[${path.basename(file)}] footer가 .app 내부에 잘 위치합니다.`);
    } else if (generalAppRegex.test(content)) {
      logError(`[${path.basename(file)}] .app 컨테이너는 존재하지만 내부에 footer 구조가 감지되지 않습니다.`);
    } else {
      // 순수 HTML 파일들(예: index.html 등)의 경우 .app 래퍼가 전체 페이지 기준인지 개별 컴포넌트인지 애매할 수 있으므로 에러 표시
      logError(`[${path.basename(file)}] footer는 있지만 감싸고 있는 .app 클래스 컨테이너가 발견되지 않았습니다.`);
    }
  }
}

if (!appComponentScanned) {
  logError('프로젝트 내 어떠한 마크업 파일(.html, .tsx, .jsx, .vue)에서도 <footer> 태그를 찾을 수 없습니다.');
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


// 4. sitemap에 모든 도구가 올바르게 등록되어 있는지 검사
const sitemapFile = findFileByName(targetDir, 'sitemap.xml') || findFileByName(targetDir, 'sitemap.ts');

if (sitemapFile) {
  const sitemapContent = fs.readFileSync(sitemapFile, 'utf8');
  let toolPages = findFilesByExt(targetDir, ['.tsx', '.jsx', '.vue', '.html']);
  const excludeNames = ['index', 'layout', 'main', '404', 'app', 'vite-env.d'];
  
  toolPages = toolPages.filter(p => !excludeNames.includes(path.basename(p, path.extname(p)).toLowerCase()));

  if (toolPages.length > 0) {
    let missingSitemapTools = 0;
    toolPages.forEach(page => {
      let routeName = path.basename(page, path.extname(page));
      const kebabName = routeName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
      
      // teemoZipsa.github.io 같은 평범한 HTML 환경일 수 있으므로 .html 명칭 그대로도 검색
      if (!sitemapContent.includes(routeName) && !sitemapContent.includes(kebabName) && !sitemapContent.includes(routeName+'.html')) {
        logError(`페이지: '${routeName}'(또는 '${kebabName}')가 사이트맵(${path.basename(sitemapFile)})에 누락되었습니다.`);
        missingSitemapTools++;
      }
    });

    if (missingSitemapTools === 0) {
      logSuccess(`총 ${toolPages.length}개의 주요 파일/도구 페이지가 모두 사이트맵에 정상 등록되어 있습니다.`);
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
