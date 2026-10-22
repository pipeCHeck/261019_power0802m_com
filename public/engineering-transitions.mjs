import { SOURCE_CARD } from "./transition-effects.mjs";

export const ENGINEERING_TRANSITIONS = Object.freeze([
  { id: "vector", letter: "A", name: "벡터 정렬", description: "사각형의 네 꼭짓점이 서로 다른 곡선을 따라 정렬됩니다. 잠깐 나타난 접선과 치수선은 새 테두리가 잡히면 걷힙니다." },
  { id: "elastic", letter: "B", name: "탄성 면", description: "공간의 경계가 유연하게 휘었다가 감쇠하며 펴집니다. 파형의 움직임 자체가 두 화면을 자연스럽게 이어 줍니다." },
  { id: "grid", letter: "C", name: "격자 정착", description: "사각형 안의 면들이 약간씩 어긋나며 이동한 뒤 하나의 면으로 맞물립니다. 작은 회전과 시간차가 정돈된 리듬을 만듭니다." },
]);
export const ENGINEERING_DURATION = 2200;
const W = 1000, H = 760, PI = Math.PI;
const clamp = n => Math.max(0, Math.min(1, n));
const phase = (p, a, b) => clamp((p - a) / (b - a));
const smooth = (p, a, b) => { const u = phase(p, a, b); return u * u * (3 - 2 * u); };
const mix = (a, b, t) => a + (b - a) * t;
const point = (a, b, t) => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const rectPoints = r => [{ x: r.left, y: r.top }, { x: r.left + r.width, y: r.top },
  { x: r.left + r.width, y: r.top + r.height }, { x: r.left, y: r.top + r.height }];
const full = () => rectPoints({ left: 0, top: 0, width: W, height: H });
function rotatePoint(p, center, angle) {
  const c = Math.cos(angle), s = Math.sin(angle), x = p.x - center.x, y = p.y - center.y;
  return { x: center.x + c * x - s * y, y: center.y + s * x + c * y };
}
const sourceCenter = { x: SOURCE_CARD.left + SOURCE_CARD.width / 2, y: SOURCE_CARD.top + SOURCE_CARD.height / 2 };
const source = rectPoints(SOURCE_CARD).map(p => rotatePoint(p, sourceCenter, SOURCE_CARD.angle * PI / 180));
function curved(a, b, t, bend) {
  const p = point(a, b, t), arc = Math.sin(PI * t);
  return { x: p.x + bend.x * arc, y: p.y + bend.y * arc };
}
const line = (f, points, opacity = 1, width = 1.2, dashed = false) => f.lines.push({ points, opacity, width, dashed });
const label = (f, p, text, opacity = .65) => f.labels.push({ ...p, text, opacity });

function revealRest(f, p, d, start = .79) {
  const u = smooth(p, start, .98);
  if (u > 0) f.clip.push(rectPoints({ left: d.left * (1 - u), top: d.top * (1 - u),
    width: mix(d.width, W, u), height: mix(d.height, H, u) }));
}

export function engineeringFrame(id, progress, destination) {
  const p = clamp(progress), d = destination, target = rectPoints(d);
  const ink = smooth(p, .02, .12) * (1 - smooth(p, .78, .97));
  const f = { oldOpacity: 1, newOpacity: 0, clip: [], lines: [], polygons: [], nodes: [], labels: [], cells: [], amplitude: 0 };
  if (p === 0) return f;
  if (p === 1) { f.oldOpacity = 0; f.newOpacity = 1; f.clip = [full()]; return f; }
  if (id === "vector") {
    f.oldOpacity = 1 - smooth(p, .10, .43); f.newOpacity = smooth(p, .40, .70);
    const corners = source.map((a, i) => {
      const u = smooth(p, .12 + i * .025, .63 + i * .025);
      const bend = { x: i < 2 ? -32 : 32, y: -55 };
      const q = curved(a, target[i], u, bend);
      if (u > 0 && u < 1) {
        const trail = Array.from({ length: 14 }, (_, j) => curved(a, target[i], Math.max(0, u - .17) + Math.min(.17, u) * j / 13, bend));
        line(f, trail, ink * .32, 1, true);
      }
      f.nodes.push({ ...q, r: 2.5, opacity: ink });
      return q;
    });
    f.clip = [corners];
    f.polygons.push({ points: corners, opacity: ink, fillOpacity: 1 - smooth(p, .40, .68), width: 1.4 });
    // The dimension marks describe the moving edge, rather than a separate HUD.
    const a = corners[0], b = corners[1], dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
    const n = { x: dy / length, y: -dx / length };
    const da = { x: a.x + n.x * 19, y: a.y + n.y * 19 }, db = { x: b.x + n.x * 19, y: b.y + n.y * 19 };
    const detail = ink * smooth(p, .10, .25) * (1 - smooth(p, .58, .78));
    line(f, [da, db], detail * .5, .9);
    for (const q of [da, db]) line(f, [{ x: q.x - n.x * 4, y: q.y - n.y * 4 }, { x: q.x + n.x * 4, y: q.y + n.y * 4 }], detail, 1);
    label(f, { x: (da.x + db.x) / 2 - 34, y: (da.y + db.y) / 2 - 8 }, `w=${length.toFixed(0)}`, detail * .7);
    label(f, { x: corners[2].x + 10, y: corners[2].y + 15 }, `s=${smooth(p, .17, .68).toFixed(2)}`, detail * .55);
    revealRest(f, p, d, .71);
  } else if (id === "elastic") {
    const u = smooth(p, .10, .88), center = H * (1 - u);
    const amplitude = 130 * Math.exp(-2.8 * u) * Math.sin(PI * Math.min(1, u * 1.5));
    f.amplitude = Math.max(0, amplitude);
    const wave = (x, offset = 0) => center + offset + f.amplitude * Math.sin(x / 340 * PI * 2 - p * PI * 8);
    const front = Array.from({ length: 81 }, (_, i) => ({ x: i / 80 * W, y: wave(i / 80 * W) }));
    f.oldOpacity = 1 - smooth(p, .12, .94); f.newOpacity = 1;
    f.clip = [[{ x: 0, y: H }, ...front, { x: W, y: H }]];
    line(f, front, ink, 1.35);
    for (const offset of [10, 22]) {
      const span = smooth(p, .06, .22) * (1 - smooth(p, .60, .85));
      line(f, Array.from({ length: 65 }, (_, i) => ({ x: i / 64 * W, y: wave(i / 64 * W, offset * (1 - u)) })), ink * span * .23, .8);
    }
    // One understated amplitude marker lives on the wave, then decays with it.
    const x = sourceCenter.x, y = wave(x), detail = ink * smooth(p, .16, .28) * (1 - smooth(p, .46, .64));
    line(f, [{ x, y: center }, { x, y }], detail * .5, .9);
    f.nodes.push({ x, y, r: 2, opacity: detail * .7 });
    label(f, { x: x + 10, y: y - 8 }, `A=${f.amplitude.toFixed(1)}`, detail * .7);
  } else {
    f.oldOpacity = 1 - smooth(p, .10, .40); f.newOpacity = smooth(p, .46, .76);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      const index = row * 4 + col, delay = (row + col) * .021;
      const u = smooth(p, .12 + delay, .64 + delay);
      const start = rotatePoint({ x: SOURCE_CARD.left + (col + .5) * SOURCE_CARD.width / 4,
        y: SOURCE_CARD.top + (row + .5) * SOURCE_CARD.height / 3 }, sourceCenter, SOURCE_CARD.angle * PI / 180);
      const end = { x: d.left + (col + .5) * d.width / 4, y: d.top + (row + .5) * d.height / 3 };
      const c = curved(start, end, u, { x: (col - 1.5) * 10, y: -22 - row * 8 });
      const angle = mix(SOURCE_CARD.angle, 0, u) + Math.sin(PI * u) * (index % 2 ? 4 : -4);
      const width = mix(SOURCE_CARD.width, d.width, u) / 4, height = mix(SOURCE_CARD.height, d.height, u) / 3;
      const poly = rectPoints({ left: c.x - width / 2, top: c.y - height / 2, width, height }).map(q => rotatePoint(q, c, angle * PI / 180));
      f.cells.push(poly); f.clip.push(poly);
      f.polygons.push({ points: poly, opacity: ink * .74, fillOpacity: 1 - smooth(p, .42, .72), width: .9 });
      if (index === 3) label(f, { x: poly[1].x + 9, y: poly[1].y - 6 }, `θ=${angle.toFixed(1)}°`,
        ink * smooth(p, .14, .28) * (1 - smooth(p, .48, .65)) * .6);
    }
    revealRest(f, p, d, .78);
  }
  return f;
}

const num = n => Number(n.toFixed(2));
const pts = points => points.map(p => `${num(p.x)},${num(p.y)}`).join(" ");
const escape = s => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function engineeringSVG(f, id) {
  const clip = f.clip.map(p => `<polygon points="${pts(p)}"/>`).join("");
  const polygons = f.polygons.map(p => `<polygon points="${pts(p.points)}" opacity="${p.opacity}" fill="${p.fill ?? "#f8f7f3"}" fill-opacity="${p.fillOpacity}" stroke-width="${p.width}"/>`).join("");
  const lines = f.lines.map(l => `<polyline points="${pts(l.points)}" opacity="${l.opacity}" stroke-width="${l.width}" ${l.dashed ? 'stroke-dasharray="2 5"' : ""}/>`).join("");
  const nodes = f.nodes.map(n => `<circle cx="${num(n.x)}" cy="${num(n.y)}" r="${n.r}" opacity="${n.opacity}" fill="#f8f7f3" stroke-width="1"/>`).join("");
  const labels = f.labels.map(l => `<text x="${num(l.x)}" y="${num(l.y)}" opacity="${l.opacity}" stroke="none" fill="#292b26" font-family="Consolas,monospace" font-size="14">${escape(l.text)}</text>`).join("");
  return `<defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse">${clip}</clipPath></defs><g stroke="#292b26" fill="none" stroke-linecap="${f.angular ? "butt" : "round"}" stroke-linejoin="${f.angular ? "miter" : "round"}">${polygons}${lines}${nodes}${labels}</g>`;
}
