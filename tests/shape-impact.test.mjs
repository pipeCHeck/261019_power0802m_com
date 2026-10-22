import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsWorld } from "../public/world-physics.mjs";
import { getBallOutline } from "../public/ball-shapes.mjs";

function setup(shape) {
  const w = new PhysicsWorld({ width: 1000, height: 800 });
  Object.assign(w.card.body, { x: 500, y: 500, angle: 0, vx: 0, vy: 0, angularVelocity: 0 });
  w.game.start(500, 300, 30, shape);
  const b = w.game.ball;
  const bottom = shape === "circle" ? b.radius : Math.max(...getBallOutline(b).map(p => p.y - b.y));
  Object.assign(b, { y: 500 - w.card.body.height / 2 - bottom + 1, vx: 0, vy: 400, angularVelocity: 0 });
  return w;
}

test("shape contacts emit their real point, normal and pre-impact speed once without scoring", () => {
  for (const shape of ["circle", "heart", "star"]) {
    const w = setup(shape);
    assert.ok(w.resolveContacts());
    const events = w.drainShapeImpacts();
    assert.equal(events.length, 1);
    const e = events[0];
    assert.equal(e.shape, shape);
    assert.equal(e.speed, 400);
    assert.ok(Math.abs(e.x - 500) < 2);
    assert.ok(Math.abs(e.y - (500 - w.card.body.height / 2)) < 3);
    assert.ok(e.normal.y < -.9);
    assert.equal(w.game.score, 0);
    assert.equal(w.drainShapeImpacts().length, 0);
    w.resolveContacts();
    assert.equal(w.drainShapeImpacts().length, 0);
  }
});

test("gentle support is quiet, a swat is louder, and wrapped contacts report visible coordinates", () => {
  const quiet = setup("circle"); quiet.game.ball.vy = 30; quiet.resolveContacts();
  assert.equal(quiet.drainShapeImpacts().length, 0);
  const swat = setup("star"); swat.card.body.vy = -600; swat.game.ball.vy = 0; swat.resolveContacts();
  assert.ok(swat.drainShapeImpacts()[0].speed > 500);
  const wrapped = setup("circle"); wrapped.card.body.x = 990;
  Object.assign(wrapped.game.ball, { x: 120, y: 380 }); wrapped.resolveContacts();
  assert.ok(wrapped.drainShapeImpacts()[0].x < 200);
});

test("bounce speed measures the actual normal velocity change, including the physics speed limit", () => {
  for (const shape of ["circle", "heart", "star"]) for (const speed of [200, 900, 6000]) {
    const w = setup(shape); w.game.ball.vy = speed;
    const before = { vx: w.game.ball.vx, vy: w.game.ball.vy };
    w.resolveContacts();
    const e = w.drainShapeImpacts()[0], b = w.game.ball;
    const actual = (b.vx - before.vx) * e.normal.x + (b.vy - before.vy) * e.normal.y;
    assert.ok(e.bounceSpeed > 0);
    assert.ok(Math.abs(e.bounceSpeed - actual) < .000001);
  }
});

test("the effect inherits the moving and rotating contact surface's velocity", () => {
  const w = setup("circle");
  Object.assign(w.card.body, { vx: 450, vy: -300, angularVelocity: 2 });
  w.resolveContacts();
  const e = w.drainShapeImpacts()[0], b = w.card.body;
  const x = e.x - b.x, y = e.y - b.y;
  assert.ok(Math.abs(e.velocity.x - (b.vx - b.angularVelocity * y)) < .000001);
  assert.ok(Math.abs(e.velocity.y - (b.vy + b.angularVelocity * x)) < .000001);
  assert.ok(Math.hypot(e.velocity.x, e.velocity.y) > 100);
});
