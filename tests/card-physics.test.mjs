import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsCard } from "../public/card-physics.mjs";

const make = () => new PhysicsCard({ width: 1000, height: 800 });
function point(body, x, y) {
  return { x: body.x + Math.cos(body.angle) * x - Math.sin(body.angle) * y,
    y: body.y + Math.sin(body.angle) * x + Math.cos(body.angle) * y };
}
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < .001, `${actual} != ${expected}`); }

test("the card falls under gravity and its rotated corners stay above the floor", () => {
  const model = make();
  const y = model.body.y;
  model.step(.1);
  assert.ok(model.body.y > y);
  model.body.angle = .6;
  model.body.vy = 1500;
  for (let i = 0; i < 1800; i++) {
    model.step(1 / 60);
    assert.ok(model.corners.every(p => p.y <= 800.001));
    assert.ok(Object.values(model.body).every(Number.isFinite));
  }
  near(Math.max(...model.corners.map(p => p.y)), 800);
  assert.equal(model.awake, false, "a settled card should stop requesting frames");
});

test("the horizontal position wraps in both directions without changing momentum", () => {
  for (const x of [-8, 1008]) {
    const model = make();
    model.body.x = x;
    model.body.vx = x < 0 ? -100 : 100;
    model.step(.001);
    assert.ok(model.body.x >= 0 && model.body.x < 1000);
    assert.equal(Math.sign(model.body.vx), x < 0 ? -1 : 1);
    near(model.displayX, model.body.x);
  }
});

test("dragging pins the clicked local point instead of the center and rotates the card", () => {
  const model = make();
  Object.assign(model.body, { x: 500, y: 300, angle: .2 });
  const local = { x: 150, y: -45 };
  const grab = point(model.body, local.x, local.y);
  assert.equal(model.beginDrag(grab.x, grab.y), true);
  const angle = model.body.angle;
  model.moveDrag(grab.x + 100, grab.y - 20);
  model.step(.08);
  const heldPoint = point(model.body, local.x, local.y);
  near(heldPoint.x, grab.x + 100);
  near(heldPoint.y, grab.y - 20);
  assert.ok(Math.abs(model.body.angle - angle) > .01);
});

test("the opposite-edge copy uses the same grab point with no initial jump", () => {
  const model = make();
  Object.assign(model.body, { x: 990, y: 300, angle: 0 });
  assert.equal(model.beginDrag(25, 290), true);
  model.step(.001);
  const heldPoint = point(model.body, 35, -10);
  near(heldPoint.x, 25);
  near(heldPoint.y, 290);
  assert.ok(model.displayX >= 0 && model.displayX < 1000);
});

test("release retains movement and spin while cancellation drops without a throw", () => {
  const model = make();
  Object.assign(model.body, { x: 400, y: 300 });
  model.beginDrag(500, 270);
  model.moveDrag(580, 250);
  model.step(.06);
  model.endDrag();
  assert.ok(model.body.vx > 20);
  assert.ok(Math.abs(model.body.angularVelocity) > .01);
  assert.equal(model.drag, null);
  model.beginDrag(model.body.x, model.body.y);
  model.moveDrag(model.body.x + 40, model.body.y);
  model.step(.04);
  model.endDrag({ throwing: false });
  near(model.body.vx, 0);
  near(model.body.vy, 0);
  near(model.body.angularVelocity, 0);
});

test("a stationary grab stays attached when the card rests against the floor", () => {
  const model = make();
  for (let i = 0; i < 300; i++) model.step(1 / 60);
  const grab = { x: model.body.x - 200, y: model.body.y };
  assert.equal(model.beginDrag(grab.x, grab.y), true);
  for (let i = 0; i < 120; i++) {
    model.step(1 / 60);
    const held = point(model.body, -200, 0);
    near(held.x, grab.x); near(held.y, grab.y);
    assert.ok(model.corners.every(p => p.y <= 800.001));
  }
});

test("a rotated corner on a wrapped copy can be grabbed even if its center is farther away", () => {
  const model = new PhysicsCard({ width: 490, height: 800 });
  Object.assign(model.body, { x: 245, y: 300, angle: .3 });
  const grab = point(model.body, 228.9, -96.08);
  assert.equal(model.beginDrag(grab.x - 490, grab.y), true);
  model.step(.001);
  const held = point(model.body, 228.9, -96.08);
  near(held.x, grab.x - 490); near(held.y, grab.y);
});

test("resize keeps every rotation inside the vertical bounds and the body reachable", () => {
  const model = make();
  Object.assign(model.body, { x: 980, y: 750, angle: 1.2 });
  model.resize(320, 240);
  assert.ok(model.body.x >= 0 && model.body.x < 320);
  assert.ok(model.corners.every(p => p.y <= 240.001));
  assert.ok(Math.hypot(model.body.width, model.body.height) <= 208.001);
});

test("large frame gaps and repeated fast drags keep the body finite and above ground", () => {
  const model = make();
  for (let i = 0; i < 40; i++) {
    model.beginDrag(model.displayX, model.body.y);
    model.moveDrag(i % 2 ? -1500 : 2200, i % 3 ? 10 : 1100);
    model.step(.1);
    model.endDrag();
    model.step(.8);
    assert.ok(Object.values(model.body).every(Number.isFinite));
    assert.ok(model.corners.every(p => p.y <= 800.001));
  }
});

test("the card can fly and be dragged above the top without a ceiling bounce", () => {
  const model = make();
  Object.assign(model.body, { y: 40, vy: -900 });
  model.step(.08);
  assert.ok(model.body.y < 0);
  assert.ok(model.body.vy < 0);
  model.beginDrag(model.displayX, model.body.y);
  model.moveDrag(model.displayX, -220);
  model.step(.1);
  near(model.body.y, -220);
  assert.ok(model.corners.every(p => p.y < 0));
});

test("release preserves the hand's linear and angular momentum instead of braking it", () => {
  const model = make();
  Object.assign(model.body, { x: 300, y: 300 });
  model.beginDrag(400, 280);
  model.moveDrag(900, 180);
  model.step(.08);
  const { vx, vy, angularVelocity } = model.body;
  model.endDrag();
  near(model.body.vx, vx); near(model.body.vy, vy);
  near(model.body.angularVelocity, angularVelocity);
});

test("airborne translation and rotation keep momentum with little air drag", () => {
  const model = new PhysicsCard({ width: 1400, height: 2000 });
  Object.assign(model.body, { y: 400, vx: 600, angularVelocity: 6 });
  model.step(.5);
  assert.ok(model.body.vx / 600 > .93);
  assert.ok(model.body.angularVelocity / 6 > .93);
});

test("shaking different off-center grab points rotates responsively while staying pinned", () => {
  for (const local of [{ x: 170, y: -50 }, { x: 50, y: 50 }, { x: 100, y: 0 }]) {
    const model = new PhysicsCard({ width: 1400, height: 1800 });
    Object.assign(model.body, { x: 700, y: 700 });
    const grab = point(model.body, local.x, local.y);
    model.beginDrag(grab.x, grab.y);
    model.moveDrag(grab.x + 100, grab.y - 120);
    model.step(.05);
    assert.ok(model.body.angularVelocity < -2.5);
    const held = point(model.body, local.x, local.y);
    near(held.x, grab.x + 100); near(held.y, grab.y - 120);
  }
});

test("pressing the upper part of a standing card against the floor does not snap it sideways", () => {
  const model = make(), b = model.body;
  Object.assign(b, { x: 500, y: 800 - b.width / 2, angle: Math.PI / 2 });
  const local = { x: -b.width * .35, y: b.height * .1 };
  const grab = point(b, local.x, local.y);
  assert.equal(model.beginDrag(grab.x, grab.y), true);
  for (let i = 1; i <= 30; i++) {
    model.moveDrag(grab.x, grab.y + i * 4);
    model.step(1 / 60);
    near(b.angle, Math.PI / 2);
    near(Math.max(...model.corners.map(p => p.y)), 800);
    near(b.vy, 0); near(b.angularVelocity, 0);
  }
  // Pressure is blocked, so the hand can move farther down than the card.
  const held = point(b, local.x, local.y);
  near(held.x, grab.x); near(held.y, grab.y);
});

test("ground-constrained drags at arbitrary angles do not jump to a distant orientation", () => {
  for (const angle of [.12, .6, 1.2, 1.7, 2.8, 3.5]) {
    const model = make(), b = model.body;
    b.angle = angle;
    b.y = 800 - (Math.abs(Math.sin(angle)) * b.width + Math.abs(Math.cos(angle)) * b.height) / 2;
    const grab = point(b, -b.width * .3, b.height * .1);
    model.beginDrag(grab.x, grab.y);
    model.moveDrag(grab.x + 2, grab.y + 8);
    model.step(1 / 60);
    assert.ok(Math.abs(b.angle - angle) < .22);
    assert.ok(model.corners.every(p => p.y <= 800.001));
  }
});

test("the same hand path produces the same response across physics substeps", () => {
  const a = new PhysicsCard({ width: 1400, height: 1800 });
  const b = new PhysicsCard({ width: 1400, height: 1800 });
  for (const model of [a, b]) {
    Object.assign(model.body, { x: 700, y: 700 });
    model.beginDrag(870, 650);
  }
  a.moveDrag(970, 530); a.step(.05);
  for (let i = 1; i <= 12; i++) {
    b.moveDrag(870 + 100 * i / 12, 650 - 120 * i / 12);
    b.step(.05 / 12);
  }
  near(a.body.angle, b.body.angle);
  near(a.body.angularVelocity, b.body.angularVelocity);
});

test("a stationary grip settles toward the hanging orientation without a near-full turn", () => {
  for (const local of [{ x: 220, y: 85 }, { x: 220, y: -85 }, { x: 1, y: 85 }, { x: 60, y: 60 }]) {
    const model = new PhysicsCard({ width: 1600, height: 3000 });
    Object.assign(model.body, { x: 800, y: 1000 });
    model.beginDrag(800 + local.x, 1000 + local.y);
    const target = Math.atan2(Math.sin(-Math.PI / 2 - Math.atan2(local.y, local.x)),
      Math.cos(-Math.PI / 2 - Math.atan2(local.y, local.x)));
    let total = 0, maximum = 0, previous = 0;
    for (let i = 0; i < 1200; i++) {
      model.step(1 / 120);
      total += Math.atan2(Math.sin(model.body.angle - previous), Math.cos(model.body.angle - previous));
      previous = model.body.angle;
      maximum = Math.max(maximum, Math.abs(total));
      const held = point(model.body, local.x, local.y);
      near(held.x, 800 + local.x); near(held.y, 1000 + local.y);
    }
    // Allow a damped overshoot of balance, while ruling out the former
    // near-full spin from simply picking up a corner.
    assert.ok(maximum <= Math.abs(target) + .7, `excessive swing at ${JSON.stringify(local)}: ${maximum}`);
    assert.ok(Math.abs(total - target) < .1, "a held plate should settle instead of oscillating indefinitely");
  }
});

test("grasping a spinning corner captures angular momentum about that point", () => {
  const model = new PhysicsCard({ width: 1600, height: 3000 });
  Object.assign(model.body, { x: 800, y: 1000, angularVelocity: 8 });
  model.beginDrag(1020, 1085);
  assert.ok(model.body.angularVelocity > 0 && model.body.angularVelocity < 3);
  for (let i = 0; i < 720; i++) model.step(1 / 120);
  assert.ok(Math.abs(model.body.angularVelocity) < .03);
});

test("a new grip immediately stops the grabbed point even before the next frame", () => {
  const model = new PhysicsCard({ width: 1600, height: 3000 });
  Object.assign(model.body, { x: 800, y: 1000, vx: 100, vy: 300, angularVelocity: 8 });
  model.beginDrag(1020, 1085);
  const b = model.body;
  near(b.vx - b.angularVelocity * 85, 0);
  near(b.vy + b.angularVelocity * 220, 0);
  const captured = { vx: b.vx, vy: b.vy, spin: b.angularVelocity };
  model.endDrag();
  near(b.vx, captured.vx); near(b.vy, captured.vy); near(b.angularVelocity, captured.spin);
});

test("an unheld plate drops 400 pixels in about half a second", () => {
  const model = new PhysicsCard({ width: 1200, height: 2000 });
  Object.assign(model.body, { x: 600, y: 400, vy: 0, angle: 0 });
  let elapsed = 0;
  while (model.body.y < 800 && elapsed < 1) {
    model.step(1 / 240); elapsed += 1 / 240;
  }
  assert.ok(elapsed > .49 && elapsed < .55, `fall took ${elapsed} seconds`);
  assert.ok(model.corners.every(p => p.y <= 2000));
});

test("inertia produces alternating, decaying swings around the held center of mass", () => {
  for (const local of [{ x: 0, y: -80 }, { x: 170, y: -50 }]) {
    const model = new PhysicsCard({ width: 1600, height: 3000 });
    const equilibrium = -Math.PI / 2 - Math.atan2(local.y, local.x);
    Object.assign(model.body, { x: 800, y: 1000, angle: equilibrium });
    const grab = point(model.body, local.x, local.y);
    model.beginDrag(grab.x, grab.y);
    for (let i = 1; i <= 18; i++) {
      model.moveDrag(grab.x + i * 10, grab.y);
      model.step(.01);
    }
    let previousSpin = model.body.angularVelocity;
    const peaks = [];
    for (let i = 0; i < 720; i++) {
      model.step(1 / 120);
      if (i > 12 && previousSpin * model.body.angularVelocity < 0) {
        peaks.push(model.body.angle - equilibrium);
      }
      previousSpin = model.body.angularVelocity;
      const held = point(model.body, local.x, local.y);
      near(held.x, grab.x + 180); near(held.y, grab.y);
    }
    assert.ok(peaks.length >= 3, "the plate should swing through balance more than once");
    assert.ok(Math.abs(peaks[1]) > .065, "grip resistance must leave a freer return swing");
    for (let i = 1; i < peaks.length; i++) {
      assert.ok(peaks[i] * peaks[i - 1] < 0, "successive swings cross the hanging orientation");
      assert.ok(Math.abs(peaks[i]) < Math.abs(peaks[i - 1]) * .6,
        "each swing loses energy through the same continuous grip damping");
    }
    assert.ok(Math.abs(model.body.angle - equilibrium) < .002);
    assert.ok(Math.abs(model.body.angularVelocity) < .01);
  }
});

test("a held upper corner settles after its recoil rather than swaying indefinitely", () => {
  const model = new PhysicsCard({ width: 1600, height: 3000 });
  Object.assign(model.body, { x: 800, y: 1000 });
  model.beginDrag(1020, 915);
  for (let i = 0; i < 480; i++) model.step(1 / 120);
  const target = -Math.PI / 2 - Math.atan2(-85, 220);
  assert.ok(Math.abs(model.body.angle - target) < .025);
  assert.ok(Math.abs(model.body.angularVelocity) < .1);
});

test("a short-edge landing stops instead of rocking between corners indefinitely", () => {
  const model = make();
  Object.assign(model.body, { angle: 244 * .101, y: 250, vx: 200, vy: 300, angularVelocity: -3 });
  for (let i = 0; i < 480; i++) model.step(1 / 60);
  assert.equal(model.awake, false);
  near(model.body.vx, 0); near(model.body.angularVelocity, 0);
  near(Math.max(...model.corners.map(p => p.y)), 800);
});

test("a separating floor contact does not apply adhesive sideways friction", () => {
  const model = make();
  Object.assign(model.body, { y: 800 - model.body.height / 2, vx: 200, vy: -80 });
  model.collide(1 / 240);
  near(model.body.vx, 200);
  near(model.body.vy, -80);
  near(model.body.angularVelocity, 0);
});

test("a flat landing has a small visible rebound before settling", () => {
  const model = make();
  model.body.y = 800 - model.body.height / 2 - 240;
  let touched = false, rebound = 0;
  for (let i = 0; i < 480; i++) {
    model.step(1 / 240);
    const clearance = 800 - Math.max(...model.corners.map(p => p.y));
    if (clearance < .001) touched = true;
    if (touched) rebound = Math.max(rebound, clearance);
    assert.ok(clearance >= -.001);
  }
  assert.ok(rebound > 5 && rebound < 15, `rebound was ${rebound}px`);
  for (let i = 0; i < 480; i++) model.step(1 / 60);
  assert.equal(model.awake, false);
});

test("a sliding plate loses momentum gradually on the floor and still comes to rest", () => {
  const model = make();
  Object.assign(model.body, { y: 800 - model.body.height / 2, vx: 400 });
  const startX = model.body.x;
  model.step(.12);
  assert.ok(model.body.vx > 100 && model.body.vx < 250, `remaining speed ${model.body.vx}`);
  assert.ok(model.body.x - startX > 25 && model.body.x - startX < 45);
  for (let i = 0; i < 480; i++) model.step(1 / 60);
  assert.equal(model.awake, false);
  near(Math.max(...model.corners.map(p => p.y)), 800);
});
