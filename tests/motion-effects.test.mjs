import test from "node:test";
import assert from "node:assert/strict";
import { createFloorImpact, floorImpactShapes } from "../public/floor-effects.mjs";

const hit = { x: 500, y: 700, span: 0, angle: .5, normalSpeed: 1600,
  tangentSpeed: 900, angularSpeed: 8, energy: 7e6 };
const seeded = seed => () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
function shapes(effect, age, role) {
  effect.age = age;
  return floorImpactShapes(effect, 1000, 700).filter(s => !role || s.role === role);
}
function contour(points) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const left = Math.min(...xs), top = Math.min(...ys);
  const w = Math.max(...xs) - left, h = Math.max(...ys) - top;
  return points.map(p => [(p.x - left) / w, (p.y - top) / h]);
}

test("rolling dust reshapes its contour, then separates into new curls", () => {
  const e = createFloorImpact(hit, seeded(30), "billow");
  const a = shapes(e, .11, "billow-body")[0], b = shapes(e, .22, "billow-body")[0];
  assert.ok(a && b);
  const ca = contour(a.points), cb = contour(b.points);
  assert.ok(ca.some((p, i) => Math.hypot(p[0] - cb[i][0], p[1] - cb[i][1]) > .08), "the contour must deform beyond bounding-box scaling");
  assert.ok(shapes(e, .4, "billow-curl").length > 2, "late curls separate from the parent body");
});

test("dust inherits its rolling contour when separating into smaller curls", () => {
  const e = createFloorImpact(hit, seeded(30), "billow");
  const puff = e.art.plumes[0]; e.art.plumes = [puff];
  const bounds = age => {
    const points = shapes(e, age).filter(s => ["billow-body", "billow-curl"].includes(s.role)).flatMap(s => s.points);
    return [Math.min(...points.map(p => p.x)), Math.max(...points.map(p => p.x)),
      Math.min(...points.map(p => p.y)), Math.max(...points.map(p => p.y))];
  };
  const at = puff.delay + puff.split * puff.life;
  const a = bounds(at - .000001), b = bounds(at + .000001);
  assert.ok(a.every((v, i) => Math.abs(v - b[i]) < .01));
});

test("ink necks stretch and detach before the heads split into satellite drops", () => {
  const e = createFloorImpact(hit, seeded(30), "liquid");
  assert.ok(shapes(e, .06, "liquid-neck").length > 0);
  assert.ok(shapes(e, .06, "liquid-head").length > 0);
  assert.equal(shapes(e, .3, "liquid-neck").length, 0);
  assert.ok(shapes(e, .4, "liquid-satellite").length > 3);
});

test("splitting ink inherits the parent silhouette without a size pop", () => {
  const e = createFloorImpact(hit, seeded(30), "liquid");
  const jet = e.art.jets[4];
  e.art.jets = [jet];
  const bounds = age => {
    const p = shapes(e, age).flatMap(s => s.points);
    return [Math.min(...p.map(p => p.x)), Math.max(...p.map(p => p.x)),
      Math.min(...p.map(p => p.y)), Math.max(...p.map(p => p.y))];
  };
  const at = jet.delay + jet.split;
  const a = bounds(at - .000001), b = bounds(at + .000001);
  assert.ok(a.every((v, i) => Math.abs(v - b[i]) < .01), "the new droplets must partition the old head at birth");
});

test("fracture cells share a source silhouette then rotate, divide and erase along cuts", () => {
  const e = createFloorImpact(hit, seeded(30), "shatter");
  assert.ok(shapes(e, .02, "shatter-cell").length > 2);
  assert.ok(shapes(e, .045, "shatter-seam").length > 0);
  assert.ok(shapes(e, .4, "shatter-child").length > 4);
  assert.equal(shapes(e, .4, "shatter-cell").length, 0);
  const late = shapes(e, .66, "shatter-child");
  assert.ok(late.length > 0);
  assert.ok(late.some(s => s.points.length !== 3), "a moving cut must change polygon topology instead of uniformly shrinking triangles");
});

test("new motion paths remain coherent, finite, bounded and eventually empty through the entire life", () => {
  for (const style of ["billow", "liquid", "shatter"]) for (let seed = 1; seed <= 12; seed++) {
    const e = createFloorImpact({ ...hit, x: seed % 2 ? 995 : 500, span: seed % 3 ? 0 : 350 }, seeded(seed), style);
    for (let age = 0; age <= e.life; age += .017) {
      const a = shapes(e, age);
      assert.deepEqual(a, shapes(e, age));
      for (const s of a) for (const p of s.points) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        assert.ok(p.y >= 0 && p.y < 700);
      }
    }
    assert.equal(shapes(e, e.life).length, 0);
  }
});
