import { SOURCE_CARD } from "./transition-effects.mjs";

export const CONSTRUCTION_DURATION = 3200;
export const CONSTRUCTION_TRANSITIONS = [
  { id: "frame", letter: "A", name: "해체 · 조형", description: "글자의 실제 절편과 테두리가 원래 자리에서 해체되어 소멸합니다. 새 접합점에서 구조가 자라고, 글자의 윤곽 안으로 잉크가 채워집니다." },
  { id: "laminate", letter: "B", name: "분절 · 적층", description: "횡방향 절단층이 서로 다른 박자로 풀립니다. 새로운 구조와 글자가 얇은 층부터 단계적으로 생성됩니다." },
  { id: "joint", letter: "C", name: "파쇄 · 응결", description: "각진 글자 절편과 선의 파쇄를 더 선명하게 보여줍니다. 새 화면에서는 작은 윤곽 조각이 제자리에서 응결해 하나가 됩니다." }
];
const clamp = v => Math.max(0, Math.min(1, v));
const mix = (a, b, u) => a + (b - a) * u;
const step = (p, a, b) => { const u = clamp((p - a) / (b - a)); return u * u * (3 - 2 * u); };
const point = (x, y) => ({ x, y });
const noise = seed => { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const pose = angle => ({ dx: 0, dy: 0, angle, scaleX: 1, scaleY: 1, opacity: 1,
  clipTop: 0, clipBottom: 0, clipLeft: 0, clipRight: 0, whole: true, fragments: [] });

// Shared vertices partition the original ink; these are clips of real text,
// not replacement triangles scattered in front of an intact element.
export function fractureCells(width, height, seed = 0) {
  const cols = width < 65 ? 2 : Math.min(8, Math.max(2, Math.ceil(width / 48)));
  const rows = Math.min(3, Math.max(2, Math.ceil(height / 28)));
  const grid = Array.from({ length: rows + 1 }, (_, y) => Array.from({ length: cols + 1 }, (_, x) => point(
    x / cols * 100 + (x && x < cols ? (noise(seed + y * 13 + x * 7) - .5) * 30 / cols : 0),
    y / rows * 100 + (y && y < rows ? (noise(seed + y * 17 + x * 3) - .5) * 30 / rows : 0))));
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const a = grid[y][x], b = grid[y][x + 1], c = grid[y + 1][x + 1], d = grid[y + 1][x];
    for (const points of (x + y) % 2 ? [[a, b, d], [b, c, d]] : [[a, b, c], [a, c, d]]) {
      cells.push({ points, cx: points.reduce((s, p) => s + p.x, 0) / 3, cy: points.reduce((s, p) => s + p.y, 0) / 3 });
    }
  }
  return cells;
}

export function pathWindow(points, start, end) {
  const lengths = points.slice(1).map((q, i) => Math.hypot(q.x - points[i].x, q.y - points[i].y));
  const total = lengths.reduce((a, b) => a + b, 0), lo = clamp(start) * total, hi = clamp(end) * total;
  if (hi <= lo || total === 0) return [];
  let distance = 0; const result = [];
  lengths.forEach((length, i) => {
    if (length && distance + length > lo && distance < hi) {
      const at = u => point(mix(points[i].x, points[i + 1].x, u), mix(points[i].y, points[i + 1].y, u));
      if (!result.length) result.push(at(clamp((lo - distance) / length)));
      result.push(at(clamp((hi - distance) / length)));
    }
    distance += length;
  });
  return result;
}

function partPose(part, index, p, id, entering) {
  const q = pose(entering ? 0 : part.angle);
  const cells = part.cells ?? fractureCells(part.width, part.height, index);
  const base = entering ? .49 + (part.role === "title" ? .015 : .05) : .035;
  q.fragments = cells.map((cell, k) => {
    const n = noise(index * 37 + k * 11), direction = Math.atan2(cell.cy - 50, cell.cx - 50) + (n - .5) * .7;
    const order = id === "laminate" ? cell.cy / 100 * .07 : id === "joint" ? n * .07 : Math.abs(cell.cx - 50) / 50 * .035;
    const start = base + (index % 6) * .008 + order, span = entering ? .22 + n * .055 : .23 + n * .035;
    const u = clamp((p - start) / span);
    if (entering) {
      const grown = step(u, 0, .48), seated = step(u, .10, .70);
      return { dx: Math.cos(direction) * (id === "joint" ? 11 : 6) * (1 - seated),
        dy: Math.sin(direction) * 7 * (1 - seated), angle: (n - .5) * (id === "joint" ? 50 : 24) * (1 - seated),
        scale: grown, opacity: u > 0 ? 1 : 0, outline: u > 0 && u < 1 ? 1 : 0, ink: step(u, .42, .95) };
    }
    const force = id === "joint" ? 60 : id === "laminate" ? 29 : 43;
    const travel = (4 * step(u, 0, .25) + force * u * u) * (.65 + n * .5);
    return { dx: Math.cos(direction) * travel, dy: Math.sin(direction) * travel + 12 * u * u,
      angle: (n - .5) * (id === "joint" ? 170 : 100) * u * u,
      scale: 1 - step(u, .40, 1), opacity: u < 1 ? 1 : 0, outline: 0, ink: 1 };
  });
  q.whole = entering ? q.fragments.every(f => f.ink === 1 && f.scale === 1 && f.angle === 0) :
    q.fragments.every(f => f.scale === 1 && f.dx === 0 && f.dy === 0);
  q.opacity = q.fragments.some(f => f.opacity === 1 && f.scale > 0) ? 1 : 0;
  return q;
}

function line(f, a, b, width = 1.5) {
  if (Math.hypot(a.x - b.x, a.y - b.y) > .025)
    f.lines.push({ points: [a, b], width, opacity: 1, dashed: false });
}
function beam(f, center, length, angle, width = 1.5) {
  const x = Math.cos(angle) * length / 2, y = Math.sin(angle) * length / 2;
  line(f, point(center.x - x, center.y - y), point(center.x + x, center.y + y), width);
}
function sourceEdges() {
  const s = SOURCE_CARD, a = s.angle * Math.PI / 180, cx = s.left + s.width / 2, cy = s.top + s.height / 2;
  return [[0, -s.height / 2 + .75, s.width - 1.5, 0], [s.width / 2 - .75, 0, s.height - 1.5, Math.PI / 2],
    [0, s.height / 2 - .75, s.width - 1.5, 0], [-s.width / 2 + .75, 0, s.height - 1.5, Math.PI / 2]].map(([x, y, length, angle]) =>
    ({ x: cx + x * Math.cos(a) - y * Math.sin(a), y: cy + x * Math.sin(a) + y * Math.cos(a), length, angle: angle + a }));
}

export function constructionFrame(id, progress, old, next, d) {
  const p = clamp(progress), f = { oldParts: old.map((part, i) => partPose(part, i, p, id, false)),
    newParts: next.map((part, i) => partPose(part, i, p, id, true)),
    oldOpacity: 1, newOpacity: 1, angular: true, border: p >= .94 ? 1 : 0,
    clip: [], lines: [], polygons: [], nodes: [], labels: [] };
  if (p === 1) {
    f.oldParts.forEach(q => { q.opacity = 0; q.whole = false; });
    return f;
  }
  // Demolition is local to the OLD rectangle. No fragment has a destination on
  // the new rectangle, and no source-to-target interpolation exists.
  sourceEdges().forEach((edge, j) => {
    const count = j % 2 ? 4 : 8;
    for (let k = 0; k < count; k++) {
      const n = noise(j * 41 + k * 17), start = .035 + j * .016 + k * .007;
      const u = clamp((p - start) / (.25 + n * .035)), remaining = 1 - step(u, .38, 1);
      const tangent = (k + .5) / count * edge.length - edge.length / 2;
      const normal = (j < 2 ? -1 : 1) * (4 * step(u, 0, .25) + (id === "joint" ? 53 : 32) * u * u);
      const cx = edge.x + Math.cos(edge.angle) * tangent - Math.sin(edge.angle) * normal;
      const cy = edge.y + Math.sin(edge.angle) * tangent + Math.cos(edge.angle) * normal + u * u * 12;
      const angle = edge.angle + (n - .5) * 1.8 * u * u;
      const length = edge.length / count * remaining;
      if (u < .40) beam(f, point(cx, cy), length, angle);
      else for (const side of [-1, 1]) {
        const spread = step(u, .40, .8) * 6;
        beam(f, point(cx + Math.cos(angle) * side * (length / 4 + spread), cy + Math.sin(angle) * side * (length / 4 + spread)),
          length / 2, angle + side * .45 * step(u, .4, 1));
      }
    }
  });
  // New members are fabricated at their final joints. Short weld strokes grow
  // into full members and meet; the old material is already gone.
  if (p < .94) {
    const l = d.left + .75, r = d.left + d.width - .75, t = d.top + .75, b = d.top + d.height - .75;
    const edges = [[l, t, r, t], [r, t, r, b], [r, b, l, b], [l, b, l, t]];
    edges.forEach(([ax, ay, bx, by], j) => {
      for (let k = 0; k < 4; k++) {
        const n = noise(j * 61 + k * 19), order = id === "laminate" ? j * .025 + k * .012 : n * .075;
        const u = step(p, .435 + order, .68 + order), settle = step(u, .10, .70);
        const cx = mix(ax, bx, (k + .5) / 4), cy = mix(ay, by, (k + .5) / 4);
        const angle = Math.atan2(by - ay, bx - ax), length = Math.hypot(bx - ax, by - ay) / 4;
        beam(f, point(cx - Math.sin(angle) * 5 * (1 - settle), cy + Math.cos(angle) * 5 * (1 - settle)),
          length * u, angle + (n - .5) * .38 * (1 - settle));
        const spark = Math.sin(Math.PI * u) * 4;
        if (spark > .05) {
          for (const side of [-1, 1]) {
            const x = cx + Math.cos(angle) * side * length * u / 2, y = cy + Math.sin(angle) * side * length * u / 2;
            beam(f, point(x, y), spark * 2, angle + Math.PI / 2, .8);
          }
        }
      }
    });
  }
  return f;
}
