import test from "node:test";
import assert from "node:assert/strict";
import { CONSTRUCTION_TRANSITIONS, constructionFrame, pathWindow, fractureCells } from "../public/construction-transitions.mjs";

const old = [{ x: 450, y: 370, width: 44, height: 64, angle: 0, role: "title" },
  { x: 610, y: 555, width: 230, height: 40, angle: -9, role: "card" },
  { x: 500, y: 415, width: 250, height: 20, angle: 0, role: "content" }];
const next = [{ x: 240, y: 310, width: 60, height: 70, angle: 0, role: "title" },
  { x: 290, y: 380, width: 220, height: 50, angle: 0, role: "content" }];
const destination = { left: 140, top: 180, width: 720, height: 350 };

test("page components visibly move apart before disappearing and the new page finishes intact", () => {
  for (const { id } of CONSTRUCTION_TRANSITIONS) {
    const start = constructionFrame(id, 0, old, next, destination);
    assert.ok(start.oldParts.every(p => p.opacity === 1 && p.dx === 0 && p.dy === 0 && p.scaleX === 1 && p.scaleY === 1));
    assert.ok(start.newParts.every(p => p.opacity === 0));
    const moving = constructionFrame(id, .16, old, next, destination);
    assert.ok(moving.oldParts.some(p => p.fragments.some(q => Math.hypot(q.dx, q.dy) > 2 && q.scale > 0)));
    const end = constructionFrame(id, 1, old, next, destination);
    assert.ok(end.oldParts.every(p => p.opacity === 0));
    assert.ok(end.newParts.every(p => p.opacity === 1 && p.dx === 0 && p.dy === 0 && p.angle === 0 && p.scaleX === 1 && p.scaleY === 1 && p.clipTop === 0 && p.clipBottom === 0));
    assert.equal(end.border, 1);
    assert.equal(end.lines.length + end.polygons.length + end.nodes.length + end.labels.length, 0);
  }
});

test("stroke trimming follows physical path length across corners and skips zero-length joints", () => {
  const route = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }];
  assert.deepEqual(pathWindow(route, .2, .8), [{ x: 60, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 140 }]);
  assert.deepEqual(pathWindow(route, 1, 1), []);
  assert.deepEqual(pathWindow(route, .8, .2), []);
});

test("assembly paths remain finite and seekable, with distinct fabrication sequences", () => {
  const sequences = new Set();
  for (const { id } of CONSTRUCTION_TRANSITIONS) {
    for (let i = 0; i <= 100; i++) {
      const f = constructionFrame(id, i / 100, old, next, destination);
      assert.doesNotMatch(JSON.stringify(f), /null|NaN|Infinity/);
      assert.deepEqual(f, constructionFrame(id, i / 100, old, next, destination));
    }
    sequences.add(JSON.stringify(constructionFrame(id, .61, old, next, destination)));
  }
  assert.equal(sequences.size, 3);
});

test("construction keeps the source shell visible and uses opaque geometry rather than fading decoration", () => {
  for (const { id } of CONSTRUCTION_TRANSITIONS) for (let i = 0; i <= 100; i++) {
    const frame = constructionFrame(id, i / 100, old, next, destination);
    assert.equal(frame.oldOpacity, 1, "the original header must stay visible through the endpoint");
    assert.equal(frame.newOpacity, 1);
    assert.ok([...frame.oldParts, ...frame.newParts, ...frame.lines, ...frame.polygons, ...frame.nodes, ...frame.labels]
      .every(item => item.opacity === 0 || item.opacity === 1), "no alpha tween for page parts or engineering marks");
    assert.ok(frame.border === 0 || frame.border === 1);
    assert.ok([...frame.oldParts, ...frame.newParts].every(q => q.scaleX === 1 && q.scaleY === 1), "type stays flat and keeps its proportions");
  }
});

test("actual content is fragmented, while whole element boxes never glide toward the next page", () => {
  for (const { id } of CONSTRUCTION_TRANSITIONS) {
    const broken = constructionFrame(id, .24, old, next, destination);
    assert.ok(broken.oldParts.every(q => q.dx === 0 && q.dy === 0 && q.fragments.length >= 4));
    assert.ok(broken.oldParts.some(q => q.fragments.some(f => f.scale > 0 && f.scale < 1)));
    const made = constructionFrame(id, .70, old, next, destination);
    assert.ok(made.newParts.every(q => q.dx === 0 && q.dy === 0));
    assert.ok(made.newParts.some(q => q.fragments.some(f => f.outline === 1 && f.ink < 1)));
  }
});

test("fracture cells tile the actual glyph rectangle with shared cut edges and no missing material", () => {
  const cells = fractureCells(42, 58, 7);
  const area = points => Math.abs(points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]; return sum + p.x * q.y - p.y * q.x;
  }, 0)) / 2;
  assert.ok(cells.length >= 8);
  assert.ok(Math.abs(cells.reduce((sum, c) => sum + area(c.points), 0) - 10000) < 1e-6);
  assert.deepEqual(cells, fractureCells(42, 58, 7));
});

test("dismantled content stays near its source instead of being stored on a material rail", () => {
  for (const { id } of CONSTRUCTION_TRANSITIONS) for (const p of [.12, .2, .3, .4]) {
    const frame = constructionFrame(id, p, old, next, destination);
    assert.ok(frame.oldParts.every(part => Math.hypot(part.dx, part.dy) < 110));
    assert.ok(frame.oldParts.every(part => part.scaleX === 1 && part.scaleY === 1));
  }
});
