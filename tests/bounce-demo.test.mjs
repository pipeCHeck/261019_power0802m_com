import test from "node:test";
import assert from "node:assert/strict";
import { buildBounceDemo, sampleBounceEffect } from "../public/bounce-demo.mjs";
import { createBounceImpact } from "../public/bounce-effects.mjs";
test("comparison samples real collisions for every shape and direction without scoring", () => {
  for (const shape of ["circle", "heart", "star"]) for (const direction of [-1, 0, 1]) {
    const demo = buildBounceDemo({ shape, direction, speed: 650 });
    assert.ok(demo.events.length > 0);
    assert.ok(demo.frames.length > 200);
    assert.ok(demo.events.every(e => e.shape === shape && e.at > 0 && e.speed > 70));
    assert.ok(demo.frames.every(f => Number.isFinite(f.ball.x) && Number.isFinite(f.ball.y)));
    assert.equal(demo.score, 0);
  }
});

test("preview seeking reconstructs early retirement without reviving an abandoned burst", () => {
  const e = createBounceImpact({ x: 500, y: 400, normal: { x: 0, y: -1 }, speed: 900,
    bounceSpeed: 1400, tangentSpeed: 0, radius: 30, shape: "circle" }, () => .5);
  const near = { x: 500, y: 440, width: 100, height: 60, angle: 0 }, far = { ...near, x: 1200 };
  const demo = { fps: 240, width: 2000, frames: Array.from({ length: 200 }, (_, i) => ({
    card: i < 10 || i > 100 ? near : far, ball: null })) };
  const early = sampleBounceEffect(e, 0, .02, demo);
  assert.ok(early);
  assert.ok(sampleBounceEffect(e, 0, .20, demo), "early separation still permits a readable opening");
  assert.equal(sampleBounceEffect(e, 0, .49, demo), null);
  assert.deepEqual(sampleBounceEffect(e, 0, .02, demo), early);
  assert.equal(e.age, 0);
  assert.equal(e.retiredAt, null);
});

test("fast preview scenes generate real moving contacts for all three shapes", () => {
  for (const motion of ["travel", "sweep"]) for (const shape of ["circle", "heart", "star"]) {
    const d = buildBounceDemo({ shape, motion });
    assert.ok(d.events.length > 0);
    assert.ok(d.events.some(e => Math.hypot(e.velocity.x, e.velocity.y) > 400));
    assert.ok(d.frames.every(f => Number.isFinite(f.ball.x) && Number.isFinite(f.card.y)));
  }
});
