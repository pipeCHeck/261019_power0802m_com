import { BOUNCE_STYLES, bounceStyleFromSearch, createBounceImpact, drawBounceImpact } from "./bounce-effects.mjs";
import { buildBounceDemo, sampleBounceEffect } from "./bounce-demo.mjs";
import { getBallOutline } from "./ball-shapes.mjs";

const $ = id => document.getElementById(id);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const views = [];
let selected = bounceStyleFromSearch(window.location.search) ?? "pop";
let seed = 42, demo, elapsed = 0, playing = !reduced.matches, raf = null, last = null;
const randomFor = value => () => ((value = (1664525 * value + 1013904223) >>> 0) / 4294967296);

for (const style of BOUNCE_STYLES) {
  const card = document.createElement("article"); card.className = "effect-card";
  card.innerHTML = `<div class="card-top"><span class="letter">${style.letter}</span><h3>${style.name}</h3></div>
    <canvas class="effect-stage" aria-label="${style.name} 충돌 장면"></canvas>
    <div class="card-bottom"><p>${style.description}</p><button type="button" class="choose" aria-pressed="false">이 스타일 선택</button></div>`;
  $("comparisons").append(card);
  const canvas = card.querySelector("canvas"), button = card.querySelector("button");
  views.push({ card, style, canvas, button, ctx: canvas.getContext("2d"), effects: [] });
  button.addEventListener("click", () => select(style.id));
}

function select(id) {
  selected = id;
  const style = BOUNCE_STYLES.find(s => s.id === id);
  $("selected-name").textContent = `${style.letter} · ${style.name}`;
  $("selected-description").textContent = style.description;
  $("try-style").href = `/?bounce=${id}`;
  for (const v of views) {
    const active = v.style.id === id;
    v.card.classList.toggle("is-selected", active);
    v.button.setAttribute("aria-pressed", String(active));
    v.button.textContent = active ? "선택됨 ✓" : "이 스타일 선택";
  }
  history.replaceState(null, "", `?bounce=${id}`);
}

function patterns() {
  for (const v of views) v.effects = demo.events.map((e, i) => ({ at: e.at,
    effect: createBounceImpact(e, randomFor(seed + i * 7919), v.style.id) }));
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (const v of views) {
    const { width, height } = v.canvas.getBoundingClientRect();
    v.width = width; v.height = height; v.dpr = dpr;
    v.canvas.width = Math.round(width * dpr); v.canvas.height = Math.round(height * dpr);
  }
  render();
}

function build() {
  demo = buildBounceDemo({ shape: $("shape").value, speed: Number($("strength").value), direction: Number($("direction").value), motion: $("motion").value, radius: Number($("radius").value) });
  elapsed = playing ? 0 : (demo.events[0]?.at ?? 0) + .13;
  patterns(); last = null; resize();
}

function render() {
  if (!demo) return;
  const sample = demo.frames[Math.min(demo.frames.length - 1, Math.floor(elapsed * demo.fps))];
  for (const v of views) {
    const ctx = v.ctx; if (!ctx || !v.width) continue;
    const scale = Math.min(v.width / demo.width, v.height / demo.height);
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); ctx.clearRect(0, 0, v.width, v.height);
    ctx.translate((v.width - demo.width * scale) / 2, (v.height - demo.height * scale) / 2); ctx.scale(scale, scale);
    const b = sample.card, ball = sample.ball;
    for (const offset of [-demo.width, 0, demo.width]) {
      const centerX = ((b.x % demo.width) + demo.width) % demo.width + offset;
      ctx.save(); ctx.translate(centerX, b.y); ctx.rotate(b.angle);
      ctx.strokeStyle = "#292b26"; ctx.lineWidth = 1.2;
      ctx.strokeRect(-b.width / 2, -b.height / 2, b.width, b.height);
      ctx.fillStyle = "#292b26"; ctx.font = '19px "SB Aggro Light", sans-serif';
      ctx.fillText("가나다라", -b.width / 2 + 10, -b.height / 2 + 29); ctx.restore();
    }
    ctx.beginPath();
    if (ball.shape === "circle") ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    else {
      const outline = getBallOutline(ball);
      ctx.moveTo(outline[0].x, outline[0].y);
      for (const p of outline.slice(1)) ctx.lineTo(p.x, p.y);
    }
    ctx.closePath(); ctx.fillStyle = { circle: "#292b26", heart: "#fa4d67", star: "#fad034" }[ball.shape]; ctx.fill();
    for (const { at, effect } of v.effects) {
      const current = sampleBounceEffect(effect, at, elapsed, demo);
      if (current) drawBounceImpact(ctx, current, demo.width, demo.height, sample);
    }
  }
  $("timeline").value = String(Math.round(elapsed * 1000));
  $("scene-time").textContent = `${Math.round(elapsed * 1000)}ms`;
}

function request() { if (playing && !document.hidden && raf === null) raf = requestAnimationFrame(tick); }
function tick(now) {
  raf = null;
  if (last !== null) elapsed += Math.min(.05, (now - last) / 1000) * Number($("speed").value);
  last = now;
  if (elapsed > demo.duration) { elapsed = 0; seed++; patterns(); }
  render(); request();
}
function playback() {
  $("toggle").textContent = playing ? "일시정지" : "재생";
  last = null; if (raf !== null) cancelAnimationFrame(raf); raf = null; request();
}
$("toggle").addEventListener("click", () => { playing = !playing; playback(); });
$("reroll").addEventListener("click", () => { seed++; patterns(); elapsed = (demo.events[0]?.at ?? 0) + .08; last = null; render(); });
$("timeline").addEventListener("input", () => { elapsed = Number($("timeline").value) / 1000; playing = false; playback(); render(); });
for (const id of ["shape", "strength", "direction", "motion", "radius"]) $(id).addEventListener("change", build);
window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  last = null;
  if (document.hidden && raf !== null) { cancelAnimationFrame(raf); raf = null; }
  else request();
});
reduced.addEventListener("change", () => {
  $("motion-note").hidden = !reduced.matches;
  if (reduced.matches) { playing = false; elapsed = (demo.events[0]?.at ?? 0) + .13; playback(); render(); }
});
$("motion-note").hidden = !reduced.matches;
select(selected); build(); playback();
document.fonts?.ready.then(render);
