import { PhysicsWorld } from "./world-physics.mjs";

const world = new PhysicsWorld({ width: window.innerWidth, height: window.innerHeight });
const listeners = new Set();
let frameId = null;
let lastTime = null;
let pendingEnd = false;

function requestFrame() {
  if (frameId === null && !document.hidden) frameId = window.requestAnimationFrame(frame);
}

function frame(time) {
  frameId = null;
  const seconds = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, .05);
  lastTime = time;
  const ended = world.step(seconds) || pendingEnd;
  pendingEnd = false;
  const floorImpacts = world.card.drainFloorImpacts();
  const shapeImpacts = world.drainShapeImpacts();
  for (const listener of listeners) listener({ seconds, ended, floorImpacts, shapeImpacts });
  if (world.awake) requestFrame();
  if (frameId === null) lastTime = null;
}

export const scene = {
  world,
  subscribe(listener) { listeners.add(listener); },
  requestFrame,
  flushDrag() {
    const drag = world.card.drag;
    if (drag && (drag.x !== drag.previousX || drag.y !== drag.previousY)) {
      pendingEnd = world.step(1 / 120) || pendingEnd;
    }
  },
};

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (frameId !== null) window.cancelAnimationFrame(frameId);
    frameId = null;
    lastTime = null;
  } else if (world.awake || pendingEnd) requestFrame();
});
