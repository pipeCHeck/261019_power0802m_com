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

function render() {
  const b = model.body;
  layer.style.setProperty("--card-width", `${b.width}px`);
  layer.style.setProperty("--card-height", `${b.height}px`);
  for (const { element, offset } of cards) {
    const left = model.displayX + offset * model.viewportWidth - b.width / 2;
    element.style.transform = `translate3d(${left}px, ${b.y - b.height / 2}px, 0) rotate(${b.angle}rad)`;
  }
}

function requestFrame() {
  scene.requestFrame();
}

function finishDrag(throwing) {
  if (activePointer === null) return;
  const pointer = activePointer;
  activePointer = null;
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
  if (!model.beginDrag(event.clientX, event.clientY, centerX)) return;
  event.preventDefault();
  activePointer = event.pointerId;
  layer.setPointerCapture(event.pointerId);
  layer.classList.add("is-dragging");
  document.documentElement.classList.add("card-dragging");
  requestFrame();
});

window.addEventListener("pointermove", event => {
  if (event.pointerId !== activePointer) return;
  model.moveDrag(event.clientX, event.clientY);
  requestFrame();
});

window.addEventListener("pointerup", event => {
  if (event.pointerId !== activePointer) return;
  model.moveDrag(event.clientX, event.clientY);
  finishDrag(true);
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
  const nudges = { ArrowLeft: [-220, -120], ArrowRight: [220, -120], ArrowUp: [0, -420], ArrowDown: [0, 180] };
  const nudge = nudges[event.key];
  if (!nudge) return;
  event.preventDefault();
  model.body.vx = nudge[0];
  model.body.vy = nudge[1];
  model.body.angularVelocity += nudge[0] / 200;
  model.wake();
  requestFrame();
});

window.addEventListener("resize", () => {
  finishDrag(false);
  model.resize(window.innerWidth, window.innerHeight);
  render();
  requestFrame();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    finishDrag(false);
  } else if (model.awake) requestFrame();
});

scene.subscribe(render);
render();
requestFrame();
