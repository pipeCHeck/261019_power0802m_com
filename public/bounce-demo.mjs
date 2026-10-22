import { PhysicsWorld } from "./world-physics.mjs";
import { updateBounceImpact } from "./bounce-placement.mjs";

export function buildBounceDemo({ shape = "circle", speed = 650, direction = 0, motion = "still", radius = 24 } = {}) {
  const width = 420, height = 300, fps = 240, duration = 1.8;
  const world = new PhysicsWorld({ width, height });
  Object.assign(world.card.body, { x: width / 2, y: height * .7, angle: 0, vx: 0, vy: 0, angularVelocity: 0 });
  world.card.beginDrag(width / 2, height * .7);
  world.game.start(width / 2 - direction * 32, height * .7 - world.card.body.height / 2 - radius - 35, radius, shape);
  const drift = motion === "travel" ? { x: 700, y: 0 } : motion === "sweep" ? { x: 420, y: -900 } : { x: 0, y: 0 };
  Object.assign(world.game.ball, { vx: drift.x + direction * 140, vy: speed, angle: 0, angularVelocity: 0 });
  const frames = [], events = [];
  for (let i = 0; i <= fps * duration; i++) {
    if (i) {
      world.card.moveDrag(width / 2 + drift.x * i / fps, height * .7 + drift.y * i / fps);
      world.step(1 / fps);
    }
    for (const e of world.drainShapeImpacts()) events.push({ ...e, at: i / fps });
    const { x, y, width: cardWidth, height: cardHeight, angle } = world.card.body;
    frames.push({ ball: { ...world.game.ball }, card: { x, y, width: cardWidth, height: cardHeight, angle } });
  }
  return { width, height, fps, duration, frames, events, score: world.game.score };
}

export function sampleBounceEffect(effect, at, elapsed, demo) {
  const age = elapsed - at;
  if (age < 0 || age >= effect.duration) return null;
  // Reconstruct retirement from the trajectory so backward seeking never reuses
  // a future dismissal. This is the same update used by the live game.
  const sample = { ...effect, age: 0, life: effect.duration, retiredAt: null };
  const end = Math.min(demo.frames.length - 1, Math.floor(elapsed * demo.fps));
  for (let i = Math.max(0, Math.ceil(at * demo.fps)); i <= end; i++) {
    sample.age = i / demo.fps - at;
    updateBounceImpact(sample, demo.frames[i], demo.width);
    if (sample.age >= sample.life) return null;
  }
  sample.age = age;
  updateBounceImpact(sample, demo.frames[end], demo.width);
  return sample.age < sample.life ? sample : null;
}
