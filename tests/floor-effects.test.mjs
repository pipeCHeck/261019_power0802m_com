import test from "node:test";
import assert from "node:assert/strict";
import * as effects from "../public/floor-effects.mjs";

const hit = (overrides = {}) => ({ x: 500, y: 800, span: 0, angle: .4,
  normalSpeed: 700, tangentSpeed: 0, energy: 1e6, ...overrides });
const create = overrides => effects.createFloorImpact(hit(overrides), () => .5, "comic");
const bounds = shapes => {
  const points = shapes.flatMap(shape => shape.points);
  return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
    top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
};
function frame(effect, age) {
  effect.age = age;
  return effects.floorImpactShapes(effect, 1000, 800);
}

function seeded(seed) {
  return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
}

for (const [role, age] of [["flash", .035], ["dust", .16], ["shockwave", .08]]) {
  test(`${role} varies between equivalent collisions instead of replaying one template`, () => {
    const variants = new Set();
    for (let seed = 1; seed <= 8; seed++) {
      const effect = effects.createFloorImpact(hit({ energy: 8e6, normalSpeed: 1600 }), seeded(seed), "comic");
      const shapes = frame(effect, age).filter(s => s.role === role);
      assert.ok(shapes.length > 0);
      variants.add(JSON.stringify(shapes));
    }
    assert.equal(variants.size, 8);
  });
}

test("dust on opposite sides has independently shaped lobes rather than mirrored copies", () => {
  const effect = effects.createFloorImpact(hit({ energy: 8e6, normalSpeed: 1600 }), seeded(42), "comic");
  const dust = frame(effect, .16).filter(s => s.role === "dust");
  const center = s => s.points.reduce((sum, p) => sum + p.x, 0) / s.points.length;
  function signature(shape, side) {
    const b = bounds([shape]);
    return shape.points.map(p => [+(side * (p.x - (b.left + b.right) / 2) / (b.right - b.left)).toFixed(4),
      +((p.y - b.top) / (b.bottom - b.top)).toFixed(4)]);
  }
  const left = dust.find(s => center(s) < 500), right = dust.find(s => center(s) > 500);
  assert.ok(left && right);
  assert.notDeepEqual(signature(left, -1), signature(right, 1));
});

test("dust motion follows the contact momentum across different visual variants", () => {
  function mean(tangentSpeed) {
    let sum = 0, count = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const effect = effects.createFloorImpact(hit({ energy: 8e6, normalSpeed: 1600, tangentSpeed }), seeded(seed), "comic");
      for (const shape of frame(effect, .19).filter(s => s.role === "dust")) {
        sum += shape.points.reduce((total, p) => total + p.x - 500, 0) / shape.points.length;
        count++;
      }
    }
    return sum / count;
  }
  assert.ok(mean(1200) > mean(-1200) + 15);
});

test("variation stays stable within an animation frame and remains finite across many seeds", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const effect = effects.createFloorImpact(hit({ x: 995, span: seed % 2 ? 0 : 460,
      energy: seed * 4e5, normalSpeed: 300 + seed * 80, tangentSpeed: (seed % 3 - 1) * 900 }), seeded(seed), "comic");
    for (const age of [.02, .08, .16, .3, effect.life - .001]) {
      const shapes = frame(effect, age);
      assert.deepEqual(shapes, frame(effect, age));
      for (const shape of shapes) for (const p of shape.points) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        assert.ok(p.y >= 0 && p.y < 800);
      }
    }
    assert.equal(frame(effect, effect.life).length, 0);
  }
});

test("strong comic impacts combine a filled flash and chips instead of isolated beams or floor cracks", () => {
  const effect = create({ energy: 4e6, normalSpeed: 1500, tangentSpeed: 1100, angularSpeed: 9 });
  const shapes = frame(effect, .035);
  assert.ok(shapes.some(s => s.role === "flash" && s.fill === "ink" && s.closed));
  assert.ok(shapes.some(s => s.role === "flash" && s.fill === "paper"));
  assert.ok(shapes.filter(s => s.role === "shard" && s.fill === "ink").length >= 6);
  for (const shape of shapes.filter(s => !s.closed)) {
    assert.equal(shape.role, "shockwave");
    assert.ok(shape.points.length >= 9, "open accents must be curved waves, not long single lines");
  }
  const flash = bounds(shapes.filter(s => s.role === "flash"));
  assert.ok(flash.right - flash.left > 90);
  assert.ok(flash.bottom - flash.top < (flash.right - flash.left) * .85);
});

test("the attack flash gives way to outlined dust and debris rather than lingering as a pole", () => {
  const effect = create({ energy: 8e6, normalSpeed: 1600 });
  assert.ok(frame(effect, .03).some(s => s.role === "flash"));
  const late = frame(effect, .26);
  assert.ok(!late.some(s => s.role === "flash"));
  assert.ok(late.some(s => s.role === "dust" && s.fill === "paper" && s.stroke === "ink"));
  assert.ok(late.some(s => s.role === "shard"));
  assert.equal(frame(effect, effect.life).length, 0);
});

test("contact energy changes the burst scale and amount without making gentle touches full slams", () => {
  const soft = create({ energy: 1e5, normalSpeed: 250 }), hard = create({ energy: 8e6, normalSpeed: 1600 });
  const a = frame(soft, .035), b = frame(hard, .035);
  const softFlash = bounds(a.filter(s => s.role === "flash"));
  const hardFlash = bounds(b.filter(s => s.role === "flash"));
  assert.ok(hard.particles.length > soft.particles.length);
  assert.ok(hardFlash.right - hardFlash.left > (softFlash.right - softFlash.left) * 2);
  assert.ok(hardFlash.top < softFlash.top - 20);
});

test("a flat face spreads contact clusters over its real width", () => {
  const point = bounds(frame(create({ span: 0 }), .1));
  const face = bounds(frame(create({ span: 460, angle: 0 }), .1));
  assert.ok(face.right - face.left > 460);
  assert.ok(point.right - point.left < 300);
  assert.ok(face.left < 300 && face.right > 700);
});

test("sideways momentum biases the departing chips toward the incoming direction", () => {
  function chipCenter(tangentSpeed) {
    const shapes = frame(create({ tangentSpeed }), .1).filter(s => s.role === "shard");
    const points = shapes.flatMap(s => s.points);
    return points.reduce((sum, p) => sum + p.x, 0) / points.length;
  }
  assert.ok(chipCenter(1000) > chipCenter(-1000) + 8);
});

test("comic shapes wrap at the seam, stay above ground and expire with no residue", () => {
  const effect = create({ x: 995, energy: 8e6, normalSpeed: 1600 });
  const shapes = frame(effect, .1), points = shapes.flatMap(s => s.points);
  assert.ok(points.some(p => p.x >= 0 && p.x < 80));
  assert.ok(points.some(p => p.x > 920 && p.x <= 1000));
  for (const p of points) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(p.y >= 0 && p.y < 800);
  }
  assert.equal(frame(effect, effect.life).length, 0);
});
