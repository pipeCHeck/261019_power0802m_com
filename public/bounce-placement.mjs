import { getBallOutline } from "./ball-shapes.mjs";

const cross = (a, b) => a.x * b.y - a.y * b.x;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const at = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const wrap = (x, width) => ((x % width) + width) % width;
function inside(p, poly) {
  let result = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

function blockers(bodies, width) {
  const polygons = [], card = bodies?.card, ball = bodies?.ball;
  if (card) {
    const c = Math.cos(card.angle), s = Math.sin(card.angle);
    const w = card.width / 2, h = card.height / 2;
    for (const shift of [-width, 0, width]) {
      const cx = wrap(card.x, width) + shift;
      polygons.push([[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) =>
        ({ x: cx + c * x - s * y, y: card.y + s * x + c * y })));
    }
  }
  if (ball) {
    const radius = ball.radius;
    polygons.push(ball.shape === "circle" ? Array.from({ length: 48 }, (_, i) => {
      const angle = i / 48 * Math.PI * 2;
      return { x: ball.x + Math.cos(angle) * radius, y: ball.y + Math.sin(angle) * radius };
    }) : getBallOutline({ ...ball, radius }));
  }
  return polygons.filter(p => p.length > 2);
}

export function bounceOrigin(e, width) {
  // A released puff inherits the contact surface's motion, then loses that drift.
  // It never remains attached to the card or follows later cursor movements.
  const travel = .16 * (1 - Math.exp(-Math.max(0, e.age) / .16));
  return { x: wrap(e.x + (e.velocity?.x ?? 0) * travel, width),
    y: e.y + (e.velocity?.y ?? 0) * travel };
}

function distanceToPolygon(p, poly) {
  if (inside(p, poly)) return 0;
  let distance = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], v = sub(b, a), d = sub(p, a);
    const t = Math.max(0, Math.min(1, (d.x * v.x + d.y * v.y) / (v.x * v.x + v.y * v.y || 1)));
    const q = at(a, b, t);
    distance = Math.min(distance, Math.hypot(p.x - q.x, p.y - q.y));
  }
  return distance;
}

export function updateBounceImpact(e, bodies, width) {
  if (!bodies || e.retiredAt != null || e.age < e.duration * .5 || e.age >= e.life) return;
  const origin = bounceOrigin(e, width), polys = blockers(bodies, width);
  const distance = Math.min(...polys.map(p => distanceToPolygon(origin, p)));
  if (distance > e.size * 1.4 + 12) {
    e.retiredAt = e.age;
    e.life = Math.min(e.life, e.age + e.retractDuration);
  }
}

export function clipBounceStrokes(shapes, bodies, width) {
  if (!bodies) return shapes;
  const maxWidth = Math.max(0, ...shapes.map(s => s.lineWidth));
  // Include the line's cap and antialiasing fringe, without filling the scene.
  const padding = maxWidth / 2 + .65, polygons = blockers(bodies, width);
  const result = [];
  for (const shape of shapes) {
    let path = [];
    const flush = () => { if (path.length > 1) result.push({ ...shape, points: path }); path = []; };
    for (let i = 1; i < shape.points.length; i++) {
      const a = shape.points[i - 1], b = shape.points[i], v = sub(b, a), cuts = [0, 1];
      const nearby = polygons.filter(poly => {
        const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
        return Math.max(...xs) + padding >= Math.min(a.x, b.x) && Math.min(...xs) - padding <= Math.max(a.x, b.x)
          && Math.max(...ys) + padding >= Math.min(a.y, b.y) && Math.min(...ys) - padding <= Math.max(a.y, b.y);
      });
      const addCut = t => { if (t > 0 && t < 1) cuts.push(t); };
      for (const poly of nearby) for (let j = 0; j < poly.length; j++) {
        const c = poly[j], d = poly[(j + 1) % poly.length], edge = sub(d, c), denominator = cross(v, edge);
        const length = Math.hypot(edge.x, edge.y) || 1;
        // Offset each edge by the actual stroke clearance. Radial shape scaling
        // leaves thin gaps at concave hearts/stars and does not protect round caps.
        if (Math.abs(denominator) >= 1e-9) for (const side of [-1, 1]) {
          const start = { x: c.x - edge.y / length * padding * side, y: c.y + edge.x / length * padding * side };
          const delta = sub(start, a), t = cross(delta, edge) / denominator, u = cross(delta, v) / denominator;
          if (u >= 0 && u <= 1) addCut(t);
        }
        const delta = sub(a, c), aa = v.x * v.x + v.y * v.y;
        const bb = 2 * (delta.x * v.x + delta.y * v.y), cc = delta.x * delta.x + delta.y * delta.y - padding * padding;
        const discriminant = bb * bb - 4 * aa * cc;
        if (aa > 1e-12 && discriminant >= 0) {
          const root = Math.sqrt(discriminant);
          addCut((-bb - root) / (2 * aa)); addCut((-bb + root) / (2 * aa));
        }
      }
      cuts.sort((x, y) => x - y);
      for (let j = 1; j < cuts.length; j++) {
        const lo = cuts[j - 1], hi = cuts[j];
        if (hi - lo < 1e-8) continue;
        if (nearby.some(poly => distanceToPolygon(at(a, b, (lo + hi) / 2), poly) < padding)) { flush(); continue; }
        const start = at(a, b, lo), end = at(a, b, hi), previous = path.at(-1);
        if (previous && Math.hypot(previous.x - start.x, previous.y - start.y) > 1e-6) flush();
        if (!path.length) path.push(start);
        path.push(end);
      }
    }
    flush();
  }
  return result;
}
