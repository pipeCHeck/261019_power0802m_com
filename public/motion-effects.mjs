const TAU = Math.PI * 2;
const clamp = t => Math.max(0, Math.min(1, t));
const ease = t => 1 - (1 - clamp(t)) ** 3;
const mix = (a, b, t) => a + (b - a) * t;
const center = points => ({ x: points.reduce((n, p) => n + p.x, 0) / points.length,
  y: points.reduce((n, p) => n + p.y, 0) / points.length });

export const MOTION_IDS = ["billow", "liquid", "shatter"];

// The seed fixes material/force variation, not the contour drawn on every frame.
export function createMotionProfile(style, effect, random) {
  const range = (a, b) => mix(a, b, random());
  const { power, slam, lean, span } = effect;
  const reach = 22 + power * 24 + slam * 65, height = 18 + power * 24 + slam * 60;
  if (style === "billow") return {
    plumes: Array.from({ length: 4 + Math.round(slam * 2) }, (_, i) => {
      const side = i % 2 ? 1 : -1;
      return { side, origin: side * span / 2 + range(-5, 5), delay: range(.008, .025) + Math.floor(i / 2) * .035,
        vx: side * range(90, 150 + slam * 190) + lean * 100, vy: range(45, 80 + slam * 120),
        radius: (8 + power * 5 + slam * 13) * range(.7, 1.25), roll: side * range(3, 6),
        lobes: 3 + Math.floor(random() * 3), phase: range(0, TAU), phase2: range(0, TAU),
        life: range(.65, .8), split: range(.45, .52),
        children: Array.from({ length: 3 }, (_, j) => ({ angle: j / 3 * TAU + range(-.3, .3),
          speed: range(17, 50), radius: range(.4, .6), curl: range(-7, 7), trim: range(.67, .8) })) };
    }),
  };
  if (style === "liquid") {
    const count = 6 + Math.round(slam * 5);
    return { jets: Array.from({ length: count }, (_, i) => {
      const angle = .15 + (i + range(.1, .9)) / count * (Math.PI - .3);
      return { origin: ((i + range(.1, .9)) / count - .5) * span, delay: range(0, .025),
        vx: Math.cos(angle) * range(140, 240 + slam * 210) + lean * 130,
        vy: Math.sin(angle) * range(130, 180 + slam * 170), gravity: range(420, 600),
        radius: (3 + power * 2 + slam * 4) * range(.6, 1.2), phase: range(0, TAU),
        pinch: range(.1, .18), split: range(.26, .33), life: range(.65, .8),
        satellites: Array.from({ length: 2 + Number(random() < .35) }, (_, j) => ({
          side: j - .5, kick: range(50, 100), radius: range(.4, .65), spin: range(-5, 5) })) };
    }) };
  }
  const clusters = span > 120 ? 3 : 1, cells = [];
  for (let c = 0; c < clusters; c++) {
    const origin = clusters === 1 ? 0 : (c / (clusters - 1) - .5) * span;
    const boundary = Array.from({ length: 9 }, (_, i) => {
      const u = i / 8;
      return { x: origin + (u - .5) * reach * 1.25,
        y: i === 0 || i === 8 ? 1 : height * range(.35, 1) * Math.sin(Math.PI * u) };
    });
    boundary.push({ x: origin, y: 0 });
    const hub = { x: origin + range(-8, 8), y: height * .15 };
    boundary.forEach((p, i) => {
      const points = [hub, p, boundary[(i + 1) % boundary.length]];
      const mid = center(points), side = Math.sign(mid.x - origin) || (i % 2 ? 1 : -1);
      cells.push({ points: points.map(v => ({ x: v.x - mid.x, y: v.y - mid.y })), mid,
        delay: range(.04, .08), vx: side * range(60, 130 + slam * 140) + lean * 120,
        vy: range(100, 160 + slam * 160), spin: range(-8, 8), gravity: range(380, 580),
        split: range(.22, .3), life: range(.72, .86), solid: random() < .3,
        children: Array.from({ length: 3 }, () => ({ kick: range(30, 65), spin: range(-7, 7),
          trim: range(.5, .6), solid: random() < .25 })) });
    });
  }
  return { cells };
}

function cloudContour(radius, age, phase, lobes, phase2, squash = 1) {
  return Array.from({ length: 48 }, (_, i) => {
    const a = i / 48 * TAU;
    const r = radius * (.83 + .17 * Math.sin(lobes * a + phase + age * 5)
      + .1 * Math.sin((lobes + 2) * a - phase2 - age * 8));
    return { x: Math.cos(a) * r * squash + Math.sin(a * 2 + age * 8) * radius * .13,
      y: Math.sin(a) * r / squash };
  });
}

function transform(points, cx, cy, angle, point) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return points.map(p => point(cx + c * p.x - s * p.y, cy + s * p.x + c * p.y));
}

function roundSection(section, mid, radius, phase, time, rounding, ripple) {
  // Keep every original corner at birth; add in-between vertices so the same
  // partition can round into a smooth full contour as it separates.
  const points = section.flatMap((a, i) => {
    const b = section[(i + 1) % section.length];
    return Array.from({ length: 3 }, (_, j) => ({ x: mix(a.x, b.x, j / 3) - mid.x,
      y: mix(a.y, b.y, j / 3) - mid.y }));
  });
  const start = Math.atan2(points[0].y, points[0].x);
  return points.map((p, i) => {
    const a = start + i / points.length * TAU;
    const r = radius * (1 + ripple * Math.sin(a * 3 + phase + time * 10)
      + ripple * .4 * Math.cos(a * 5 - time * 8));
    return { x: mix(p.x, Math.cos(a) * r, rounding), y: mix(p.y, Math.sin(a) * r, rounding) };
  });
}

// Erode a contour with a moving plane. Vertices disappear at different times;
// no alpha fade and no uniformly shrinking stamp.
function cutPolygon(points, fraction) {
  if (fraction <= 0) return points;
  if (fraction >= 1) return [];
  const xs = points.map(p => p.x), cut = mix(Math.min(...xs), Math.max(...xs), fraction);
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], ia = a.x >= cut, ib = b.x >= cut;
    if (ia) result.push(a);
    if (ia !== ib) { const t = (cut - a.x) / (b.x - a.x); result.push({ x: cut, y: mix(a.y, b.y, t) }); }
  }
  return result;
}

const flight = (j, t) => ({ x: j.origin + j.vx * t, y: 2 + j.vy * t - j.gravity * t * t / 2 });

function liquidHead(j, t, radius, phase) {
  const velocity = Math.hypot(j.vx, j.vy - j.gravity * t), angle = Math.atan2(j.vy - j.gravity * t, j.vx);
  const stretch = 1 + Math.min(.75, velocity / 450) * Math.exp(-t * 2);
  return Array.from({ length: 28 }, (_, i) => {
    const a = i / 28 * TAU;
    const wobble = 1 + .13 * Math.sin(a * 3 + phase + t * 17) + .07 * Math.cos(a * 2 - t * 11);
    const px = Math.cos(a) * radius * stretch * wobble, py = Math.sin(a) * radius / stretch * wobble;
    return { x: Math.cos(angle) * px - Math.sin(angle) * py, y: Math.sin(angle) * px + Math.cos(angle) * py };
  });
}

export function motionShapes(effect, add, x, floor) {
  const { age, art, style, lean, power, slam } = effect;
  const point = (px, py) => ({ x: x + px, y: floor - py });
  if (style === "billow") {
    for (const p of art.plumes) {
      const t = age - p.delay, u = t / p.life;
      if (t < 0 || u >= 1) continue;
      const cx = p.origin + p.vx * (1 - Math.exp(-t * 3)) / 3;
      const cy = 3 + p.radius * .35 + p.vy * t * Math.exp(-t * 3);
      const radius = p.radius * (.5 + .5 * ease(t / .07));
      if (u < p.split) {
        const contour = cloudContour(radius, t, p.phase, p.lobes, p.phase2, 1.55 - .5 * ease(t / .16));
        add("billow-body", transform(contour, cx, cy, p.roll * t, point), t < .055 ? "ink" : "paper", "ink", 1.3);
        if (t < .055) {
          const opening = cutPolygon(contour, 1 - ease(t / .055));
          if (opening.length > 2) add("billow-open", transform(opening, cx, cy, p.roll * t, point), "paper");
        }
        if (t > .06) {
          const progress = ease((t - .06) / .15);
          const curl = Array.from({ length: 22 }, (_, i) => {
            const a = i / 21 * progress * Math.PI * 1.6, r = radius * (.08 + .34 * i / 21);
            return { x: Math.cos(a) * r, y: Math.sin(a) * r };
          });
          add("billow-inner", transform(curl, cx, cy, p.roll * t + p.phase, point), null, "ink", 1, false);
        }
      } else {
        const dt = t - p.split * p.life;
        const splitTime = p.split * p.life;
        const parent = cloudContour(p.radius * (.5 + .5 * ease(splitTime / .07)), splitTime,
          p.phase, p.lobes, p.phase2, 1.55 - .5 * ease(splitTime / .16));
        for (const [index, child] of p.children.entries()) {
          const start = Math.floor(index / p.children.length * parent.length);
          const end = Math.floor((index + 1) / p.children.length * parent.length);
          const section = [{ x: 0, y: 0 }, ...Array.from({ length: end - start + 1 }, (_, k) => parent[(start + k) % parent.length])];
          const mid = center(section), rounding = ease(dt / .12), rotation = p.roll * t;
          const contour = roundSection(section, mid, radius * child.radius, p.phase, dt, rounding, .17);
          const px = cx + Math.cos(rotation) * mid.x - Math.sin(rotation) * mid.y + Math.cos(child.angle) * child.speed * dt;
          const py = cy + Math.sin(rotation) * mid.x + Math.cos(rotation) * mid.y + Math.sin(child.angle) * child.speed * dt * .45;
          const pts = transform(contour, px, py, rotation + dt * child.curl, point);
          const trim = clamp((u - child.trim) / (1 - child.trim));
          if (trim === 0) add("billow-curl", pts, "paper", "ink", 1.1);
          else {
            const start = Math.floor(trim * pts.length * .79), end = pts.length - Math.floor(trim * pts.length * .16);
            if (end - start > 2) add("billow-curl", pts.slice(start, end), null, "ink", 1.1, false);
          }
        }
      }
    }
    // A pressure lip draws outward, rather than scaling a fixed impact star.
    if (age < .13) {
      const front = ease(age / .11), end = clamp((age - .035) / .095);
      for (const side of [-1, 1]) {
        const pts = Array.from({ length: 18 }, (_, i) => {
          const t = mix(end, front, i / 17), distance = (15 + slam * 65) * t;
          return point(side * (effect.span / 2 + distance) + lean * 20 * t,
            2 + Math.sin(t * Math.PI) * (5 + power * 8));
        });
        add("billow-lip", pts, null, "ink", 1.7, false);
      }
    }
  } else if (style === "liquid") {
    for (const j of art.jets) {
      const t = age - j.delay;
      if (t < 0 || t >= j.life) continue;
      const head = flight(j, t);
      if (t < j.pinch) {
        const neck = 1 - ease((t - j.pinch * .4) / (j.pinch * .6)), points = [];
        for (const side of [1, -1]) for (let i = 0; i <= 18; i++) {
          const u = side === 1 ? i / 18 : 1 - i / 18, f = flight(j, t * u);
          const a = Math.atan2(j.vy - j.gravity * t * u, j.vx);
          const width = j.radius * (.35 + Math.sin(Math.PI * u) * .65) * neck;
          points.push(point(f.x - Math.sin(a) * width * side, f.y + Math.cos(a) * width * side));
        }
        add("liquid-neck", points);
      }
      if (t < j.split) {
        add("liquid-head", transform(liquidHead(j, t, j.radius, j.phase), head.x, head.y, 0, point));
      } else {
        const dt = t - j.split, birth = flight(j, j.split);
        const parent = liquidHead(j, j.split, j.radius, j.phase);
        for (const [index, child] of j.satellites.entries()) {
          const vx = j.vx + child.side * child.kick, vy = j.vy - j.gravity * j.split + child.kick * .25;
          const start = Math.floor(index / j.satellites.length * parent.length);
          const end = Math.floor((index + 1) / j.satellites.length * parent.length);
          const section = [{ x: 0, y: 0 }, ...Array.from({ length: end - start + 1 }, (_, k) => parent[(start + k) % parent.length])];
          const mid = center(section);
          const cx = birth.x + mid.x + vx * dt, cy = birth.y + mid.y + vy * dt - j.gravity * dt * dt / 2;
          if (cy < -j.radius) continue;
          // Partition the parent's exact contour first. Detached pieces round
          // off progressively, instead of replacing the head with small stamps.
          const rounding = ease(dt / .1);
          const contour = roundSection(section, mid, j.radius * child.radius, j.phase, t, rounding, .09);
          const trim = clamp((t / j.life - .65) / .35);
          const pts = cutPolygon(contour, trim);
          if (pts.length > 2) add("liquid-satellite", transform(pts, cx, cy, child.spin * dt, point));
        }
      }
    }
  } else if (style === "shatter") {
    for (const cell of art.cells) {
      const t = Math.max(0, age - cell.delay);
      if (age >= cell.life) continue;
      const cx = cell.mid.x + cell.vx * t, cy = cell.mid.y + cell.vy * t - cell.gravity * t * t / 2;
      const angle = cell.spin * t;
      if (t < cell.split) {
        add("shatter-cell", transform(cell.points, cx, cy, angle, point),
          t > .025 && !cell.solid ? "paper" : "ink", t > .025 ? "ink" : null, 1.1);
        if (age > .015 && t === 0) {
          const a = cell.points[0], b = cell.points[1], progress = ease((age - .015) / .05);
          const q = { x: mix(a.x, b.x, progress), y: mix(a.y, b.y, progress) };
          const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
          add("shatter-seam", transform([{ x: a.x, y: a.y }, { x: q.x, y: q.y },
            { x: q.x - dy / length, y: q.y + dx / length }, { x: a.x - dy / length, y: a.y + dx / length }],
          cx, cy, angle, point), "paper");
        }
      } else {
        const dt = t - cell.split;
        cell.children.forEach((child, i) => {
          const pts = [{ x: 0, y: 0 }, cell.points[i], cell.points[(i + 1) % 3]], mid = center(pts);
          const length = Math.hypot(mid.x, mid.y) || 1;
          const trim = clamp((age - child.trim) / (cell.life - child.trim));
          const cut = cutPolygon(pts.map(p => ({ x: p.x - mid.x, y: p.y - mid.y })), trim);
          if (cut.length < 3) return;
          const localX = mid.x + mid.x / length * child.kick * dt;
          const localY = mid.y + mid.y / length * child.kick * dt;
          const px = cx + Math.cos(angle) * localX - Math.sin(angle) * localY;
          const py = cy + Math.sin(angle) * localX + Math.cos(angle) * localY;
          if (py < -30) return;
          add("shatter-child", transform(cut, px, py, angle + child.spin * dt, point),
            child.solid ? "ink" : "paper", child.solid ? null : "ink", 1);
        });
      }
    }
  }
}
