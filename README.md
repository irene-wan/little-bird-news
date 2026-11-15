# 개인화 뉴스 서비스

> 뉴스를 읽을 힘도 없는 현생에 지친 20대에게, 나를 아는 작은 새가 나에게 딱 알맞은 소식을 골라 프리미엄으로 전달한다.

비엔지니어 창업자가 AI(Claude)와 함께 **기획 → 기술 검증 → 설계 → 동작하는 데모**까지 밟아 온 과정을 그대로 담은 저장소다.

## 바로 써 보기

- **데모**: https://little-bird-news.vercel.app
- 프로필을 몇 줄 적으면(예시 버튼으로 채워도 된다) 20초쯤 뒤에 오늘의 소식 세 편이 온다.
- 데모의 구조와 코드 설명: [`demo/README.md`](demo/README.md)

## 세 가지 핵심 가치

| 가치 | 뜻 |
| --- | --- |
| Personal Relevance | 나와 관련된 소식을 **근거 있게** 발견한다 |
| Meaningful Understanding | 깊은 이해와 흥미, 지적 만족을 얻는다 |
| Emotional Experience | 새와 함께하는 경험에서 즐거움과 정서적 만족을 느낀다 |

## 이 저장소에 있는 것

| 단계 | 문서·코드 |
| --- | --- |
| 제품 정의 | [`docs/product/product-brief.md`](docs/product/product-brief.md), [`docs/product/product-principles.md`](docs/product/product-principles.md) |
| 가설과 검증 계획 | [`docs/research/assumption-register.md`](docs/research/assumption-register.md) |
| 요구사항 | [`docs/product/prd/personal-mvp.md`](docs/product/prd/personal-mvp.md) |
| 결정 기록 | [`docs/architecture/decision-log.md`](docs/architecture/decision-log.md) |
| 기술 검증 (Spike) | [`docs/architecture/technical-discovery.md`](docs/architecture/technical-discovery.md), [`docs/research/spikes/`](docs/research/spikes/), 코드는 [`spikes/`](spikes/) |
| 기술 설계 초안 | [`docs/architecture/technical-design.md`](docs/architecture/technical-design.md) |
| 동작하는 데모 | [`demo/`](demo/) |
| AI와 일하는 규칙 | [`CLAUDE.md`](CLAUDE.md) |

## 만든 방식에서 눈여겨볼 점

- **사실 목록이 뼈대다.** AI가 기사에서 뽑은 사실은 근거 인용이 원문에 글자 그대로 있을 때만 남기고, 본문의 사실 문장은 모두 그 사실에 묶여 독립 검증과 숫자 대조를 거친다.
- **고르는 일은 규칙이 한다.** AI는 "프로필의 어느 문장 ↔ 소식의 어느 사실"이라는 연결고리를 내고, 선정은 코드가 한다. 모든 후보의 선정·제외 이유가 남는다.
- **화면은 틀이, AI는 빈칸만.** 조작형 설명은 AI가 스펙만 만들고 검증기를 통과해야 그려진다. 통과하지 못하면 요약 카드로 대신한다.
- **가벼운 모델로.** 하루치 준비에 약 1달러, 독자 한 명의 소식을 고르는 데 수십 원.

이 저장소에는 실제 개인 프로필, API 키, 기사 본문이 들어 있지 않다.
