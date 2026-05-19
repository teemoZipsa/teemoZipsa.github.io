const fs = require('fs');
const path = require('path');

const tools = ['char-counter','speech-timer','emoji-mixer','zodiac-calc','prompt-gen','utm-builder','pet-age-calc','pet-food-calc','pet-bmi-calc'];
const basePath = 'C:\\Users\\Seonkyu\\special-chars\\en';

// Common Korean→English replacements (order matters - longer first)
const commonReplacements = [
  // Navigation
  ['← 도구 모음', '← All Tools'],
  ['😺 더 많은 도구', '😺 More Tools'],
  ['href="https://teemozipsa.github.io/"', 'href="https://teemozipsa.github.io/en/"'],
  
  // Guide sections
  ['사용 방법', 'How to Use'],
  ['사용 가이드', 'How to Use'],
  ['자주 묻는 질문', 'FAQ'],
  
  // Common UI
  ['실시간 계산', 'Real-time Calculation'],
  ['결과 복사', 'Copy Result'],
  ['초기화', 'Reset'],
  ['계산하기', 'Calculate'],
  ['적용하기', 'Apply'],
  ['복사되었습니다', 'Copied to clipboard'],
  ['클릭하면 복사됩니다', 'Click to copy'],
  ['숫자 입력 즉시 실시간 계산', 'Real-time Calculation'],
];

// Tool-specific title/meta replacements
const toolMeta = {
  'char-counter': {
    titleKo: '✏️ 글자수 세기 — 티모집사',
    titleEn: '✏️ Character Counter — TeemoZipsa',
    descKo: '글자수, 단어수, 바이트수를 실시간으로 세어줍니다.',
    descEn: 'Count characters, words, and bytes in real time.',
    h1Ko: '✏️ 글자수 세기',
    h1En: '✏️ Character Counter',
  },
  'speech-timer': {
    titleKo: '🎤 발표 시간 계산기 — 티모집사',
    titleEn: '🎤 Speech Timer — TeemoZipsa',
    descKo: '발표 원고의 예상 소요 시간을 계산합니다.',
    descEn: 'Estimate how long your speech or presentation will take.',
    h1Ko: '🎤 발표 시간 계산기',
    h1En: '🎤 Speech Timer',
  },
  'emoji-mixer': {
    titleKo: '🎨 이모지 믹서 — 티모집사',
    titleEn: '🎨 Emoji Mixer — TeemoZipsa',
    descKo: '이모지를 조합하여 새로운 이모지를 만들어보세요.',
    descEn: 'Combine emojis to create fun new emoji combinations.',
    h1Ko: '🎨 이모지 믹서',
    h1En: '🎨 Emoji Mixer',
  },
  'zodiac-calc': {
    titleKo: '⭐ 별자리 계산기 — 티모집사',
    titleEn: '⭐ Zodiac Calculator — TeemoZipsa',
    descKo: '생년월일로 별자리를 알아보세요.',
    descEn: 'Find your zodiac sign by your birthday.',
    h1Ko: '⭐ 별자리 계산기',
    h1En: '⭐ Zodiac Calculator',
  },
  'prompt-gen': {
    titleKo: '🤖 AI 프롬프트 생성기 — 티모집사',
    titleEn: '🤖 AI Prompt Generator — TeemoZipsa',
    descKo: 'AI 프롬프트를 쉽게 생성하세요.',
    descEn: 'Generate effective AI prompts with ease.',
    h1Ko: '🤖 AI 프롬프트 생성기',
    h1En: '🤖 AI Prompt Generator',
  },
  'utm-builder': {
    titleKo: '🔗 UTM 빌더 — 티모집사',
    titleEn: '🔗 UTM Builder — TeemoZipsa',
    descKo: 'UTM 파라미터가 포함된 추적 URL을 쉽게 생성합니다.',
    descEn: 'Easily create tracking URLs with UTM parameters.',
    h1Ko: '🔗 UTM 빌더',
    h1En: '🔗 UTM Builder',
  },
  'pet-age-calc': {
    titleKo: '🐾 반려동물 나이 계산기 — 티모집사',
    titleEn: '🐾 Pet Age Calculator — TeemoZipsa',
    descKo: '반려동물의 사람 나이를 계산합니다.',
    descEn: 'Calculate your pet\'s age in human years.',
    h1Ko: '🐾 반려동물 나이 계산기',
    h1En: '🐾 Pet Age Calculator',
  },
  'pet-food-calc': {
    titleKo: '🍖 반려동물 사료 계산기 — 티모집사',
    titleEn: '🍖 Pet Food Calculator — TeemoZipsa',
    descKo: '반려동물의 일일 사료 급여량을 계산합니다.',
    descEn: 'Calculate daily food portions for your pet.',
    h1Ko: '🍖 반려동물 사료 계산기',
    h1En: '🍖 Pet Food Calculator',
  },
  'pet-bmi-calc': {
    titleKo: '⚖️ 반려동물 체중 관리 — 티모집사',
    titleEn: '⚖️ Pet Weight Manager — TeemoZipsa',
    descKo: '반려동물의 체중을 관리하고 BCS를 확인합니다.',
    descEn: 'Monitor your pet\'s weight and check their body condition score.',
    h1Ko: '⚖️ 반려동물 체중 관리',
    h1En: '⚖️ Pet Weight Manager',
  },
};

for (const tool of tools) {
  const filePath = path.join(basePath, tool, 'index.html');
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Apply common replacements
  for (const [ko, en] of commonReplacements) {
    content = content.split(ko).join(en);
  }
  
  // Apply tool-specific meta
  const meta = toolMeta[tool];
  if (meta) {
    if (meta.titleKo) content = content.split(meta.titleKo).join(meta.titleEn);
    if (meta.descKo) content = content.split(meta.descKo).join(meta.descEn);
    if (meta.h1Ko) content = content.split(meta.h1Ko).join(meta.h1En);
  }
  
  // Add hreflang if missing
  if (!content.includes('hreflang="ko"')) {
    const canonical = `<link rel="canonical" href="https://teemozipsa.github.io/special-chars/en/${tool}/">`;
    const replacement = canonical + 
      `\n<link rel="alternate" hreflang="ko" href="https://teemozipsa.github.io/special-chars/${tool}/">` +
      `\n<link rel="alternate" hreflang="en" href="https://teemozipsa.github.io/special-chars/en/${tool}/">`;
    content = content.replace(canonical, replacement);
  }
  
  // Add Korean toggle button if missing
  if (!content.includes('한국어</a>')) {
    const h1Close = `<h1>${meta.h1En}</h1>`;
    content = content.replace(h1Close, h1Close + `\n    <a href="/special-chars/${tool}/" class="back-btn">🌐 한국어</a>`);
  }
  
  // Fix footer link
  content = content.replace(
    /href="https:\/\/teemozipsa\.github\.io\/">😺 More Tools/g,
    'href="https://teemozipsa.github.io/en/">😺 More Tools'
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Done: ${tool}`);
}

console.log('\nAll common translations applied!');
