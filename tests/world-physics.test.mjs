import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsWorld } from "../public/world-physics.mjs";
import { getBallOutline } from "../public/ball-shapes.mjs";

function setup(shape = "circle", angle = 0) {
  const world = new PhysicsWorld({ width: 1000, height: 800 });
  Object.assign(world.card.body, { x: 500, y: 500, angle: 0, vx: 0, vy: 0, angularVelocity: 0 });
  world.game.start(500, 300, 30, shape);
  Object.assign(world.game.ball, { angle, vx: 0, vy: 400, angularVelocity: 0 });
  return world;
}

test("all three shapes bounce off the visible card and transfer less motion to the heavy card", () => {
  for (const shape of ["circle", "heart", "star"]) {
    for (const angle of [0, .7, 2.1]) {
      const world = setup(shape, angle), ball = world.game.ball;
      const bottom = shape === "circle" ? ball.radius : Math.max(...getBallOutline(ball).map(p => p.y - ball.y));
      ball.y = world.card.body.y - world.card.body.height / 2 - bottom + 2;
      assert.equal(world.resolveContacts(), true, `${shape} ${angle}`);
      assert.ok(ball.vy < 0, `${shape} should bounce up`);
      assert.ok(world.card.body.vy > 0 && world.card.body.vy < 100);
      assert.equal(world.game.score, 0, "physics contacts do not score clicks");
    }
  }
});

test("empty space outside a heart or star silhouette does not collide", () => {
  for (const shape of ["heart", "star"]) {
    const world = setup(shape), ball = world.game.ball;
    const bottom = Math.max(...getBallOutline(ball).map(p => p.y - ball.y));
    ball.y = world.card.body.y - world.card.body.height / 2 - bottom - 2;
    assert.ok(ball.y + ball.radius > world.card.body.y - world.card.body.height / 2);
    assert.equal(world.resolveContacts(), false);
    assert.equal(ball.vy, 400);
  }
});

test("a shallow contact at a star valley does not snap the shape to its convex hull", () => {
  const world = new PhysicsWorld({ width: 1000, height: 1000 });
  Object.assign(world.card.body, { x: 500, y: 500, angle: 3.9 });
  world.game.start(400, 227, 100, "star");
  Object.assign(world.game.ball, { angle: 0, vy: 100, angularVelocity: 0 });
  assert.equal(world.resolveContacts(), false);
  world.game.ball.y = 227.5;
  assert.equal(world.resolveContacts(), true);
  assert.ok(Math.hypot(world.game.ball.x - 400, world.game.ball.y - 227.5) < 2);
});

test("wrapped copies collide and off-center hits rotate the card", () => {
  const world = setup();
  world.card.body.x = 990;
  Object.assign(world.game.ball, { x: 120, y: 380 });
  assert.equal(world.resolveContacts(), true);
  assert.ok(world.game.ball.vy < 0);
  assert.ok(Math.abs(world.card.body.angularVelocity) > .01);
});

test("a held card remains pinned while it bounces a ball", () => {
  const world = setup();
  world.card.beginDrag(500, 500);
  Object.assign(world.game.ball, { y: 380 });
  assert.equal(world.resolveContacts(), true);
  assert.equal(world.card.body.x, 500);
  assert.equal(world.card.body.y, 500);
  assert.ok(world.game.ball.vy < 0);
});

test("substeps catch a fast small ball instead of letting it tunnel through", () => {
  const world = setup();
  Object.assign(world.card.body, { y: 350 });
  Object.assign(world.game.ball, { y: 180, radius: 8, vy: 2600 });
  world.step(.08);
  assert.ok(world.game.ball.vy < 0);
  assert.ok(world.game.ball.y < world.card.body.y);
});

test("a moving card can strike a stationary ball, with finite state during repeated contacts", () => {
  const world = setup("star", .3);
  Object.assign(world.card.body, { vy: -600, angularVelocity: .4 });
  Object.assign(world.game.ball, { y: 380, vy: 0 });
  assert.equal(world.resolveContacts(), true);
  assert.ok(world.game.ball.vy < -200);
  for (let i = 0; i < 600; i++) world.step(1 / 60);
  assert.ok(Object.values(world.card.body).every(Number.isFinite));
  assert.ok(Object.values(world.game.ball).filter(v => typeof v === "number").every(Number.isFinite));
  assert.ok(world.card.corners.every(p => p.y <= 800.001));
});

test("falling past the card still ends a round once, with the chosen shape retained", () => {
  for (const shape of ["circle", "heart", "star"]) {
    const world = setup(shape);
    Object.assign(world.card.body, { x: 180 });
    Object.assign(world.game.ball, { x: 800, y: 700, vy: 300 });
    let endings = 0;
    for (let i = 0; i < 200; i++) if (world.step(.02)) endings++;
    assert.equal(endings, 1);
    assert.equal(world.game.ball.shape, shape);
  }
});

test("the plate and ball fall on the same gravity scale", () => {
  const world = new PhysicsWorld({ width: 1200, height: 1600 });
  Object.assign(world.card.body, { x: 300, y: 300, vy: 0, angle: 0 });
  world.game.start(900, 300, 18, "circle");
  world.game.ball.vy = 0;
  for (let i = 0; i < 12; i++) world.step(1 / 60);
  assert.ok(Math.abs(world.card.body.y - world.game.ball.y) < 1.5);
  assert.ok(Math.abs(world.card.body.vy - world.game.ball.vy) < .001);
});
