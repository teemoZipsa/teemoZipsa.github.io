const fs = require('fs');
const p = require('path');
const base = 'C:\\Users\\Seonkyu\\special-chars';

const R = [
  // ========== COMMON ==========
  ['lang="ko"', 'lang="en"'],
  ["orioncactus/pretendard/dist/web/static/pretendard.css", "fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"],
  ["'Pretendard'", "'Inter'"],
  ['"Pretendard"', '"Inter"'],
  ['← 도구 모음', '← All Tools'],
  ['😺 더 많은 도구', '😺 More Tools'],
  ['📖 사용 방법', '📖 How to Use'],
  ['💡 자주 묻는 질문', '💡 FAQ'],
  ['aria-label="맨 위로"', 'aria-label="Top"'],

  // ========== ZODIAC-CALC ==========
  ['>별자리 계산기 / Zodiac Calculator<', '>⭐ Zodiac Calculator — TeemoZipsa<'],
  ['별자리 계산기 / Zodiac Calculator — 티모집사', '⭐ Zodiac Calculator — TeemoZipsa'],
  ['별자리 계산기 / Zodiac Calculator', '⭐ Zodiac Calculator — TeemoZipsa'],
  ['생년월일로 나의 별자리를 알아보세요. 성격 특성, 원소, 수호성, 궁합 별자리까지 한눈에 확인', 'Find your zodiac sign by birthday. Discover personality traits, element, ruling planet, and compatible signs.'],
  ['>⭐ 별자리 계산기<', '>⭐ Zodiac Calculator<'],
  ['>생년월일을 입력하세요<', '>Enter your date of birth<'],
  ['>오늘 날짜<', '>Today<'],
  ['>원소<', '>Element<'],
  ['>수호성<', '>Ruling Planet<'],
  ['>성격 키워드<', '>Personality Traits<'],
  ['>궁합이 좋은 별자리<', '>Best Compatibility<'],
  ['>생년월일 기반 계산<', '>Birthday-based calculation<'],
  // Zodiac guide
  ["생년월일을 선택하거나 직접 입력하세요 (또는 '오늘 날짜' 버튼 클릭)", "Select your date of birth or click 'Today' button"],
  ['자동으로 해당하는 별자리와 상세 정보가 표시됩니다', 'Your zodiac sign and detailed info will be shown automatically'],
  ["'결과 복사' 버튼으로 텍스트 결과를 복사할 수 있습니다", "Use the 'Copy Result' button to copy the text"],
  ['💡 별자리는 태양이 해당 황도대를 지나는 기간을 기준으로 합니다. 경계 날짜(cusp)에 태어난 경우 해에 따라 다를 수 있습니다.', '💡 Zodiac signs are based on the period the Sun transits each constellation. Those born on cusp dates may vary by year.'],
  // Zodiac JS data - constellation names
  ["name:'물병자리'", "name:'Aquarius'"],
  ["name:'물고기자리'", "name:'Pisces'"],
  ["name:'양자리'", "name:'Aries'"],
  ["name:'황소자리'", "name:'Taurus'"],
  ["name:'쌍둥이자리'", "name:'Gemini'"],
  ["name:'게자리'", "name:'Cancer'"],
  ["name:'사자자리'", "name:'Leo'"],
  ["name:'처녀자리'", "name:'Virgo'"],
  ["name:'천칭자리'", "name:'Libra'"],
  ["name:'전갈자리'", "name:'Scorpio'"],
  ["name:'사수자리'", "name:'Sagittarius'"],
  ["name:'염소자리'", "name:'Capricorn'"],
  // Zodiac elements
  ["element:'🌬️ 공기'", "element:'🌬️ Air'"],
  ["element:'💧 물'", "element:'💧 Water'"],
  ["element:'🔥 불'", "element:'🔥 Fire'"],
  ["element:'🌍 땅'", "element:'🌍 Earth'"],
  // Zodiac planets
  ["planet:'♅ 천왕성'", "planet:'♅ Uranus'"],
  ["planet:'♆ 해왕성'", "planet:'♆ Neptune'"],
  ["planet:'♂ 화성'", "planet:'♂ Mars'"],
  ["planet:'♀ 금성'", "planet:'♀ Venus'"],
  ["planet:'☿ 수성'", "planet:'☿ Mercury'"],
  ["planet:'☽ 달'", "planet:'☽ Moon'"],
  ["planet:'☉ 태양'", "planet:'☉ Sun'"],
  ["planet:'♇ 명왕성'", "planet:'♇ Pluto'"],
  ["planet:'♃ 목성'", "planet:'♃ Jupiter'"],
  ["planet:'♄ 토성'", "planet:'♄ Saturn'"],
  // Zodiac traits
  ["traits:['독창적','자유로운','인도적','지적']", "traits:['Original','Freedom-loving','Humanitarian','Intellectual']"],
  ["traits:['직관적','감성적','예술적','헌신적']", "traits:['Intuitive','Emotional','Artistic','Devoted']"],
  ["traits:['열정적','도전적','솔직한','용감한']", "traits:['Passionate','Adventurous','Honest','Brave']"],
  ["traits:['안정적','인내심','감각적','신뢰감']", "traits:['Stable','Patient','Sensual','Reliable']"],
  ["traits:['재치있는','호기심','적응력','사교적']", "traits:['Witty','Curious','Adaptable','Social']"],
  ["traits:['보호적','감성적','직관적','가정적']", "traits:['Protective','Emotional','Intuitive','Family-oriented']"],
  ["traits:['카리스마','자신감','관대한','창의적']", "traits:['Charismatic','Confident','Generous','Creative']"],
  ["traits:['분석적','꼼꼼한','실용적','겸손한']", "traits:['Analytical','Meticulous','Practical','Humble']"],
  ["traits:['균형감','우아한','공정한','사교적']", "traits:['Balanced','Graceful','Fair','Social']"],
  ["traits:['열정적','통찰력','결단력','신비로운']", "traits:['Passionate','Insightful','Decisive','Mysterious']"],
  ["traits:['낙관적','모험적','철학적','자유분방']", "traits:['Optimistic','Adventurous','Philosophical','Free-spirited']"],
  ["traits:['야심찬','책임감','끈기있는','현실적']", "traits:['Ambitious','Responsible','Persistent','Realistic']"],
  // Zodiac compat arrays (Korean names → English)
  ["compat:['쌍둥이자리','천칭자리','사수자리']", "compat:['Gemini','Libra','Sagittarius']"],
  ["compat:['전갈자리','게자리','염소자리']", "compat:['Scorpio','Cancer','Capricorn']"],
  ["compat:['사자자리','사수자리','쌍둥이자리']", "compat:['Leo','Sagittarius','Gemini']"],
  ["compat:['처녀자리','염소자리','게자리']", "compat:['Virgo','Capricorn','Cancer']"],
  ["compat:['천칭자리','물병자리','양자리']", "compat:['Libra','Aquarius','Aries']"],
  ["compat:['전갈자리','물고기자리','황소자리']", "compat:['Scorpio','Pisces','Taurus']"],
  ["compat:['양자리','사수자리','쌍둥이자리']", "compat:['Aries','Sagittarius','Gemini']"],
  ["compat:['황소자리','염소자리','전갈자리']", "compat:['Taurus','Capricorn','Scorpio']"],
  ["compat:['쌍둥이자리','물병자리','사자자리']", "compat:['Gemini','Aquarius','Leo']"],
  ["compat:['게자리','물고기자리','처녀자리']", "compat:['Cancer','Pisces','Virgo']"],
  ["compat:['양자리','사자자리','물병자리']", "compat:['Aries','Leo','Aquarius']"],
  ["compat:['황소자리','처녀자리','물고기자리']", "compat:['Taurus','Virgo','Pisces']"],
  // Zodiac JS strings
  ["showToast('초기화되었습니다')", "showToast('Reset')"],
  ["showToast('먼저 생년월일을 입력하세요')", "showToast('Enter your date of birth first')"],
  ["`${z.start[0]}월 ${z.start[1]}일 ~ ${z.end[0]}월 ${z.end[1]}일`", "`${['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][z.start[0]]} ${z.start[1]} – ${['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][z.end[0]]} ${z.end[1]}`"],
  ["`${name} (${en})\\n기간: ${range}\\n원소: ${elem} | 수호성: ${planet}\\n성격: ${traits}\\n궁합: ${compat}`", "`${name} (${en})\\nPeriod: ${range}\\nElement: ${elem} | Planet: ${planet}\\nTraits: ${traits}\\nCompatibility: ${compat}`"],
  ["showToast('결과가 복사되었습니다')", "showToast('Copied to clipboard')"],

  // ========== PROMPT-GEN ==========
  ['🤖 AI 프롬프트 자판기 — 티모집사', '🤖 AI Prompt Generator — TeemoZipsa'],
  ['🤖 AI 프롬프트 자판기', '🤖 AI Prompt Generator'],
  ['빈칸만 채우면 AI가 잘 알아듣는 구조화된 프롬프트가 완성! ChatGPT, Claude 등에 바로 붙여넣기.', 'Fill in the blanks to generate structured AI prompts! Paste directly into ChatGPT, Claude, etc.'],
  ['>⚡ 빠른 템플릿<', '>⚡ Quick Templates<'],
  ['>💬 범용<', '>💬 General<'],
  ['>✍️ 글쓰기<', '>✍️ Writing<'],
  ['>💻 코딩<', '>💻 Coding<'],
  ['>🌐 번역<', '>🌐 Translation<'],
  ['>📋 요약<', '>📋 Summary<'],
  ['>💡 브레인스토밍<', '>💡 Brainstorm<'],
  ['>📝 프롬프트 빌더<', '>📝 Prompt Builder<'],
  ['>🎭 역할 (Role) <span class="tip">— AI에게 부여할 전문가 역할</span>', '>🎭 Role <span class="tip">— Expert role for the AI</span>'],
  ['placeholder="예: 10년차 마케팅 전문가"', 'placeholder="e.g. Senior marketing strategist"'],
  ['>🎯 목적 (Task) <span class="tip">— 무엇을 해달라고 할 건지</span>', '>🎯 Task <span class="tip">— What you want the AI to do</span>'],
  ['placeholder="예: 인스타그램 릴스용 마케팅 카피 10개를 작성해줘"', 'placeholder="e.g. Write 10 Instagram Reels captions for a product launch"'],
  ['>📌 맥락 (Context) <span class="tip">— 배경 정보, 대상, 상황 (선택)</span>', '>📌 Context <span class="tip">— Background info, audience, situation (optional)</span>'],
  ['placeholder="예: 타겟은 20-30대 여성, 제품은 비건 화장품 브랜드"', 'placeholder="e.g. Target audience is women aged 20-30, product is a vegan cosmetics brand"'],
  ['>📐 출력 형식 (Format) <span class="tip">— 원하는 결과물 형태 (선택)</span>', '>📐 Format <span class="tip">— Desired output format (optional)</span>'],
  ['placeholder="예: 번호 매긴 리스트, 각 항목 2줄 이내"', 'placeholder="e.g. Numbered list, each item 2 lines or less"'],
  ['>⚠️ 제약 조건 (Constraints) <span class="tip">— 주의사항, 금지 사항 (선택)</span>', '>⚠️ Constraints <span class="tip">— Rules, limitations, do-nots (optional)</span>'],
  ['placeholder="예: 이모지 포함, 각 카피 30자 이내, 영어 사용 금지"', 'placeholder="e.g. Include emojis, each copy under 50 words"'],
  ['>🗣️ 어조 (Tone) <span class="tip">— 말투 스타일 (선택)</span>', '>🗣️ Tone <span class="tip">— Writing style (optional)</span>'],
  ['>지정 안 함<', '>Not specified<'],
  ['>친근하고 캐주얼하게<', '>Friendly & Casual<'],
  ['>전문적이고 격식 있게<', '>Professional & Formal<'],
  ['>유머러스하고 재치 있게<', '>Humorous & Witty<'],
  ['>간결하고 핵심만<', '>Concise & Direct<'],
  ['>공감적이고 따뜻하게<', '>Empathetic & Warm<'],
  ['>설득력 있고 논리적으로<', '>Persuasive & Logical<'],
  ['>📋 프롬프트 복사<', '>📋 Copy Prompt<'],
  ['>🗑️ 초기화<', '>🗑️ Reset<'],
  // Prompt-gen guide
  ['카테고리에서 원하는 프롬프트 템플릿을 선택하세요.', 'Choose a prompt template from the Quick Templates.'],
  ['빈칸([ ] 부분)에 원하는 내용을 채워넣으세요.', 'Fill in the fields with your specific details.'],
  ['"복사" 버튼을 클릭하여 완성된 프롬프트를 ChatGPT, Claude 등에 붙여넣으세요.', 'Click "Copy" and paste into ChatGPT, Claude, or any AI.'],
  ['Q. 좋은 프롬프트를 작성하는 팁은?', 'Q. Tips for writing good prompts?'],
  ['좋은 프롬프트의 핵심은 <strong>구체성</strong>입니다. "글 써줘" 대신 "20대 여성을 타겟으로 한 비건 화장품 인스타그램 릴스 카피 10개를 캐주얼한 톤으로 작성해줘"처럼 역할, 대상, 형식, 어조를 명시하면 훨씬 좋은 결과를 얻을 수 있습니다. 이 도구의 역할(Role)-목적(Task)-맥락(Context)-형식(Format)-제약(Constraints) 구조를 활용하면 자연스럽게 구조화된 프롬프트가 완성됩니다.', 'The key is <strong>specificity</strong>. Instead of "write something," try "Write 10 Instagram Reels captions targeting women aged 20-30 for a vegan cosmetics brand in a casual tone." Use this tool\'s Role → Task → Context → Format → Constraints structure to create well-organized prompts naturally.'],
  ['Q. 프리셋 템플릿은 어떻게 활용하나요?', 'Q. How do I use the preset templates?'],
  ['프리셋은 자주 사용되는 작업 유형(글쓰기, 코딩, 번역, 요약, 브레인스토밍)에 대한 최적화된 기본값을 제공합니다. 프리셋을 선택한 후 빈칸만 채우면 바로 사용할 수 있고, 필요에 따라 각 필드를 자유롭게 수정할 수도 있습니다. 예를 들어 \'글쓰기\' 프리셋을 선택하고 주제만 입력하면 블로그 글 작성 프롬프트가 즉시 완성됩니다.', 'Presets provide optimized defaults for common tasks (writing, coding, translation, summary, brainstorming). Select a preset, fill in the blanks, and you\'re ready to go. You can also freely modify each field. For example, select "Writing" and just enter a topic to instantly generate a blog writing prompt.'],
  ['Q. ChatGPT와 Claude에서 프롬프트 사용법이 다른가요?', 'Q. Are prompts used differently in ChatGPT vs Claude?'],
  ['기본적인 프롬프트 구조는 동일하게 사용할 수 있습니다. 다만 각 AI의 특성에 따라 약간의 차이가 있습니다. ChatGPT는 시스템 메시지로 역할을 지정하는 것이 효과적이고, Claude는 XML 태그(&lt;role&gt;, &lt;task&gt; 등)를 활용하면 더 정확한 결과를 얻을 수 있습니다. 이 도구에서 생성된 프롬프트는 두 서비스 모두에서 잘 작동합니다.', 'The basic prompt structure works the same for both. However, ChatGPT works best with system messages for roles, while Claude performs better with XML tags (&lt;role&gt;, &lt;task&gt;). Prompts generated by this tool work well with both services.'],
  ['>AI 프롬프트 자판기<', '>AI Prompt Generator<'],
  // Prompt-gen JS data (presets)
  ["role:'도움이 되는 AI 어시스턴트'", "role:'Helpful AI assistant'"],
  ["role:'10년차 카피라이터'", "role:'Senior copywriter with 10 years of experience'"],
  ["task:'아래 주제로 블로그 글을 작성해줘'", "task:'Write a blog post on the topic below'"],
  ["format:'제목 + 소제목 3개 + 본문 (총 800자 내외)'", "format:'Title + 3 subheadings + body (around 500 words)'"],
  ["constraints:'쉬운 표현, 한국어만'", "constraints:'Use simple language'"],
  ["tone:'친근하고 캐주얼한'", "tone:'Friendly & Casual'"],
  ["role:'시니어 풀스택 개발자'", "role:'Senior full-stack developer'"],
  ["task:'아래 요구사항에 맞는 코드를 작성해줘'", "task:'Write code that meets the requirements below'"],
  ["format:'코드 블록 + 주석 + 간단한 사용법 설명'", "format:'Code block + comments + brief usage guide'"],
  ["constraints:'최신 문법 사용, 에러 처리 포함'", "constraints:'Use modern syntax, include error handling'"],
  ["tone:'간결하고 핵심만 담은'", "tone:'Concise & Direct'"],
  ["role:'한영 전문 번역가'", "role:'Professional translator'"],
  ["task:'아래 텍스트를 자연스러운 영어로 번역해줘'", "task:'Translate the text below naturally'"],
  ["format:'원문과 번역문을 나란히'", "format:'Original and translation side by side'"],
  ["constraints:'직역보다 의역 중심, 뉘앙스 살리기'", "constraints:'Focus on natural phrasing over literal translation'"],
  ["role:'문서 요약 전문가'", "role:'Document summarization expert'"],
  ["task:'아래 내용을 핵심만 간결하게 요약해줘'", "task:'Summarize the content below concisely'"],
  ["format:'3줄 요약 + 핵심 키워드 5개'", "format:'3-line summary + 5 key takeaways'"],
  ["constraints:'원문의 핵심 논지를 빠뜨리지 않기'", "constraints:'Don\\'t miss the main argument'"],
  ["role:'창의적인 기획자'", "role:'Creative planner'"],
  ["task:'아래 주제에 대한 아이디어를 브레인스토밍해줘'", "task:'Brainstorm ideas on the topic below'"],
  ["format:'번호 매긴 리스트, 각 아이디어에 한 줄 설명 포함'", "format:'Numbered list with a one-line description per idea'"],
  ["constraints:'실현 가능성 높은 아이디어 위주, 최소 10개'", "constraints:'Focus on feasible ideas, at least 10'"],
  ["tone:'유머러스하고 재치 있는'", "tone:'Humorous & Witty'"],
  // Prompt-gen JS template strings
  ["`당신은 ${role}입니다.\\n\\n`", "`You are ${role}.\\n\\n`"],
  ["`[요청]\\n${task}\\n\\n`", "`[Task]\\n${task}\\n\\n`"],
  ["`[맥락/배경]\\n${context}\\n\\n`", "`[Context]\\n${context}\\n\\n`"],
  ["`[어조]\\n${tone} 말투로 작성해주세요.\\n\\n`", "`[Tone]\\nWrite in a ${tone} tone.\\n\\n`"],
  ["`[출력 형식]\\n${format}\\n\\n`", "`[Format]\\n${format}\\n\\n`"],
  ["`[제약 조건]\\n${constraints}\\n`", "`[Constraints]\\n${constraints}\\n`"],
  ["`${prompt.length}자`", "`${prompt.length} chars`"],
  ["btn.textContent = '✅ 복사 완료!';", "btn.textContent = '✅ Copied!';"],
  ["btn.textContent = '📋 프롬프트 복사';", "btn.textContent = '📋 Copy Prompt';"],
  ["value=\"친근하고 캐주얼한\"", "value=\"Friendly & Casual\""],
  ["value=\"전문적이고 격식 있는\"", "value=\"Professional & Formal\""],
  ["value=\"유머러스하고 재치 있는\"", "value=\"Humorous & Witty\""],
  ["value=\"간결하고 핵심만 담은\"", "value=\"Concise & Direct\""],
  ["value=\"공감적이고 따뜻한\"", "value=\"Empathetic & Warm\""],
  ["value=\"설득력 있고 논리적인\"", "value=\"Persuasive & Logical\""],
  // Prompt-gen comments
  ['// 자동 저장: 페이지 로드 시 이전 입력 복원', '// Auto-restore previous input'],
  ['// 자동 저장', '// Auto-save'],
  ['// 자동 저장 데이터도 제거', '// Clear auto-save data'],
  ['/* 프리셋 */', '/* Presets */'],
  ['/* 결과 */', '/* Result */'],
];

const tools = ['zodiac-calc','prompt-gen','utm-builder','pet-age-calc','pet-food-calc','pet-bmi-calc'];

for (const tool of tools) {
  const src = p.join(base, tool, 'index.html');
  const dst = p.join(base, 'en', tool, 'index.html');
  let content = fs.readFileSync(src, 'utf8');
  
  let count = 0;
  for (const [ko, en] of R) {
    if (content.includes(ko)) {
      content = content.split(ko).join(en);
      count++;
    }
  }
  
  // Fix URLs
  content = content.split(`teemozipsa.github.io/special-chars/${tool}/`).join(`teemozipsa.github.io/special-chars/en/${tool}/`);
  content = content.split('href="https://teemozipsa.github.io/">').join('href="https://teemozipsa.github.io/en/">');
  
  // Add hreflang
  const can = `<link rel="canonical" href="https://teemozipsa.github.io/special-chars/en/${tool}/">`;
  if (!content.includes('hreflang="ko"')) {
    content = content.replace(can, can +
      `\n<link rel="alternate" hreflang="ko" href="https://teemozipsa.github.io/special-chars/${tool}/">` +
      `\n<link rel="alternate" hreflang="en" href="https://teemozipsa.github.io/special-chars/en/${tool}/">`);
  }
  
  // Add Korean toggle
  if (!content.includes('한국어')) {
    content = content.replace(/<\/h1>\s*\n\s*<\/div>/, `</h1>\n    <a href="/special-chars/${tool}/" class="back-btn">🌐 한국어</a>\n  </div>`);
  }
  
  fs.writeFileSync(dst, content, 'utf8');
  const rem = (content.match(/[가-힣]/g) || []).length;
  console.log(`${tool}: ${count} applied, ${rem} Korean chars left`);
}
