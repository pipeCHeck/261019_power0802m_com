import { scene } from "./scene.js";

const layer = document.querySelector(".physics-card-layer");
const primaryCard = layer.querySelector("[data-physics-card]");
const model = scene.world.card;
const cards = [-1, 0, 1].map(offset => {
  const element = offset === 0 ? primaryCard : primaryCard.cloneNode(true);
  if (offset !== 0) {
    element.removeAttribute("id");
    element.setAttribute("aria-hidden", "true");
    element.tabIndex = -1;
    layer.append(element);
  }
  return { element, offset };
});

let activePointer = null;
let press = null;

function trackPress(event) {
  if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press.dragged = true;
}

function openCardPage() {
  window.location.assign("/space.html");
}

function render() {
  const b = model.body;
  layer.style.setProperty("--card-width", `${b.width}px`);
  layer.style.setProperty("--card-height", `${b.height}px`);
  for (const { element, offset } of cards) {
    element.classList[model.mounted ? "add" : "remove"]("is-mounted");
    const left = model.displayX + offset * model.viewportWidth - b.width / 2;
    element.style.transform = `translate3d(${left}px, ${b.y - b.height / 2}px, 0) rotate(${b.angle}rad)`;
  }
}

function placeMount() {
  if (!model.mount) return;
  // Centre the copy + initial mounted card together. Retain this composition
  // after release so the text does not jump as the fastener breaks.
  document.documentElement.classList.add("mounted-card-layout");
  document.documentElement.style.setProperty("--initial-card-height", `${model.body.height}px`);
  if (!model.mounted) return;
  const description = document.querySelector(".description")?.getBoundingClientRect?.();
  if (Number.isFinite(description?.bottom)) {
    model.mount.place(window.innerWidth / 2, description.bottom + Math.max(32, Math.min(48, window.innerHeight * .07)) - 3);
  }
}

function requestFrame() {
  scene.requestFrame();
}

function finishDrag(throwing) {
  if (activePointer === null) return;
  const pointer = activePointer;
  activePointer = null;
  press = null;
  if (throwing) scene.flushDrag();
  model.endDrag({ throwing });
  layer.classList.remove("is-dragging");
  document.documentElement.classList.remove("card-dragging");
  if (layer.hasPointerCapture(pointer)) layer.releasePointerCapture(pointer);
  render();
  requestFrame();
}

layer.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0 || activePointer !== null) return;
  const clicked = cards.find(card => card.element === event.target.closest("[data-physics-card]"));
  if (!clicked) return;
  const centerX = model.displayX + clicked.offset * model.viewportWidth;
  if (!model.mounted && !model.beginDrag(event.clientX, event.clientY, centerX)) return;
  event.preventDefault();
  activePointer = event.pointerId;
  press = { x: event.clientX, y: event.clientY, startedAt: window.performance.now(), dragged: false };
  layer.setPointerCapture(event.pointerId);
  if (!model.mounted) {
    layer.classList.add("is-dragging");
    document.documentElement.classList.add("card-dragging");
  }
  requestFrame();
});

window.addEventListener("pointermove", event => {
  if (event.pointerId !== activePointer) return;
  trackPress(event);
  model.moveDrag(event.clientX, event.clientY);
  requestFrame();
});

window.addEventListener("pointerup", event => {
  if (event.pointerId !== activePointer) return;
  trackPress(event);
  const isClick = press && !press.dragged && window.performance.now() - press.startedAt <= 500;
  model.moveDrag(event.clientX, event.clientY);
  finishDrag(true);
  if (isClick) openCardPage();
});
window.addEventListener("pointercancel", event => {
  if (event.pointerId === activePointer) finishDrag(false);
});
layer.addEventListener("lostpointercapture", event => {
  if (event.pointerId === activePointer) finishDrag(false);
});
window.addEventListener("blur", () => finishDrag(false));
window.addEventListener("keydown", event => {
  if (event.key === "Escape") finishDrag(false);
});

primaryCard.addEventListener("keydown", event => {
  if (activePointer !== null) return;
  if (event.key === "Enter") {
    event.preventDefault();
    if (!event.repeat) openCardPage();
    return;
  }
  const nudges = { ArrowLeft: [-220, -120], ArrowRight: [220, -120], ArrowUp: [0, -420], ArrowDown: [0, 180] };
  const nudge = nudges[event.key];
  if (!nudge) return;
  event.preventDefault();
  if (model.mounted) return;
  model.body.vx = nudge[0];
  model.body.vy = nudge[1];
  model.body.angularVelocity += nudge[0] / 200;
  model.wake();
  requestFrame();
});

window.addEventListener("resize", () => {
  finishDrag(false);
  model.resize(window.innerWidth, window.innerHeight);
  placeMount();
  render();
  requestFrame();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    finishDrag(false);
  } else if (model.awake) requestFrame();
});

scene.subscribe(render);
placeMount();
render();
requestFrame();
document.fonts?.ready?.then(() => { placeMount(); render(); });
