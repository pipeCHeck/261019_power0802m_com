import test from "node:test";
import assert from "node:assert/strict";
import { createFloorImpact, floorImpactShapes } from "../public/floor-effects.mjs";

function impact(normalSpeed, tangentSpeed = 0, angularSpeed = 0) {
  return { x: 10000, y: 20000, span: 0, angle: .4, normalSpeed, tangentSpeed, angularSpeed,
    energy: .5 * 12 * normalSpeed ** 2 };
}
const create = hit => createFloorImpact(hit, () => .5);

test("ordinary impacts keep the existing energy, direction and rotation weighting", () => {
  for (const v of [150, 300, 600, 800]) {
    const hit = impact(v, v * .4, 2);
    const e = create(hit);
    const power = Math.sqrt(hit.energy / 8640000);
    const motion = Math.hypot(v, hit.tangentSpeed * .45) / 1800;
    const rotationGate = Math.max(0, Math.min(1, (v - 250) / 750));
    const slam = Math.max(0, (Math.max(power, motion) - .38) / .62 + .25 * (2 / 8) * rotationGate);
    assert.equal(e.power, power);
    assert.equal(e.slam, slam);
    assert.equal(e.lean, hit.tangentSpeed / (v + 240));
  }
});

test("D keeps growing in strength, size, reach and density beyond the former maximum", () => {
  let last = { power: 0, slam: 0, count: 0, width: 0, height: 0 };
  for (const speed of [1200, 1800, 2400, 3600, 7200]) {
    const e = create(impact(speed)); e.age = .12;
    const points = floorImpactShapes(e, 20000, 20000).flatMap(s => s.points);
    const now = { power: e.power, slam: e.slam, count: e.art.rocks.length,
      width: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)),
      height: 19999 - Math.min(...points.map(p => p.y)) };
    for (const key of Object.keys(now)) assert.ok(now[key] > last[key], `${key} must grow at ${speed}px/s`);
    last = now;
  }
  assert.ok(last.power > 1 && last.slam > 1);
});

test("sideways motion and rotation keep contributing beyond their previous saturation", () => {
  const slide = [2400, 4800, 9600].map(v => create(impact(600, v)));
  const spin = [8, 16, 32].map(v => create(impact(1000, 0, v)));
  for (const values of [slide, spin]) for (let i = 1; i < values.length; i++) {
    assert.ok(values[i].slam > values[i - 1].slam);
  }
});

test("overflow grows gradually without a hard ceiling or proportional particle explosion", () => {
  const a = create(impact(1200)), b = create(impact(12000)), c = create(impact(120000));
  assert.ok(c.power > b.power && b.power > a.power);
  assert.ok(c.slam > b.slam && b.slam > a.slam);
  assert.ok(c.art.rocks.length < b.art.rocks.length * 3);
  for (const e of [a, b, c]) {
    e.age = .08;
    for (const s of floorImpactShapes(e, 20000, 20000)) for (const p of s.points) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    }
    e.age = e.life;
    assert.equal(floorImpactShapes(e, 20000, 20000).length, 0);
  }
});
