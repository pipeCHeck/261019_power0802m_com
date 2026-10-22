import test from "node:test";
import assert from "node:assert/strict";
import { createBounceImpact, bounceShapes } from "../public/bounce-effects.mjs";
import { clipBounceStrokes, updateBounceImpact } from "../public/bounce-placement.mjs";
import { getBallOutline } from "../public/ball-shapes.mjs";

const hit = { x: 500, y: 400, normal: { x: 0, y: -1 }, speed: 900, bounceSpeed: 1400, tangentSpeed: 0, radius: 30, shape: "circle" };
const ray = (a, b) => ({ points: [a, b], lineWidth: 1.2, closed: false, fill: null });
const inside = (p, poly) => {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) yes = !yes;
  }
  return yes;
};

test("a moving rotated card cuts only covered line sections, including a segment with both ends outside", () => {
  const s = ray({ x: 400, y: 400 }, { x: 600, y: 400 });
  const body = { x: 500, y: 400, width: 40, height: 70, angle: Math.PI / 4 };
  const cut = clipBounceStrokes([s], { card: body }, 1000);
  assert.equal(cut.length, 2);
  assert.equal(cut[0].points[0].x, 400);
  assert.equal(cut[1].points.at(-1).x, 600);
  assert.ok(cut[0].points.at(-1).x < 480 && cut[1].points[0].x > 520);
  assert.equal(clipBounceStrokes([s], { card: { ...body, width: 500, height: 500 } }, 1000).length, 0);
  assert.deepEqual(clipBounceStrokes([s], { card: { ...body, y: 700 } }, 1000), [s]);
});

test("masking follows each moving shape silhouette rather than filling heart notches or star valleys", () => {
  for (const shape of ["circle", "heart", "star"]) for (const angle of [0, .75]) {
    const ball = { x: 500, y: 400, radius: 35, angle, shape };
    const rays = Array.from({ length: 16 }, (_, i) => ray({ x: 450, y: 365 + i * 5 }, { x: 550, y: 365 + i * 5 }));
    const cuts = clipBounceStrokes(rays, { ball }, 1000);
    assert.ok(cuts.length > 0);
    const outline = getBallOutline(ball);
    for (const s of cuts) for (const p of s.points) {
      const clearance = shape === "circle" ? Math.hypot(p.x - 500, p.y - 400) - 35 : Math.min(...outline.map((a, i) => {
        const b = outline[(i + 1) % outline.length], dx = b.x - a.x, dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
        return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
      }));
      assert.ok(clearance >= .6, `${shape} must clear the round stroke cap`);
    }
    for (const s of cuts) for (let j = 1; j < s.points.length; j++) for (let t = 0; t <= 1; t += .1) {
      const a = s.points[j - 1], b = s.points[j], p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      assert.equal(shape === "circle" ? Math.hypot(p.x - 500, p.y - 400) < 35 : inside(p, getBallOutline(ball)), false);
    }
  }
  const notch = ray({ x: 498, y: 370 }, { x: 502, y: 370 });
  assert.deepEqual(clipBounceStrokes([notch], { ball: { x: 500, y: 400, radius: 35, angle: 0, shape: "heart" } }, 1000), [notch]);
});

test("wrapped card copies hide covered rays on both viewport edges", () => {
  const card = { x: 990, y: 400, width: 100, height: 80, angle: 0 };
  assert.equal(clipBounceStrokes([ray({ x: 1, y: 400 }, { x: 20, y: 400 })], { card }, 1000).length, 0);
  assert.equal(clipBounceStrokes([ray({ x: 970, y: 400 }, { x: 999, y: 400 })], { card }, 1000).length, 0);
});

test("fast contacts carry motion and finish sooner; abandoned effects retract once without reviving", () => {
  const still = createBounceImpact(hit, () => .5), fast = createBounceImpact({ ...hit, velocity: { x: 1800, y: 0 } }, () => .5);
  still.age = fast.age = .08;
  const centerX = e => { const pts = bounceShapes(e, 2000, 1000).flatMap(s => s.points); return pts.reduce((n, p) => n + p.x, 0) / pts.length; };
  assert.ok(centerX(fast) - centerX(still) > 80);
  assert.ok(fast.life < still.life);
  const bodies = { card: { x: 1200, y: 700, width: 50, height: 50, angle: 0 }, ball: { x: 1300, y: 200, radius: 30, shape: "circle", angle: 0 } };
  updateBounceImpact(still, bodies, 2000);
  assert.equal(still.retiredAt, null, "separation must not cut off the opening");
  still.age = .30;
  updateBounceImpact(still, bodies, 2000);
  const deadline = still.life;
  assert.ok(deadline >= .44 && deadline <= .5);
  still.age += .02;
  updateBounceImpact(still, { card: { ...bodies.card, x: 500, y: 400 } }, 2000);
  assert.equal(still.life, deadline);
  still.age = deadline;
  assert.equal(bounceShapes(still, 2000, 1000).length, 0);
});
