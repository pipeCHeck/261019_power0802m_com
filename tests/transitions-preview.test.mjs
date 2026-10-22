import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { TRANSITIONS, TRANSITION_DURATION, SOURCE_CARD, transitionTracks } from "../public/transition-effects.mjs";
import { TransitionTimeline } from "../public/transition-timeline.mjs";
import { ENGINEERING_TRANSITIONS, ENGINEERING_DURATION, engineeringFrame, engineeringSVG } from "../public/engineering-transitions.mjs";
import { CONSTRUCTION_TRANSITIONS, CONSTRUCTION_DURATION, constructionFrame } from "../public/construction-transitions.mjs";

async function setup(reduced = false, search = "?collection=previous&style=paper") {
  const animations = [];
  class Element {
    constructor() {
      this.listeners = new Map(); this.nodes = new Map(); this.children = []; this.disabled = true;
      this.style = { setProperty() {} }; this.classList = { toggle() {} };
    }
    addEventListener(name, fn) { const a = this.listeners.get(name) ?? []; a.push(fn); this.listeners.set(name, a); }
    emit(name, properties = {}) { for (const fn of this.listeners.get(name) ?? []) fn(properties); }
    append(e) { this.children.push(e); }
    setAttribute() {}
    querySelector(selector) {
      if (!this.nodes.has(selector)) {
        const e = new Element();
        if (selector === ".scene-old" || selector === ".scene-new") e.contentDocument = sceneDocument();
        this.nodes.set(selector, e);
      }
      return this.nodes.get(selector);
    }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return Object.create({ left: 140, top: 180, width: 720, height: 350 }); }
    set srcdoc(html) { this.html = html; queueMicrotask(() => this.emit("load")); }
    animate(frames) {
      const a = { frames, currentTime: 0, cancelled: false, pause() {}, cancel() { this.cancelled = true; } };
      animations.push(a); return a;
    }
  }
  function sceneDocument() {
    const doc = new Element(); doc.body = new Element(); doc.head = new Element();
    doc.createElement = () => new Element(); doc.documentElement = { outerHTML: "<html></html>" };
    doc.fonts = { ready: Promise.resolve() }; return doc;
  }
  const nodes = new Map(), document = sceneDocument(), window = new Element(), preference = new Element();
  document.getElementById = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const node = id => document.getElementById(id);
  node("loop").checked = true; node("speed").value = "1";
  preference.matches = reduced; window.matchMedia = () => preference;
  const frames = new Map(); let next = 0;
  const source = readFileSync(new URL("../public/transitions-preview.js", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");
  runInNewContext(source, { window, document, TRANSITIONS, TRANSITION_DURATION, SOURCE_CARD, transitionTracks, TransitionTimeline,
    ENGINEERING_TRANSITIONS, ENGINEERING_DURATION, engineeringFrame, engineeringSVG,
    CONSTRUCTION_TRANSITIONS, CONSTRUCTION_DURATION, constructionFrame,
    prepareConstruction: () => ({ pieces: [{ x: 500, y: 380, width: 100, height: 40, angle: 0, role: "title", node: new Element() }] }),
    applyConstruction: (prepared, poses, border) => { prepared.pieces.forEach((p, i) => { p.node.pose = poses[i]; }); prepared.border = border; },
    location: { search }, URLSearchParams, history: { replaceState() {} }, console,
    DOMParser: class { parseFromString() { return sceneDocument(); } },
    fetch: async () => ({ ok: true, text: async () => "<html></html>" }),
    requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id) });
  await new Promise(resolve => setImmediate(resolve));
  return { node, document, window, preference, frames, animations,
    advance(now) { const f = [...frames.values()]; frames.clear(); f.forEach(fn => fn(now)); } };
}

test("all views seek together and a paused frame survives Back navigation", async () => {
  const e = await setup();
  assert.equal(e.node("comparisons").children.length, 4);
  assert.equal(e.node("toggle").disabled, false);
  assert.ok(e.animations.length > 12);
  e.node("timeline").value = "700"; e.node("timeline").emit("input");
  assert.equal(e.frames.size, 0);
  assert.ok(e.animations.every(a => a.currentTime === 700));
  e.window.emit("pagehide", { persisted: true }); e.window.emit("pageshow", { persisted: true });
  assert.ok(e.animations.every(a => !a.cancelled && a.currentTime === 700));
  assert.equal(e.frames.size, 0);
});

test("reduced motion starts still and explicit playback has one clock across visibility changes", async () => {
  const e = await setup(true);
  assert.equal(e.frames.size, 0);
  assert.equal(e.node("timeline").value, "1400");
  e.node("toggle").emit("click"); e.advance(0); e.advance(100);
  assert.equal(e.node("timeline").value, "100");
  e.document.hidden = true; e.document.emit("visibilitychange"); assert.equal(e.frames.size, 0);
  e.document.hidden = false; e.document.emit("visibilitychange"); e.document.emit("visibilitychange");
  assert.equal(e.frames.size, 1); e.advance(50000);
  assert.equal(e.node("timeline").value, "100");
});

test("new motion studies seek procedurally and finish on the visible destination without overlays", async () => {
  const e = await setup(true, "?collection=engineering&style=vector");
  const cards = e.node("comparisons").children;
  assert.equal(cards.length, 3);
  assert.equal(e.node("timeline").value, "2200");
  for (const card of cards) {
    assert.equal(Number(card.querySelector(".scene-new").style.opacity), 1);
    assert.equal(Number(card.querySelector(".scene-old").style.opacity), 0);
  }
  e.node("timeline").value = "900"; e.node("timeline").emit("input");
  const middle = cards.map(card => card.querySelector(".engineering-overlay").innerHTML);
  assert.ok(middle.every(s => s.includes("<defs>") && !s.includes("NaN")));
  e.node("timeline").value = "1300"; e.node("timeline").emit("input");
  assert.ok(cards.every((card, i) => card.querySelector(".engineering-overlay").innerHTML !== middle[i]));
  e.node("timeline").value = "900"; e.node("timeline").emit("input");
  assert.ok(cards.every((card, i) => card.querySelector(".engineering-overlay").innerHTML === middle[i]));
});

test("construction is the default collection and all page fragments follow the shared seekable playhead", async () => {
  const e = await setup(true, "?style=frame");
  const cards = e.node("comparisons").children;
  assert.equal(cards.length, 3);
  assert.equal(e.node("timeline").value, "3200");
  assert.equal(e.node("toggle").disabled, false);
  assert.equal(e.animations.length, 0);
  assert.ok(cards.every(card => Number(card.querySelector(".scene-old").style.opacity) === 1));
  e.node("timeline").value = "600"; e.node("timeline").emit("input");
  const sample = cards.map(card => card.querySelector(".engineering-overlay").innerHTML);
  assert.ok(sample.every(s => s.includes("polyline") && !s.includes("NaN")));
  e.node("timeline").value = "1900"; e.node("timeline").emit("input");
  assert.ok(cards.every((c, i) => c.querySelector(".engineering-overlay").innerHTML !== sample[i]));
  e.node("timeline").value = "600"; e.node("timeline").emit("input");
  assert.ok(cards.every((c, i) => c.querySelector(".engineering-overlay").innerHTML === sample[i]));
  e.window.emit("pagehide"); e.window.emit("pageshow");
  assert.equal(e.node("timeline").value, "600");
  assert.equal(e.frames.size, 0);
});
