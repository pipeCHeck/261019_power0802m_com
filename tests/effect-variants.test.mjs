import test from "node:test";
import assert from "node:assert/strict";
import { createFloorImpact, floorImpactShapes } from "../public/floor-effects.mjs";
import { impactStyleFromSearch } from "../public/effect-variants.mjs";

const hit = { x: 500, y: 700, span: 0, angle: .6, normalSpeed: 1600,
  tangentSpeed: 850, angularSpeed: 8, energy: 7e6 };
const styles = ["comic", "ink", "slash", "fracture", "ripple", "billow", "liquid", "shatter"];
const seeded = seed => () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const frame = (effect, age) => {
  effect.age = age;
  return floorImpactShapes(effect, 1000, 700);
};

test("all choices produce distinct silhouettes and motion from the same collision", () => {
  const signatures = styles.map(style => {
    const effect = createFloorImpact(hit, seeded(73), style);
    return JSON.stringify([.035, .12, .25].map(age => frame(effect, age)));
  });
  assert.equal(new Set(signatures).size, styles.length);
});

for (const style of styles.slice(1)) {
  test(`${style} varies per collision, stays coherent per frame, wraps and expires`, () => {
    const variants = new Set();
    for (let seed = 1; seed <= 8; seed++) {
      const effect = createFloorImpact({ ...hit, x: 995, span: seed % 2 ? 0 : 300 }, seeded(seed), style);
      const shapes = frame(effect, .12);
      assert.ok(shapes.length > 0);
      variants.add(JSON.stringify(shapes));
      assert.deepEqual(shapes, frame(effect, .12));
      const points = shapes.flatMap(s => s.points);
      const edgeBand = 120 + effect.span / 2;
      assert.ok(points.some(p => p.x >= 0 && p.x < edgeBand));
      assert.ok(points.some(p => p.x > 1000 - edgeBand && p.x <= 1000));
      for (const age of [0, .035, .25, effect.life - .001]) {
        for (const s of frame(effect, age)) for (const p of s.points) {
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
          assert.ok(p.y >= 0 && p.y < 700);
        }
      }
      assert.equal(frame(effect, effect.life).length, 0);
    }
    assert.equal(variants.size, 8);
  });

  test(`${style} responds to strength, contact width and incoming direction`, () => {
    function extent(overrides) {
      const e = createFloorImpact({ ...hit, ...overrides }, seeded(10), style);
      const p = frame(e, .12).flatMap(s => s.points);
      return { width: Math.max(...p.map(p => p.x)) - Math.min(...p.map(p => p.x)),
        height: 699 - Math.min(...p.map(p => p.y)),
        center: p.reduce((sum, p) => sum + p.x, 0) / p.length };
    }
    const soft = extent({ energy: 1e5, normalSpeed: 250, tangentSpeed: 0, angularSpeed: 0 });
    const hard = extent({});
    const face = extent({ span: 350 });
    assert.ok(hard.width > soft.width * 1.3);
    assert.ok(hard.height > soft.height * 1.3);
    assert.ok(face.width > hard.width + 100);
    assert.ok(extent({ tangentSpeed: 1200 }).center > extent({ tangentSpeed: -1200 }).center + 5);
  });
}

test("missing or unknown styles preserve the current default", () => {
  const normal = createFloorImpact(hit, seeded(1));
  const invalid = createFloorImpact(hit, seeded(1), "invalid");
  assert.equal(normal.style, "fracture");
  assert.deepEqual(frame(normal, .12), frame(invalid, .12));
});

test("trial links select only known styles without changing the default", () => {
  for (const style of styles) assert.equal(impactStyleFromSearch(`?impact=${style}`), style);
  for (const search of ["", "?impact=invalid", "?other=ink", "?impact=%3Cscript%3E"]) {
    assert.equal(impactStyleFromSearch(search), "fracture");
  }
});
