import { MOTION_IDS, createMotionProfile, motionShapes } from "./motion-effects.mjs";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - (1 - clamp(t, 0, 1)) ** 3;
const TAU = Math.PI * 2;

export const DEFAULT_IMPACT_STYLE = "fracture";
export const ORIGINAL_IMPACT_STYLES = Object.freeze([
  { id: "comic", letter: "A", name: "만화 구름", description: "짧은 섬광 뒤로 불규칙한 구름과 파편이 굴러갑니다." },
  { id: "ink", letter: "B", name: "잉크 스플래시", description: "묵직한 먹 덩어리가 터지고 둥근 방울이 사방으로 흩어집니다." },
  { id: "slash", letter: "C", name: "붓 참격", description: "굵고 날렵한 붓 자국이 휘어 나가며 타격 방향을 강조합니다." },
  { id: "fracture", letter: "D", name: "각진 파쇄", description: "날카로운 충격 조각과 속이 빈 다각형 파편이 튀어 오릅니다." },
  { id: "ripple", letter: "E", name: "압력 링", description: "끊어진 타원형 압력파가 겹쳐 퍼지는 가벼운 선 중심 효과." },
]);

export const MOTION_IMPACT_STYLES = Object.freeze([
  { id: "billow", letter: "A2", name: "롤링 더스트", description: "눌린 먼지가 말려 올라가고, 회전하는 작은 구름으로 풀어집니다." },
  { id: "liquid", letter: "B2", name: "리퀴드 스플래시", description: "잉크 줄기가 늘어나 끊기고, 방울이 갈라져 곡선을 그리며 흩어집니다." },
  { id: "shatter", letter: "D2", name: "연쇄 파열", description: "하나의 충격 면에 균열이 자라며 조각이 떨어지고, 비행 중 다시 갈라집니다." },
]);
export const IMPACT_STYLES = Object.freeze([...ORIGINAL_IMPACT_STYLES, ...MOTION_IMPACT_STYLES]);

export const validImpactStyle = value => IMPACT_STYLES.some(s => s.id === value) ? value : DEFAULT_IMPACT_STYLE;
export const impactStyleFromSearch = search => validImpactStyle(new URLSearchParams(search).get("impact"));

// Sample once at contact. Rendering never resamples, so variants animate coherently.
export function createVariantProfile(style, effect, random) {
  if (MOTION_IDS.includes(style)) return createMotionProfile(style, effect, random);
  const range = (a, b) => a + random() * (b - a);
  const amount = Math.round(6 + effect.power * 4 + effect.slam * 5);
  const origins = i => ((i + range(.1, .9)) / amount - .5) * effect.span;
  if (style === "ink") return {
    splats: Array.from({ length: effect.span > 120 ? 3 : 1 }, (_, i) => ({
      origin: effect.span > 120 ? (i / 2 - .5) * effect.span : 0,
      aspect: range(.8, 1.3), scale: range(.75, 1.2), duration: range(.18, .25),
      lobes: Array.from({ length: 20 }, (_, j) => ({ angle: -Math.PI + j / 19 * Math.PI,
        radius: j % 2 ? range(.5, .8) : range(.85, 1.25) })),
    })),
    drops: Array.from({ length: amount }, (_, i) => ({ origin: origins(i),
      angle: -Math.PI + (i + range(.15, .85)) / amount * Math.PI,
      reach: range(.6, 1.4), size: range(.5, 1.3), stretch: range(1.1, 2.2),
      delay: range(0, .035), duration: range(.27, .48), spin: range(-2, 2) })),
  };
  if (style === "slash") return {
    blades: Array.from({ length: 3 + Math.round(effect.slam * 2) }, (_, i) => ({
      side: i % 2 ? -1 : 1, origin: (random() - .5) * effect.span,
      reach: range(.65, 1.25), rise: range(.65, 1.35), width: range(.6, 1.25),
      start: range(.03, .18), arc: range(.32, .55), tilt: range(-.18, .18),
      delay: range(0, .025) + i * .009, duration: range(.22, .4),
    })),
    cuts: Array.from({ length: Math.round(amount * .6) }, (_, i) => ({ origin: origins(i),
      angle: range(-Math.PI + .2, -.2), reach: range(.7, 1.3), delay: range(.02, .06), size: range(.5, 1.3) })),
  };
  if (style === "fracture") return {
    teeth: Array.from({ length: effect.span > 120 ? 3 : 1 }, (_, i) => ({
      origin: effect.span > 120 ? (i / 2 - .5) * effect.span : 0,
      peaks: Array.from({ length: 7 }, (_, j) => ({ x: (j / 6 - .5) * 2,
        y: j % 2 ? range(.1, .35) : range(.65, 1.2) })), scale: range(.7, 1.2),
    })),
    rocks: Array.from({ length: amount }, (_, i) => ({ origin: origins(i),
      angle: -Math.PI + (i + range(.1, .9)) / amount * Math.PI,
      reach: range(.6, 1.3), size: range(.5, 1.3), rotation: range(0, TAU), spin: range(-5, 5),
      delay: range(.005, .045), duration: range(.3, .5), solid: random() < .3,
      vertices: Array.from({ length: 3 + Math.floor(random() * 3) }, () => range(.6, 1.2)),
    })),
  };
  return {
    rings: Array.from({ length: 3 + Math.round(effect.slam * 2) }, (_, i) => ({
      origin: (random() - .5) * effect.span * .35, reach: range(.8, 1.3), rise: range(.7, 1.3),
      delay: i * range(.025, .045), duration: range(.25, .4), width: range(.8, 1.8),
      arcs: Array.from({ length: 3 + Math.floor(random() * 3) }, (_, j) => ({
        start: (j + range(.08, .3)) / 5 * Math.PI, length: range(.07, .14) * Math.PI,
      })),
    })),
    motes: Array.from({ length: 5 }, (_, i) => ({ origin: (i / 4 - .5) * effect.span,
      angle: range(-Math.PI + .2, -.2), reach: range(.7, 1.2), radius: range(.7, 1.5) })),
  };
}

function oval(cx, cy, rx, ry, rotation = 0, count = 18) {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return Array.from({ length: count }, (_, i) => {
    const a = i / count * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    return { x: cx + c * x - s * y, y: cy + s * x + c * y };
  });
}

function smoothOutline(points) {
  return points.flatMap((b, i) => {
    const n = points.length, a = points[(i + n - 1) % n], c = points[(i + 1) % n], d = points[(i + 2) % n];
    return Array.from({ length: 4 }, (_, j) => {
      const t = j / 4, t2 = t * t, t3 = t2 * t;
      const axis = k => .5 * (2 * b[k] + (-a[k] + c[k]) * t
        + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3);
      return { x: axis("x"), y: axis("y") };
    });
  });
}

export function variantShapes(effect, add, x, floor) {
  if (MOTION_IDS.includes(effect.style)) return motionShapes(effect, add, x, floor);
  const { power, slam, lean, age, art, style, span } = effect;
  const reach = 24 + power * 32 + slam * 68;
  const height = 12 + power * 20 + slam * 65;
  const shift = lean * reach * ease(age / .18) * .7;
  const point = (px, py) => ({ x: x + px + shift, y: floor - py });

  if (style === "ink") {
    for (const s of art.splats) {
      const t = age / s.duration;
      if (t >= 1) continue;
      const scale = (.55 + .45 * ease(age / .03)) * (1 - ease((t - .2) / .8)) * s.scale;
      const points = s.lobes.map(p => point(s.origin + Math.cos(p.angle) * reach * .7 * scale * s.aspect
        - Math.sin(p.angle) * lean * height * scale, 2 - Math.sin(p.angle) * height * scale * p.radius * .7));
      add("ink-splat", smoothOutline(points));
    }
    for (const d of art.drops) {
      const t = (age - d.delay) / d.duration;
      if (t < 0 || t >= 1) continue;
      const progress = ease(t), radius = (2 + power * 2 + slam * 5) * d.size * (1 - t) ** .7;
      const p = point(d.origin + Math.cos(d.angle) * reach * progress * d.reach,
        3 - Math.sin(d.angle) * height * progress * d.reach - 16 * t * t);
      add("ink-drop", oval(p.x, p.y, radius * d.stretch, radius, d.angle + d.spin * t));
    }
  } else if (style === "slash") {
    for (const b of art.blades) {
      const t = (age - b.delay) / b.duration;
      if (t < 0 || t >= 1) continue;
      const scale = .3 + .7 * ease(t / .6), thickness = (3 + slam * 10) * b.width * (1 - t);
      const rx = (span / 2 + reach) * b.reach * scale, ry = height * b.rise * scale;
      const pts = [];
      for (const edge of [1, -1]) for (let i = 0; i <= 24; i++) {
        const u = edge === 1 ? i / 24 : 1 - i / 24;
        const a = (b.start + u * b.arc) * Math.PI;
        const w = Math.sin(Math.PI * u) ** .65 * thickness * edge;
        pts.push(point(b.origin + b.side * (Math.cos(a) * rx + w * .3),
          3 + Math.sin(a) * ry + w + Math.cos(a) * b.tilt * ry));
      }
      add("slash-blade", pts);
    }
    for (const c of art.cuts) {
      const t = (age - c.delay) / .27;
      if (t < 0 || t >= 1) continue;
      const p = point(c.origin + Math.cos(c.angle) * reach * ease(t) * c.reach,
        4 - Math.sin(c.angle) * height * ease(t) * c.reach);
      const length = (7 + slam * 13) * c.size * (1 - t), dx = Math.cos(c.angle), dy = Math.sin(c.angle);
      add("slash-cut", [{ x: p.x + dx * length, y: p.y + dy * length },
        { x: p.x - dy * 1.5, y: p.y + dx * 1.5 }, { x: p.x - dx * length * .3, y: p.y - dy * length * .3 }]);
    }
  } else if (style === "fracture") {
    if (age < .16) for (const tooth of art.teeth) {
      const scale = (.5 + .5 * ease(age / .025)) * (1 - ease((age - .04) / .12)) * tooth.scale;
      add("fracture-crown", [point(tooth.origin - reach * .4 * scale, 0),
        ...tooth.peaks.map(p => point(tooth.origin + p.x * reach * .6 * scale + lean * p.y * height * scale,
          p.y * height * scale)), point(tooth.origin + reach * .4 * scale, 0)]);
    }
    for (const r of art.rocks) {
      const t = (age - r.delay) / r.duration;
      if (t < 0 || t >= 1) continue;
      const p = point(r.origin + Math.cos(r.angle) * reach * ease(t) * r.reach,
        5 - Math.sin(r.angle) * height * ease(t) * r.reach - 24 * t * t);
      const size = (3 + power * 3 + slam * 11) * r.size * (1 - t) ** .65;
      const pts = r.vertices.map((v, i) => {
        const a = i / r.vertices.length * TAU + r.rotation + r.spin * t;
        return { x: p.x + Math.cos(a) * size * v, y: p.y + Math.sin(a) * size * v };
      });
      add("fracture-rock", pts, r.solid ? "ink" : "paper", r.solid ? null : "ink", 1.2);
    }
  } else if (style === "ripple") {
    for (const ring of art.rings) {
      const t = (age - ring.delay) / ring.duration;
      if (t < 0 || t >= 1) continue;
      const rx = (span / 2 + reach * ring.reach) * (.2 + .8 * ease(t));
      const ry = height * ring.rise * .65 * (.2 + .8 * ease(t));
      for (const arc of ring.arcs) {
        const length = arc.length * (1 - ease((t - .5) / .5));
        if (length < .002) continue;
        add("ripple-arc", Array.from({ length: 16 }, (_, i) => {
          const a = arc.start + length * i / 15;
          return point(ring.origin + Math.cos(a) * rx, 2 + Math.sin(a) * ry);
        }), null, "ink", ring.width, false);
      }
    }
    for (const m of art.motes) {
      const t = age / .3;
      if (t >= 1) continue;
      const p = point(m.origin + Math.cos(m.angle) * reach * ease(t) * m.reach,
        3 - Math.sin(m.angle) * height * ease(t) * m.reach);
      add("ripple-mote", oval(p.x, p.y, m.radius * (1 - t), m.radius * (1 - t)));
    }
  }
}
