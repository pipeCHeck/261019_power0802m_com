import { SOURCE_CARD } from "./transition-effects.mjs";
import { fractureCells } from "./construction-transitions.mjs";

function glyphs(doc, selector) {
  const parent = doc.querySelector(selector);
  if (!parent) return [];
  const chars = Array.from(parent.textContent);
  parent.textContent = "";
  return chars.map(char => {
    const span = doc.createElement("span");
    span.textContent = char;
    span.style.cssText = "display:inline-block;white-space:pre";
    parent.append(span);
    return span;
  });
}

// Capture typography after fonts have loaded, at the unscaled 1000×760 layout.
// Clones live outside the source containers so hiding those containers does not
// hide, reflow or constrain the moving parts.
export function prepareConstruction(doc, home) {
  const view = doc.defaultView, pieces = [];
  const heading = home ? ".message-line.is-current .message-text" : "#space-title";
  const entries = glyphs(doc, heading).map(node => ({ node, role: "title" }));
  const selectors = home ? [
    [".eyebrow", "content"],
    [".message-line.is-current .dots", "title"], [".description", "content"],
    [".physics-card h2", "card"], [".physics-card p", "card"]
  ] : [[".space-index", "content"], [".space-intro", "content"], [".space-mark", "content"], [".space-back", "content"]];
  for (const [selector, role] of selectors) {
    const node = doc.querySelector(selector);
    if (node) entries.push({ node, role });
  }
  for (const { node, role } of entries) {
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    let width = rect.width, height = rect.height, x = rect.left + width / 2, y = rect.top + height / 2, angle = 0;
    if (role === "card") {
      const s = SOURCE_CARD, a = s.angle * Math.PI / 180;
      width = node.offsetWidth; height = node.offsetHeight;
      const lx = node.offsetLeft + width / 2 - s.width / 2, ly = node.offsetTop + height / 2 - s.height / 2;
      x = s.left + s.width / 2 + lx * Math.cos(a) - ly * Math.sin(a);
      y = s.top + s.height / 2 + lx * Math.sin(a) + ly * Math.cos(a);
      angle = s.angle;
    }
    const clone = node.cloneNode(true), style = view.getComputedStyle(node);
    // Snapshot descendant styles too (the wordmark and its SVG inherit styles).
    const originals = [node, ...node.querySelectorAll("*")], copies = [clone, ...clone.querySelectorAll("*")];
    originals.forEach((original, i) => {
      const computed = view.getComputedStyle(original), target = copies[i];
      for (let k = 0; k < computed.length; k++) target.style.setProperty(computed[k], computed.getPropertyValue(computed[k]));
      target.removeAttribute("id");
      target.style.animation = "none"; target.style.transition = "none";
    });
    Object.assign(clone.style, { position: "absolute", left: `${x - width / 2}px`, top: `${y - height / 2}px`,
      width: `${width}px`, height: `${height}px`, margin: "0", visibility: "visible", opacity: "1",
      transformOrigin: "50% 50%", transform: `rotate(${angle}deg)`, zIndex: "10", pointerEvents: "none",
      font: style.font, contain: "none" });
    clone.setAttribute("aria-hidden", "true");
    doc.body.append(clone);
    const cells = fractureCells(width, height, pieces.length), fragments = [];
    const fragmentLayer = doc.createElement("div");
    Object.assign(fragmentLayer.style, { position: "absolute", left: `${x - width / 2}px`, top: `${y - height / 2}px`,
      width: `${width}px`, height: `${height}px`, transform: `rotate(${angle}deg)`, transformOrigin: "50% 50%",
      pointerEvents: "none", zIndex: "10", display: "none" });
    fragmentLayer.setAttribute("aria-hidden", "true");
    for (const cell of cells) {
      const motion = doc.createElement("div"), reveal = doc.createElement("div");
      const outline = clone.cloneNode(true), ink = clone.cloneNode(true);
      Object.assign(motion.style, { position: "absolute", inset: "0", transformOrigin: `${cell.cx}% ${cell.cy}%` });
      Object.assign(reveal.style, { position: "absolute", inset: "0" });
      const polygon = `polygon(${cell.points.map(p => `${p.x}% ${p.y}%`).join(",")})`;
      for (const node of [outline, ink]) Object.assign(node.style, { left: "0", top: "0", transform: "none", clipPath: polygon });
      // Descendants have explicit computed text-fill values from the snapshot;
      // override them too so nested arrows cannot fill before their ink reveal.
      for (const node of [outline, ...outline.querySelectorAll("*")]) {
        node.style.webkitTextFillColor = "transparent";
        node.style.webkitTextStroke = ".65px #292b26";
      }
      reveal.append(ink); motion.append(outline); motion.append(reveal); fragmentLayer.append(motion);
      fragments.push({ motion, outline, reveal, minY: Math.min(...cell.points.map(p => p.y)), maxY: Math.max(...cell.points.map(p => p.y)) });
    }
    doc.body.append(fragmentLayer);
    pieces.push({ node: clone, fragmentLayer, fragments, cells, display: clone.style.display, x, y, width, height, angle, role });
  }
  // The current message explicitly declares visibility:visible in styles.css;
  // hide it directly as well as its container, after cloning its visible glyphs.
  // Keep the source header and footer in their real DOM, untouched. The source
  // iframe remains visible; the destination supplies only the changing body.
  const hide = home ? [".coming-soon", ".message-line.is-current", ".physics-card-layer"] :
    [".site-header", ".site-footer", "#space-title", ".space-index", ".space-intro", ".space-mark", ".space-back"];
  hide.forEach(selector => { const node = doc.querySelector(selector); if (node) node.style.visibility = "hidden"; });
  const frameElement = home ? null : doc.querySelector(".space-panel");
  if (frameElement) frameElement.style.borderColor = "transparent";
  return { pieces, frameElement };
}

export function applyConstruction(prepared, poses, border) {
  prepared.pieces.forEach((part, i) => {
    const { node, fragmentLayer, fragments } = part;
    const p = poses[i];
    node.style.opacity = String(p.whole ? p.opacity : 0);
    node.style.display = p.whole && p.opacity ? part.display : "none";
    node.style.clipPath = "none";
    const active = !p.whole && p.opacity === 1;
    fragmentLayer.style.display = active ? "block" : "none";
    if (!active) return;
    fragments.forEach(({ motion, outline, reveal, minY, maxY }, k) => {
      const f = p.fragments[k];
      motion.style.display = f.opacity && f.scale > 0 ? "block" : "none";
      motion.style.transform = `translate(${f.dx}px,${f.dy}px) rotate(${f.angle}deg) scale(${f.scale})`;
      outline.style.display = f.outline ? part.display : "none";
      reveal.style.clipPath = f.ink === 1 ? "none" : `inset(${maxY - (maxY - minY) * f.ink}% 0 0 0)`;
    });
  });
  if (prepared.frameElement) prepared.frameElement.style.borderColor = border === 1 ? "#292b26" : "transparent";
}
