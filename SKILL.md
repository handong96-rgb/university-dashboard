---
name: univ-dashboard-builder
description: 대학 데이터 분석을 위한 웹 기반 BI 대시보드를 생성하고 리팩토링합니다. 주어진 데이터를 Python 등으로 전처리하고, Vanilla JS 기반 프론트엔드로 시각화할 때 사용하세요. 특히 기존 Power BI 대시보드의 시각적 재현에 집중합니다.
---

# University Dashboard Builder Skill

이 스킬은 KEDI(한국교육개발원) 공공데이터 및 대학정보공시(예: 4주기 대학기관평가인증 지표) 데이터를 활용하여 대학 맞춤형 웹 기반 BI 대시보드를 개발할 때 에이전트가 준수해야 할 가이드라인입니다.

## Core Philosophy

당신(AI)은 기존의 구축형 BI 툴을 대체하는 가볍고 빠른 웹 기반 대시보드를 구축하고 있습니다. **가장 중요한 원칙은 사용자가 기존 Power BI에서 사용하던 UI/UX 경험을 웹 환경에서도 그대로 유지하는 것입니다.** 사용자가 파워비아이 대시보드의 **캡처 사진을 제공하는 경우, 레이아웃, 차트의 종류, 지표 배치 등을 가급적 코드상에서 그대로 재현(Visual Migration)**하는 것을 최우선 목표로 삼아야 합니다. 다만 색상과 컴포넌트 스타일은 아래 정의된 **통일성 있는 디자인 시스템**을 따릅니다.

## 1. Tech Stack & File Structure Conventions

프로젝트는 다음의 정적(Static) 데이터 파이프라인 구조를 따릅니다. 절대 임의로 무거운 프론트엔드 프레임워크를 도입하지 마세요.

* **Data Pipeline (Python):** 
  * `extract_pdf.py`, `process_data.py` 등의 스크립트를 작성하여 원시 데이터(.xlsx, .pdf)를 읽고 정제(`pandas` 활용)합니다.
  * 정제된 최종 결과물은 프론트엔드가 소비하기 쉬운 형태의 **JSON 파일**(`dashboard_data.json` 등)로 저장합니다.
* **Frontend (Vanilla Web):**
  * `index.html` 등의 순수 HTML 마크업.
  * `style.css`를 통한 독립적인 스타일링.
  * `app.js` (Vanilla JavaScript)에서 `fetch()` API를 통해 JSON 데이터를 비동기로 불러와 DOM을 조작하고 차트를 렌더링합니다.

## 2. Visual Identity & Design System (Consistency Standard)

모든 대시보드는 다음의 시각적 요소를 공유하여 통일성을 유지해야 합니다.

* **Color Palette:**
  * **Primary:** `#1d4ed8` (HGU Blue)를 메인 포인트 컬러로 사용합니다.
  * **Status Colors:** 지표 성과에 따라 `Good(#3b82f6)`, `Mid(#9ca3af)`, `Warn(#f59e0b)`, `Poor(#ef4444)`를 적용합니다.
* **Component Styling:**
  * **KPI Cards:** 카드 상단에 상태를 나타내는 `4px` 컬러 바를 배치합니다.
  * **Chart Boxes:** `border-radius: 12px`와 매우 미세한 그림자(`box-shadow: 0 1px 3px rgba(0,0,0,0.05)`)를 통해 고급스러운 질감을 표현합니다.
  * **Typography:** `Pretendard` 또는 `Noto Sans KR`을 사용하여 가독성을 극대화합니다. 본문은 `14px`, 핵심 수치는 `28px` 이상의 볼드체를 사용합니다.

## 3. Data Logic & Calculation Standards

단순한 값 표기를 넘어, 통계적으로 정확하고 일관된 로직을 구현합니다.

* **Metadata-driven Formatting:** 각 지표의 특성(정수, 소수점 1~3자리 등)에 따라 `formatKpiValue` 함수를 통해 자릿수를 엄격히 제한합니다.
* **Directional Ranking Logic:** 지표의 성격(정/부)을 판별하여 '높을수록 좋은 지표'와 '낮을수록 좋은 지표'의 순위 및 백분위 계산 로직을 분리 적용합니다.
* **Dynamic Benchmarking:** 현재 사용자가 선택한 필터(권역, 설립구분, 규모 등) 내에서의 상대적 위치(상위 % 등)를 동적으로 계산하여 제시합니다.

## 4. Execution Steps for the Agent

새로운 기능을 개발하거나 코드를 수정할 때 다음 순서를 따르세요:

1. **Analyze Input (입력 분석):** 
  * 사용자의 요구사항과 함께 **제공된 파워비아이 캡처 사진이 있다면, 이를 정밀하게 분석**하세요. 
  * 분석 내용: 사용된 차트 유형(Bar, Line, Pie 등), 필터(슬라이서)의 위치, KPI 카드의 배치.
2. **Python Scripting:** 원시 데이터를 처리해야 한다면, 먼저 Python 코드를 작성하여 캡처 화면을 구성하는 데 필요한 JSON 데이터를 설계 및 생성하세요. 
3. **JSON Structuring:** 프론트엔드에서 파싱하기 가장 효율적인 형태로 JSON 스키마를 구성하세요.
4. **Vanilla JS Implementation:** `app.js`에 들어갈 자바스크립트 코드를 작성하세요. 캡처 사진과 동일한 시각적 효과를 내기 위한 DOM 구조와 차트 옵션을 설정합니다.
5. **HTML/CSS Integration:** 기존 `style.css` 컨벤션을 해치지 않으면서, 캡처 사진의 레이아웃과 **섹션 2의 디자인 시스템**을 정확히 결합하여 구현하세요.

## 5. Code Review Checklist

- [ ] **(마이그레이션 시) 생성된 코드의 결과물이 사용자가 제공한 파워비아이 캡처 사진의 레이아웃 및 디자인과 최대한 충실히 일치하는가?**
- [ ] **디자인 시스템 준수:** Primary 컬러(`#1d4ed8`)와 KPI 카드의 컬러 바 로직이 정확히 적용되었는가?
- [ ] **데이터 정확성:** 지표별 '정/부' 성격에 따른 랭킹 로직과 소수점 자릿수 포맷팅이 metadata 기반으로 동작하는가?
- [ ] Python 백엔드 코드가 데이터를 완벽한 JSON 형태로 구워내고 있는가?
- [ ] 프론트엔드 코드에 불필요한 프레임워크 종속성이 없는가? (Vanilla JS 유지)
- [ ] 총장/처장급을 위한 요약 뷰(Executive View)와 실무자를 위한 상세 탐색 뷰의 목적이 코드상에서 분리되었는가?
