import { TRANSITIONS, TRANSITION_DURATION, SOURCE_CARD, transitionTracks } from "./transition-effects.mjs";
import { TransitionTimeline } from "./transition-timeline.mjs";
import { ENGINEERING_TRANSITIONS, ENGINEERING_DURATION, engineeringFrame, engineeringSVG } from "./engineering-transitions.mjs";
import { CONSTRUCTION_TRANSITIONS, CONSTRUCTION_DURATION, constructionFrame } from "./construction-transitions.mjs";
import { prepareConstruction, applyConstruction } from "./construction-dom.mjs";

const $ = id => document.getElementById(id);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const params = new URLSearchParams(location.search);
const previous = params.get("collection") === "previous";
const engineering = params.get("collection") === "engineering";
const construction = !previous && !engineering;
const catalog = previous ? TRANSITIONS : engineering ? ENGINEERING_TRANSITIONS : CONSTRUCTION_TRANSITIONS;
const duration = previous ? TRANSITION_DURATION : engineering ? ENGINEERING_DURATION : CONSTRUCTION_DURATION;
const timeline = new TransitionTimeline(duration);
const views = [];
let ready = false, raf = null;

for (const style of catalog) {
  const card = document.createElement("article");
  card.className = "effect-card";
  card.innerHTML = `<div class="card-top"><span class="letter">${style.letter}</span><h3>${style.name}</h3></div>
    <div class="transition-stage"><div class="transition-viewport">
      <iframe class="scene-frame scene-old" title="메인 화면" tabindex="-1" aria-hidden="true"></iframe>
      <iframe class="scene-frame scene-new" title="새로운 공간" tabindex="-1" aria-hidden="true"></iframe>
      <div class="transition-panel"><div class="transition-panel-text"><strong>가나다라</strong><span>가나다라</span></div></div>
      <div class="transition-rule line-top"></div><div class="transition-rule line-bottom"></div>
      <svg class="engineering-overlay" viewBox="0 0 1000 760" aria-hidden="true"></svg>
    </div><button class="stage-replay" type="button" aria-label="${style.letter} ${style.name} 전환 다시 보기" disabled></button></div>
    <div class="card-bottom"><p>${style.description}</p><button type="button" class="choose" aria-pressed="false">이 안 선택</button></div>`;
  $("comparisons").append(card);
  const v = { style, card, stage: card.querySelector(".transition-stage"), viewport: card.querySelector(".transition-viewport"),
    old: card.querySelector(".scene-old"), next: card.querySelector(".scene-new"), animations: [],
    overlay: card.querySelector(".engineering-overlay"), clipId: `transition-clip-${style.id}` };
  views.push(v);
  card.querySelector(".choose").addEventListener("click", () => select(style.id));
  card.querySelector(".stage-replay").addEventListener("click", replay);
}

function select(id) {
  const style = catalog.find(s => s.id === id) ?? catalog[0];
  $("selected-name").textContent = `${style.letter} · ${style.name}`;
  $("selected-description").textContent = style.description;
  for (const v of views) {
    const active = v.style.id === style.id;
    v.card.classList.toggle("is-selected", active);
    const button = v.card.querySelector(".choose");
    button.setAttribute("aria-pressed", String(active));
    button.textContent = active ? "선택됨 ✓" : "이 안 선택";
  }
  history.replaceState(null, "", `?${previous ? "collection=previous&" : engineering ? "collection=engineering&" : ""}style=${style.id}`);
}

function staticScene(html, home) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script").forEach(el => el.remove());
  doc.body.setAttribute("inert", "");
  const style = doc.createElement("style");
  style.textContent = "html{overflow:hidden}body{min-height:760px}";
  if (construction) style.textContent += "html,body{background:transparent!important}body::before{display:none!important}";
  if (home) {
    const s = SOURCE_CARD;
    style.textContent += `.physics-card-layer{--card-width:${s.width}px;--card-height:${s.height}px}
      .physics-card{transform:translate(${s.left}px,${s.top}px) rotate(${s.angle}deg)}`;
  }
  doc.head.append(style);
  return "<!doctype html>" + doc.documentElement.outerHTML;
}

function loadFrame(frame, html) {
  return new Promise((resolve, reject) => {
    frame.addEventListener("load", async () => {
      try { await frame.contentDocument.fonts.ready; resolve(); } catch (error) { reject(error); }
    }, { once: true });
    frame.addEventListener("error", reject, { once: true });
    frame.srcdoc = html;
  });
}

function render() {
  if (!ready) return;
  for (const v of views) for (const a of v.animations) a.currentTime = timeline.position;
  if (engineering) for (const v of views) {
    const frame = engineeringFrame(v.style.id, timeline.position / duration, v.destination);
    v.overlay.innerHTML = engineeringSVG(frame, v.clipId);
    v.old.style.opacity = frame.oldOpacity;
    v.next.style.opacity = frame.newOpacity;
  }
  if (construction) for (const v of views) {
    const frame = constructionFrame(v.style.id, timeline.position / duration, v.fromParts.pieces, v.toParts.pieces, v.destination);
    applyConstruction(v.fromParts, frame.oldParts, 0);
    applyConstruction(v.toParts, frame.newParts, frame.border);
    v.overlay.innerHTML = engineeringSVG(frame, v.clipId);
    v.old.style.opacity = frame.oldOpacity;
    v.next.style.opacity = frame.newOpacity;
  }
  $("timeline").value = String(Math.round(timeline.position));
  $("time").textContent = `${Math.round(timeline.position)}ms`;
  $("toggle").textContent = timeline.playing ? "일시정지" : "재생";
}

function request() { if (ready && timeline.playing && !document.hidden && raf === null) raf = requestAnimationFrame(tick); }
function tick(now) { raf = null; timeline.tick(now); render(); request(); }
function stopFrame() { if (raf !== null) cancelAnimationFrame(raf); raf = null; }
function replay() { if (!ready) return; stopFrame(); timeline.restart(); render(); request(); }
function resize() {
  for (const v of views) v.viewport.style.setProperty("--scene-scale", String(v.stage.getBoundingClientRect().width / 1000));
}

$("toggle").addEventListener("click", () => {
  if (!ready) return;
  stopFrame();
  if (timeline.playing) timeline.pause(); else timeline.play();
  render(); request();
});
$("replay").addEventListener("click", replay);
$("timeline").addEventListener("input", () => {
  stopFrame(); timeline.pause(); timeline.seek(Number($("timeline").value)); render();
});
$("speed").addEventListener("change", () => { timeline.speed = Number($("speed").value); timeline.suspend(); });
$("loop").addEventListener("change", () => { timeline.loop = $("loop").checked; });
window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  timeline.suspend();
  if (document.hidden) stopFrame(); else request();
});
reduced.addEventListener("change", () => {
  if (reduced.matches) { stopFrame(); timeline.pause(); timeline.seek(duration); render(); }
  $("notice").textContent = reduced.matches ? "동작 줄이기 설정에 따라 멈춘 화면으로 표시합니다. 재생을 누르면 비교할 수 있어요." : "화면을 누르면 전환을 함께 다시 재생합니다.";
});
window.addEventListener("pagehide", () => { stopFrame(); timeline.suspend(); });
window.addEventListener("pageshow", () => { timeline.suspend(); render(); request(); });

async function init() {
  select(params.get("style"));
  $("timeline").max = String(duration);
  if (previous) {
    $("preview-heading").textContent = "공간에서, 다음 공간으로.";
    $("preview-intro").textContent = "이전의 간결한 네 가지 전환입니다. 새 모션과 비교해 보세요.";
    $("collection-link").textContent = "새 모션 보기 ↗";
    $("collection-link").href = "/transitions.html?style=frame";
  } else if (engineering) {
    $("preview-heading").textContent = "움직임 안에, 질서를.";
    $("preview-intro").textContent = "이전의 벡터 정렬 · 탄성 면 · 격자 정착을 비교할 수 있습니다.";
    $("collection-link").textContent = "새 조립 모션 보기 ↗";
    $("collection-link").href = "/transitions.html?style=frame";
  }
  try {
    const [home, space] = await Promise.all(["/", "/space.html"].map(async url => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("page unavailable");
      return response.text();
    }));
    const source = staticScene(home, true), destination = staticScene(space, false);
    await Promise.all(views.flatMap(v => [loadFrame(v.old, source), loadFrame(v.next, destination)]));
    await document.fonts.ready;
    for (const v of views) {
      const from = v.old.contentDocument, to = v.next.contentDocument;
      const targets = { old: v.old, new: v.next, panel: v.card.querySelector(".transition-panel"),
        "panel-text": v.card.querySelector(".transition-panel-text"), "line-top": v.card.querySelector(".line-top"),
        "line-bottom": v.card.querySelector(".line-bottom"), "from-title": from.querySelector("#construction-message"),
        "from-description": from.querySelector(".description"), "from-eyebrow": from.querySelector(".eyebrow"),
        "to-index": to.querySelector(".space-index"), "to-title": to.querySelector("#space-title"),
        "to-description": to.querySelector(".space-intro"), "to-back": to.querySelector(".space-back") };
      const d = to.querySelector(".space-panel").getBoundingClientRect();
      v.destination = { left: d.left, top: d.top, width: d.width, height: d.height };
      if (engineering) v.next.style.clipPath = `url(#${v.clipId})`;
      if (construction) {
        v.old.style.background = "transparent"; v.next.style.background = "transparent";
        v.fromParts = prepareConstruction(from, true);
        v.toParts = prepareConstruction(to, false);
      }
      for (const { target, frames } of previous ? transitionTracks(v.style.id, d) : []) {
        const a = targets[target].animate(frames, { duration: TRANSITION_DURATION, fill: "both", easing: "linear" });
        a.pause(); a.currentTime = 0; v.animations.push(a);
      }
    }
    ready = true; resize();
    for (const id of ["toggle", "replay", "timeline"]) $(id).disabled = false;
    views.forEach(v => { v.card.querySelector(".stage-replay").disabled = false; });
    timeline.loop = $("loop").checked;
    if (reduced.matches) {
      timeline.seek(duration);
      $("notice").textContent = "동작 줄이기 설정에 따라 멈춘 화면으로 시작합니다. 재생을 눌러 비교할 수 있어요.";
    } else {
      $("notice").textContent = "화면을 누르면 전환을 함께 다시 재생합니다.";
      timeline.play();
    }
    render(); request();
  } catch (error) {
    stopFrame();
    $("notice").textContent = "페이지를 불러오지 못했습니다. 로컬 서버가 켜져 있는지 확인한 뒤 새로고침해 주세요.";
    console.error(error);
  }
}
init();
