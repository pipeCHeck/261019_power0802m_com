import test from "node:test";
import assert from "node:assert/strict";
import { prepareConstruction, applyConstruction } from "../public/construction-dom.mjs";
import { constructionFrame } from "../public/construction-transitions.mjs";

function fixture(home) {
  class Node {
    constructor(text = "", rect = { left: 180, top: 260, width: 80, height: 45 }) {
      this.textContent = text; this.rect = rect; this.children = []; this.attrs = { id: "original" };
      this.offsetLeft = 12; this.offsetTop = 10; this.offsetWidth = 100; this.offsetHeight = 35;
      this.style = { setProperty(name, value) { this[name] = value; } };
    }
    append(node) { this.children.push(node); }
    cloneNode() { const node = new Node(this.textContent, this.rect); node.children = this.children.map(c => c.cloneNode()); Object.assign(node.style, this.style); return node; }
    querySelectorAll() { return this.children; }
    removeAttribute(name) { delete this.attrs[name]; }
    setAttribute(name, value) { this.attrs[name] = value; }
    getBoundingClientRect() { return this.rect; }
  }
  const nodes = new Map();
  for (const s of home ? [".message-line.is-current .message-text", ".message-line.is-current", ".physics-card h2", ".site-header", ".site-status", ".coming-soon", ".site-footer", ".physics-card-layer"] :
    ["#space-title", ".space-panel", ".space-intro", ".site-header", ".site-footer"])
    nodes.set(s, new Node(s.includes("title") || s.includes("message-text") ? "공간" : "내용"));
  const wordmark = new Node("power0802m"); wordmark.append(new Node(".com")); nodes.set(".wordmark", wordmark);
  if (!home) { const back = new Node("홈으로"); back.append(new Node("←")); nodes.set(".space-back", back); }
  const computed = ["font-size", "font-family", "color"];
  computed.font = '400 33px "SB Aggro Light"';
  computed.getPropertyValue = name => ({ "font-size": "33px", "font-family": '"SB Aggro Light"', color: "rgb(41, 43, 38)" })[name];
  const doc = { body: new Node(), createElement: () => new Node(), querySelector: s => nodes.get(s),
    defaultView: { getComputedStyle: () => computed } };
  return { doc, nodes };
}

test("source fragments keep font/descendant styles and rotated card coordinates outside hidden original containers", () => {
  const { doc, nodes } = fixture(true), prepared = prepareConstruction(doc, true);
  assert.equal(prepared.pieces.length, 3); // two glyphs and card title; header stays in its original DOM
  assert.equal(prepared.pieces[0].node.style["font-family"], '"SB Aggro Light"');
  assert.equal(prepared.pieces[2].node.style["font-size"], "33px");
  assert.equal(prepared.pieces[2].node.attrs.id, undefined);
  assert.ok(prepared.pieces.every(p => doc.body.children.includes(p.node) && p.node.style.visibility === "visible"));
  assert.equal(nodes.get(".physics-card-layer").style.visibility, "hidden");
  assert.equal(nodes.get(".message-line.is-current").style.visibility, "hidden");
  assert.equal(nodes.get(".site-header").style.visibility, undefined);
  assert.equal(nodes.get(".site-status").style.visibility, undefined);
  assert.equal(nodes.get(".site-footer").style.visibility, undefined);
  assert.equal(nodes.get(".wordmark").attrs.id, "original");
  assert.ok(prepared.pieces.every(p => p.role !== "header" && p.role !== "footer"));
  const card = prepared.pieces.find(p => p.role === "card");
  assert.equal(card.angle, -9); assert.equal(card.width, 100);
  assert.ok(card.x > 550 && card.x < 910 && card.y > 480 && card.y < 700);
});

test("seeking restores clipped glyphs and exact destination border without replacing the nodes", () => {
  const { doc } = fixture(false), prepared = prepareConstruction(doc, false);
  const identities = prepared.pieces.map(p => p.node);
  const d = { left: 140, top: 180, width: 720, height: 350 };
  const partial = constructionFrame("laminate", .60, [], prepared.pieces, d);
  applyConstruction(prepared, partial.newParts, partial.border);
  assert.ok(prepared.pieces.some(p => p.fragmentLayer.style.display === "block"));
  assert.ok(prepared.pieces.some(p => p.fragments.some(f => f.reveal.style.clipPath?.startsWith("inset("))));
  const end = constructionFrame("laminate", 1, [], prepared.pieces, d);
  applyConstruction(prepared, end.newParts, end.border);
  assert.ok(prepared.pieces.every((p, i) => p.node === identities[i] && p.node.style.clipPath === "none" && p.node.style.opacity === "1"));
  assert.ok(prepared.pieces.every(p => p.fragmentLayer.style.display === "none"));
  assert.equal(prepared.frameElement.style.borderColor, "#292b26");
  assert.equal(doc.querySelector(".site-header").style.visibility, "hidden");
});

test("outline generation keeps nested arrows unfilled until the ink mask reaches them", () => {
  const { doc } = fixture(false), prepared = prepareConstruction(doc, false);
  const back = prepared.pieces.find(p => p.node.textContent === "홈으로");
  assert.ok(back.fragments.every(f => f.outline.children[0].style.webkitTextFillColor === "transparent"));
  assert.ok(back.fragments.every(f => f.outline.children[0].style.webkitTextStroke === ".65px #292b26"));
});

test("disassembly renders clipped copies of the actual ink instead of moving intact glyph boxes", () => {
  const { doc } = fixture(true), prepared = prepareConstruction(doc, true);
  const d = { left: 140, top: 180, width: 720, height: 350 };
  const broken = constructionFrame("frame", .21, prepared.pieces, [], d);
  applyConstruction(prepared, broken.oldParts, 0);
  assert.ok(prepared.pieces.every(p => p.node.style.display === "none" && p.fragmentLayer.style.display === "block"));
  assert.ok(prepared.pieces.every(p => p.fragments.length === p.cells.length && p.fragments.length >= 8));
  const layer = prepared.pieces[0];
  assert.ok(layer.fragments.some(f => f.motion.style.transform.includes("rotate(") && f.motion.style.transform.includes("scale(")));
  const end = constructionFrame("frame", 1, prepared.pieces, [], d);
  applyConstruction(prepared, end.oldParts, 0);
  assert.ok(prepared.pieces.every(p => p.node.style.display === "none" && p.fragmentLayer.style.display === "none"));
});
