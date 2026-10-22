import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { DEFAULT_IMPACT_STYLE, IMPACT_STYLES, ORIGINAL_IMPACT_STYLES, MOTION_IMPACT_STYLES, impactStyleFromSearch } from "../public/effect-variants.mjs";
import { createFloorImpact, drawFloorImpact } from "../public/floor-effects.mjs";

function setup({ reduced = false, search = "" } = {}) {
  class Element {
    constructor() {
      this.listeners = new Map(); this.children = []; this.attributes = new Map();
      this.value = ""; this.hidden = false;
      this.classList = { toggle() {} };
    }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    emit(type) { this.listeners.get(type)?.(); }
    append(child) { this.children.push(child); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    querySelector(selector) { return this[selector] ??= new Element(); }
    getBoundingClientRect() { return { width: 380, height: 217 }; }
    getContext() { return new Proxy({}, { get: () => () => {} }); }
  }
  const nodes = new Map(), document = new Element(), window = new Element();
  document.getElementById = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  document.createElement = () => new Element();
  for (const [id, value] of Object.entries({ strength: "hard", contact: "corner", direction: "1", speed: "0.5" })) {
    document.getElementById(id).value = value;
  }
  window.location = { search }; window.devicePixelRatio = 1;
  const preference = new Element(); preference.matches = reduced;
  window.matchMedia = () => preference;
  const frames = new Map(), effects = [], history = [];
  let frameId = 0;
  const source = readFileSync(new URL("../public/effects-preview.js", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");
  runInNewContext(source, { window, document, URLSearchParams, DEFAULT_IMPACT_STYLE, IMPACT_STYLES, ORIGINAL_IMPACT_STYLES, MOTION_IMPACT_STYLES, impactStyleFromSearch, drawFloorImpact,
    createFloorImpact: (...args) => { const effect = createFloorImpact(...args); effects.push(effect); return effect; },
    history: { replaceState: (...args) => history.push(args[2]) },
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame: id => frames.delete(id) });
  return { node: id => document.getElementById(id), document, window, frames, effects, history,
    advance(now) { const fns = [...frames.values()]; frames.clear(); fns.forEach(fn => fn(now)); } };
}

test("comparison choices share contact conditions and selection opens the correct real-site trial", () => {
  const e = setup({ search: "?impact=liquid" });
  assert.equal(e.node("comparisons").children.length, 3);
  assert.deepEqual(e.effects.map(x => x.style), MOTION_IMPACT_STYLES.map(x => x.id));
  assert.ok(e.effects.every(x => x.x === e.effects[0].x && x.power === e.effects[0].power && x.lean === e.effects[0].lean));
  assert.equal(e.node("try-style").href, "/?impact=liquid");
  const card = e.node("comparisons").children[2];
  card.querySelector("button").emit("click");
  assert.equal(e.node("try-style").href, "/?impact=shatter");
  assert.equal(card.querySelector("button").attributes.get("aria-pressed"), "true");
  assert.equal(e.history.at(-1), "?impact=shatter");
});

test("conditions and fresh patterns rebuild all views; scrubbing pauses on a coherent frame", () => {
  const e = setup();
  e.node("contact").value = "face"; e.node("contact").emit("change");
  assert.ok(e.effects.slice(-3).every(x => x.span > 100));
  e.node("strength").value = "soft"; e.node("strength").emit("change");
  assert.ok(e.effects.at(-1).power < e.effects[0].power);
  e.node("direction").value = "-1"; e.node("direction").emit("change");
  assert.ok(e.effects.at(-1).lean < 0);
  const previous = JSON.stringify(e.effects.at(-1).art);
  e.node("reroll").emit("click");
  assert.notEqual(JSON.stringify(e.effects.at(-1).art), previous);
  e.node("timeline").value = "540"; e.node("timeline").emit("input");
  assert.equal(e.frames.size, 0);
  assert.equal(e.node("toggle").textContent, "재생");
  assert.equal(e.node("scene-time").textContent, "충돌 +120ms");
  assert.ok(e.effects.slice(-3).every(x => Math.abs(x.age - .12) < 1e-10));
});

test("previous options remain available without replacing the new motion studies", () => {
  const old = setup({ search: "?collection=previous" });
  assert.equal(old.node("comparisons").children.length, 5);
  assert.deepEqual(old.effects.map(e => e.style), ORIGINAL_IMPACT_STYLES.map(s => s.id));
  assert.equal(setup().node("try-style").href, "/?impact=billow");
  assert.equal(setup({ search: "?impact=ink" }).node("try-style").href, "/?impact=ink");
});

test("reduced motion starts still; playback and hidden tabs schedule no duplicate frames", () => {
  const e = setup({ reduced: true });
  assert.equal(e.frames.size, 0);
  assert.equal(e.node("motion-note").hidden, false);
  e.node("toggle").emit("click");
  assert.equal(e.frames.size, 1);
  e.advance(0); e.advance(40);
  assert.equal(e.node("timeline").value, "560", "half-speed advances 20ms per 40ms frame");
  e.document.hidden = true; e.document.emit("visibilitychange");
  assert.equal(e.frames.size, 0);
  e.document.hidden = false; e.document.emit("visibilitychange");
  e.advance(50000);
  assert.equal(e.node("timeline").value, "560", "resuming does not skip through the hidden interval");
  assert.equal(e.frames.size, 1);
  e.node("toggle").emit("click");
  assert.equal(e.frames.size, 0);
});
