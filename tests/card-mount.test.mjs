import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsCard } from "../public/card-physics.mjs";
import { PhysicsWorld } from "../public/world-physics.mjs";
import { getBallOutline } from "../public/ball-shapes.mjs";

const mounted = (width = 1000, height = 800) => new PhysicsCard({ width, height, mounted: true });
function pin(card) {
  const b = card.body, y = -b.height / 2 + 16;
  return { x: b.x - Math.sin(b.angle) * y, y: b.y + Math.cos(b.angle) * y };
}
function hit(world, shape, speed = 700, time = 1) {
  const card = world.card, b = card.body;
  world.time = time;
  world.game.start(b.x + b.width * .30, b.y - b.height, 30, shape);
  const ball = world.game.ball;
  Object.assign(ball, { vx: 0, vy: speed, angle: 0, angularVelocity: 0 });
  const bottom = shape === "circle" ? ball.radius : Math.max(...getBallOutline(ball).map(p => p.y - ball.y));
  // Place on the actual rotated top face, with a small real overlap.
  const faceY = b.y + Math.tan(b.angle) * (ball.x - b.x) - b.height / (2 * Math.cos(b.angle));
  ball.y = faceY - bottom + 2;
  return world.resolveContacts();
}

test("initially mounted card stays in place under gravity without an idle animation loop", () => {
  const card = mounted(), before = { ...card.body };
  assert.equal(card.mounted, true);
  assert.equal(card.mount.hp, 300);
  assert.equal(card.mount.maxHp, 300);
  assert.equal(card.body.angle, 0);
  assert.equal(card.body.x, card.viewportWidth / 2);
  assert.ok(card.body.y > 800 * .4);
  for (let i = 0; i < 300; i++) card.step(1 / 60);
  assert.deepEqual(card.body, before);
  assert.equal(card.awake, false);
  assert.equal(card.beginDrag(card.body.x, card.body.y), false);
});

test("circle, heart and star collisions consume HP once per impact and preserve the material pin", () => {
  for (const shape of ["circle", "heart", "star"]) {
    const world = new PhysicsWorld({ width: 1000, height: 800, mounted: true });
    const initialPin = pin(world.card);
    assert.equal(hit(world, shape), true, shape);
    const hp = world.card.mount.hp;
    assert.ok(hp > 0 && hp < world.card.mount.maxHp, shape);
    world.resolveContacts();
    assert.equal(world.card.mount.hp, hp, "solver repetitions cannot do extra damage");
    for (let i = 0; i < 80; i++) {
      world.card.step(1 / 120);
      assert.ok(Math.hypot(pin(world.card).x - initialPin.x, pin(world.card).y - initialPin.y) < 1e-7);
    }
    assert.equal(world.game.score, 0);
  }
});

test("damage follows incoming speed, while quiet support and stale impacts do not consume HP", () => {
  const a = mounted(), b = mounted();
  a.receiveShapeImpact({ speed: 350, radius: 30, time: 1 });
  b.receiveShapeImpact({ speed: 1400, radius: 30, time: 1 });
  assert.ok(b.mount.hp < a.mount.hp);
  const hp = a.mount.hp;
  a.receiveShapeImpact({ speed: 1400, radius: 30, time: 1.01 });
  a.receiveShapeImpact({ speed: 40, radius: 30, time: 2 });
  assert.equal(a.mount.hp, hp);
});

test("a loose fastener swings more from the same real impulse, then settles around its fixed pin", () => {
  function amplitude(hp) {
    const world = new PhysicsWorld({ width: 1000, height: 800, mounted: true });
    world.card.mount.hp = hp;
    hit(world, "circle", 800);
    let peak = 0;
    for (let i = 0; i < 300; i++) {
      world.card.step(1 / 240);
      peak = Math.max(peak, Math.abs(world.card.body.angle - world.card.mount.restAngle));
    }
    return peak;
  }
  assert.ok(amplitude(75) > amplitude(300) * 10);
});

test("the final hit releases the current pose without teleporting, and gravity and dragging resume", () => {
  const card = mounted(); card.mount.hp = 1;
  card.body.angle += .12; card.mount.syncPose();
  const before = { ...card.body };
  card.receiveShapeImpact({ speed: 900, radius: 30, time: 1 });
  assert.equal(card.mount.hp, 0); assert.equal(card.mounted, false);
  assert.deepEqual(card.body, before);
  for (let i = 0; i < 15; i++) card.step(1 / 60);
  assert.ok(card.body.y > before.y + 40);
  assert.equal(card.beginDrag(card.body.x, card.body.y), true);
});

test("resizing preserves damage and detachment instead of healing or reattaching", () => {
  const card = mounted(); card.receiveShapeImpact({ speed: 900, radius: 30, time: 1 });
  const hp = card.mount.hp; card.resize(420, 650);
  assert.equal(card.mount.hp, hp); assert.equal(card.mounted, true);
  assert.ok(Math.abs(pin(card).x - 210) < 1e-7);
  card.mount.hp = 1; card.receiveShapeImpact({ speed: 900, radius: 30, time: 2 });
  card.resize(1000, 800); assert.equal(card.mounted, false); assert.equal(card.mount.hp, 0);
});

test("repeated real collisions break the fastener once, then the card reaches the existing floor", () => {
  const world = new PhysicsWorld({ width: 1000, height: 800, mounted: true });
  let hits = 0;
  while (world.card.mounted && hits < 30) {
    const hp = world.card.mount.hp;
    assert.equal(hit(world, ["circle", "heart", "star"][hits % 3], 900, 1 + hits * .2), true);
    assert.ok(world.card.mount.hp < hp);
    hits++;
  }
  assert.ok(hits >= 20 && hits <= 30);
  assert.equal(world.card.mount.hp, 0);
  world.game.active = false;
  for (let i = 0; i < 600; i++) world.step(1 / 60);
  assert.equal(world.card.mounted, false);
  assert.ok(Math.abs(Math.max(...world.card.corners.map(p => p.y)) - 800) < .01);
  assert.ok(Object.values(world.card.body).every(Number.isFinite));
});

test("a low-HP impulse rings down naturally and the shared scene can sleep again", () => {
  const world = new PhysicsWorld({ width: 1000, height: 800, mounted: true });
  world.card.mount.hp = 25;
  hit(world, "circle", 600);
  const hp = world.card.mount.hp;
  for (let i = 0; i < 3600; i++) world.card.step(1 / 240);
  assert.equal(world.card.awake, false);
  assert.equal(world.card.body.angle, world.card.mount.restAngle);
  assert.equal(world.card.mount.hp, hp);
});
