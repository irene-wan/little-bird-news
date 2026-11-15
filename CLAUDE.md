# 개인화 뉴스 서비스

> 뉴스를 읽을 힘도 없는 현생에 지친 20대에게, 나를 아는 작은 새가 나에게 딱 알맞은 소식을 골라 프리미엄으로 전달한다.
> — Product Brief v1.0, 1. One-liner

이 파일은 이 저장소에서 일하는 사람과 AI가 따르는 작업 지침이다. 제품의 내용은 아래 공식 문서가 기준이며, 이 파일은 그 문서를 대체하지 않는다. 이 파일과 공식 문서가 다르면 공식 문서가 우선한다.

## 현재 단계

- Project Bootstrap은 완료되었다.
- MVP PRD는 승인되었다 (`docs/product/prd/personal-mvp.md`).
- Technical Discovery와 1차 Technical Spike는 2026-11-15에 창업자 지시로 마감했다 (D-046). **이어받을 때는 `docs/architecture/technical-discovery.md` 0.3절부터 읽는다** (어디까지 했는지, 프로토타입을 다시 돌리는 법, 다음에 할 일).
- 다음 단계는 Technical Design 초안 작성이다 (`docs/architecture/technical-design.md`, 아직 없음).
- 기술 스택과 아키텍처는 **아직 확정되지 않았다** (Product Brief 13, Decision Log 3). 엔지니어가 고른 구조는 Proposed로 기록되어 있다 (D-047~D-051).
- 소식의 목표 수준은 창업자가 준 시안이다: `docs/research/references/target-edition-mockup.html`. 저비용의 경량 모델로 그 수준을 내는 것이 목표다 (D-045).
- 창업자는 엔지니어가 아니다. 구조와 기술은 엔지니어(AI)가 골라 진행하고 쉬운 말로 알린다 (D-043). 정책과 불확실성 정리보다 핵심 가치를 담은 동작하는 결과물이 먼저다 (D-040).
- 제품 구현은 승인된 기능 명세에 따라 진행한다. 승인된 Technical Spike만 예외다 (아래 「Technical Spike 예외」).

## 핵심 가치 (비협상)

Product Principles v1.0 「2. 비협상 가치」 원문이다.

- Personal Relevance: 나와 관련된 소식을 근거 있게 발견한다.
- Meaningful Understanding: 깊은 이해와 흥미, 지적 만족을 얻는다.
- Emotional Experience: 새와 함께하는 경험에서 즐거움과 정서적 만족을 느낀다.

첫 개인용 MVP는 세 가치 모두를 구현하고 검증한다. 한두 가지만 달성한 상태는 전체 성공이 아니다.

## 공식 문서 경로

| 문서 | 경로 | 버전·상태 | 용도 |
| --- | --- | --- | --- |
| Product Brief | `docs/product/product-brief.md` | v1.0 · Approved | 제품 정의, MVP 범위(CORE A–F), 완료 정의, Open Decisions |
| Product Principles | `docs/product/product-principles.md` | v1.1 · Approved | 비협상 가치, 제품 원칙 P-01–P-17, 변경 관리 원칙 |
| Assumption Register | `docs/research/assumption-register.md` | v1.0 · Approved | 가설 H-01–H-16, Feasibility Gate F-01–F-07, 검증 프로토콜 |
| Decision Log | `docs/architecture/decision-log.md` | v1.3 · Approved (D-040–D-051의 문구는 창업자 확인 전) | 결정 D-000–D-051과 상태, 승인·변경 규칙 |
| MVP PRD | `docs/product/prd/personal-mvp.md` | v1.1 · Approved | 최초 개인용 MVP의 사용자 흐름, 기능·비기능 요구사항, 세 가치의 인수 조건, 필수·제외 경계, 기술 설계 미결정 사항 |

### 문서 우선순위

원본의 보존과 최신 승인본의 우선순위는 서로 다른 문제다. 혼동하지 않는다. 보존은 `imports/`가 맡고, 개발 기준은 `docs/`가 맡는다.

- **개발의 공식 기준은 `docs/`에 있는 최신 Approved Markdown 문서다.**
- `imports/`의 DOCX는 최초 승인본(v1.0)의 보관용 스냅샷이다. 수정·삭제·이름 변경을 하지 않고, 개발 기준으로 쓰지 않는다.
- 이후 승인된 변경으로 Markdown이 스냅샷과 달라지는 것은 정상이다. 이때 `docs/`의 최신 Approved 문서를 따르고, 스냅샷은 고치지 않는다.
- 창업자가 Google Docs에서 수정한 내용은 창업자가 승인한 뒤에 Markdown에 반영한다. 승인 전의 수정본은 기준이 아니다.
- 아직 승인되지 않은 Draft 문서는 기존 Approved 문서를 대체하지 않는다. 새 버전이 Approved가 될 때까지 기존 Approved 버전이 기준이다.
- 승인된 문서의 변경은 Git 이력과 Decision Log에서 추적할 수 있어야 한다.
- 각 Markdown 파일 front matter의 `source`와 `source_sha256`은 최초 변환에 사용한 스냅샷을 가리키는 출처 기록이다. 우선순위를 뜻하지 않는다.

### Vision Document

뉴스 서비스 기획서 v3(Decision Log D-000의 원본 Vision Document)는 창업자가 별도로 보관 중이며, 현재 이 프로젝트 폴더에는 없다. 창업자가 제공하면 원본 보존 여부와 저장 위치를 그때 정한다. 그 전에는 내용을 재작성하거나 대신 생성하지 않는다.

## 용어

- 프로젝트명은 '개인화 뉴스 서비스'로 표기한다 (D-001).
- 뉴스 콘텐츠는 일관되게 '소식'이라 부른다 (D-001).
- 문서 안의 ID(P-xx, H-xx, F-xx, D-xxx)는 바꾸지 않고, 새 문서에서 근거를 댈 때 이 ID로 인용한다.

## 작업 원칙

1. **공식 문서가 기준이다.** 작업을 시작하기 전에 관련 공식 문서를 읽는다. 요청이 승인된 문서와 충돌하면 진행을 멈추고 어느 항목과 충돌하는지 보고한다.
2. **승인된 의미를 바꾸지 않는다.** 승인된 문서를 인용·요약·변환할 때 의미를 수정하거나 축약하지 않는다. 문서에 없는 내용을 추정으로 채우지 않고, 빈 곳은 질문한다.
3. **미결정 사항을 임의로 확정하지 않는다.** Product Brief 13의 Open Decisions와 Decision Log의 Pending / Validation Required / Deferred 항목은 창업자가 결정한다. AI의 기술 선택 제안은 자동 확정되지 않는다 (Decision Log 5). 제안은 Proposed로 표시한다.
4. **정해진 순서로 개발한다.** 기능별 Spec → Plan → Task → Implement → Test → Review (Product Brief 14). 앞 단계 문서가 승인되기 전에 다음 단계로 넘어가지 않는다. 승인된 Technical Spike만 예외다 (아래 「Technical Spike 예외」).
5. **범위를 지킨다.** 최초 MVP는 창업자 한 명을 위한 개인용 제품이다 (D-002). 제외 범위(Product Brief 9.8, D-009)를 구현하지 않는다. 단, 출처 확인·기본 보안·오류 처리·데이터 보호·품질 검증은 필수다.
6. **완료는 검증으로 판단한다.** AI의 완료 보고만으로 기능을 합격시키지 않는다 (P-12). 무엇을 실제로 확인했고 무엇을 확인하지 못했는지 구분해 보고한다.
7. **승인된 범위 안에서 작업하고, 끝나면 보고한다.** 자세한 기준은 아래 「파일 변경 승인 정책」을 따른다.

## 파일 변경 승인 정책

- 승인된 Task 또는 Technical Spike 범위 안에서는 필요한 파일을 생성·수정할 수 있다.
- 작업 종료 후 변경사항과 테스트 결과를 보고한다.
- 다음은 별도 승인이 필요하다.
  - 범위 밖의 기능 추가
  - 핵심 아키텍처 변경
  - Approved 문서 수정
  - 파일 대량 삭제
  - 운영 데이터 변경
- Git 커밋과 원격 푸시는 창업자의 승인을 받는다.

## Technical Spike 예외

승인된 기술 검증 작업(Technical Spike, Product Brief 14)에 한해서는 정식 Spec/Plan/Tasks 전체를 작성하기 전에도 격리된 실험 코드를 작성할 수 있다. 조건은 다음과 같다.

- 실험 목적, 범위, 검증 기준을 사전에 명확히 한다.
- 실제 제품 코드와 분리된 환경에서 작업한다.
- 실험 결과와 관찰한 한계를 `docs/research/spikes/`에 기록한다.
- 실험 결과가 기술 선택을 자동으로 확정하지 않는다 (Decision Log 5).
- 제품 코드에 통합하려면 정식 개발 절차(Spec → Plan → Task → Implement → Test → Review)를 따른다.

## 문서 승인 규칙

- **승인권자는 창업자다.** 문서는 창업자가 명시적으로 승인한다고 말했을 때만 Approved가 된다. AI는 Draft 작성과 제안까지만 한다.
- **문서 상태**는 front matter `status`에 적는다.
  - `Draft`: 작성 중. 개발 기준으로 쓰지 않으며, 기존 Approved 문서를 대체하지 않는다.
  - `In Review`: 창업자 검토 요청 상태.
  - `Approved`: 창업자 승인 완료. 개발 기준이다.
  - `Superseded`: 새 버전이나 새 문서로 대체됨. 지우지 않고 남긴다.
- **Approved 문서는 창업자 승인 없이 수정하지 않는다.** 오탈자·서식 수정도 먼저 변경안을 보여준다. 승인되면 `version`을 올리고 변경 날짜를 기록한다.
- **Google Docs 수정본의 반영 순서**: 창업자가 수정 → 창업자가 승인 → `docs/`의 Markdown에 반영 → 반영 결과를 수정본과 대조 → 커밋. 승인 전에는 Markdown을 바꾸지 않는다.
- **승인된 문서의 변경은 추적 가능해야 한다.** 변경은 Git 커밋으로 남기고, 커밋 메시지에 문서명·버전과 관련 결정 ID를 적는다. 변경의 근거는 Decision Log에 기록한다 (Product Principles 5). 결정마다 ID, 날짜, 책임자, 선택지, 근거, 승인 상태, 영향을 받는 문서를 기록한다. 확정된 결정을 바꾸면 이전 결정을 Superseded로 남기고 새 이유와 검증 근거를 기록한다 (Decision Log 5).
- **결정 상태값**은 Decision Log 1의 정의를 그대로 쓴다: Confirmed / Proposed / Pending / Validation Required / Deferred / Superseded.
- **가설 상태값**은 Assumption Register 1의 정의를 그대로 쓴다: Unvalidated / Testing / Supported / Contradicted / Inconclusive / Revised. 구현했다는 이유만으로 Supported로 바꾸지 않는다 (Assumption Register 8).
- 새 문서의 front matter 필수 항목: `title`, `version`, `status`, `date`. 승인되면 `approved_date`를 추가한다.

## 문서 저장 규칙

파일명은 영문 소문자 kebab-case, 확장자는 `.md`다. 버전은 파일명이 아니라 front matter에 적고, 변경 이력은 Git으로 관리한다. 아래 경로의 파일은 해당 작업을 시작할 때 만든다. 미리 빈 문서를 만들어 두지 않는다.

| 종류 | 경로 | 규칙 |
| --- | --- | --- |
| PRD | `docs/product/prd/<주제>.md` | PRD 하나당 파일 하나. 근거가 되는 Product Brief 항목과 P/H/D ID를 인용한다. |
| Evaluation Spec | `docs/research/evaluation-spec.md` | 개인용 MVP 정량 합격 기준. 평가 시작 전에 확정한다 (D-018). |
| Technical Spike 결과 | `docs/research/spikes/<주제>.md` | 실험 목적·범위·검증 기준, 결과, 관찰한 한계를 기록한다. 검증한 Feasibility Gate(F-xx)와 관련 결정(D-xxx)을 적는다. |
| Technical Discovery | `docs/architecture/technical-discovery.md` | 기술적 불확실성, 아키텍처 대안, 필요한 Technical Spike와 진행 순서. Technical Design의 입력이다. |
| Technical Spike 코드 | `spikes/<주제>/` | 제품 코드와 분리된 실험 코드. 제품 코드에서 가져다 쓰지 않는다. |
| 참고 자료 | `docs/research/references/` | 창업자가 준 목표 시안 같은 참고물. 실제 프로필에서 나온 문장은 가리고 넣는다. 원본은 `private/references/`에 둔다. |
| Technical Design | `docs/architecture/technical-design.md` | 전체 기술 설계. 주제별 상세 설계는 `docs/architecture/<주제>.md`. |
| 결정 기록 | `docs/architecture/decision-log.md` | 결정은 이 문서 한 곳에만 등록한다. ID는 마지막으로 등록된 번호 다음부터 이어 쓴다 (2026-11-15 기준 마지막은 D-051). |
| 기능별 Spec / Plan / Tasks | `specs/<NNN>-<기능명>/` | 아래 참조. |

### specs/ 규칙

```
specs/
└── <NNN>-<기능명>/     예: 001-<기능명>
    ├── spec.md         무엇을, 왜. 수용 기준 포함
    ├── plan.md         어떻게. 기술 계획
    └── tasks.md        작업 목록
```

- `<NNN>`은 001부터 만든 순서대로 붙이는 세 자리 번호다. 번호는 재사용하지 않는다.
- 기능 하나당 폴더 하나, 폴더 안에는 `spec.md`, `plan.md`, `tasks.md` 세 파일을 둔다.
- 작성 순서는 spec → plan → tasks다. `spec.md`가 Approved가 된 뒤 `plan.md`를 쓰고, `plan.md`가 Approved가 된 뒤 `tasks.md`를 쓴다. `tasks.md`가 Approved가 된 뒤 구현한다.
- 각 문서는 근거가 되는 PRD와 공식 문서 ID를 인용한다. 근거가 없는 요구사항은 추가하지 않는다.
- 기술 선택이 필요한 내용은 Decision Log에서 해당 결정이 Confirmed가 된 뒤에 `plan.md`에 확정 사항으로 적는다.

## 보안·개인정보

- 실제 개인정보(창업자의 실제 프로필, 연락처, 건강·재정 등 민감정보)와 API 키·토큰·비밀번호를 Git에 넣지 않는다.
- 비밀값은 `.gitignore`로 제외된 로컬 파일(`.env` 등)에만 둔다. `.env.example`처럼 비밀값이 없는 예시 파일만 추적하고, 문서와 예시에는 가짜 값을 쓴다.
- 개인 프로필 실데이터는 `.gitignore`로 제외된 `private/` 디렉터리에만 둔다. 실제 저장 방식은 기술 설계에서 정한다 (D-011, F-07).
- 이 저장소는 비공개로 운영한다. 공개로 전환하기 전에 `imports/` 원본과 Git 이력 전체를 다시 점검한다.
- 커밋 전에 스테이징된 파일에 개인정보나 비밀값이 없는지 확인한다.
- 뉴스 데이터는 수집·저장·AI 처리·재가공·서비스 제공 권한을 구분해 확인한 뒤 사용한다 (P-11, F-01).
