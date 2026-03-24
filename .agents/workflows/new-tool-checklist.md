---
description: 티모집사 프로젝트에 새 도구를 추가할 때 반드시 따라야 할 품질 체크리스트. 새 도구를 만들거나 기존 도구를 개선할 때 자동으로 참조하세요.
---

# 새 도구 품질 체크리스트

새 웹 도구를 만들 때 아래 항목을 **자동으로 포함**해야 합니다.

## 1. 입력 내역 자동 저장 (Auto-Save)

텍스트 입력(textarea, input[type=text])이 있는 도구는 반드시 localStorage 자동 저장을 적용합니다.

```javascript
// 페이지 로드 시 복원
(function(){
  const saved = localStorage.getItem('도구키_필드명');
  if (saved) { document.getElementById('필드ID').value = saved; }
})();

// 입력 시 저장 (해당 도구의 메인 함수 안에)
try { localStorage.setItem('도구키_필드명', value); } catch(e) {}

// 초기화 시 삭제
try { localStorage.removeItem('도구키_필드명'); } catch(e) {}
```

**키 네이밍 규칙**: `도구폴더명_필드명` (예: `charCounter_text`, `speechTimer_text`, `promptGen_role`)

## 2. SEO 필수 메타 태그

모든 도구 페이지(index.html)에 반드시 포함:

- `<title>` — "도구명 — 티모집사" 형식
- `<meta name="description">` — 도구 설명 (60~120자)
- `<meta property="og:title/description/type/url/image">`
- `<link rel="canonical" href="...">`

## 3. 사이트맵 등록

새 도구를 추가하면 두 곳의 sitemap.xml에 URL을 추가합니다:
- `/sitemap.xml` (루트)
- `/special-chars/sitemap.xml` (하위)

## 4. 메인 포털에 카드 등록

`/index.html`의 `#toolsGrid`에 도구 카드를 추가합니다:
- `data-keywords` 속성에 검색 키워드 포함
- `data-category` 속성에 카테고리 지정 (calc/convert/date/utility)
