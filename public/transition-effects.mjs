export const TRANSITIONS = Object.freeze([
  { id: "card", letter: "A", name: "사각형 따라가기", description: "눌렀던 사각형이 펴지며 새 공간의 테두리로 이어집니다. 오브젝트와 페이지가 하나의 움직임으로 연결됩니다." },
  { id: "paper", letter: "B", name: "종이 밀기", description: "얇은 선을 앞세운 새 종이가 아래에서 올라옵니다. 이전 화면은 조금 먼저 위로 밀려납니다." },
  { id: "split", letter: "C", name: "가운데서 열기", description: "가느다란 가로선이 길어진 뒤 위아래로 벌어집니다. 그 사이로 다음 공간이 드러납니다." },
  { id: "type", letter: "D", name: "문장 바통", description: "기존 문장이 위로 빠지고 새 제목과 설명이 차례로 들어옵니다. 가장 작고 조용한 전환입니다." },
]);
export const TRANSITION_DURATION = 1400;
export const SOURCE_CARD = Object.freeze({ left: 550, top: 510, width: 360, height: 151.2, angle: -9 });
const curve = "cubic-bezier(.76,0,.24,1)";
const f = (offset, values) => ({ offset, easing: curve, ...values });
const track = (target, frames) => ({ target, frames });
const rect = r => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, transform: `rotate(${r.angle ?? 0}deg)` });
const inset = r => `inset(${r.top}px ${1000 - r.left - r.width}px ${760 - r.top - r.height}px ${r.left}px)`;

export function transitionTracks(id, destination) {
  const s = SOURCE_CARD, d = { left: destination.left, top: destination.top, width: destination.width, height: destination.height, angle: 0 };
  if (id === "card") return [
    track("old", [f(0, { opacity: 1 }), f(.40, { opacity: 0 }), f(1, { opacity: 0 })]),
    track("new", [f(0, { opacity: 0, clipPath: inset(s) }), f(.30, { opacity: 0, clipPath: inset(d) }),
      f(.58, { opacity: 1, clipPath: inset(d) }), f(.94, { opacity: 1, clipPath: "inset(0px)" }), f(1, { opacity: 1, clipPath: "inset(0px)" })]),
    track("panel", [f(0, { ...rect(s), opacity: 1 }), f(.08, { ...rect(s), opacity: 1 }),
      f(.58, { ...rect(d), opacity: 1 }), f(.78, { ...rect(d), opacity: 1 }), f(.95, { ...rect(d), opacity: 0 }), f(1, { ...rect(d), opacity: 0 })]),
    track("panel-text", [f(0, { opacity: 1, transform: "translateY(0px)" }), f(.30, { opacity: 0, transform: "translateY(-20px)" }), f(1, { opacity: 0 })]),
  ];
  if (id === "paper") return [
    track("old", [f(0, { transform: "translateY(0px)", opacity: 1 }), f(.85, { transform: "translateY(-60px)", opacity: .4 }), f(1, { opacity: 0 })]),
    track("new", [f(0, { clipPath: "inset(100% 0 0 0)", opacity: 1 }), f(.08, { clipPath: "inset(100% 0 0 0)" }), f(.85, { clipPath: "inset(0% 0 0 0)" }), f(1, { clipPath: "inset(0% 0 0 0)", opacity: 1 })]),
    track("line-top", [f(0, { transform: "translateY(760px)", opacity: 0 }), f(.08, { transform: "translateY(760px)", opacity: 1 }),
      f(.85, { transform: "translateY(-2px)", opacity: 1 }), f(1, { transform: "translateY(-2px)", opacity: 0 })]),
  ];
  if (id === "split") return [
    track("old", [f(0, { opacity: 1 }), f(.8, { opacity: .4 }), f(1, { opacity: 0 })]),
    track("new", [f(0, { clipPath: "inset(50% 0 50% 0)", opacity: 1 }), f(.28, { clipPath: "inset(50% 0 50% 0)" }), f(.9, { clipPath: "inset(0% 0 0% 0)" }), f(1, { clipPath: "inset(0% 0 0% 0)", opacity: 1 })]),
    ...["line-top", "line-bottom"].map((target, i) => track(target, [
      f(0, { transform: "translateY(380px) scaleX(0)", opacity: 1 }), f(.28, { transform: "translateY(380px) scaleX(1)", opacity: 1 }),
      f(.9, { transform: `translateY(${i ? 761 : -1}px) scaleX(1)`, opacity: 1 }), f(1, { opacity: 0 }),
    ])),
  ];
  return [
    track("old", [f(0, { opacity: 1 }), f(.44, { opacity: 0 }), f(1, { opacity: 0 })]),
    track("new", [f(0, { opacity: 0 }), f(.35, { opacity: 0 }), f(.55, { opacity: 1 }), f(1, { opacity: 1 })]),
    ...["from-title", "from-description", "from-eyebrow"].map((target, i) => track(target, [
      f(0, { transform: "translateY(0px)", opacity: 1 }), f(.28 + i * .05, { transform: "translateY(-30px)", opacity: 0 }), f(1, { opacity: 0 }),
    ])),
    ...["to-index", "to-title", "to-description", "to-back"].map((target, i) => track(target, [
      f(0, { transform: "translateY(28px)", opacity: 0 }), f(.36 + i * .07, { transform: "translateY(28px)", opacity: 0 }),
      f(.70 + i * .07, { transform: "translateY(0px)", opacity: 1 }), f(1, { transform: "translateY(0px)", opacity: 1 }),
    ])),
  ];
}
