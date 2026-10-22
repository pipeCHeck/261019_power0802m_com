import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsCard } from "../public/card-physics.mjs";

function landing({ angle = 0, speed = 700, spin = 0, x = 500 } = {}) {
  const card = new PhysicsCard({ width: 1000, height: 800 });
  Object.assign(card.body, { x, y: 400, angle, vy: speed, angularVelocity: spin, vx: 180 });
  card.body.y += 799 - Math.max(...card.corners.map(p => p.y));
  card.step(1 / 120);
  return { card, impacts: card.drainFloorImpacts() };
}

test("flat floor impacts report the actual contact span, floor and incoming energy once", () => {
  const { card, impacts } = landing();
  assert.equal(impacts.length, 1);
  const impact = impacts[0];
  assert.equal(impact.y, 800);
  assert.ok(Math.abs(impact.span - card.body.width) < .001);
  assert.ok(impact.x > 499 && impact.x < 503);
  assert.ok(impact.normalSpeed >= 700);
  assert.ok(impact.energy > 0);
  assert.ok(impact.tangentSpeed > 0);
  assert.equal(card.drainFloorImpacts().length, 0);
});

test("corner contacts emit at the corner rather than the center and include angular impact speed", () => {
  const { card, impacts } = landing({ angle: .4, speed: -50, spin: 5 });
  assert.equal(impacts.length, 1);
  assert.equal(impacts[0].span, 0);
  assert.ok(Math.abs(impacts[0].x - card.body.x) > 100);
  assert.ok(impacts[0].normalSpeed > 500, "rotation alone can produce a hard impact");
  assert.ok(Math.abs(impacts[0].angle - .4) < .1);
  assert.ok(impacts[0].angularSpeed > 4, "retain pre-impact spin for the swing trail");
});

test("impact energy scales with contact speed instead of a fixed landing preset", () => {
  const soft = landing({ speed: 300 }).impacts[0];
  const hard = landing({ speed: 900 }).impacts[0];
  assert.ok(hard.energy > soft.energy * 6);
});

test("slow support and a settled plate do not repeatedly emit floor effects", () => {
  const card = new PhysicsCard({ width: 1000, height: 800 });
  card.body.y = 800 - card.body.height / 2;
  for (let i = 0; i < 600; i++) card.step(1 / 120);
  assert.equal(card.drainFloorImpacts().length, 0);
});

test("a held plate produces one floor hit while continued pressure stays quiet", () => {
  const card = new PhysicsCard({ width: 1000, height: 800 });
  card.body.y = 770 - card.body.height / 2;
  card.beginDrag(card.body.x, card.body.y);
  card.moveDrag(card.body.x, card.body.y + 120);
  card.step(.05);
  assert.equal(card.drainFloorImpacts().length, 1);
  for (let i = 0; i < 120; i++) card.step(1 / 120);
  assert.equal(card.drainFloorImpacts().length, 0);
});
