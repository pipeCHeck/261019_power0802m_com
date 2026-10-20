import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { BallGame, radiusForDrag } from "../public/game-physics.mjs";
import { getBallShapePath, selectBallShape } from "../public/ball-shapes.mjs";
import { PhysicsWorld } from "../public/world-physics.mjs";

function setup() {
  class Element {
    constructor() {
      this.listeners = new Map(); this.children = []; this.dataset = {}; this.hidden = false;
      this.captured = new Set(); this.classes = new Set();
      this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
      this.style = { setProperty() {} };
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
    append(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    get lastElementChild() { return this.children.at(-1); }
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
  canvas.getContext = () => new Proxy({}, { get: () => () => {} });
  const frames = new Map(); let nextFrame = 0, now = 0, model, world;
  const raf = fn => { frames.set(++nextFrame, fn); return nextFrame; };
  const cancel = id => frames.delete(id);
  Object.assign(window, { innerWidth: 1000, innerHeight: 800, devicePixelRatio: 1,
    requestAnimationFrame: raf, cancelAnimationFrame: cancel,
    setTimeout: () => 1, clearTimeout() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) });
  const context = { window, document, requestAnimationFrame: raf, cancelAnimationFrame: cancel,
    PhysicsWorld: class extends PhysicsWorld { constructor(options) { super(options); model = this.card; world = this; } },
    BallGame, radiusForDrag, getBallShapePath, selectBallShape };
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
  const advance = () => {
    now += 16;
    const pending = [...frames.values()]; frames.clear();
    for (const fn of pending) fn(now);
  };
  return { window, document, layer, card, canvas, model, world, scene: runInNewContext("scene", context),
    frames, pointer, advance, Element };
}

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
