import test from "node:test";
import assert from "node:assert/strict";
import { TransitionTimeline } from "../public/transition-timeline.mjs";

test("pause, seek and speed changes preserve the transition's current position", () => {
  const t = new TransitionTimeline(1400);
  t.play(); t.tick(1000); t.tick(1100);
  assert.equal(t.position, 100);
  t.pause(); t.tick(9000);
  assert.equal(t.position, 100);
  t.seek(800); t.speed = .5; t.play(); t.tick(10000); t.tick(10100);
  assert.equal(t.position, 850);
  t.seek(9999); assert.equal(t.position, 1400);
  t.seek(-4); assert.equal(t.position, 0);
});

test("hidden-page resumption does not jump, and non-loop playback stops at the end", () => {
  const t = new TransitionTimeline(1400);
  t.play(); t.tick(0); t.tick(100); t.suspend();
  t.tick(50000);
  assert.equal(t.position, 100);
  t.seek(1380); t.play(); t.tick(51000); t.tick(51100);
  assert.equal(t.position, 1400);
  assert.equal(t.playing, false);
});

test("loop playback keeps the destination visible before starting a fresh transition", () => {
  const t = new TransitionTimeline(1400);
  t.loop = true; t.play(); t.tick(0);
  for (let i = 1; i <= 14; i++) t.tick(i * 100);
  assert.equal(t.position, 1400);
  for (let i = 15; i <= 24; i++) t.tick(i * 100);
  assert.equal(t.position, 1400);
  t.tick(2500);
  assert.equal(t.position, 0);
});
