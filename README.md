<div align="center">

# 😺 티모집사 툴즈 — 직장인용 브라우저 업무 도구

**설치와 로그인 없이, 지금 하던 작은 업무를 바로 끝냅니다.**

[![Website](https://img.shields.io/badge/🌐_사이트_바로가기-teemozipsa.com-FF6B6B?style=for-the-badge)](https://teemozipsa.com)
[![검증된 도구](https://img.shields.io/badge/검증된_업무_도구-36개-6C5CE7?style=for-the-badge)](#-검증된-업무-도구)
[![PWA](https://img.shields.io/badge/PWA-방문_페이지_캐시-00C853?style=for-the-badge)](#-주요-기능)

</div>

---

## ✨ 소개

직장인이 문서, 파일, 일정, 계산과 마케팅 업무를 회원가입 없이 **브라우저에서 바로 처리**할 수 있는 웹 도구 모음입니다.

계산·텍스트·파일 변환은 가능한 한 **브라우저에서 로컬 처리**하며, 공인 IP 조회·응답 지연 측정이나 AI 모델처럼 네트워크가 필요한 기능은 페이지에서 범위와 최초 다운로드 크기를 안내합니다. PDF·QR 엔진, 배경 제거 AI 코드·모델과 사이트 글꼴은 고정 버전을 저장소에 포함해 핵심 도구가 제3자 CDN 장애 때문에 멈추지 않게 합니다.

> 🔒 **로컬 우선 설계** — 사용자 파일과 계산 입력은 원칙적으로 브라우저 안에서 처리합니다

<br>

## 🎯 주요 기능

- 🌓 **다크/라이트 모드** — 메인 포털에서 원클릭 테마 전환, 전체 사이트 일관 적용
- 📱 **PWA 지원** — 192px·maskable 아이콘, 원자적 앱 셸 설치, 방문 페이지와 버전 고정 도구 엔진의 분리 캐시 지원
- 💾 **선택적 자동 저장** — 일부 도구는 입력·설정·커스텀 문구 또는 생성 이력을 브라우저에 저장
- ⭐ **즐겨찾기** — 자주 쓰는 도구에 별표 또는 드래그로 즐겨찾기 등록
- 🔐 **로컬 우선 처리** — 계산·텍스트·파일 변환은 브라우저에서 처리하고 네트워크 기능은 별도 표시
- ✅ **도구 공개 게이트** — 신규 도구는 업무 카테고리 등록, 정적 안내, 처리 범위와 검증 기준을 갖춰야 검색 대상으로 승격
- ✅ **품질 검사** — `npm run verify`로 카탈로그·구조·보안 정책·수식·실제 페이지 회귀·SEO·접근성·Chromium/Firefox/WebKit·모바일 에뮬레이션을 게시 전에 로컬 검증

<br>

## 🛠️ 검증된 업무 도구

| 업무 흐름 | 공개 도구 |
|---|---|
| 문서·커뮤니케이션 | 특수문자, 글자 수, 빠른 답장, 발표시간, 한영 타자 복구, AI 프롬프트, 콘텐츠용 이모지 조합 |
| 파일·이미지·콘텐츠 | QR 코드, 이미지 압축, 이미지 포맷 변환, PDF, 배경 제거, 영상·오디오 제작 계산 |
| 일정·시간 | 날짜/D-Day, 영업일, 타임존, 타이머, 정밀 시계·웹 응답 확인 |
| 계산·비용 | 퍼센트, 시급 환산, 할인·부가세, 단위 변환, 빠른 계산기, 성장률 시나리오, 가중 평균 단가, SaaS 예산, GPA, 대출 상환 비교, 출장 유류비·택시비, 중개보수 상한 |
| 마케팅·웹 실무 | 비밀번호, Base64, UTM 링크, 공인 IP·접속 환경, 색상 코드 변환 |

저장소에는 기존 URL 보존을 위한 생활·오락·반려동물 도구 8개가 `noindex` 상태로 남아 있습니다. 직장인 업무 목적에 맞게 재설계되지 않는 한 홈페이지 카탈로그와 사이트맵에는 노출하지 않습니다.

<br>

## ➕ 새 도구를 추가하는 순서

1. `누가 / 어떤 업무에서 / 무엇을 끝내는 도구인지` 한 문장으로 정의합니다.
2. `special-chars/<tool>/index.html`을 만들고 검증 전에는 `noindex, follow`로 시작합니다.
3. 업무 흐름 카테고리(`writing`, `files`, `schedule`, `numbers`, `web`)와 검색어·설명을 설계하되, 검증 전 페이지는 홈페이지 카탈로그에 노출하지 않습니다.
4. 실제 입력 예시, 처리 방식, 지원 범위·예외, 파일·개인정보 흐름과 정정 경로를 정적 본문에 작성합니다.
5. 정상값·경계값·잘못된 입력, 키보드·모바일·브라우저 동작을 테스트합니다.
6. `npm run audit:tool-quality`와 `npm run verify`를 통과한 뒤에만 `noindex`를 제거하고 홈페이지 카탈로그와 두 사이트맵에 등록합니다.

공개 기준과 광고 원칙은 사이트의 [도구 제작·검증 기준](https://teemozipsa.com/tool-standards.html)에 사용자에게도 공개합니다. 기능 수가 아니라 검증을 통과한 업무 해결 범위가 누적되도록 하는 구조입니다.

<br>

## ✅ 로컬 검증과 배포 준비

사용자 정의 GitHub Actions 없이 로컬 검증을 통과한 정적 파일을 `main` 브랜치 루트에서 GitHub Pages로 게시합니다. 저장소에는 workflow를 두지 않으며, Pages의 내장 배포만 GitHub가 관리합니다.

공식 주소는 `https://teemozipsa.com`이며 저장소 루트의 `CNAME`과 Cloudflare DNS로 연결합니다. 루트 도메인과 `www` 레코드는 GitHub Pages 인증서 발급과 원본 확인이 가능하도록 DNS 전용으로 유지합니다.

루트와 `special-chars` 사이트맵에는 업무 목적, 정적 안내, 처리 범위와 검증 기준을 갖춘 공개 색인 페이지만 등록합니다. 실험 중이거나 설명이 겹치는 도구는 `noindex` 상태로 유지합니다. Google Search Console과 네이버 서치어드바이저의 속성 등록·소유권 확인·사이트맵 제출은 외부 관리자 계정에서 수동으로 관리합니다.

AdSense 사이트 소유권은 루트 페이지의 `google-adsense-account` 메타태그와 `ads.txt`로 확인합니다. 도구 링크 중심의 포털·404·`noindex` 페이지에는 광고 로더를 두지 않으며, 승인 후에도 충분한 자체 안내가 있는 검증된 도구·가이드 페이지에서만 입력과 결과를 방해하지 않게 적용합니다.

최초 한 번 의존성과 로컬 브라우저 엔진을 준비합니다.

```powershell
npm ci
npx playwright install chromium firefox webkit
```

코드 변경을 검증할 때는 다음 한 명령을 실행합니다.

```powershell
npm run verify
```

이 명령은 직장인 도구 카탈로그와 검색 공개 게이트, 구조·외부 실행 의존성·CSP 규칙, 계산식 오라클과 실제 페이지 회귀, SEO 색인, 핵심 사용자 조작, 80개 도구 페이지의 라이트·다크 초기·탭 상태 WCAG 2.1 A/AA 및 자동화 가능한 모범 사례, 전체 정적 페이지 Chromium 렌더링, Chromium·Firefox·WebKit 데스크톱과 Pixel 7·iPhone 15 에뮬레이션의 전체 도구·색인 페이지 렌더링, 모바일 터치 타깃과 Git diff 오류를 순서대로 검사합니다. 자동화 검사는 실제 스크린 리더·물리 모바일·OS 백그라운드 동작을 대체하지 않습니다. 빠른 카탈로그 검사는 `npm run audit:tool-quality`, 핵심 조작 회귀검사는 `npm run audit:interactions`, 자동 접근성 검사는 `npm run audit:accessibility`, 5개 환경 호환성 검사는 `npm run audit:browsers`로 따로 실행할 수 있습니다.

약 85MB로 고정된 전체 AI 모델·WASM 구성 중 Chromium·Firefox가 각각 약 56.9MB를 실제로 읽는 배경 제거 추론은 일반 검증의 실행 시간과 메모리 사용을 늘리므로 선택 검사로 분리했습니다. 배경 제거 번들·모델·CSP를 바꾼 뒤에는 `npm run audit:background-inference`를 실행해 두 엔진 모두에서 64×64 PNG의 실제 추론 결과와 제3자 요청 부재를 확인합니다.

모바일 프로필은 뷰포트·터치·브라우저 엔진 에뮬레이션입니다. 물리 기기의 OS 통합 동작과 Windows Playwright WebKit이 제공하지 않는 Safari/iOS Web Audio는 실제 Apple 기기에서 별도로 확인해야 합니다. Windows Playwright WebKit에서는 브라우저 매트릭스의 전체 페이지 렌더링과 대표 상호작용은 통과하지만 배경 제거 실추론이 8분 동안 모델 로딩 단계를 벗어나지 않아 필수 추론 검사에 포함하지 않았으며, 이 경로도 실제 Apple 기기의 Safari에서 확인해야 합니다. Chromium과 Firefox에서는 메트로놈 AudioWorklet의 누적 프레임 간격·정지·재시작을 검증합니다.

PDF·QR·배경 제거·글꼴 구성요소의 정확한 버전·크기·무결성·라이선스·출처는 [`special-chars/vendor/README.md`](special-chars/vendor/README.md)에 기록합니다. 배경 제거 도구의 첫 진입과 최초 처리에는 이 사이트에서 JS 번들·양자화 모델·실행 환경에 맞는 WASM 합계 약 56.9MB를 받으며, 브라우저 저장 공간 정리나 축출 시 다시 받아야 합니다. `@imgly/background-removal`의 AGPL-3.0 고지, 대응 소스맵과 제3자 라이선스는 배포물에서 제거하면 안 됩니다.

게시 전 외부 라이브러리 보안 확인을 포함한 전체 릴리스 검사를 실행합니다.

```powershell
npm run release:check
```

이 명령은 커밋·푸시·원격 CI를 실행하지 않습니다. 도구 주제는 검색 제안 자동 수집이 아니라 실제 업무 문제와 사용자 제보를 기준으로 선정합니다.

<br>

## 🏗️ 기술 스택

<div align="center">

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-222222?style=for-the-badge&logo=githubpages&logoColor=white)

</div>

<br>

## 📜 라이선스

이 저장소에서 직접 작성한 코드는 [MIT License](LICENSE)를 따릅니다. `special-chars/vendor/`에 포함된 제3자 코드·모델·글꼴은 각 디렉터리의 원본 라이선스와 [`special-chars/vendor/README.md`](special-chars/vendor/README.md)가 우선하며, 여기에는 AGPL-3.0·Apache-2.0·OFL-1.1 구성요소가 포함됩니다.

---

<div align="center">

**[티모집사](https://www.instagram.com/seon_7yu/)가 만들었습니다**

[🌐 사이트 바로가기](https://teemozipsa.com) · [☕ 후원하기](https://ctee.kr/place/teemozipsa/post/2)

</div>
