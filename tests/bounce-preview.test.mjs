import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { BOUNCE_STYLES, bounceStyleFromSearch, createBounceImpact, drawBounceImpact } from "../public/bounce-effects.mjs";
import { buildBounceDemo, sampleBounceEffect } from "../public/bounce-demo.mjs";
import { getBallOutline } from "../public/ball-shapes.mjs";

function setup({ reduced = false, search = "" } = {}) {
  const drawCalls = [];
  class Element {
    constructor() { this.listeners = new Map(); this.children = []; this.value = ""; this.classList = { toggle() {} }; }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    emit(name) { this.listeners.get(name)?.(); }
    append(child) { this.children.push(child); }
    setAttribute() {}
    querySelector(id) { return this[id] ??= new Element(); }
    getBoundingClientRect() { return { width: 420, height: 300 }; }
    getContext() { return new Proxy({}, { get: (_, name) => (...args) => drawCalls.push({ name, args }) }); }
  }
  const window = new Element(), document = new Element(), nodes = new Map(), preference = new Element();
  document.getElementById = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  document.createElement = () => new Element();
  for (const [id, value] of Object.entries({ shape: "heart", strength: "650", direction: "0", speed: "1", motion: "still", radius: "24" })) document.getElementById(id).value = value;
  window.location = { search }; window.devicePixelRatio = 1; preference.matches = reduced; window.matchMedia = () => preference;
  const frames = new Map(), created = []; let next = 0;
  const source = readFileSync(new URL("../public/bounce-preview.js", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");
  runInNewContext(source, { window, document, BOUNCE_STYLES, bounceStyleFromSearch, drawBounceImpact, buildBounceDemo, sampleBounceEffect, getBallOutline,
    createBounceImpact: (...args) => { const e = createBounceImpact(...args); created.push(e); return e; },
    history: { replaceState() {} }, requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id) });
  return { node: id => document.getElementById(id), window, document, frames, created, drawCalls,
    advance(now) { const fns = [...frames.values()]; frames.clear(); fns.forEach(fn => fn(now)); } };
}

test("bouncy comparison selects real-site trials and rebuilds actual shape collisions", () => {
  const e = setup({ search: "?bounce=bubbles" });
  assert.equal(e.node("comparisons").children.length, 3);
  assert.equal(e.node("try-style").href, "/?bounce=bubbles");
  e.node("comparisons").children[2].querySelector("button").emit("click");
  assert.equal(e.node("try-style").href, "/?bounce=spring");
  const previous = e.created.length;
  e.node("shape").value = "star"; e.node("shape").emit("change");
  assert.ok(e.created.slice(previous).every(x => x.shape === "star"));
  const old = JSON.stringify(e.created.at(-1).bits);
  e.node("reroll").emit("click");
  assert.notEqual(JSON.stringify(e.created.at(-1).bits), old);
  const beforeMotion = e.created.length;
  e.node("motion").value = "travel"; e.node("motion").emit("change");
  assert.ok(e.created.length > beforeMotion);
  assert.ok(e.created.slice(beforeMotion).some(x => Math.hypot(x.velocity.x, x.velocity.y) > 400));
  const oldSize = e.created.at(-1).size, beforeSize = e.created.length;
  e.node("radius").value = "64"; e.node("radius").emit("change");
  assert.ok(e.created.length > beforeSize);
  assert.ok(e.created.at(-1).size > oldSize);
});

test("the moving preview paints the same wrapped card copies used by its physics and masks", () => {
  const e = setup();
  e.node("motion").value = "travel"; e.node("motion").emit("change");
  e.node("timeline").value = "600"; e.drawCalls.length = 0; e.node("timeline").emit("input");
  // 210 + 700 * .6 = 630: the visible wrapped center is 210 in a 420px view.
  assert.ok(e.drawCalls.some(c => c.name === "translate" && Math.abs(c.args[0] - 210) < .001 && Math.abs(c.args[1] - 210) < .001));
});

test("circle scenes render a circular ball and remain usable when seeking", () => {
  const e = setup();
  e.node("shape").value = "circle"; e.node("shape").emit("change");
  e.node("timeline").value = "120"; e.drawCalls.length = 0; e.node("timeline").emit("input");
  assert.ok(e.drawCalls.some(c => c.name === "arc" && c.args[2] === 24));
  assert.ok(e.drawCalls.some(c => c.name === "fill"));
});

test("playback, slow motion, scrubbing and hidden-page resume share one clock", () => {
  const e = setup();
  assert.equal(e.frames.size, 1);
  e.advance(0); e.advance(50);
  assert.equal(e.node("timeline").value, "50");
  e.node("speed").value = ".25"; e.advance(100);
  assert.equal(e.node("timeline").value, "63");
  e.document.hidden = true; e.document.emit("visibilitychange"); assert.equal(e.frames.size, 0);
  e.document.hidden = false; e.document.emit("visibilitychange"); e.advance(50000);
  assert.equal(e.node("timeline").value, "63");
  e.node("timeline").value = "500"; e.node("timeline").emit("input");
  assert.equal(e.frames.size, 0); assert.equal(e.node("scene-time").textContent, "500ms");
  const reduced = setup({ reduced: true });
  assert.equal(reduced.frames.size, 0); assert.ok(Number(reduced.node("timeline").value) > 0);
  reduced.node("toggle").emit("click"); assert.equal(reduced.frames.size, 1);
});
