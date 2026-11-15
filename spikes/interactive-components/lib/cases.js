// S5a Spike — 고정 기술 테스트 사례 (D-024).
// 모든 내용은 실험용으로 지어낸 가짜다. 실제 보도, 실제 정책, 실제 수치가 아니다.
// 사실 목록(facts)과 스펙(spec)은 사람이 손으로 썼다. AI가 스펙을 만드는 것은 S5b에서 다룬다.
(function (g) {
  const SOURCE = { label: "가상 보도 (실험용으로 지어낸 내용)", asOf: "2026-11-10" };
  const fact = (id, v) => ({ v, fact: id });
  const assumed = (v, note) => ({ v, assumed: true, note });

  g.S5A_CASES = [
    {
      id: "cmp-rent",
      type: "comparison",
      topic: "주거",
      headline: "청년 월세 지원, 두 가지 개편안이 나왔다",
      paragraphs: [
        "가상의 '한울시'가 청년 월세 지원 제도를 고치기로 하고 두 가지 안을 내놓았다. A안은 한 달에 받는 돈을 늘리는 쪽이고, B안은 받는 기간을 늘리는 쪽이다.",
        "어느 안이 유리한지는 한 달 금액만 봐서는 알기 어렵다. 받는 기간까지 곱해 봐야 전체로 얼마를 받는지가 나온다.",
      ],
      after: "시는 다음 달 공청회를 열어 두 안 가운데 하나를 고를 계획이다.",
      facts: [
        { id: "F1", text: "현행 제도의 월 지원액은 20만 원이다", value: 20, unit: "만 원" },
        { id: "F2", text: "현행 제도의 지원 기간은 12개월이다", value: 12, unit: "개월" },
        { id: "F3", text: "A안의 월 지원액은 30만 원이다", value: 30, unit: "만 원" },
        { id: "F4", text: "A안의 지원 기간은 12개월이다", value: 12, unit: "개월" },
        { id: "F5", text: "B안의 월 지원액은 25만 원이다", value: 25, unit: "만 원" },
        { id: "F6", text: "B안의 지원 기간은 24개월이다", value: 24, unit: "개월" },
      ],
      source: SOURCE,
      spec: {
        title: "어느 안이 얼마나 다른가",
        guide: "안을 바꿔 보세요. 한 달 금액, 기간, 다 합친 금액이 지금 제도와 얼마나 다른지 보입니다.",
        baseline: "now",
        options: [
          { key: "now", label: "현행" },
          { key: "a", label: "A안" },
          { key: "b", label: "B안" },
        ],
        metrics: [
          { key: "amount", label: "한 달 지원액", unit: "만 원", values: { now: fact("F1", 20), a: fact("F3", 30), b: fact("F5", 25) } },
          { key: "months", label: "지원 기간", unit: "개월", values: { now: fact("F2", 12), a: fact("F4", 12), b: fact("F6", 24) } },
          { key: "total", label: "다 합친 지원액", unit: "만 원", derived: "amount * months" },
        ],
        checks: [
          { metric: "total", option: "now", expect: 240 },
          { metric: "total", option: "a", expect: 360 },
          { metric: "total", option: "b", expect: 600 },
        ],
      },
    },
    {
      id: "cmp-commute",
      type: "comparison",
      topic: "교통",
      headline: "출퇴근 수단을 바꾸면 한 달이 어떻게 달라질까",
      paragraphs: [
        "가상의 '한울시 교통연구소'가 시내 10km 구간을 출퇴근하는 사람을 기준으로 수단별 비용과 시간, 탄소 배출을 계산해 발표했다.",
        "자가용이 가장 빠르지만 돈이 가장 많이 든다. 지하철과 자전거를 함께 쓰면 버스보다 조금 빠르고 탄소 배출은 가장 적다.",
      ],
      after: "연구소는 내년부터 이 계산을 해마다 내놓겠다고 밝혔다.",
      facts: [
        { id: "F1", text: "자가용 출퇴근의 한 달 비용은 32만 원이다", value: 32, unit: "만 원" },
        { id: "F2", text: "버스 출퇴근의 한 달 비용은 7만 원이다", value: 7, unit: "만 원" },
        { id: "F3", text: "지하철과 자전거를 함께 쓰는 출퇴근의 한 달 비용은 6만 원이다", value: 6, unit: "만 원" },
        { id: "F4", text: "자가용의 편도 시간은 35분이다", value: 35, unit: "분" },
        { id: "F5", text: "버스의 편도 시간은 50분이다", value: 50, unit: "분" },
        { id: "F6", text: "지하철과 자전거의 편도 시간은 45분이다", value: 45, unit: "분" },
        { id: "F7", text: "자가용의 한 달 탄소 배출은 96kg이다", value: 96, unit: "kg" },
        { id: "F8", text: "버스의 한 달 탄소 배출은 31kg이다", value: 31, unit: "kg" },
        { id: "F9", text: "지하철과 자전거의 한 달 탄소 배출은 12kg이다", value: 12, unit: "kg" },
      ],
      source: SOURCE,
      spec: {
        title: "자가용 대신 탄다면",
        guide: "수단을 바꿔 보세요. 자가용과 견줘 돈, 시간, 탄소가 얼마나 달라지는지 보입니다.",
        baseline: "car",
        options: [
          { key: "car", label: "자가용" },
          { key: "bus", label: "버스" },
          { key: "metro", label: "지하철+자전거" },
        ],
        metrics: [
          { key: "cost", label: "한 달 비용", unit: "만 원", values: { car: fact("F1", 32), bus: fact("F2", 7), metro: fact("F3", 6) } },
          { key: "time", label: "편도 시간", unit: "분", values: { car: fact("F4", 35), bus: fact("F5", 50), metro: fact("F6", 45) } },
          { key: "carbon", label: "한 달 탄소 배출", unit: "kg", values: { car: fact("F7", 96), bus: fact("F8", 31), metro: fact("F9", 12) } },
        ],
      },
    },
    {
      id: "sim-loan",
      type: "simulation",
      topic: "금융",
      headline: "대출 금리가 0.5%p 올랐다. 내 이자는 얼마나 늘까",
      paragraphs: [
        "가상의 '한울은행'이 변동금리 대출의 금리를 연 4.0%에서 연 4.5%로 올렸다. 숫자로는 작아 보여도 빌린 돈이 클수록 한 달에 내는 이자의 차이가 커진다.",
        "이자만 내는 대출이라면 계산은 단순하다. 빌린 돈에 금리를 곱하고 열두 달로 나누면 한 달 이자가 된다.",
      ],
      after: "은행은 다음 금리 조정 시점을 석 달 뒤로 예고했다.",
      facts: [
        { id: "F1", text: "인상 전 대출 금리는 연 4.0%다", value: 4.0, unit: "%" },
        { id: "F2", text: "인상 후 대출 금리는 연 4.5%다", value: 4.5, unit: "%" },
      ],
      source: SOURCE,
      spec: {
        title: "내 대출이라면 한 달 이자는",
        guide: "빌린 돈과 금리를 움직여 보세요. 한 달 이자가 인상 전보다 얼마나 늘어나는지 보입니다.",
        inputs: [
          { key: "principal", label: "빌린 돈", unit: "만 원", min: 1000, max: 30000, step: 500, default: assumed(10000, "설명을 위해 넣은 예시 금액") },
          {
            key: "rate", label: "금리", unit: "%", min: 2, max: 7, step: 0.25, default: fact("F2", 4.5),
            marks: [
              { label: "인상 전", value: fact("F1", 4.0) },
              { label: "인상 후", value: fact("F2", 4.5) },
            ],
          },
        ],
        outputs: [{ key: "monthly", label: "한 달 이자", unit: "만 원", formula: "principal * rate / 100 / 12", digits: 1 }],
        compare: { input: "rate", from: fact("F1", 4.0), label: "인상 전(연 4.0%)보다" },
        checks: [
          { inputs: { principal: 10000, rate: 4.5 }, output: "monthly", expect: 37.5 },
          { inputs: { principal: 10000, rate: 4.0 }, output: "monthly", expect: 33.3333333333 },
          { inputs: { principal: 24000, rate: 5.0 }, output: "monthly", expect: 100 },
        ],
      },
    },
    {
      id: "sim-wage",
      type: "simulation",
      topic: "노동",
      headline: "내년 최저 시급 인상안, 한 달 월급으로는 얼마일까",
      paragraphs: [
        "가상의 '한울시 생활임금위원회'가 내년 최저 시급을 10,500원에서 11,000원으로 올리는 안을 내놓았다.",
        "시급 500원 차이가 월급에서 얼마가 되는지는 일하는 시간에 달려 있다. 주 15시간 일하는 사람과 주 40시간 일하는 사람이 받는 차이는 같지 않다.",
      ],
      after: "위원회는 이달 말 최종안을 확정한다.",
      facts: [
        { id: "F1", text: "올해 최저 시급은 10,500원이다", value: 10500, unit: "원" },
        { id: "F2", text: "내년 최저 시급 인상안은 11,000원이다", value: 11000, unit: "원" },
      ],
      source: SOURCE,
      spec: {
        title: "내 근무 시간이라면 한 달에",
        guide: "일주일에 일하는 시간과 시급을 움직여 보세요. 한 달 급여가 올해보다 얼마나 늘어나는지 보입니다.",
        constants: [{ key: "weeks", label: "한 달을 4.345주로 계산했고 주휴수당은 뺐습니다", value: assumed(4.345, "계산을 단순하게 하려는 가정") }],
        inputs: [
          { key: "hours", label: "일주일 근무 시간", unit: "시간", min: 5, max: 52, step: 1, default: assumed(40, "설명을 위해 넣은 예시 시간") },
          {
            key: "hourly", label: "시급", unit: "원", min: 10000, max: 12000, step: 100, default: fact("F2", 11000),
            marks: [
              { label: "올해", value: fact("F1", 10500) },
              { label: "내년 안", value: fact("F2", 11000) },
            ],
          },
        ],
        outputs: [{ key: "pay", label: "한 달 급여", unit: "만 원", formula: "hourly * hours * weeks / 10000", digits: 1 }],
        compare: { input: "hourly", from: fact("F1", 10500), label: "올해 시급(10,500원)보다" },
        checks: [
          { inputs: { hours: 40, hourly: 11000 }, output: "pay", expect: 191.18 },
          { inputs: { hours: 40, hourly: 10500 }, output: "pay", expect: 182.49 },
          { inputs: { hours: 15, hourly: 11000 }, output: "pay", expect: 71.6925 },
        ],
      },
    },
    {
      id: "proc-bill",
      type: "process",
      topic: "제도",
      headline: "'배달 노동자 보호법', 지금 어디까지 왔나",
      paragraphs: [
        "가상의 '배달 노동자 보호법'이 국회 상임위원회를 통과했다. 통과했다는 소식만 들으면 곧 시행될 것 같지만, 법이 실제로 효력을 가지려면 아직 세 단계가 남았다.",
      ],
      after: "본회의에서 부결되면 법안은 폐기되고 처음부터 다시 시작해야 한다.",
      facts: [
        { id: "F1", text: "법안은 9월 2일에 발의되었다" },
        { id: "F2", text: "법안은 10월 21일에 상임위원회를 통과했다" },
        { id: "F3", text: "본회의 표결은 11월 20일로 예정되어 있다" },
        { id: "F4", text: "법은 공포한 날부터 6개월 뒤에 시행된다", value: 6, unit: "개월" },
      ],
      source: SOURCE,
      spec: {
        title: "법안이 시행되기까지",
        guide: "단계를 하나씩 넘겨 보세요. 지금 어느 단계이고 무엇이 남았는지 보입니다.",
        current: 2,
        steps: [
          { title: "발의", body: "국회의원이 법안을 내놓는다. 이 법안은 9월 2일에 발의되었다.", facts: ["F1"] },
          { title: "상임위원회 심사", body: "담당 위원회가 내용을 따져 보고 고친다. 10월 21일에 통과했다.", facts: ["F2"] },
          { title: "본회의 표결", body: "국회의원 전체가 찬반 투표를 한다. 11월 20일로 예정되어 있다.", facts: ["F3"] },
          { title: "공포", body: "표결을 통과하면 정부가 법을 공식으로 알린다. 날짜는 아직 정해지지 않았다." },
          { title: "시행", body: "공포한 뒤 정해진 기간이 지나야 실제로 적용된다.", facts: ["F4"], figure: { label: "공포 뒤 시행까지", value: fact("F4", 6), unit: "개월" } },
        ],
      },
    },
    {
      id: "proc-recall",
      type: "process",
      topic: "소비자 안전",
      headline: "전기자전거 배터리 리콜, 내 자전거는 언제 바꿔 주나",
      paragraphs: [
        "가상의 '한울전기'가 만든 전기자전거 배터리에서 과열 신고가 이어지자 당국이 리콜을 결정했다. 리콜이 결정되었다고 바로 교체가 시작되는 것은 아니다.",
      ],
      after: "대상 여부는 배터리에 적힌 제조 번호로 확인할 수 있다.",
      facts: [
        { id: "F1", text: "과열 신고는 148건 접수되었다", value: 148, unit: "건" },
        { id: "F2", text: "조사에서 배터리 보호 회로의 결함이 확인되었다" },
        { id: "F3", text: "리콜 대상은 3만 2천 대다", value: 32000, unit: "대" },
        { id: "F4", text: "무상 교체는 12개월 동안 진행된다", value: 12, unit: "개월" },
      ],
      source: SOURCE,
      spec: {
        title: "리콜은 이런 순서로 진행된다",
        guide: "단계를 하나씩 넘겨 보세요. 지금 어느 단계이고 내가 할 일이 언제 생기는지 보입니다.",
        current: 2,
        steps: [
          { title: "신고 접수", body: "소비자가 과열 사례를 신고한다.", facts: ["F1"], figure: { label: "접수된 신고", value: fact("F1", 148), unit: "건" } },
          { title: "원인 조사", body: "당국이 제품을 시험해 원인을 찾는다. 보호 회로의 결함이 확인되었다.", facts: ["F2"] },
          { title: "리콜 결정", body: "결함이 확인되면 대상 제품의 범위를 정해 발표한다.", facts: ["F3"], figure: { label: "리콜 대상", value: fact("F3", 32000), unit: "대" } },
          { title: "무상 교체", body: "제조사가 대상 배터리를 새것으로 바꿔 준다. 이때 소비자가 신청해야 한다.", facts: ["F4"], figure: { label: "교체 기간", value: fact("F4", 12), unit: "개월" } },
        ],
      },
    },
  ];
})(globalThis);
