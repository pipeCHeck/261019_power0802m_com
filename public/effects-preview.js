import { DEFAULT_IMPACT_STYLE, ORIGINAL_IMPACT_STYLES, MOTION_IMPACT_STYLES } from "./effect-variants.mjs";
import { createFloorImpact, drawFloorImpact } from "./floor-effects.mjs";

const $ = id => document.getElementById(id);
const comparisons = $("comparisons");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const params = new URLSearchParams(window.location.search);
const previous = params.get("collection") === "previous" || ORIGINAL_IMPACT_STYLES.some(s => s.id === params.get("impact"));
const choices = previous ? ORIGINAL_IMPACT_STYLES : MOTION_IMPACT_STYLES;
let selected = choices.some(s => s.id === params.get("impact")) ? params.get("impact") : choices[0].id;
let playing = !reduced.matches, elapsed = playing ? 0 : .54, seed = 130, last = null, raf = null;
const views = [];
const randomFor = seed => () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);

$("collection-title").textContent = previous ? "같은 충돌, 다른 표정." : "모양보다, 움직임부터.";
$("collection-summary").textContent = previous ? "이전 다섯 가지 형태를 같은 조건에서 비교해 보세요." : "눌리고, 늘어나고, 끊어지고, 갈라지는 세 가지 모션 스터디.";
$("collection-link").href = previous ? "/effects.html" : "/effects.html?collection=previous";
$("collection-link").textContent = previous ? "새 모션 3안 보기 ↗" : "이전 5안 보기 ↗";
$("study-count").textContent = previous ? "01 — 05" : "A2 / B2 / D2";
comparisons.setAttribute("aria-label", previous ? "이전 5가지 이펙트" : "세 가지 모션 그래픽 이펙트");
for (const style of choices) {
  const card = document.createElement("article");
  card.className = "effect-card";
  card.innerHTML = `<div class="card-top"><span class="letter">${style.letter}</span><h3>${style.name}</h3>${style.id === DEFAULT_IMPACT_STYLE ? '<span class="current-tag">현재 스타일</span>' : ""}</div>
    <canvas class="effect-stage" aria-label="${style.name} 충돌 애니메이션"></canvas>
    <div class="card-bottom"><p>${style.description}</p><button class="choose" type="button" aria-pressed="false">이 스타일 선택</button></div>`;
  comparisons.append(card);
  const canvas = card.querySelector("canvas"), button = card.querySelector("button");
  const view = { style, card, canvas, button, context: canvas.getContext("2d"), effect: null };
  views.push(view);
  button.addEventListener("click", () => select(style.id));
}

function select(id) {
  selected = id;
  const style = choices.find(s => s.id === id);
  $("selected-name").textContent = `${style.letter} · ${style.name}`;
  $("selected-description").textContent = style.description;
  $("try-style").href = `/?impact=${id}`;
  for (const view of views) {
    const active = view.style.id === id;
    view.card.classList.toggle("is-selected", active);
    view.button.setAttribute("aria-pressed", String(active));
    view.button.textContent = active ? "선택됨 ✓" : "이 스타일 선택";
  }
  history.replaceState(null, "", `?impact=${id}`);
}

function conditions() {
  const strength = { soft: [300, 1.5e5, 0], medium: [850, 1.8e6, 3], hard: [1650, 7e6, 9] }[$("strength").value];
  const direction = Number($("direction").value);
  return { normalSpeed: strength[0], energy: strength[1], angularSpeed: strength[2] * direction,
    tangentSpeed: strength[0] * .65 * direction, angle: $("contact").value === "face" ? 0 : .58 * (direction || 1) };
}

function build() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), input = conditions();
  for (const view of views) {
    const { width, height } = view.canvas.getBoundingClientRect();
    view.width = width; view.height = height;
    view.canvas.width = Math.round(width * dpr); view.canvas.height = Math.round(height * dpr);
    view.context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.floor = height - 18;
    view.plateWidth = Math.min(124, width * .31);
    view.plateHeight = view.plateWidth * .42;
    view.effect = createFloorImpact({ ...input, x: width / 2, y: view.floor,
      span: $("contact").value === "face" ? view.plateWidth : 0 }, randomFor(seed), view.style.id);
  }
}

function draw(view) {
  const { context: ctx, width, height, floor } = view;
  if (!ctx || !width || !height) return;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#d4d5ca"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(18, floor + .5); ctx.lineTo(width - 18, floor + .5); ctx.stroke();
  // A shared contact pose makes the motion treatments directly comparable.
  const input = conditions(), angle = input.angle;
  const w = view.plateWidth, h = view.plateHeight;
  const lowest = Math.abs(Math.sin(angle)) * w / 2 + Math.abs(Math.cos(angle)) * h / 2;
  const cornerX = input.angle ? Math.sign(angle) * Math.cos(angle) * w / 2 - Math.sin(angle) * h / 2 : 0;
  const before = Math.max(0, 1 - elapsed / .42), after = Math.max(0, elapsed - .42);
  const lift = before ? (height - 80) * (2 * before - before * before) : Math.sin(Math.min(1, after / .16) * Math.PI) * 3;
  const drift = before * Number($("direction").value) * 32;
  ctx.save();
  ctx.translate(width / 2 - cornerX - drift, floor - lowest - lift);
  ctx.rotate(angle);
  ctx.strokeStyle = "#777c6d"; ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.font = '9px "SB Aggro Light", sans-serif'; ctx.fillStyle = "#838878";
  ctx.fillText("가나다라", -w / 2 + 7, -h / 2 + 16);
  ctx.restore();
  // Match the actual site's canvas above its transparent physical card.
  if (elapsed >= .42) {
    view.effect.age = elapsed - .42;
    drawFloorImpact(ctx, view.effect, width, height);
  }
}

function render() {
  for (const view of views) draw(view);
  $("timeline").value = String(Math.round(elapsed * 1000));
  $("scene-time").textContent = elapsed < .42 ? "충돌 전" : `충돌 +${Math.round((elapsed - .42) * 1000)}ms`;
}
function request() { if (playing && !document.hidden && raf === null) raf = requestAnimationFrame(tick); }
function tick(now) {
  raf = null;
  if (last !== null) elapsed += Math.min((now - last) / 1000, .05) * Number($("speed").value);
  last = now;
  if (elapsed > 1.8) { elapsed = 0; seed++; build(); }
  render(); request();
}
function updatePlayback() {
  $("toggle").textContent = playing ? "일시정지" : "재생";
  last = null;
  if (raf !== null) cancelAnimationFrame(raf);
  raf = null; request();
}
$("toggle").addEventListener("click", () => { playing = !playing; updatePlayback(); });
$("reroll").addEventListener("click", () => { seed++; elapsed = playing ? .42 : .54; build(); render(); last = null; });
$("timeline").addEventListener("input", () => {
  playing = false; elapsed = Number($("timeline").value) / 1000; updatePlayback(); render();
});
for (const id of ["strength", "contact", "direction"]) $(id).addEventListener("change", () => {
  elapsed = playing ? 0 : .54; build(); render(); last = null;
});
window.addEventListener("resize", () => { build(); render(); });
document.addEventListener("visibilitychange", () => { last = null; if (document.hidden && raf !== null) { cancelAnimationFrame(raf); raf = null; } else request(); });
reduced.addEventListener("change", () => {
  if (reduced.matches) { playing = false; elapsed = .54; render(); updatePlayback(); }
  $("motion-note").hidden = !reduced.matches;
});
$("motion-note").hidden = !reduced.matches;
select(selected); build(); render(); updatePlayback();
document.fonts?.ready.then(render);
