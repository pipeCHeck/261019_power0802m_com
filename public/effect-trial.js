import { IMPACT_STYLES } from "./effect-variants.mjs";
import { BOUNCE_STYLES, bounceStyleFromSearch } from "./bounce-effects.mjs";

const bounce = bounceStyleFromSearch(window.location.search);
const style = bounce ? BOUNCE_STYLES.find(s => s.id === bounce)
  : IMPACT_STYLES.find(s => s.id === new URLSearchParams(window.location.search).get("impact"));
if (style) {
  const panel = document.createElement("nav");
  panel.setAttribute("aria-label", "충돌 이펙트 시험");
  Object.assign(panel.style, { position: "fixed", top: "10px", left: "50%", transform: "translateX(-50%)",
    zIndex: "100", background: "#f8f7f3", color: "#292b26", border: "1px solid #aeb1a1",
    padding: "9px 14px", fontSize: "11px", display: "flex", gap: "15px", alignItems: "center", whiteSpace: "nowrap" });
  const label = document.createElement("span");
  label.textContent = `${bounce ? "통통" : "미리보기"} ${style.letter} · ${style.name}`;
  const back = document.createElement("a");
  back.href = bounce ? `/bounces.html?bounce=${style.id}` : `/effects.html?impact=${style.id}`;
  back.textContent = "스타일 비교 ↗";
  back.style.color = "inherit";
  panel.append(label, back);
  panel.addEventListener("pointerdown", event => event.stopPropagation());
  document.body.append(panel);
}
