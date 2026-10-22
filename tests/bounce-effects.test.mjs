import test from "node:test";
import assert from "node:assert/strict";
import { BOUNCE_STYLES, createBounceImpact, bounceShapes, bounceStyleFromSearch, drawBounceImpact } from "../public/bounce-effects.mjs";

const hit = { x: 500, y: 400, normal: { x: 0, y: -1 }, speed: 700, tangentSpeed: 120, radius: 30, shape: "heart" };
const seeded = seed => () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
test("every comparison uses opaque open strokes, with no filled particles or closed outlines", () => {
  for (const { id } of BOUNCE_STYLES) {
    let strokes = 0;
    const ctx = { beginPath() {}, moveTo() {}, lineTo() {},
      stroke() { assert.equal(this.globalAlpha, 1); strokes++; },
      fill() { assert.fail(`${id} must not fill a particle`); },
      closePath() { assert.fail(`${id} must use open line strokes`); } };
    const e = createBounceImpact(hit, seeded(42), id);
    for (const age of [.04, .13, .26, .45]) {
      e.age = age;
      drawBounceImpact(ctx, e, 1000, 800);
    }
    assert.ok(strokes > 0);
  }
});
test("bouncy variants differ and remain stable, finite and temporary across normals and shapes", () => {
  const variants = new Set();
  for (const { id } of BOUNCE_STYLES) for (const shape of ["circle", "heart", "star"]) {
    const e = createBounceImpact({ ...hit, shape }, seeded(12), id);
    e.age = .13;
    const shapes = bounceShapes(e, 1000, 800);
    assert.ok(shapes.length > 0);
    assert.deepEqual(shapes, bounceShapes(e, 1000, 800));
    if (shape === "circle") variants.add(JSON.stringify(shapes));
    for (const age of [.01, .1, .25, .45, .7]) {
      e.age = age;
      for (const s of bounceShapes(e, 1000, 800)) for (const p of s.points) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    }
    e.age = e.life; assert.equal(bounceShapes(e, 1000, 800).length, 0);
  }
  assert.equal(variants.size, 3);
});
test("random variation, collision speed and the outgoing normal affect the actual motion", () => {
  for (const { id } of BOUNCE_STYLES) {
    const a = createBounceImpact(hit, seeded(1), id), b = createBounceImpact(hit, seeded(2), id);
    a.age = b.age = .15;
    assert.notDeepEqual(bounceShapes(a, 1000, 800), bounceShapes(b, 1000, 800));
    const hard = createBounceImpact({ ...hit, speed: 1800 }, seeded(1), id);
    assert.ok(hard.strength > a.strength);
    const flipped = createBounceImpact({ ...hit, normal: { x: 0, y: 1 } }, seeded(1), id);
    flipped.age = .15;
    const centerY = e => { const p = bounceShapes(e, 1000, 800).flatMap(s => s.points); return p.reduce((n, p) => n + p.y, 0) / p.length; };
    assert.ok(centerY(a) < 400 && centerY(flipped) > 400);
  }
});
test("trial query overrides accept known styles only", () => {
  assert.equal(bounceStyleFromSearch(""), null);
  assert.equal(bounceStyleFromSearch("?bounce=invalid"), null);
  for (const s of BOUNCE_STYLES) assert.equal(bounceStyleFromSearch(`?bounce=${s.id}`), s.id);
});

test("pop visibly expands with the actual bounce kick and ball radius, including large balls", () => {
  const reach = (kick, radius = 30) => {
    const e = createBounceImpact({ ...hit, bounceSpeed: kick, radius }, seeded(1), "pop");
    e.age = .13;
    return Math.max(...bounceShapes(e, 4000, 3000).flatMap(s => s.points).map(p => Math.hypot(p.x - e.x, p.y - e.y)));
  };
  const light = reach(200), medium = reach(1000), hard = reach(3000);
  assert.ok(medium > light * 1.7);
  assert.ok(hard > medium * 1.5);
  assert.ok(reach(6000) > hard);
  assert.ok(reach(1000, 60) > reach(1000, 18) * 1.8);
  assert.ok(reach(1000, 120) > reach(1000, 60) * 1.4);
  const fast = createBounceImpact({ ...hit, velocity: { x: 1800, y: 0 } }, seeded(1), "pop");
  fast.age = .30;
  assert.ok(bounceShapes(fast, 4000, 3000).length >= 5, "the opening must remain readable before retraction");
});
