const fs = require('fs');
const path = require('path');
const basePath = 'C:\\Users\\Seonkyu\\special-chars\\en';

// For each tool, specify [oldText, newText] pairs
const fixes = {
  'char-counter': [
    ['Characters 수, Without spaces, Words, Lines, 바이트(UTF-8/EUC-KR)를 실시간으로 계산합니다.', 'Count characters (with/without spaces), words, lines, and bytes (UTF-8/EUC-KR) in real time.'],
    ['>제한 없음<', '>No Limit<'],
    ['>Characters 수 제한<', '>Character Limit<'],
    ['>바이트 제한 (UTF-8)<', '>Byte Limit (UTF-8)<'],
    ['>바이트 제한 (EUC-KR)<', '>Byte Limit (EUC-KR)<'],
    ['placeholder="예: 500"', 'placeholder="e.g. 500"'],
    ['>전체 Characters<', '>Total Chars<'],
    ['>줄<', '>Lines<'],
    ['>바이트<', '>Bytes<'],
    ['텍스트 입력 영역에 min석할 텍스트를 붙여넣거나 직접 입력하세요.', 'Paste or type the text you want to analyze in the text area.'],
    ['전체 Characters, Without spaces, Words, 줄, Bytes가 실시간으로 표시됩니다.', 'Total characters, without spaces, words, lines, and bytes are displayed in real time.'],
    ['제한 설정에서 Characters 수 또는 바이트 제한을 걸면 진행률 바가 나타납니다.', 'Set a character or byte limit to see a progress bar.'],
    ['"Copy Result" 버튼으로 통계를 클립보드에 복사할 수 있습니다.', 'Click "Copy Stats" to copy all statistics to your clipboard.'],
    ['>실시간 min석<', '>Real-time Analysis<'],
    // JS strings
    ["' ⚠ sec과!'", "' ⚠ Over limit!'"],
    ["showToast('Reset 완료')", "showToast('Cleared')"],
    ['`전체 Characters: ${chars}\\nWithout spaces: ${noSpace}\\nWords: ${words}\\nLines: ${lines}\\nUTF-8 바이트: ${utf8}\\nEUC-KR 바이트: ${euckr}`', '`Total Characters: ${chars}\\nWithout Spaces: ${noSpace}\\nWords: ${words}\\nLines: ${lines}\\nUTF-8 Bytes: ${utf8}\\nEUC-KR Bytes: ${euckr}`'],
    ["showToast('결과가 Copied to clipboard!')", "showToast('Stats copied to clipboard!')"],
    ['aria-label="맨 위로"', 'aria-label="Top"'],
    // Auto-save comments
    ['// 자동 저장: 페이지 로드 시 이전 입력 복원', '// Auto-restore saved text on page load'],
    ['// 자동 저장: 입력할 때마다 localStorage에 저장', '// Auto-save text to localStorage'],
    // Add Korean toggle
    ['<h1>📏 Character Counter</h1>\r\n  </div>', '<h1>📏 Character Counter</h1>\n    <a href="/special-chars/char-counter/" class="back-btn">🌐 한국어</a>\n  </div>'],
    ['<h1>📏 Character Counter</h1>\n  </div>', '<h1>📏 Character Counter</h1>\n    <a href="/special-chars/char-counter/" class="back-btn">🌐 한국어</a>\n  </div>'],
  ],
};

for (const [tool, replacements] of Object.entries(fixes)) {
  const filePath = path.join(basePath, tool, 'index.html');
  let content = fs.readFileSync(filePath, 'utf8');
  
  for (const [old, replacement] of replacements) {
    if (content.includes(old)) {
      content = content.split(old).join(replacement);
      console.log(`  ✓ ${tool}: replaced "${old.substring(0,40)}..."`);
    } else {
      console.log(`  ✗ ${tool}: NOT FOUND "${old.substring(0,40)}..."`);
    }
  }
  
  // Remove duplicate hreflang lines
  const lines = content.split('\n');
  const seen = new Set();
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('<link rel="alternate" hreflang=')) {
      if (seen.has(trimmed)) return false;
      seen.add(trimmed);
    }
    return true;
  });
  content = filtered.join('\n');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Done: ${tool}\n`);
}
