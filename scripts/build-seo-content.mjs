import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const today = '2026-05-27';

const tools = {
  'pet-age-calc': { url: '/special-chars/pet-age-calc/', name: '반려동물 나이 계산기', icon: '🐾', color: 'teal', desc: '나이와 생애 단계 확인' },
  'pet-bmi-calc': { url: '/special-chars/pet-bmi-calc/', name: '반려동물 체중 관리', icon: '⚖️', color: 'blue', desc: 'BCS와 참고 체중 점검' },
  'pet-food-calc': { url: '/special-chars/pet-food-calc/', name: '사료 급여량 계산기', icon: '🍖', color: 'warn', desc: 'RER 기반 하루 급여량 추정' },
  'biz-day-calc': { url: '/special-chars/biz-day-calc/', name: '영업일 계산기', icon: '📆', color: 'blue', desc: '주말·공휴일 제외 날짜 계산' },
  'discount-calc': { url: '/special-chars/discount-calc/', name: '할인/부가세 계산기', icon: '🏷️', color: 'warn', desc: '할인율과 VAT 금액 계산' },
  'loan-calc': { url: '/special-chars/loan-calc/', name: '대출이자 계산기', icon: '🏦', color: 'warn', desc: '상환 방식별 납입액 비교' },
  'broker-fee-calc': { url: '/special-chars/broker-fee-calc/', name: '부동산 중개보수 계산기', icon: '🏠', color: 'warn', desc: '매매·전월세 중개보수 계산' },
  'date-calc': { url: '/special-chars/date-calc/', name: '날짜/D-Day 계산기', icon: '📅', color: 'blue', desc: '기념일과 기간 계산' },
  'image-compress': { url: '/special-chars/image-compress/', name: '이미지 압축기', icon: '🗜️', color: 'blue', desc: '업로드 전 이미지 용량 줄이기' }
};

const existingArticles = [
  {
    id: 'cat-age-guide',
    title: '"1년 = 7년"이라는 거짓말 — AAFP 기준으로 다시 보는 고양이 나이',
    url: '/blog/cat-age-guide/',
    thumbnail: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=1200&auto=format&fit=crop',
    thumbnailLabel: 'CAT · AGE',
    tag: '팩트체크',
    category: '고양이 건강/생활',
    summary: '첫 해 +15세, 둘째 해 +9세, 이후 매년 +4세. 우리집 고양이의 진짜 사람 나이를 다시 계산합니다.',
    author: '티모집사 편집팀',
    date: '2026-05-18',
    readMinutes: 6,
    size: 'tall',
    isFeatured: true,
    relatedTool: tools['pet-age-calc'].url,
    relatedToolName: tools['pet-age-calc'].name,
    relatedToolIcon: tools['pet-age-calc'].icon,
    sources: ['AAFP/AAHA Feline Life Stage Guidelines']
  },
  {
    id: 'cat-bmi-guide',
    title: '비만일까 원시주머니일까 — 고양이 체형을 보는 9점 척도',
    url: '/blog/cat-bmi-guide/',
    thumbnail: 'https://images.unsplash.com/photo-1574231164645-d6f0e8553590?w=800&auto=format&fit=crop',
    thumbnailLabel: 'CAT · BCS',
    tag: '건강관리',
    category: '고양이 건강/생활',
    summary: '위에서 보고, 옆에서 보고, 만져서 확인하는 고양이 체형 평가 기준을 정리합니다.',
    author: '티모집사 편집팀',
    date: '2026-05-16',
    readMinutes: 5,
    size: 'big',
    relatedTool: tools['pet-bmi-calc'].url,
    relatedToolName: tools['pet-bmi-calc'].name,
    relatedToolIcon: tools['pet-bmi-calc'].icon,
    sources: ['WSAVA Body Condition Score 참고']
  }
];

const articles = [
  {
    id: 'cat-food-amount-guide',
    date: '2026-05-27',
    tag: '사료 계산',
    category: '반려동물',
    title: '고양이 사료 급여량 계산법 — 체중만 넣으면 왜 자꾸 틀릴까',
    summary: 'RER와 활동 계수를 나눠 하루 칼로리와 사료 그램 수를 계산하는 방법을 예시로 정리했습니다.',
    label: 'CAT · FOOD',
    tool: 'pet-food-calc',
    keywords: ['고양이 사료 급여량', '고양이 하루 사료량', '고양이 칼로리 계산'],
    sections: [
      ['체중만으로는 부족합니다', '같은 4kg 고양이라도 중성화 여부, 활동량, 감량 필요 여부에 따라 하루 필요 열량이 달라집니다. 그래서 티모집사는 먼저 RER를 계산하고, 그 위에 생활 상태별 계수를 적용하는 방식을 씁니다.', 'RER는 휴식 상태에서 필요한 최소 에너지에 가까운 값입니다. 실제 급여량은 RER에 활동 계수를 곱한 뒤, 사료 100g당 열량으로 나눠 그램으로 바꿔야 합니다.'],
      ['예시로 계산해보기', '4.5kg 중성화 성묘가 100g당 380kcal 사료를 먹는다고 가정하면, 먼저 RER를 구하고 중성화 성묘 계수를 적용합니다. 이후 하루 칼로리를 380으로 나눈 뒤 100을 곱하면 하루 급여 그램 수가 됩니다.', '간식이 있다면 전체 칼로리의 일부를 먼저 빼고 사료량을 계산해야 합니다. 간식을 따로 주면서 사료를 그대로 주면 체중이 천천히 늘어납니다.'],
      ['자주 틀리는 부분', '컵 단위 계량은 브랜드마다 밀도가 달라 오차가 큽니다. 처음 2주만이라도 주방저울로 그램을 맞춰보면 체중 변화가 훨씬 잘 보입니다.', '성장기, 임신·수유, 질환 관리 중인 고양이는 일반 성묘 계산식으로 맞추면 안 됩니다. 이 글의 계산은 건강한 성묘의 교육용 추정입니다.']
    ],
    examples: ['감량 중이면 계수를 낮추고 매주 체중을 기록합니다.', '간식 30kcal를 주면 하루 사료 칼로리에서 먼저 뺍니다.', '사료를 바꿀 때는 새 사료의 100g당 kcal를 다시 입력합니다.'],
    faq: [
      ['사료 봉투 권장량과 계산기가 다르면 어느 쪽을 보나요?', '봉투 권장량은 넓은 범위입니다. 체중 변화 기록을 기준으로 2주 단위로 조정하는 편이 현실적입니다.'],
      ['츄르는 하루에 얼마나 줘야 하나요?', '간식은 총 열량의 일부로만 계산해야 합니다. 간식을 주는 날은 사료량을 함께 줄이세요.']
    ],
    sources: ['AAHA 2021 Nutrition and Weight Management Guidelines', 'WSAVA Global Nutrition Guidelines']
  },
  {
    id: 'kitten-feeding-guide',
    date: '2026-05-28',
    tag: '성장기',
    category: '반려동물',
    title: '아기 고양이 사료량 — 성장기에는 성묘 공식으로 계산하면 안 됩니다',
    summary: '자묘는 성묘보다 에너지 요구량이 높습니다. 월령별로 사료량을 볼 때 확인해야 할 기준을 정리했습니다.',
    label: 'KITTEN · FOOD',
    tool: 'pet-food-calc',
    keywords: ['아기 고양이 사료량', '자묘 사료 급여량', '고양이 성장기 칼로리'],
    sections: [
      ['성장기는 목표가 다릅니다', '성묘 급여량의 목표가 체중 유지라면, 자묘 급여량의 목표는 안정적인 성장입니다. 너무 적게 주면 성장과 면역에 영향을 줄 수 있고, 너무 많이 주면 설사나 급격한 체중 증가가 생길 수 있습니다.'],
      ['월령보다 중요한 관찰값', '월령표는 출발점일 뿐입니다. 실제로는 체중 증가 속도, 변 상태, 활동성, 식욕을 함께 봐야 합니다. 특히 입양 직후에는 환경 변화 때문에 일시적으로 섭취량이 줄 수 있습니다.'],
      ['실전 조정법', '하루 총량을 여러 번 나눠 주고, 1~2주 단위로 몸무게를 기록합니다. 사료를 바꿀 때는 기존 사료와 섞어 천천히 전환하면 소화 부담을 줄일 수 있습니다.']
    ],
    examples: ['새 사료 전환은 며칠에 걸쳐 비율을 바꿉니다.', '체중은 같은 시간대에 기록합니다.', '설사가 반복되면 계산보다 진료가 우선입니다.'],
    faq: [['자율급식이 좋나요?', '자묘는 자율급식이 가능한 경우도 있지만, 과식하거나 다묘 가정이면 개별 섭취량 확인이 어렵습니다.']],
    sources: ['WSAVA Global Nutrition Guidelines']
  },
  {
    id: 'senior-cat-health-check',
    date: '2026-05-29',
    tag: '노묘 관리',
    category: '반려동물',
    title: '노묘 건강검진 항목 — 나이 계산 후 바로 확인할 것들',
    summary: '고양이 나이를 사람 나이로 바꾼 뒤, 생애 단계별로 어떤 검진과 생활 변화를 챙길지 정리했습니다.',
    label: 'CAT · SENIOR',
    tool: 'pet-age-calc',
    keywords: ['노묘 건강검진 항목', '고양이 노묘 나이', '고양이 사람 나이'],
    sections: [
      ['나이 계산은 시작점입니다', '사람 나이 환산은 재미용 숫자에 그치면 의미가 작습니다. 중요한 것은 우리 고양이가 성묘기, 중년기, 노묘기 중 어디에 있는지 보고 검진 주기를 바꾸는 것입니다.'],
      ['집에서 볼 수 있는 신호', '물 마시는 양, 소변 횟수, 점프 높이, 그루밍 빈도, 체중 변화를 기록하면 진료 때 훨씬 구체적으로 설명할 수 있습니다. 노화 신호는 천천히 오기 때문에 매일 보면 오히려 놓치기 쉽습니다.'],
      ['도구와 기록을 연결하기', '나이 계산기로 생애 단계를 확인하고, 체중 관리 도구로 BCS를 함께 기록하세요. 숫자 하나보다 변화 추세가 더 중요합니다.']
    ],
    examples: ['체중이 서서히 줄면 식욕이 있어도 확인이 필요합니다.', '화장실 모래 사용량 변화는 중요한 단서입니다.', '점프를 피하면 관절 불편 신호일 수 있습니다.'],
    faq: [['몇 살부터 노묘인가요?', '분류 기준마다 차이가 있지만 대체로 11세 이후는 노묘 관리 관점으로 보는 것이 안전합니다.']],
    sources: ['AAFP/AAHA Feline Life Stage Guidelines']
  },
  {
    id: 'cat-treat-calorie-guide',
    date: '2026-05-30',
    tag: '간식 관리',
    category: '반려동물',
    title: '츄르 하루 권장량 — 간식을 사료와 따로 계산하면 살이 찝니다',
    summary: '고양이 간식은 하루 총칼로리 안에서 계산해야 합니다. 츄르와 사료량을 함께 조정하는 방법입니다.',
    label: 'CAT · TREAT',
    tool: 'pet-food-calc',
    keywords: ['츄르 권장량 하루', '고양이 간식 칼로리', '고양이 간식 사료량'],
    sections: [
      ['간식은 별도 보너스가 아닙니다', '츄르나 동결건조 간식도 모두 칼로리입니다. 하루 필요 열량을 이미 사료로 채웠다면 간식은 추가 열량이 되고, 이 상태가 반복되면 체중이 늘어납니다.'],
      ['계산 순서', '먼저 하루 필요 칼로리를 계산합니다. 그 다음 간식 칼로리를 빼고, 남은 칼로리만 사료로 채우면 됩니다. 간식 봉투의 kcal 표시를 확인하는 습관이 중요합니다.'],
      ['주의할 상황', '신장, 췌장, 알레르기, 비만 관리 중인 고양이는 간식 종류 자체가 문제가 될 수 있습니다. 이 경우 권장량 계산보다 수의사와 식단을 정하는 것이 우선입니다.']
    ],
    examples: ['간식 20kcal를 주면 사료도 20kcal만큼 줄입니다.', '훈련 보상은 작게 쪼개 횟수만 늘립니다.', '여러 가족이 간식을 주면 기록표가 필요합니다.'],
    faq: [['간식을 아예 끊어야 하나요?', '대부분은 끊기보다 총량 안에서 관리하는 편이 지속하기 쉽습니다.']],
    sources: ['AAHA 2021 Nutrition and Weight Management Guidelines']
  },
  {
    id: 'dog-food-amount-guide',
    date: '2026-05-31',
    tag: '강아지 급여',
    category: '반려동물',
    title: '강아지 사료량 계산 — 몸무게보다 활동량 계수가 먼저입니다',
    summary: '강아지 급여량은 체중, 중성화, 활동량, 감량 여부에 따라 크게 달라집니다.',
    label: 'DOG · FOOD',
    tool: 'pet-food-calc',
    keywords: ['강아지 사료량 계산', '강아지 하루 칼로리', '강아지 다이어트 사료량'],
    sections: [
      ['같은 체중도 필요 열량이 다릅니다', '산책량이 많은 개와 실내 활동이 적은 개는 같은 체중이어도 필요 칼로리가 다릅니다. 중성화 여부와 체형 상태도 급여량에 영향을 줍니다.'],
      ['계산 후 관찰이 필수입니다', '공식은 출발점입니다. 2주 동안 체중과 허리 라인을 관찰한 뒤 늘릴지 줄일지 정해야 합니다. 특히 소형견은 작은 간식 하나도 비중이 큽니다.'],
      ['감량 중에는 천천히', '급격한 제한은 스트레스와 영양 불균형을 만들 수 있습니다. 감량 목표가 있다면 현재 식사량, 간식, 운동량을 함께 기록하세요.']
    ],
    examples: ['산책량이 줄어든 계절에는 사료량도 재검토합니다.', '훈련 간식은 하루 총량에 포함합니다.', '체중보다 BCS를 함께 봅니다.'],
    faq: [['사료 봉투보다 적게 줘도 되나요?', '체중이 늘고 있다면 줄일 수 있지만, 성장기나 질환이 있으면 전문가 확인이 우선입니다.']],
    sources: ['WSAVA Global Nutrition Guidelines']
  },
  {
    id: 'pet-weight-loss-calorie-guide',
    date: '2026-06-01',
    tag: '감량 계획',
    category: '반려동물',
    title: '반려동물 다이어트 칼로리 — 적게 주기 전에 목표를 계산하세요',
    summary: '무작정 사료를 줄이기보다 현재 체형, 목표 체중, 간식량을 함께 계산하는 방법입니다.',
    label: 'PET · DIET',
    tool: 'pet-bmi-calc',
    keywords: ['반려동물 다이어트 칼로리', '고양이 감량 사료량', '강아지 비만 관리'],
    sections: [
      ['다이어트의 기준은 목표 체형입니다', '체중 숫자만 보고 줄이면 근육량과 골격 차이를 놓칩니다. 먼저 BCS를 확인하고, 현재 상태가 과체중인지 비만인지 구분하는 것이 좋습니다.'],
      ['줄이는 순서', '첫 번째는 간식과 사람 음식입니다. 두 번째가 사료량입니다. 활동량은 가능한 범위에서 서서히 늘려야 오래 유지됩니다.'],
      ['기록이 없으면 조정할 수 없습니다', '감량은 주 단위로 봐야 합니다. 하루 섭취 칼로리, 체중, 변 상태, 활동량을 기록하면 과도한 제한을 피할 수 있습니다.']
    ],
    examples: ['간식부터 0으로 만들기보다 칼로리를 기록합니다.', '목표 체중은 품종 평균이 아니라 현재 체형 기준으로 봅니다.', '급격한 식욕 변화는 진료가 우선입니다.'],
    faq: [['얼마나 빨리 빼야 하나요?', '안전한 속도는 개체마다 다릅니다. 빠른 감량보다 지속 가능한 식단이 중요합니다.']],
    sources: ['AAHA 2021 Nutrition and Weight Management Guidelines']
  },
  {
    id: 'multi-cat-feeding-guide',
    date: '2026-06-02',
    tag: '다묘 가정',
    category: '반려동물',
    title: '다묘 가정 사료량 — 한 그릇 급식이 계산을 망치는 이유',
    summary: '여러 마리가 함께 먹을 때 개별 섭취량을 확인하는 현실적인 방법을 정리했습니다.',
    label: 'MULTI · CAT',
    tool: 'pet-food-calc',
    keywords: ['다묘 가정 사료', '고양이 여러 마리 사료량', '다묘 급식 방법'],
    sections: [
      ['총량만 맞추면 부족합니다', '두 마리의 하루 총량을 한 그릇에 담으면 누가 얼마나 먹었는지 알 수 없습니다. 한 마리는 과식하고 다른 한 마리는 부족할 수 있습니다.'],
      ['분리 급식의 현실적인 기준', '완전 분리가 어렵다면 하루 한 끼만이라도 분리해서 먹는 속도와 식욕을 확인하세요. 급식 위치를 나누고, 체중 기록을 개별로 관리하는 것이 중요합니다.'],
      ['계산 도구 활용법', '각 고양이의 체중과 상태를 따로 입력해 하루 권장량을 구한 뒤, 실제 섭취량을 비교하세요. 다묘 가정에서는 평균값이 가장 위험합니다.']
    ],
    examples: ['마른 아이와 비만 아이를 같은 사료통으로 관리하지 않습니다.', '자동급식기는 개체 인식 기능 여부가 중요합니다.', '먹는 속도가 빠른 아이는 퍼즐 피더가 도움이 될 수 있습니다.'],
    faq: [['한 마리만 처방식을 먹어야 하면 어떻게 하나요?', '처방식은 공유되면 안 되는 경우가 많습니다. 분리 급식 환경을 먼저 만들어야 합니다.']],
    sources: ['WSAVA Global Nutrition Guidelines']
  },
  {
    id: 'cat-bcs-home-checklist',
    date: '2026-06-03',
    tag: '체형 체크',
    category: '반려동물',
    title: '고양이 BCS 집에서 보는 법 — 위·옆·손끝 3단계 체크',
    summary: 'BCS 9점 척도를 집에서 대략 확인할 때 보는 허리, 복부, 갈비뼈 기준입니다.',
    label: 'CAT · BCS',
    tool: 'pet-bmi-calc',
    keywords: ['고양이 BCS 측정법', '고양이 비만 확인', '원시주머니 vs 비만'],
    sections: [
      ['위에서 보기', '갈비뼈 뒤쪽 허리가 살짝 들어가면 이상적인 체형에 가깝습니다. 위에서 봤을 때 몸통이 둥글게 이어지면 과체중 가능성이 있습니다.'],
      ['옆에서 보기', '배 라인이 아래로 많이 처져 있는지, 원시주머니인지 구분해야 합니다. 원시주머니는 부드러운 피부 주머니에 가깝고, 비만은 갈비뼈와 허리 주변 지방이 함께 늘어납니다.'],
      ['손끝으로 확인하기', '갈비뼈가 너무 도드라지면 마른 상태일 수 있고, 두꺼운 지방층 때문에 거의 만져지지 않으면 과체중 가능성이 있습니다. 고양이가 싫어하면 억지로 만지지 마세요.']
    ],
    examples: ['사진은 매달 같은 각도에서 찍습니다.', '체중계 숫자와 BCS를 함께 봅니다.', '털이 긴 고양이는 시각 평가만으로 부족할 수 있습니다.'],
    faq: [['원시주머니가 크면 비만인가요?', '원시주머니만으로 비만을 판단하지 않습니다. 허리, 갈비뼈, 체중 변화까지 같이 봐야 합니다.']],
    sources: ['WSAVA Body Condition Score 참고']
  },
  {
    id: 'business-day-count-guide',
    date: '2026-06-04',
    tag: '영업일',
    category: '생활 계산',
    title: '영업일 계산법 — 오늘부터 5영업일 후와 두 날짜 사이는 다릅니다',
    summary: '시작일 포함 여부가 결과를 바꿉니다. 업무 마감일을 계산할 때 확인할 규칙입니다.',
    label: 'BIZ · DAY',
    tool: 'biz-day-calc',
    keywords: ['영업일 계산', '5영업일 후', '두 날짜 사이 영업일'],
    sections: [
      ['연산이 다르면 포함 규칙도 다릅니다', '오늘부터 N영업일 후를 구할 때는 보통 시작일을 세지 않습니다. 반면 두 날짜 사이 영업일 수는 시작일과 종료일 포함 여부를 먼저 정해야 합니다.'],
      ['공휴일이 핵심 변수입니다', '주말만 빼는 계산은 실제 업무일과 다를 수 있습니다. 한국 기준 계산은 고정 공휴일, 음력 공휴일, 대체공휴일, 선거일·임시공휴일을 구분해야 합니다.'],
      ['실무 예시', '계약서 제출, 택배 영업일, 고객센터 처리일은 회사별 기준이 다를 수 있습니다. 도구 결과는 공통 달력 기준으로 보고, 각 서비스 약관의 산입 규칙을 함께 확인하세요.']
    ],
    examples: ['시작일이 금요일이면 1영업일 후는 보통 다음 월요일입니다.', '공휴일 전후에는 하루 차이가 쉽게 납니다.', '회사 휴무일은 별도 캘린더로 관리해야 합니다.'],
    faq: [['토요일은 영업일인가요?', '일반적인 은행·관공서 기준에서는 영업일로 보지 않습니다. 업종별로 다를 수 있습니다.']],
    sources: ['관공서의 공휴일에 관한 규정', '티모집사 공휴일 fixture']
  },
  {
    id: 'korean-substitute-holiday-guide',
    date: '2026-06-05',
    tag: '공휴일',
    category: '생활 계산',
    title: '대체공휴일 계산 — 주말이면 무조건 다음 평일일까',
    summary: '한국 대체공휴일은 휴일 종류별 규칙이 달라 단순 주말 치환으로 계산하면 틀릴 수 있습니다.',
    label: 'HOLIDAY',
    tool: 'biz-day-calc',
    keywords: ['대체공휴일 계산', '한국 공휴일 계산', '임시공휴일 영업일'],
    sections: [
      ['단순 규칙으로는 부족합니다', '모든 공휴일이 같은 방식으로 대체되는 것은 아닙니다. 어떤 휴일인지, 토요일인지 일요일인지, 다른 공휴일과 겹쳤는지에 따라 결과가 달라질 수 있습니다.'],
      ['임시공휴일과 선거일', '임시공휴일이나 임기만료 선거일은 고정 공식만으로 자동 산출하기 어렵습니다. 그래서 티모집사는 수동 데이터 파일에 확인일을 남겨 관리합니다.'],
      ['계산 결과를 볼 때', '장기 계약, 급여일, 법정 기한처럼 금액이나 권리가 걸린 일정은 계산기 결과만으로 확정하지 말고 해당 기관 기준을 확인해야 합니다.']
    ],
    examples: ['어린이날, 설·추석, 국경일은 적용 조건을 따로 봅니다.', '선거일은 해당 연도 데이터를 확인해야 합니다.', '회사 창립기념일은 공통 공휴일이 아닙니다.'],
    faq: [['임시공휴일도 자동 반영되나요?', '확인된 연도 데이터는 반영하지만, 정부 수시 지정일은 갱신이 필요합니다.']],
    sources: ['관공서의 공휴일에 관한 규정']
  },
  {
    id: 'vat-inclusive-exclusive-guide',
    date: '2026-06-06',
    tag: '부가세',
    category: '생활 계산',
    title: '부가세 포함·별도 계산 — 11,000원에서 공급가액은 얼마일까',
    summary: 'VAT 역산은 공급가액과 세액을 분리한 뒤 반올림 규칙까지 확인해야 합니다.',
    label: 'VAT',
    tool: 'discount-calc',
    keywords: ['부가세 포함 계산', '부가세 별도 계산', '공급가액 세액 계산'],
    sections: [
      ['포함과 별도는 방향이 다릅니다', '부가세 별도 금액에 10%를 더하는 계산은 쉽습니다. 반대로 부가세 포함 금액에서 공급가액을 역산할 때는 총액을 1.1로 나누고 세액을 분리합니다.'],
      ['원 단위 처리', '금액 계산에서는 1원 차이도 의미가 있습니다. 견적서, 세금계산서, 장부 입력에서는 반올림인지 버림인지 규칙을 맞춰야 합니다.'],
      ['실전 확인', '쇼핑몰 판매가, 프리랜서 견적, 사업자 거래는 표시 방식이 다릅니다. 부가세 포함 가격인지 별도 가격인지 먼저 확인하세요.']
    ],
    examples: ['11,000원 포함가는 공급가액 10,000원과 세액 1,000원으로 볼 수 있습니다.', '10,000원 별도가는 총 11,000원입니다.', '소수점이 생기면 정수화 규칙을 명시합니다.'],
    faq: [['계산기와 거래처 금액이 1원 다르면 오류인가요?', '반올림·절사 규칙 차이일 수 있습니다. 거래처 기준을 확인해야 합니다.']],
    sources: ['부가가치세 일반 계산 원칙', '티모집사 금액 검산 fixture']
  },
  {
    id: 'discount-percent-guide',
    date: '2026-06-07',
    tag: '할인율',
    category: '생활 계산',
    title: '할인율 계산 — 20% 할인과 20% 적립은 같은 혜택이 아닙니다',
    summary: '쇼핑 가격 비교에서 할인, 쿠폰, 적립, 부가세를 같은 기준으로 환산하는 방법입니다.',
    label: 'DISCOUNT',
    tool: 'discount-calc',
    keywords: ['할인율 계산', '쿠폰 할인 계산', '최종 결제금액 계산'],
    sections: [
      ['할인과 적립을 구분하세요', '20% 할인은 결제금액을 바로 줄이지만, 20% 적립은 다음 구매에서만 가치가 생깁니다. 같은 퍼센트라도 현금 흐름이 다릅니다.'],
      ['중복 쿠폰의 순서', '정률 할인과 정액 쿠폰이 같이 있을 때 적용 순서가 결과를 바꿉니다. 쇼핑몰은 보통 자체 규칙이 있으므로 최종 결제 단계 금액을 기준으로 비교해야 합니다.'],
      ['VAT와 배송비', '사업자 구매나 견적 비교에서는 부가세 포함 여부와 배송비를 따로 봐야 합니다. 할인율만 높아도 총액은 더 비쌀 수 있습니다.']
    ],
    examples: ['10만원의 20% 할인은 8만원 결제입니다.', '8만원 결제 후 2만원 적립은 현금 할인과 다릅니다.', '배송비 무료 조건도 총액에 포함해 비교합니다.'],
    faq: [['최저가 비교는 무엇을 기준으로 하나요?', '실제 결제금액에서 즉시 사용 가능한 혜택만 먼저 반영하는 편이 안전합니다.']],
    sources: ['티모집사 금액 검산 fixture']
  },
  {
    id: 'loan-interest-repayment-guide',
    date: '2026-06-08',
    tag: '대출',
    category: '금융 계산',
    title: '원리금균등·원금균등 차이 — 월 납입액만 보면 놓치는 것',
    summary: '대출 상환 방식별 월 납입액, 총이자, 초반 부담 차이를 계산 예시로 설명합니다.',
    label: 'LOAN',
    tool: 'loan-calc',
    keywords: ['원리금균등 원금균등 차이', '대출 이자 계산', '월 상환액 계산'],
    sections: [
      ['월 납입액의 모양이 다릅니다', '원리금균등은 매달 비슷한 금액을 내도록 설계됩니다. 원금균등은 원금을 매달 같은 금액으로 갚기 때문에 초반 납입액이 크고 시간이 갈수록 줄어듭니다.'],
      ['총이자 차이', '조건이 같다면 원금이 더 빨리 줄어드는 방식이 총이자를 줄이는 데 유리할 수 있습니다. 하지만 초반 현금 흐름 부담도 함께 봐야 합니다.'],
      ['반올림 규칙', '실제 금융기관 상환표는 원 단위 처리와 마지막 회차 잔차 처리 방식이 있습니다. 계산기는 비교용으로 보고, 계약 전에는 금융기관 상환 예정표를 확인하세요.']
    ],
    examples: ['초반 부담이 낮아야 하면 원리금균등을 많이 봅니다.', '총이자 절감을 우선하면 원금균등도 비교합니다.', '중도상환수수료는 별도 조건입니다.'],
    faq: [['계산기 월 납입액과 은행 표가 다를 수 있나요?', '원 단위 처리, 실행일, 첫 이자 기간 때문에 차이가 날 수 있습니다.']],
    sources: ['티모집사 대출 검산 fixture']
  },
  {
    id: 'broker-fee-rent-guide',
    date: '2026-06-09',
    tag: '부동산',
    category: '생활 계산',
    title: '월세 중개보수 계산 — 보증금 + 월세×100만 기억하면 틀릴 수 있습니다',
    summary: '월세 환산보증금의 5천만 원 미만 예외와 서울 기준 중개보수 계산 흐름을 정리했습니다.',
    label: 'BROKER',
    tool: 'broker-fee-calc',
    keywords: ['월세 중개수수료 계산', '부동산 중개보수 계산', '환산보증금 계산'],
    sections: [
      ['환산보증금 예외', '월세 중개보수는 보증금에 월세의 100배를 더해 거래금액을 보는 것이 기본입니다. 다만 이 값이 5천만 원 미만이면 월세의 70배를 더하는 방식으로 다시 계산하는 예외가 있습니다.'],
      ['지역 기준을 확인하세요', '주택 중개보수는 법령의 한도 구조와 시·도 조례가 함께 작동합니다. 티모집사는 서울 기준 요율표를 명시해 계산 기준을 고정합니다.'],
      ['오피스텔과 비주택', '주거용 오피스텔, 상가, 사무실은 일반 주택 구간표와 다르게 볼 수 있습니다. 물건 종류를 잘못 고르면 결과가 크게 달라집니다.']
    ],
    examples: ['보증금 500만원, 월세 40만원은 예외 구간을 확인해야 합니다.', '고가 매매·임대차는 상위 구간 요율을 따로 봅니다.', '최종 지급액은 계약서와 관할 조례 확인이 필요합니다.'],
    faq: [['전국 어디나 같은 요율인가요?', '대부분 비슷하지만 주택은 시·도 조례 기준을 확인해야 합니다.']],
    sources: ['공인중개사법 시행규칙 별표', '서울특별시 중개보수 요율표']
  },
  {
    id: 'date-dday-count-guide',
    date: '2026-06-10',
    tag: 'D-Day',
    category: '생활 계산',
    title: '디데이 계산 — 오늘을 1일로 셀지 0일로 셀지 먼저 정하세요',
    summary: '기념일, 수험일, 프로젝트 마감일 계산에서 가장 많이 헷갈리는 초일 산입 규칙입니다.',
    label: 'D-DAY',
    tool: 'date-calc',
    keywords: ['디데이 계산', '날짜 차이 계산', '초일 산입'],
    sections: [
      ['초일 산입이 결과를 바꿉니다', '오늘을 1일차로 세면 결과가 하나 커지고, 오늘을 제외하면 일반적인 날짜 차이에 가까워집니다. 어느 방식이 맞는지는 사용 상황에 따라 다릅니다.'],
      ['기념일과 마감일', '연애 100일처럼 기념일은 시작일을 1일로 보는 경우가 많습니다. 반대로 프로젝트 마감까지 남은 일수는 오늘을 제외하고 계산하는 경우가 많습니다.'],
      ['달력 기준과 시간 기준', '날짜 계산은 시각을 버리고 달력 날짜만 보는 경우가 많습니다. 정확한 시간 차이가 필요하면 시간대와 시각까지 포함해야 합니다.']
    ],
    examples: ['오늘부터 7일 뒤와 7일째 되는 날은 다를 수 있습니다.', '생일 D-Day는 날짜 기준이면 충분합니다.', '해외 일정은 시간대 차이를 확인합니다.'],
    faq: [['왜 다른 사이트와 하루 차이가 나나요?', '시작일 포함 여부가 다르기 때문인 경우가 많습니다.']],
    sources: ['티모집사 날짜 계산 규칙']
  },
  {
    id: 'image-compress-webp-guide',
    date: '2026-06-11',
    tag: '이미지',
    category: '웹 도구',
    title: '이미지 용량 줄이기 — JPG, PNG, WebP를 언제 써야 할까',
    summary: '블로그·쇼핑몰·문서 업로드 전에 이미지 품질과 용량을 함께 맞추는 실전 기준입니다.',
    label: 'IMG · WEBP',
    tool: 'image-compress',
    keywords: ['이미지 용량 줄이기', 'WebP 변환', 'JPG PNG 차이'],
    sections: [
      ['포맷 선택이 먼저입니다', '사진은 JPG나 WebP가 유리하고, 투명 배경이 필요한 이미지는 PNG나 WebP를 봐야 합니다. 스크린샷은 글자 선명도가 중요하므로 과한 압축을 피하세요.'],
      ['크기와 품질을 나눠 조정하기', '가로 4000px 이미지를 그대로 올리면 압축률을 높여도 무겁습니다. 먼저 실제 표시 크기에 맞게 리사이즈하고, 그 다음 품질을 조정하는 순서가 좋습니다.'],
      ['개인정보와 로컬 처리', '주민등록증, 계약서, 내부 문서 이미지는 서버 업로드형 도구보다 브라우저 로컬 처리 도구가 안전합니다. 티모집사 이미지 도구는 브라우저에서 처리하는 것을 원칙으로 합니다.']
    ],
    examples: ['블로그 본문 이미지는 긴 변 1200~1600px로도 충분한 경우가 많습니다.', '투명 로고는 PNG 또는 WebP를 확인합니다.', '압축 후 글자가 흐리면 품질을 올립니다.'],
    faq: [['무조건 WebP가 좋은가요?', '대부분 웹에서는 유리하지만, 호환성이나 편집 목적에 따라 JPG/PNG가 더 편할 수 있습니다.']],
    sources: ['티모집사 이미지 도구 운영 기준']
  }
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function articleUrl(id) {
  return `/blog/${id}/`;
}

function plainText(article) {
  return [
    article.summary,
    ...article.sections.flatMap((section) => section.slice(1)),
    ...(article.examples || []),
    ...(article.faq || []).flat()
  ].join(' ');
}

function renderList(items) {
  if (!items?.length) return '';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderArticle(article) {
  const tool = tools[article.tool];
  const sourceList = renderList(article.sources || []);
  const faqHtml = (article.faq || []).map(([q, a]) => `<details><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join('\n');
  const body = article.sections.map(([heading, ...paragraphs]) => `
        <h2>${escapeHtml(heading)}</h2>
        ${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n        ')}
      `).join('\n');
  const intentText = (article.keywords || []).slice(0, 3).join(', ');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.summary,
    author: { '@type': 'Organization', name: '티모집사 편집팀' },
    publisher: { '@type': 'Organization', name: '티모집사' },
    datePublished: article.date,
    dateModified: today,
    mainEntityOfPage: `https://teemozipsa.github.io${articleUrl(article.id)}`
  };
  const faqSchema = article.faq?.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.faq.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a }
    }))
  } : null;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <script>(function(){var t;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)})()</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(article.title)} | 티모 매거진</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="stylesheet" href="/special-chars/theme.css">
  <meta name="theme-color" content="#6366f1">
  <meta name="description" content="${escapeHtml(article.summary)}">
  <link rel="canonical" href="https://teemozipsa.github.io${articleUrl(article.id)}">
  <meta property="og:title" content="${escapeHtml(article.title)} | 티모 매거진">
  <meta property="og:description" content="${escapeHtml(article.summary)}">
  <meta property="og:url" content="https://teemozipsa.github.io${articleUrl(article.id)}">
  <meta property="og:type" content="article">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  ${faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : ''}
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3501868770820650" crossorigin="anonymous"></script>
  <style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
    *{box-sizing:border-box} body{margin:0;font-family:'Pretendard',-apple-system,BlinkMacSystemFont,system-ui,'Noto Sans KR',sans-serif;background:var(--bg-body);color:var(--text-secondary);line-height:1.75}
    header{border-bottom:1px solid var(--border);background:rgba(var(--bg-card-rgb),.88);position:sticky;top:0;z-index:20;backdrop-filter:blur(10px)}
    .header-inner{max-width:820px;margin:0 auto;padding:15px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px}
    .back-link,.brand-logo{font-weight:800;text-decoration:none;color:var(--text-primary)} .brand-logo{color:var(--accent)}
    main{max-width:760px;margin:0 auto;padding:40px 20px 90px}
    .meta{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;margin-bottom:18px}
    .tag{background:var(--bg-hover);color:var(--accent);padding:4px 10px;border-radius:999px;font-weight:800;font-size:12px}
    h1{font-size:clamp(28px,5vw,42px);line-height:1.28;text-align:center;color:var(--text-primary);margin:0 0 22px;word-break:keep-all}
    .summary{font-size:18px;color:var(--text-secondary);text-align:center;margin:0 auto 28px;max-width:680px}
    .hero-label{border:1px solid var(--border);border-radius:18px;background:linear-gradient(135deg,var(--bg-card),var(--bg-hover));min-height:190px;display:grid;place-items:center;margin:30px 0 42px;color:var(--accent);font-weight:900;font-size:28px;letter-spacing:.08em}
    article{font-size:17px;word-break:keep-all} h2{font-size:24px;color:var(--text-primary);margin:44px 0 16px;padding-bottom:10px;border-bottom:2px solid var(--border)} p{margin:0 0 20px}
    ul{margin:14px 0 24px;padding-left:22px} li{margin:8px 0}
    .note,.tool-card,.sources,.faq{border:1px solid var(--border);border-radius:16px;background:var(--bg-card);padding:22px;margin:34px 0}
    .note strong{color:var(--text-primary)}
    .tool-card{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center}
    .tool-card h2{border:0;margin:0 0 8px;padding:0;font-size:22px}.tool-card p{margin:0;color:var(--text-muted)}
    .tool-card a{display:inline-flex;align-items:center;justify-content:center;background:var(--accent);color:var(--text-on-accent);text-decoration:none;font-weight:900;border-radius:12px;padding:14px 18px;min-height:48px;white-space:nowrap}
    details{border-top:1px solid var(--border);padding:14px 0} details:first-child{border-top:0} summary{cursor:pointer;color:var(--text-primary);font-weight:800}
    .related{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.related a{border:1px solid var(--border);border-radius:999px;padding:9px 13px;color:var(--text-primary);text-decoration:none;font-weight:800;background:var(--bg-card)}
    footer{border-top:1px solid var(--border);padding:34px 20px;text-align:center;color:var(--text-muted);font-size:14px}
    @media(max-width:640px){.tool-card{grid-template-columns:1fr}.tool-card a{width:100%}.hero-label{min-height:140px;font-size:22px}}
  </style>
</head>
<body>
<header>
  <div class="header-inner">
    <a href="/blog/" class="back-link">← 티모 매거진</a>
    <a href="/" class="brand-logo">티모집사 도구</a>
  </div>
</header>
<main>
  <div class="meta">
    <span class="tag">${escapeHtml(article.tag)}</span>
    <span>${escapeHtml(article.date)}</span>
    <span>티모집사 편집팀</span>
  </div>
  <h1>${escapeHtml(article.title)}</h1>
  <p class="summary">${escapeHtml(article.summary)}</p>
  <div class="hero-label">${escapeHtml(article.label)}</div>
  <article>
    <div class="note"><strong>먼저 확인하세요.</strong> 이 글은 ${escapeHtml(today)} 기준으로 정리한 생활 정보입니다. 건강·금융·부동산 관련 내용은 교육용 참고 자료이며, 실제 진단·계약·세무 처리는 전문가나 공식 기관 기준을 확인해야 합니다.</div>
    ${body}
    <h2>검색 의도에 맞게 쓰는 방법</h2>
    <p>이 글은 ${escapeHtml(intentText)}처럼 실제 사용자가 자주 찾는 질문을 기준으로 정리했습니다. 단순히 공식 하나만 외우기보다, 먼저 내 상황이 어떤 조건에 해당하는지 확인하고 그 조건에 맞는 입력값을 넣는 것이 중요합니다.</p>
    <p>${escapeHtml(tool.name)}를 사용할 때는 결과 숫자만 보지 말고 입력값, 기준일, 적용 대상, 제외해야 할 예외를 함께 확인하세요. 특히 기준이 바뀔 수 있는 주제는 글의 작성일과 도구 안의 안내 문구를 같이 보는 편이 안전합니다.</p>
    <p>계산 결과가 기대와 다르면 먼저 단위, 반올림 방식, 포함·제외 규칙을 점검하세요. 그래도 차이가 크다면 공식 출처나 기관 기준을 다시 확인하고, 오류가 의심되는 경우 <a href="/contact.html">정정 제보</a>로 알려주시면 검토 후 반영합니다.</p>
    <p>비슷한 주제를 여러 번 검색하고 있다면 결과를 한 번만 보고 끝내지 말고, 입력값을 바꿔가며 범위를 확인해 보세요. 최솟값과 최댓값, 일반적인 경우와 예외적인 경우를 함께 비교하면 도구 결과를 더 현실적으로 해석할 수 있습니다.</p>
    <h2>바로 써볼 수 있는 체크포인트</h2>
    ${renderList(article.examples)}
    <section class="tool-card">
      <div>
        <h2>${escapeHtml(tool.icon)} ${escapeHtml(tool.name)}</h2>
        <p>${escapeHtml(tool.desc)}. 위 내용을 내 숫자로 바로 확인할 수 있습니다.</p>
      </div>
      <a href="${escapeHtml(tool.url)}">도구 열기</a>
    </section>
    ${faqHtml ? `<section class="faq"><h2>자주 묻는 질문</h2>${faqHtml}</section>` : ''}
    <section class="sources"><h2>기준과 참고</h2>${sourceList}<p>계산식이 포함된 도구는 별도 검산 fixture로 회귀 검사를 진행합니다.</p></section>
    <nav class="related" aria-label="관련 링크">
      <a href="/blog/">블로그 홈</a>
      <a href="${escapeHtml(tool.url)}">${escapeHtml(tool.name)}</a>
      <a href="/about.html">운영 기준</a>
      <a href="/editorial-policy.html">편집정책</a>
      <a href="/contact.html">정정 제보</a>
      <a href="/privacy.html">개인정보처리방침</a>
    </nav>
  </article>
</main>
<footer>© 2026 티모집사. 광고와 도구 사용성을 분리해 운영합니다. <a href="/editorial-policy.html">편집정책</a> · <a href="/contact.html">문의</a></footer>
</body>
</html>
`;
}

function writeArticlePages() {
  for (const article of articles) {
    const dir = path.join(root, 'blog', article.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderArticle(article), 'utf8');
  }
}

function writeArticlesJson() {
  const generated = articles.map((article, idx) => {
    const tool = tools[article.tool];
    return {
      id: article.id,
      title: article.title,
      url: articleUrl(article.id),
      thumbnailLabel: article.label,
      tag: article.tag,
      category: article.category,
      summary: article.summary,
      author: '티모집사 편집팀',
      date: article.date,
      readMinutes: Math.max(4, Math.ceil(plainText(article).length / 520)),
      size: idx % 5 === 0 ? 'big' : (idx % 3 === 0 ? 'med' : 'sm'),
      relatedTool: tool.url,
      relatedToolName: tool.name,
      relatedToolIcon: tool.icon,
      sources: article.sources
    };
  });
  fs.writeFileSync(path.join(root, 'blog', 'data', 'articles.json'), JSON.stringify([...generated, ...existingArticles], null, 2), 'utf8');
}

function writeMappingJson() {
  const keywordToContent = {};
  for (const article of articles) {
    for (const keyword of article.keywords) {
      keywordToContent[keyword] = { article: article.id, tool: article.tool };
    }
  }
  keywordToContent['고양이 나이 계산'] = { article: 'cat-age-guide', tool: 'pet-age-calc' };
  keywordToContent['비만일까 원시주머니'] = { article: 'cat-bmi-guide', tool: 'pet-bmi-calc' };

  const mapping = {
    _comment: '검색 키워드를 글/도구로 연결하는 룰. 정확 매칭 우선, 없으면 contains fallback.',
    keyword_to_content: keywordToContent,
    contains_fallback: [
      { match: '사료', article: 'cat-food-amount-guide', tool: 'pet-food-calc' },
      { match: '츄르', article: 'cat-treat-calorie-guide', tool: 'pet-food-calc' },
      { match: '노묘', article: 'senior-cat-health-check', tool: 'pet-age-calc' },
      { match: '나이', article: 'cat-age-guide', tool: 'pet-age-calc' },
      { match: 'BCS', article: 'cat-bcs-home-checklist', tool: 'pet-bmi-calc' },
      { match: '비만', article: 'cat-bcs-home-checklist', tool: 'pet-bmi-calc' },
      { match: '영업일', article: 'business-day-count-guide', tool: 'biz-day-calc' },
      { match: '공휴일', article: 'korean-substitute-holiday-guide', tool: 'biz-day-calc' },
      { match: '부가세', article: 'vat-inclusive-exclusive-guide', tool: 'discount-calc' },
      { match: '할인', article: 'discount-percent-guide', tool: 'discount-calc' },
      { match: '대출', article: 'loan-interest-repayment-guide', tool: 'loan-calc' },
      { match: '중개', article: 'broker-fee-rent-guide', tool: 'broker-fee-calc' },
      { match: '디데이', article: 'date-dday-count-guide', tool: 'date-calc' },
      { match: '이미지', article: 'image-compress-webp-guide', tool: 'image-compress' },
      { match: '고양이', article: 'cat-age-guide', tool: 'pet-age-calc' }
    ],
    tools
  };
  fs.writeFileSync(path.join(root, 'blog', 'data', 'mapping.json'), JSON.stringify(mapping, null, 2), 'utf8');
}

function writeTrendsJson() {
  const keywords = [
    '고양이 사료 급여량', '츄르 권장량 하루', '고양이 BCS 측정법', '고양이 나이 계산', '영업일 계산',
    '대체공휴일 계산', '부가세 포함 계산', '월세 중개수수료 계산', '원리금균등 원금균등 차이', '이미지 용량 줄이기'
  ];
  const items = keywords.map((keyword, idx) => ({
    keyword,
    rank: idx + 1,
    previousRank: Math.min(idx + 2, 10),
    change: idx < 4 ? 'up' : 'flat',
    delta: idx < 4 ? 1 : 0,
    growth24h: idx < 4 ? `+${6 - idx}%` : '+1%',
    sparkline: Array.from({ length: 13 }, (_, n) => 20 + ((idx * 7 + n * 5) % 17))
  }));
  fs.writeFileSync(path.join(root, 'blog', 'data', 'trends.json'), JSON.stringify({
    last_updated: `${today}T09:00:00+09:00`,
    refresh_minutes: 1440,
    source: 'editorial_longtail_cluster_plan',
    items
  }, null, 2), 'utf8');
}

function updateSitemap() {
  const sitemapPath = path.join(root, 'sitemap.xml');
  const supportUrls = [
    'https://teemozipsa.github.io/contact.html',
    'https://teemozipsa.github.io/editorial-policy.html'
  ];
  const urls = [
    ...articles.map((article) => `https://teemozipsa.github.io${articleUrl(article.id)}`),
    ...existingArticles.map((article) => `https://teemozipsa.github.io${article.url}`)
  ];
  let xml = fs.readFileSync(sitemapPath, 'utf8');
  xml = xml.replace(/\n\s*<url><loc>https:\/\/teemozipsa\.github\.io\/(?:contact|editorial-policy)\.html<\/loc><changefreq>monthly<\/changefreq><priority>0\.4<\/priority><\/url>/g, '');
  xml = xml.replace(/\n\s*<url><loc>https:\/\/teemozipsa\.github\.io\/blog\/[^<]+?\/<\/loc><changefreq>monthly<\/changefreq><priority>0\.55<\/priority><\/url>/g, '');
  const supportBlock = supportUrls.map((url) => `  <url><loc>${url}</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>`).join('\n');
  const block = urls.map((url) => `  <url><loc>${url}</loc><changefreq>monthly</changefreq><priority>0.55</priority></url>`).join('\n');
  xml = xml.replace(/(\s*<url><loc>https:\/\/teemozipsa\.github\.io\/privacy\.html<\/loc><changefreq>monthly<\/changefreq><priority>0\.3<\/priority><\/url>)/, `$1\n${supportBlock}`);
  xml = xml.replace(/(\s*<url><loc>https:\/\/teemozipsa\.github\.io\/blog\/<\/loc><changefreq>weekly<\/changefreq><priority>0\.6<\/priority><\/url>)/, `$1\n${block}`);
  fs.writeFileSync(sitemapPath, xml, 'utf8');
}

writeArticlePages();
writeArticlesJson();
writeMappingJson();
writeTrendsJson();
updateSitemap();

console.log(`Generated ${articles.length} SEO articles and updated blog data.`);
