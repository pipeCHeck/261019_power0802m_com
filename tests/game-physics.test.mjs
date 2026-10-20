import test from "node:test";
import assert from "node:assert/strict";

import { BallGame } from "../public/game-physics.mjs";
import * as physics from "../public/game-physics.mjs";
import { getBallShapePath, selectBallShape } from "../public/ball-shapes.mjs";

const game = () => new BallGame({ width: 1000, height: 800 });
function fall(model) {
  for (let i = 0; i < 80 && model.ball.vy < 0; i++) model.step(.02);
}

test("first launch starts at zero and sends the ball upward", () => {
  assert.equal(typeof BallGame, "function", "BallGame is implemented");
  const model = game();
  model.start(500, 600);
  assert.equal(model.score, 0);
  assert.equal(model.active, true);
  assert.ok(model.ball.vy < 0);
  assert.equal(model.ball.x, 500);
});

test("a falling-ball hit increments the score and launches upward again", () => {
  const model = game(); model.start(500, 600); fall(model);
  const result = model.hit(model.ball.x, model.ball.y);
  assert.equal(result.hit, true);
  assert.equal(model.score, 1);
  assert.ok(model.ball.vy < 0);
  assert.equal(model.ball.vx, 0);
});

test("the clicked side determines horizontal launch direction", () => {
  for (const [offset, direction] of [[-9, 1], [9, -1]]) {
    const model = game(); model.start(500, 600); fall(model);
    model.hit(model.ball.x + offset, model.ball.y + 4);
    assert.equal(Math.sign(model.ball.vx), direction);
    assert.ok(model.ball.vy < 0);
  }
});

test("misses and clicks while rising do not award points or change velocity", () => {
  const model = game(); model.start(500, 600);
  const vy = model.ball.vy;
  assert.equal(model.hit(500, 600).hit, false);
  assert.equal(model.score, 0);
  assert.equal(model.ball.vy, vy);
  fall(model);
  const fallingVelocity = model.ball.vy;
  assert.equal(model.hit(20, 20).hit, false);
  assert.equal(model.score, 0);
  assert.equal(model.ball.vy, fallingVelocity);
});

test("ten-point milestones fire on ten and twenty, never on zero or adjacent hits", () => {
  const model = game(); model.start(500, 700);
  const milestones = [];
  for (let i = 1; i <= 21; i++) {
    fall(model);
    const result = model.hit(model.ball.x, model.ball.y);
    if (result.milestone) milestones.push(model.score);
  }
  assert.deepEqual(milestones, [10, 20]);
  assert.equal(model.score, 21);
});

test("falling below the viewport ends the round once and a new click resets score", () => {
  const model = game(); model.start(500, 600);
  let losses = 0;
  for (let i = 0; i < 300; i++) if (model.step(.02)) losses++;
  assert.equal(losses, 1);
  assert.equal(model.active, false);
  assert.equal(model.hit(500, 600).hit, false);
  model.start(400, 500);
  assert.equal(model.active, true);
  assert.equal(model.score, 0);
});

test("side walls reflect the ball and resize keeps it inside the new viewport", () => {
  const model = game(); model.start(950, 650); fall(model);
  model.hit(model.ball.x - 16, model.ball.y);
  let reflected = false;
  for (let i = 0; i < 30; i++) {
    model.step(.02);
    if (model.ball.vx < 0) reflected = true;
  }
  assert.equal(reflected, true);
  model.resize(320, 480);
  assert.ok(model.ball.x >= model.ball.radius && model.ball.x <= 320 - model.ball.radius);
  assert.ok(model.ball.y >= model.ball.radius && model.ball.y <= 480 - model.ball.radius);
  assert.equal(model.active, true);
});

test("free-flight movement is independent of frame rate", () => {
  const a = game(); const b = game(); a.start(500, 650); b.start(500, 650);
  for (let i = 0; i < 10; i++) a.step(.01);
  for (let i = 0; i < 5; i++) b.step(.02);
  assert.ok(Math.abs(a.ball.y - b.ball.y) < .000001);
  assert.ok(Math.abs(a.ball.vy - b.ball.vy) < .000001);
});

test("a chosen radius controls the launched ball and keeps it inside the viewport", () => {
  const model = game();
  model.start(15, 20, 60);
  assert.equal(model.ball.radius, 60);
  assert.equal(model.ball.x, 60);
  assert.equal(model.ball.y, 60);
  assert.equal(model.score, 0);
});

test("drag distance selects radius with practical minimum and maximum sizes", () => {
  assert.equal(typeof physics.radiusForDrag, "function", "Drag sizing is implemented");
  const bounds = { width: 1000, height: 800 };
  assert.equal(physics.radiusForDrag({ x: 100, y: 100 }, { x: 130, y: 140 }, bounds), 50);
  assert.equal(physics.radiusForDrag({ x: 100, y: 100 }, { x: 101, y: 100 }, bounds), 8);
  assert.equal(physics.radiusForDrag({ x: 100, y: 100 }, { x: 900, y: 700 }, bounds), 160);
});

test("a selected large ball shrinks to fit a smaller resized viewport", () => {
  const model = game();
  model.start(500, 600, 150);
  assert.equal(model.ball.radius, 150);
  model.resize(240, 200);
  assert.equal(model.ball.radius, 92);
  assert.ok(model.ball.x >= model.ball.radius && model.ball.x + model.ball.radius <= 240);
  assert.ok(model.ball.y >= model.ball.radius && model.ball.y + model.ball.radius <= 200);
  assert.equal(model.active, true);
});

test("shape selection gives hearts and stars ten percent each with exact bucket boundaries", () => {
  for (const [roll, expected] of [[0, "heart"], [.099999, "heart"], [.1, "star"], [.199999, "star"], [.2, "circle"], [.999999, "circle"]]) {
    assert.equal(selectBallShape(roll), expected);
  }
  const counts = { circle: 0, heart: 0, star: 0 };
  for (let index = 0; index < 1000; index++) counts[selectBallShape(index / 1000)]++;
  assert.deepEqual(counts, { circle: 800, heart: 100, star: 100 });
});

test("chosen non-circular shapes launch upright and rotate while flying", () => {
  const model = game();
  for (const shape of ["heart", "star"]) {
    model.start(500, 650, 30, shape);
    assert.equal(model.ball.shape, shape);
    assert.equal(model.ball.angle, 0);
    assert.ok(Math.abs(model.ball.angularVelocity) > .5);
    model.step(.2);
    assert.ok(Math.abs(model.ball.angle) > .1);
  }
});

test("the heart fits its collision circle at every rotation", () => {
  const tokens = getBallShapePath("heart").match(/[MCZ]|-?\d+(?:\.\d+)?/g);
  assert.equal(tokens.shift(), "M");
  let start = [Number(tokens.shift()), Number(tokens.shift())];
  while (tokens[0] === "C") {
    tokens.shift();
    const controls = Array.from({ length: 3 }, () => [Number(tokens.shift()), Number(tokens.shift())]);
    for (let sample = 0; sample <= 100; sample++) {
      const t = sample / 100;
      const u = 1 - t;
      const point = [0, 1].map(axis => u ** 3 * start[axis]
        + 3 * u ** 2 * t * controls[0][axis]
        + 3 * u * t ** 2 * controls[1][axis]
        + t ** 3 * controls[2][axis]);
      assert.ok(Math.hypot(point[0] - 50, point[1] - 50) <= 50,
        "rotating a heart must not extend outside its circular wall boundary");
    }
    start = controls[2];
  }
  assert.deepEqual(tokens, ["Z"]);
});

test("off-center catches turn the shape in the clicked direction without jumping its angle", () => {
  for (const [offset, direction] of [[-9, 1], [9, -1]]) {
    const model = game(); model.start(500, 650, 18, "heart"); fall(model);
    const angle = model.ball.angle;
    model.hit(model.ball.x + offset, model.ball.y);
    assert.equal(model.ball.angle, angle);
    assert.equal(Math.sign(model.ball.angularVelocity), direction);
    model.step(.1);
    assert.notEqual(model.ball.angle, angle);
  }
});

test("rotation is frame-rate independent and a ceiling bounce reverses spin", () => {
  const a = game(); const b = game();
  a.start(500, 650, 18, "star"); b.start(500, 650, 18, "star");
  for (let i = 0; i < 10; i++) a.step(.01);
  for (let i = 0; i < 5; i++) b.step(.02);
  assert.ok(Math.abs(a.ball.angle - b.ball.angle) < .000001);
  assert.ok(Math.abs(a.ball.angularVelocity - b.ball.angularVelocity) < .000001);
  const model = game(); model.start(500, 20, 18, "heart");
  const spin = model.ball.angularVelocity;
  model.step(.05);
  assert.ok(model.ball.angularVelocity * spin < 0);
});

test("circles, hearts and stars drop 400 pixels in about half a second", () => {
  for (const shape of ["circle", "heart", "star"]) {
    const model = new BallGame({ width: 1000, height: 1600 });
    model.start(500, 300, 18, shape);
    model.ball.vy = 0;
    let elapsed = 0;
    while (model.ball.y < 700 && elapsed < 1) {
      model.step(1 / 240); elapsed += 1 / 240;
    }
    assert.ok(elapsed > .49 && elapsed < .55, `${shape} fall took ${elapsed} seconds`);
  }
});

test("clicking each shape lifts it about ten percent higher on small and tall screens", () => {
  for (const height of [400, 900]) {
    for (const shape of ["circle", "heart", "star"]) {
      for (const offset of [-.5, 0, .5]) {
        const model = new BallGame({ width: 1000, height });
        model.start(500, height * .8, 18, shape);
        model.ball.vy = 0;
        const startY = model.ball.y;
        assert.equal(model.hit(model.ball.x + offset * model.ball.radius, model.ball.y).hit, true);
        for (let i = 0; i < 1600 && model.ball.vy < 0; i++) model.step(.001);
        const rise = startY - model.ball.y;
        const previousRise = Math.min(620 ** 2 / (2 * 900), height * .38)
          * (1 - Math.abs(offset) * .12) ** 2;
        assert.ok(rise > previousRise * 1.08 && rise < previousRise * 1.12,
          `${shape} click at ${offset}: rise ${rise}, previous ${previousRise}`);
      }
    }
  }
});

test("the faster game keeps the previous jump height on small and tall screens", () => {
  for (const height of [400, 900]) {
    function rise(gravity) {
      const model = new BallGame({ width: 1000, height });
      if (gravity) model.gravity = gravity;
      model.start(500, height * .8, 18, "circle");
      const startY = model.ball.y;
      for (let i = 0; i < 1600 && model.ball.vy < 0; i++) model.step(.001);
      return startY - model.ball.y;
    }
    assert.ok(Math.abs(rise() - rise(900)) < .01);
  }
});
