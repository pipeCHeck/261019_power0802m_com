import test from "node:test";
import assert from "node:assert/strict";
import { ENGINEERING_TRANSITIONS, engineeringFrame, engineeringSVG } from "../public/engineering-transitions.mjs";

const destination = { left: 140, top: 180, width: 720, height: 350 };
test("each procedural transition starts on the home and ends on the same unobscured destination", () => {
  const silhouettes = new Set();
  for (const { id } of ENGINEERING_TRANSITIONS) {
    const first = engineeringFrame(id, 0, destination), last = engineeringFrame(id, 1, destination);
    assert.equal(first.oldOpacity, 1); assert.equal(first.newOpacity, 0);
    assert.equal(last.oldOpacity, 0); assert.equal(last.newOpacity, 1);
    assert.equal(last.lines.length + last.polygons.length + last.nodes.length + last.labels.length, 0);
    assert.deepEqual(last.clip, [[{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 760 }, { x: 0, y: 760 }]]);
    for (let i = 0; i <= 100; i++) {
      const frame = engineeringFrame(id, i / 100, destination);
      const svg = engineeringSVG(frame, "test");
      assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
      assert.deepEqual(frame, engineeringFrame(id, i / 100, destination));
    }
    silhouettes.add(JSON.stringify(engineeringFrame(id, .5, destination).clip));
  }
  assert.equal(silhouettes.size, 3);
});

test("elastic curvature settles and the grid joins without seams at its destination", () => {
  const early = engineeringFrame("elastic", .32, destination), late = engineeringFrame("elastic", .75, destination);
  assert.ok(early.amplitude > late.amplitude * 2);
  const grid = engineeringFrame("grid", .84, destination);
  assert.equal(grid.cells.length, 12);
  const area = points => Math.abs(points.reduce((n, p, i) => {
    const q = points[(i + 1) % points.length]; return n + p.x * q.y - q.x * p.y;
  }, 0)) / 2;
  assert.ok(Math.abs(grid.cells.reduce((n, p) => n + area(p), 0) - 720 * 350) < .001);
  for (const poly of grid.cells) for (const p of poly) {
    assert.ok(p.x >= 140 - .001 && p.x <= 860 + .001 && p.y >= 180 - .001 && p.y <= 530 + .001);
  }
});
