import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { BallGame, radiusForDrag } from "../public/game-physics.mjs";
import { getBallShapePath, selectBallShape } from "../public/ball-shapes.mjs";
import { PhysicsWorld } from "../public/world-physics.mjs";
import { createFloorImpact, drawFloorImpact } from "../public/floor-effects.mjs";
import { impactStyleFromSearch } from "../public/effect-variants.mjs";
import { createBounceImpact, drawBounceImpact, bounceStyleFromSearch } from "../public/bounce-effects.mjs";
import { updateBounceImpact } from "../public/bounce-placement.mjs";

function setup({ reducedMotion = false, search = "", random = Math.random } = {}) {
  class Element {
    constructor() {
      this.listeners = new Map(); this.children = []; this.dataset = {}; this.hidden = false;
      this.captured = new Set(); this.classes = new Set();
      this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
      this.style = { setProperty: (key, value) => { this.style[key] = value; } };
      this.nodes = new Map();
    }
    addEventListener(name, listener) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(listener);
    }
    emit(name, properties = {}) {
      const event = { target: this, preventDefault() {}, ...properties };
      for (const listener of this.listeners.get(name) ?? []) listener(event);
    }
    querySelector(selector) {
      if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
      return this.nodes.get(selector);
    }
    closest(selector) { return this.isCard && selector.includes("[data-physics-card]") ? this : null; }
    cloneNode() { const clone = new Element(); clone.isCard = true; return clone; }
    append(child) {
      const index = this.children.indexOf(child);
      if (index !== -1) this.children.splice(index, 1);
      this.children.push(child);
    }
    replaceChildren(...children) { this.children = children; }
    get lastElementChild() { return this.children.at(-1); }
    getBoundingClientRect() { return { top: window.innerHeight - 44, height: 14 }; }
    setAttribute() {}
    removeAttribute() {}
    focus() {}
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); this.emit("lostpointercapture", { pointerId: id }); }
  }
  const window = new Element(), document = new Element(), layer = new Element(), card = new Element();
  card.isCard = true;
  layer.nodes.set("[data-physics-card]", card);
  document.nodes.set(".physics-card-layer", layer);
  document.documentElement = new Element();
  const elements = new Map();
  document.getElementById = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  document.createElement = () => new Element();
  const canvas = document.getElementById("game-canvas");
  const drawCalls = [], createdImpacts = [], createdBounces = [];
  canvas.getContext = () => new Proxy({}, { get: (_, name) => (...args) => drawCalls.push({ name, args }) });
  const frames = new Map(), timers = new Map(); let nextFrame = 0, nextTimer = 0, timerNow = 0, now = 0, model, world;
  const raf = fn => { frames.set(++nextFrame, fn); return nextFrame; };
  const cancel = id => frames.delete(id);
  Object.assign(window, { innerWidth: 1000, innerHeight: 800, devicePixelRatio: 1,
    performance: { now: () => now },
    getComputedStyle: () => ({ transform: "matrix(1, 0, 0, 1, 0, -12)" }),
    location: { search }, requestAnimationFrame: raf, cancelAnimationFrame: cancel,
    setTimeout: (fn, delay = 0) => { timers.set(++nextTimer, { fn, due: timerNow + delay }); return nextTimer; },
    clearTimeout: id => timers.delete(id), matchMedia: () => ({ matches: reducedMotion, addEventListener() {} }) });
  const context = { window, document, Math: Object.assign(Object.create(Math), { random }), requestAnimationFrame: raf, cancelAnimationFrame: cancel,
    PhysicsWorld: class extends PhysicsWorld { constructor(options) { super(options); model = this.card; world = this; } },
    BallGame, radiusForDrag, getBallShapePath, selectBallShape,
    createFloorImpact: (...args) => { const effect = createFloorImpact(...args); createdImpacts.push(effect); return effect; },
    drawFloorImpact, impactStyleFromSearch, drawBounceImpact, bounceStyleFromSearch, updateBounceImpact,
    createBounceImpact: (...args) => { const effect = createBounceImpact(...args); createdBounces.push(effect); return effect; } };
  for (const file of ["scene.js", "game.js", "card.js"]) {
    const source = readFileSync(new URL(`../public/${file}`, import.meta.url), "utf8")
      .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
    runInNewContext(source, context);
  }
  const pointer = (type, target = card, properties = {}) => {
    const event = { target, pointerId: 1, isPrimary: true, button: 0,
      clientX: model.displayX + 100, clientY: model.body.y - 20, ...properties };
    if (type === "pointerdown" && target.isCard) layer.emit(type, event);
    window.emit(type, event);
  };
  const advance = (milliseconds = 16) => {
    now += milliseconds;
    const pending = [...frames.values()]; frames.clear();
    for (const fn of pending) fn(now);
  };
  return { window, document, layer, card, canvas, model, world, scene: runInNewContext("scene", context),
    frames, pointer, advance, Element, drawCalls, createdImpacts, createdBounces,
    runTimers(ms) {
      const until = timerNow + ms;
      while (true) {
        const entry = [...timers].filter(([, t]) => t.due <= until).sort((a, b) => a[1].due - b[1].due)[0];
        if (!entry) break;
        const [id, timer] = entry; timers.delete(id); timerNow = timer.due; timer.fn();
      }
      timerNow = until;
    } };
}

function deliverImpact(env, x, speed = 1200) {
  env.model.floorImpacts.push({ x, y: 800, span: 0, angle: 0, normalSpeed: speed,
    tangentSpeed: 0, angularSpeed: 0, energy: .5 * 12 * speed ** 2 });
  env.scene.requestFrame(); env.advance(); env.advance();
}

const captionPosition = root => root.style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/).slice(1).map(Number);

test("shape impacts default to pop, consume events once, and respect trials and reduced motion", () => {
  for (const [search, reducedMotion, expected] of [["", false, 1], ["?bounce=pop", false, 1],
    ["?bounce=bubbles", false, 1], ["?bounce=spring", false, 1], ["?bounce=pop", true, 0]]) {
    const e = setup({ search, reducedMotion }); e.model.sleeping = true;
    e.world.shapeImpacts.push({ x: 500, y: 400, normal: { x: 0, y: -1 }, speed: 700, tangentSpeed: 0, radius: 30, shape: "heart" });
    e.scene.requestFrame(); e.advance(); e.advance();
    assert.equal(e.createdBounces.length, expected);
    if (expected) assert.equal(e.createdBounces[0].style, new URLSearchParams(search).get("bounce") || "pop");
    assert.equal(e.world.drainShapeImpacts().length, 0);
    assert.equal(e.world.game.score, 0);
    assert.equal(e.drawCalls.some(c => c.name === "lineTo"), expected === 1);
    for (let i = 0; i < 70; i++) e.advance();
    assert.equal(e.frames.size, 0);
  }
});

test("a contact from an earlier physics substep catches up before its first effect drawing", () => {
  const e = setup(); e.model.sleeping = true;
  e.world.shapeImpacts.push({ x: 500, y: 400, time: e.world.time - .04, normal: { x: 0, y: -1 },
    speed: 1000, tangentSpeed: 0, radius: 30, shape: "circle", velocity: { x: 800, y: 0 } });
  e.scene.requestFrame(); e.advance();
  assert.equal(e.createdBounces.length, 1);
  assert.ok(e.createdBounces[0].age >= .04);
});

test("interrupting an entrance erases only the visible slice without accelerating it through the window", () => {
  const env = setup({ random: () => .5 });
  deliverImpact(env, 500);
  const old = env.document.getElementById("impact-scores").children.at(-1);
  const window = old.querySelector(".score-window"), line = window.lastElementChild;
  window.getBoundingClientRect = () => ({ top: 200, height: 33 });
  line.getBoundingClientRect = () => ({ top: 188, height: 33 });
  deliverImpact(env, 510);
  assert.equal(line.style["--impact-exit-end"], line.style["--impact-exit-start"]);
  const clipStart = parseFloat(line.style["--impact-exit-clip-start"].match(/[\d.]+/)[0]);
  assert.ok(Math.abs(clipStart - 12 / 33 * 100) < .001);
  assert.equal(line.style["--impact-exit-clip-end"], "inset(100% 0 0 0)");
});

test("already settled impact badges keep their fast downward slide", () => {
  const env = setup({ random: () => .5 });
  deliverImpact(env, 500);
  const old = env.document.getElementById("impact-scores").children.at(-1);
  env.advance(650); env.runTimers(650);
  deliverImpact(env, 510);
  const line = old.querySelector(".score-window").lastElementChild;
  assert.equal(line.style["--impact-exit-end"], "translateY(110%)");
  assert.equal(line.style["--impact-exit-clip-end"], "inset(0)");
});

test("rapid same-position hits and recycled roots always give the newest number a clean entrance", () => {
  const env = setup({ random: () => .5 }), lines = new Set();
  env.model.sleeping = true; // Isolate injected contacts from the card's initial free fall.
  let latest;
  for (let i = 0; i < 10; i++) {
    deliverImpact(env, 500, 1234.5);
    latest = env.document.getElementById("impact-scores").children.at(-1);
    const line = latest.querySelector(".score-window").lastElementChild;
    lines.add(line);
    assert.equal(line.className, "score-line is-entering");
    assert.equal(line.style["--impact-exit-end"], undefined);
    assert.ok(parseFloat(line.textContent) < 1234.5);
    env.advance(33); env.runTimers(65);
  }
  assert.equal(lines.size, 10, "no retiring span can become a new counter");
  env.advance(650); env.runTimers(650);
  assert.ok(!latest.hidden);
  assert.equal(latest.querySelector(".score-window").lastElementChild.textContent, "1234.5px/s");
  assert.equal(latest.querySelector(".score-window").lastElementChild.className, "score-line is-current");
});

test("nearly coincident captions dismiss the old box downward in 180ms without resetting that deadline", () => {
  const env = setup({ random: () => .5 });
  deliverImpact(env, 500);
  const root = env.document.getElementById("impact-scores"), old = root.children.at(-1);
  const oldPosition = old.style.transform;
  deliverImpact(env, 512);
  const next = root.children.at(-1), line = old.querySelector(".score-window").lastElementChild;
  assert.notEqual(old, next);
  assert.equal(old.style.transform, oldPosition);
  assert.equal(line.className, "score-line is-dismissed");
  assert.equal(line.style["--impact-exit-start"], "matrix(1, 0, 0, 1, 0, -12)");
  env.runTimers(100);
  deliverImpact(env, 515);
  env.runTimers(79);
  assert.ok(!old.hidden);
  env.runTimers(1);
  assert.ok(old.hidden);
  assert.ok(!root.children.at(-1).hidden);
  env.runTimers(500);
  assert.ok(old.hidden, "the cancelled entrance callback must not revive an old box");
});

test("a nearby replacement clears immediately with reduced motion; separated captions keep their normal lifetime", () => {
  const reduced = setup({ reducedMotion: true, random: () => .5 });
  deliverImpact(reduced, 500);
  const old = reduced.document.getElementById("impact-scores").children.at(-1);
  deliverImpact(reduced, 510);
  assert.ok(old.hidden);
  assert.ok(!reduced.document.getElementById("impact-scores").children.at(-1).hidden);
  const env = setup({ random: () => .5 });
  deliverImpact(env, 500);
  const separate = env.document.getElementById("impact-scores").children.at(-1);
  deliverImpact(env, 600);
  env.runTimers(180);
  assert.ok(!separate.hidden);
  assert.equal(separate.querySelector(".score-window").lastElementChild.className, "score-line is-entering");
});

test("fast dismissal includes 45px horizontally and 16px vertically, but excludes larger gaps", () => {
  for (const [dx, dy, dismisses] of [[45, 16, true], [45.1, 16, false], [45, 16.1, false]]) {
    const env = setup({ random: () => .5 });
    const email = env.document.querySelector(".contact-email");
    email.getBoundingClientRect = () => ({ top: 720, height: 14 });
    deliverImpact(env, 400);
    const old = env.document.getElementById("impact-scores").children.at(-1);
    const oldTop = captionPosition(old)[1];
    // A repeated .5 sample yields -10px on the second badge; compensate
    // through the measured email baseline to exercise exact screen gaps.
    email.getBoundingClientRect = () => ({ top: oldTop + dy + 10 + 16.5 - 7, height: 14 });
    deliverImpact(env, 400 + dx);
    const next = env.document.getElementById("impact-scores").children.at(-1);
    const actualDy = Math.abs(captionPosition(next)[1] - oldTop);
    assert.ok(Math.abs(actualDy - dy) < .001);
    assert.equal(old.querySelector(".score-window").lastElementChild.className === "score-line is-dismissed", dismisses);
  }
});

test("recycled captions return to the front without moving existing captions", () => {
  const env = setup();
  deliverImpact(env, 500);
  const root = env.document.getElementById("impact-scores"), first = root.children.at(-1);
  env.runTimers(1000);
  deliverImpact(env, 510);
  const second = root.children.at(-1), position = second.style.transform;
  assert.notEqual(first, second);
  env.runTimers(1300);
  assert.ok(first.hidden && !second.hidden);
  deliverImpact(env, 520);
  assert.equal(root.children.length, 2, "the expired node may be recycled");
  assert.equal(root.children.at(-1), first, "the newest effect must be last in paint order even when recycled");
  assert.equal(second.style.transform, position);
  assert.ok(!second.hidden);
});

test("impact numbers count up over the same duration for small and large speeds", () => {
  const results = [];
  for (const speed of [600, 24000]) {
    const env = setup();
    deliverImpact(env, 500, speed);
    const shown = env.document.getElementById("impact-scores").children.find(s => !s.hidden);
    const line = shown.querySelector(".score-window").lastElementChild;
    assert.ok(parseFloat(line.textContent) > 0 && parseFloat(line.textContent) < speed);
    env.advance(309); // 16ms since birth + 309ms = half of the 650ms count.
    results.push(parseFloat(line.textContent) / speed);
    assert.ok(parseFloat(line.textContent) < speed);
    env.advance(325);
    assert.equal(line.textContent, `${speed.toFixed(1)}px/s`);
    env.advance(100);
    assert.equal(line.textContent, `${speed.toFixed(1)}px/s`);
  }
  assert.ok(Math.abs(results[0] - results[1]) < .0001);
});

test("impact badge heights vary around the email's height", () => {
  const env = setup(), tops = [];
  for (let i = 0; i < 6; i++) {
    deliverImpact(env, 500);
    const shown = env.document.getElementById("impact-scores").children.filter(s => !s.hidden).at(-1);
    const [left, top] = captionPosition(shown);
    assert.ok(left >= 8);
    assert.ok(Math.abs(top + 16.5 - (800 - 37)) <= 10);
    if (tops.length) assert.ok(Math.abs(top - tops.at(-1)) >= 4);
    tops.push(top);
  }
});

test("nearby collisions leave the existing badge in place and count independently", () => {
  const env = setup();
  deliverImpact(env, 400, 2400);
  const shown = env.document.getElementById("impact-scores").children.find(s => !s.hidden);
  const oldLine = shown.querySelector(".score-window").lastElementChild;
  const oldValue = oldLine.textContent;
  const oldPosition = shown.style.transform;
  assert.ok(parseFloat(oldValue) < 2400);
  deliverImpact(env, 470, 600);
  const next = env.document.getElementById("impact-scores").children.filter(s => !s.hidden).at(-1);
  assert.notEqual(next, shown);
  assert.equal(shown.style.transform, oldPosition);
  assert.equal(shown.dataset.value, "2400.0px/s");
  assert.ok(parseFloat(oldLine.textContent) > parseFloat(oldValue));
  assert.equal(oldLine.className, "score-line is-entering");
  assert.ok(parseFloat(next.querySelector(".score-window").lastElementChild.textContent) < 600);
  env.advance(650);
  assert.equal(oldLine.textContent, "2400.0px/s");
  assert.equal(next.querySelector(".score-window").lastElementChild.textContent, "600.0px/s");
  env.window.innerHeight = 400; env.window.emit("resize"); env.advance(1000); env.runTimers(5000);
  assert.ok(shown.hidden, "cancelled counters and timers must not redraw a cleared badge");
});

test("floor contact displays its incoming speed directly in px/s without normalization", () => {
  const env = setup();
  deliverImpact(env, 310, 2400);
  const slots = env.document.getElementById("impact-scores").children;
  const visible = slots.filter(s => !s.hidden);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].dataset.value, "2400.0px/s");
  assert.equal(captionPosition(visible[0])[0], 252);
  assert.equal(env.world.game.active, false);
  assert.equal(env.document.getElementById("game-score").dataset.value, undefined);
  deliverImpact(env, 310, 599.96);
  assert.equal(slots.at(-1).dataset.value, "600.0px/s");
  deliverImpact(env, 310, 1234.56);
  assert.equal(slots.at(-1).dataset.value, "1234.6px/s");
  assert.equal(visible[0].dataset.value, "2400.0px/s");
});

test("every collision gets a fresh effect without relocating or evicting live badges", () => {
  const env = setup();
  deliverImpact(env, 300);
  const slots = env.document.getElementById("impact-scores").children;
  assert.equal(slots.filter(s => !s.hidden).length, 1);
  const first = slots.find(s => !s.hidden);
  const firstPosition = first.style.transform;
  deliverImpact(env, 320, 1800);
  assert.equal(slots.filter(s => !s.hidden).length, 2);
  assert.equal(first.dataset.value, "1200.0px/s");
  assert.equal(first.querySelector(".score-window").children.length, 1);
  for (const x of [20, 550, 780, 990]) deliverImpact(env, x);
  assert.equal(slots.filter(s => !s.hidden).length, 6);
  deliverImpact(env, 140);
  assert.equal(slots.filter(s => !s.hidden).length, 7);
  assert.equal(first.style.transform, firstPosition);
  assert.equal(captionPosition(slots.at(-1))[0], 82);
  assert.ok(slots.every(s => s.querySelector(".score-window").children.length === 1));
});

test("impact numbers transition out, clear on resize, and remain readable without motion", () => {
  for (const reducedMotion of [false, true]) {
    const env = setup({ reducedMotion });
    deliverImpact(env, -10);
    const slots = env.document.getElementById("impact-scores").children;
    const shown = slots.find(s => !s.hidden);
    assert.ok(shown);
    assert.equal(captionPosition(shown)[0], 876);
    if (reducedMotion) assert.equal(shown.querySelector(".score-window").lastElementChild.textContent, "1200.0px/s");
    env.runTimers(reducedMotion ? 1000 : 1650);
    if (!reducedMotion) {
      assert.equal(shown.querySelector(".score-window").lastElementChild.className, "score-line is-leaving");
      env.runTimers(650);
    }
    assert.ok(shown.hidden);
    deliverImpact(env, 200);
    env.window.innerHeight = 400; env.window.emit("resize");
    assert.ok(slots.every(s => s.hidden));
    env.runTimers(5000);
    assert.ok(slots.every(s => s.hidden), "cleared timers cannot resurrect old numbers");
  }
});

test("card dragging captures its pointer without starting the ball; blank-space clicks still play", () => {
  const env = setup();
  env.pointer("pointerdown");
  assert.ok(env.model.drag);
  assert.ok(env.layer.hasPointerCapture(1));
  assert.notEqual(env.canvas.dataset.state, "sizing");
  const start = env.model.drag.x;
  env.pointer("pointermove", env.card, { pointerId: 2, clientX: 100 });
  assert.equal(env.model.drag.x, start);
  env.pointer("pointermove", env.card, { clientX: 700 });
  env.advance(); env.advance();
  env.pointer("pointerup", env.card, { clientX: 720 });
  assert.equal(env.model.drag, null);
  assert.ok(!env.layer.hasPointerCapture(1));
  assert.ok(env.model.body.vx > 0);
  env.pointer("pointerdown", new env.Element(), { clientX: 100, clientY: 100 });
  assert.equal(env.canvas.dataset.state, "sizing");
  env.pointer("pointerup", new env.Element(), { clientX: 100, clientY: 100 });
  assert.equal(env.canvas.dataset.state, "playing");
});

test("capture interruptions release the card without leaving a drag or a throw", () => {
  for (const reason of ["pointercancel", "blur", "Escape", "lostpointercapture", "hidden", "resize"]) {
    const env = setup();
    env.pointer("pointerdown");
    env.pointer("pointermove", env.card, { clientX: 700 });
    env.advance(); env.advance();
    if (reason === "Escape") env.window.emit("keydown", { key: "Escape" });
    else if (reason === "lostpointercapture") env.layer.releasePointerCapture(1);
    else if (reason === "hidden") {
      env.document.hidden = true;
      env.document.emit("visibilitychange");
      assert.equal(env.frames.size, 0);
      env.document.hidden = false;
      env.document.emit("visibilitychange");
      assert.ok(env.frames.size > 0);
    } else if (reason === "resize") {
      env.window.innerWidth = 320; env.window.innerHeight = 240;
      env.window.emit("resize");
      assert.ok(env.model.corners.every(p => p.y <= 240.001));
    } else env.window.emit(reason, { pointerId: 1 });
    assert.equal(env.model.drag, null, reason);
    assert.equal(env.layer.hasPointerCapture(1), false, reason);
    assert.equal(env.document.documentElement.classes.has("card-dragging"), false, reason);
    assert.equal(env.model.body.vx, 0, reason);
    assert.equal(env.model.body.angularVelocity, 0, reason);
  }
});

test("the card and ball share one frame clock and physics advances only once", () => {
  const env = setup();
  env.pointer("pointerdown", new env.Element(), { clientX: 100, clientY: 200 });
  env.pointer("pointerup", new env.Element(), { clientX: 100, clientY: 200 });
  assert.equal(env.frames.size, 1);
  const ball = env.world.game.ball, y = ball.y, vy = ball.vy;
  env.advance(); env.advance();
  const expected = y + vy * .016 + .5 * env.world.game.gravity * .016 ** 2;
  assert.ok(Math.abs(ball.y - expected) < .000001);
  assert.equal(env.frames.size, 1);
});

test("shared scene reports one GG/LOVE/STAR ending and allows a fresh round", () => {
  for (const [shape, text] of [["circle", "GG"], ["heart", "LOVE"], ["star", "STAR"]]) {
    const env = setup();
    env.model.body.x = 180;
    env.world.game.start(800, 700, 18, shape);
    env.world.game.ball.vy = 400;
    let endings = 0;
    env.scene.subscribe(({ ended }) => { if (ended) endings++; });
    env.scene.requestFrame();
    for (let i = 0; i < 120; i++) env.advance();
    assert.equal(endings, 1);
    assert.equal(env.canvas.dataset.state, "ended");
    assert.equal(env.document.getElementById("game-score").dataset.value, text);
    env.pointer("pointerdown", new env.Element(), { clientX: 800, clientY: 100 });
    env.pointer("pointerup", new env.Element(), { clientX: 800, clientY: 100 });
    assert.equal(env.canvas.dataset.state, "playing");
    assert.equal(env.document.getElementById("game-score").dataset.value, "0");
  }
});

test("the shared frame delivers floor contacts once and renders strokes without starting a game", () => {
  const env = setup(), deliveries = [];
  Object.assign(env.model.body, { y: 796 - env.model.body.height / 2, vy: 950, angle: 0 });
  env.scene.subscribe(({ floorImpacts }) => deliveries.push(floorImpacts));
  env.advance();
  env.drawCalls.length = 0;
  env.advance();
  assert.equal(deliveries.at(-1)?.length, 1);
  assert.ok(env.drawCalls.some(call => call.name === "lineTo"));
  assert.ok(env.drawCalls.some(call => call.name === "fill"), "the comic impact uses filled silhouettes");
  assert.equal(env.createdImpacts[0]?.style, "fracture", "the normal site uses the original D effect");
  assert.equal(env.world.game.active, false);
  assert.equal(env.model.drainFloorImpacts().length, 0);
  env.advance();
  assert.equal(deliveries.at(-1).length, 0);
  for (let i = 0; i < 180; i++) env.advance();
  assert.equal(env.frames.size, 0, "effect frames stop when the strokes and plate settle");
});

test("reduced motion consumes floor events without drawing an impact animation", () => {
  const env = setup({ reducedMotion: true });
  Object.assign(env.model.body, { y: 796 - env.model.body.height / 2, vy: 950 });
  env.advance();
  env.drawCalls.length = 0;
  env.advance();
  assert.equal(env.model.drainFloorImpacts().length, 0);
  assert.ok(!env.drawCalls.some(call => call.name === "lineTo"));
  assert.ok(!env.drawCalls.some(call => call.name === "fill"));
});

test("a style trial uses the selected renderer on real floor contacts", () => {
  for (const style of ["ink", "slash", "fracture", "ripple", "billow", "liquid", "shatter"]) {
    const env = setup({ search: `?impact=${style}` });
    Object.assign(env.model.body, { y: 796 - env.model.body.height / 2, vy: 1600, angle: 0 });
    env.advance(); env.advance();
    env.drawCalls.length = 0;
    for (let i = 0; i < 5; i++) env.advance();
    assert.ok(env.drawCalls.some(call => call.name === "lineTo"), style);
    assert.equal(env.createdImpacts[0]?.style, style);
    assert.equal(env.world.game.active, false);
  }
});
