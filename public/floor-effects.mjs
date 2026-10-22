import { DEFAULT_IMPACT_STYLE, createVariantProfile, validImpactStyle, variantShapes } from "./effect-variants.mjs";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ease = value => 1 - (1 - clamp(value, 0, 1)) ** 3;
// Preserve the old response through 1, then keep rising without saturation.
// Logarithmic overflow prevents huge impacts from multiplying particle work.
const strength = value => value <= 1 ? Math.max(0, value) : 1 + Math.log(value);

// Build each puff once, with independently sized, overlapping lobes.
function createCloud(random) {
  const lobes = 2 + Math.floor(random() * 3);
  const widths = Array.from({ length: lobes }, () => .7 + random() * .6);
  const total = widths.reduce((sum, w) => sum + w, 0);
  const points = [{ x: -1, y: .2 }];
  const curve = (a, b, end) => {
    const start = points.at(-1);
    for (let i = 1; i <= 6; i++) {
      const t = i / 6, u = 1 - t;
      points.push({ x: u ** 3 * start.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t ** 3 * end.x,
        y: u ** 3 * start.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t ** 3 * end.y });
    }
  };
  let left = -1;
  for (let i = 0; i < lobes; i++) {
    const width = widths[i] / total * 2, right = left + width;
    const height = (.6 + random() * .5) * (1 - Math.abs((left + right) / 2) * .25);
    const peak = left + width * (.35 + random() * .3);
    curve({ x: left - width * .12, y: -height * .55 },
      { x: peak - width * .3, y: -height }, { x: peak, y: -height });
    curve({ x: peak + width * .35, y: -height }, { x: right + width * .15, y: -height * .55 },
      { x: right, y: i === lobes - 1 ? .2 : -.12 - random() * .2 });
    left = right;
  }
  curve({ x: 1.15, y: .45 + random() * .2 }, { x: -1.1, y: .4 + random() * .25 }, points[0]);
  return points;
}

export function createFloorImpact(impact, random = Math.random, selectedStyle = DEFAULT_IMPACT_STYLE) {
  const power = strength(Math.sqrt(impact.energy / 8640000));
  const sweep = strength(Math.abs(impact.angularSpeed || 0) / 8);
  const motion = strength(Math.hypot(impact.normalSpeed, impact.tangentSpeed * .45) / 1800);
  const slam = strength((Math.max(power, motion) - .38) / .62
    + .25 * sweep * clamp((impact.normalSpeed - 250) / 750, 0, 1));
  const lean = clamp(impact.tangentSpeed / (impact.normalSpeed + 240), -.8, .8);
  const count = Math.round(5 + power * 5 + slam * 7 + Math.min(4, impact.span / 70));
  const particles = Array.from({ length: count }, (_, i) => {
    const u = (i + .5) / count;
    const angle = clamp(-Math.PI + .15 + u * (Math.PI - .3) + lean * .5
      + (random() - .5) * .18, -Math.PI + .12, -.12);
    const reach = (18 + power * 38 + slam * 75) * (.8 + random() * .4);
    return { origin: (u - .5) * impact.span, dx: Math.cos(angle) * reach,
      dy: Math.sin(angle) * reach * (1 - clamp(impact.span / 200, 0, 1) * .2),
      length: (4 + power * 4 + slam * 9) * (.65 + random() * .7),
      thickness: (1.1 + slam * 2.5) * (.7 + random() * .6),
      delay: i % 4 === 0 ? 0 : random() * .035, turn: (random() - .5) * 3 };
  });
  // Randomness belongs to the collision, never to a rendered frame. Profiles
  // stay coherent while their shape, timing and motion differ between hits.
  const flashCount = impact.span > 120 ? 2 + Math.floor(random() * 2) : 1;
  const flashes = Array.from({ length: flashCount }, (_, index) => {
    const tipCount = 9 + Math.floor(random() * 3) * 2;
    return { origin: flashCount === 1 ? 0 : ((index + .25 + random() * .5) / flashCount - .5) * impact.span,
      scale: (flashCount > 1 ? .72 : 1) * (.85 + random() * .3),
      aspect: .8 + random() * .4, lean: lean + Math.sin(impact.angle) * .1 + (random() - .5) * .2,
      delay: index === 0 ? 0 : random() * .014, attack: .016 + random() * .018,
      hold: .04 + random() * .025, release: .05 + random() * .035, inset: .54 + random() * .18,
      tips: Array.from({ length: tipCount }, (_, i) => ({
        angle: -Math.PI + .1 + i / (tipCount - 1) * (Math.PI - .2)
          + (i && i < tipCount - 1 ? (random() - .5) * .8 / tipCount : 0),
        radius: i % 2 === 0 ? .65 + random() * .35 : .27 + random() * .25,
      })) };
  });
  const dust = [], waves = [];
  for (const side of [-1, 1]) {
    const bias = 1 + side * lean * .5;
    const count = slam > .2 ? 1 + Math.floor(random() * 2 + slam * .7 + Math.max(0, side * lean) * .7) : 1;
    for (let i = 0; i < count; i++) {
      dust.push({ side, origin: side * (impact.span / 2 + 4 + random() * 12 + i * (10 + random() * 14)),
        scale: (.65 + random() * .7) * Math.sqrt(bias), aspect: .8 + random() * .55,
        speed: (.65 + random() * .7) * bias, lift: .4 + random() * .35,
        delay: .025 + random() * .045 + i * (.008 + random() * .018),
        grow: .05 + random() * .04, duration: (.27 + power * .1 + slam * .1) * (.7 + random() * .35),
        rotation: (random() - .5) * .3 + lean * .12, roll: (random() - .5) * .3,
        outline: .9 + random() * .4 + slam * .35, cloud: createCloud(random) });
    }
    const waveCount = 1 + Number(slam > .5 && random() < .3);
    for (let i = 0; i < waveCount; i++) waves.push({ side, delay: .008 + random() * .014 + i * .018,
      duration: .1 + random() * .065, reach: (.75 + random() * .5) * bias,
      rise: .7 + random() * .6, start: .08 + random() * .1, arc: .15 + random() * .15,
      width: 1 + slam * (.4 + random() * .6) });
  }
  const life = Math.max(.34 + power * .12 + slam * .1, ...dust.map(p => p.delay + p.duration));
  const style = validImpactStyle(selectedStyle);
  const effect = { type: "floor", x: impact.x, y: impact.y, span: impact.span, age: 0,
    life, power, slam, lean, particles, flashes, dust, waves, style };
  if (style !== "comic") {
    effect.art = createVariantProfile(style, effect, random);
    effect.life = ["billow", "liquid", "shatter"].includes(style) ? .95 : .6;
  }
  return effect;
}

export function floorImpactShapes(effect, width, height) {
  if (effect.age >= effect.life || width <= 0 || height <= 0) return [];
  const shapes = [], x = ((effect.x % width) + width) % width;
  const floor = Math.max(0, Math.min(effect.y, height) - 1);
  const add = (role, points, fill = "ink", stroke = null, lineWidth = 1, closed = true) => {
    const left = Math.min(...points.map(p => p.x)), right = Math.max(...points.map(p => p.x));
    for (const offset of [-width, 0, width]) {
      if (right + offset < 0 || left + offset > width) continue;
      shapes.push({ role, fill, stroke, lineWidth, closed,
        points: points.map(p => ({ x: p.x + offset, y: clamp(p.y, 0, floor) })) });
    }
  };
  if (effect.style && effect.style !== "comic") {
    variantShapes(effect, add, x, floor);
    return shapes;
  }
  const age = effect.age;

  // Attack: a compact, filled impact crown with a paper-colored cutout.
  // It expands in two frames, holds briefly, then contracts into the contact.
  for (const profile of effect.flashes) {
    const t = age - profile.delay;
    if (t < 0) continue;
    const flash = (.45 + .55 * ease(t / profile.attack)) * (1 - ease((t - profile.hold) / profile.release));
    if (flash > .2) {
      const anchor = profile.origin, scale = flash * profile.scale;
      const rx = (15 + effect.power * 20 + effect.slam * 52) * scale * profile.aspect;
      const ry = (9 + effect.power * 10 + effect.slam * 43) * scale;
      const points = [{ x: x + anchor - rx * .22, y: floor }];
      for (const { angle, radius } of profile.tips) {
        points.push({ x: x + anchor + Math.cos(angle) * rx * radius
          - Math.sin(angle) * profile.lean * ry * .65,
        y: floor - 2 + Math.sin(angle) * ry * radius });
      }
      points.push({ x: x + anchor + rx * .22, y: floor });
      add("flash", points);
      add("flash", points.map(p => ({ x: x + anchor + (p.x - x - anchor) * profile.inset,
        y: floor + (p.y - floor) * profile.inset })), "paper");
    }
  }

  // Secondary action: chunky tapered chips, not evenly spaced thin rays.
  for (const p of effect.particles) {
    const t = (age - p.delay) / (effect.life - p.delay);
    if (t < 0 || t >= 1) continue;
    const travel = ease((age - p.delay) / (.28 + effect.slam * .08));
    const cx = x + p.origin + p.dx * travel;
    const cy = floor - 3 + p.dy * travel + 25 * t * t;
    const direction = Math.atan2(p.dy, p.dx) + p.turn * t;
    const dx = Math.cos(direction), dy = Math.sin(direction);
    const size = (.7 + .3 * ease(t / .08)) * (1 - t) ** 1.2;
    const length = p.length * size, half = p.thickness * size;
    add("shard", [
      { x: cx + dx * length * .5, y: cy + dy * length * .5 },
      { x: cx - dx * length * .1 - dy * half, y: cy - dy * length * .1 + dx * half },
      { x: cx - dx * length * .5, y: cy - dy * length * .5 },
      { x: cx - dx * length * .1 + dy * half, y: cy - dy * length * .1 - dx * half },
    ]);
  }

  // A short curved pressure wave joins the impact and the departing dust.
  for (const wave of effect.waves) {
    const t = (age - wave.delay) / wave.duration;
    if (t >= 0 && t < 1) {
      const radius = effect.span / 2 + (12 + effect.power * 20 + effect.slam * 65) * wave.reach * (.35 + .65 * ease(t));
      const rise = (10 + effect.slam * 18) * wave.rise * (1 - t * .3);
      const arc = wave.arc * (1 - clamp((t - .4) / .6, 0, 1));
      const points = Array.from({ length: 10 }, (_, i) => {
        const angle = (wave.start + i / 9 * arc) * Math.PI;
        return { x: x + wave.side * Math.cos(angle) * radius, y: floor - 1 - Math.sin(angle) * rise };
      });
      add("shockwave", points, null, "ink", wave.width, false);
    }
  }

  // Follow-through: asymmetric outlined puffs roll out from the contact ends.
  for (const puff of effect.dust) {
    const dustTime = (age - puff.delay) / puff.duration;
    if (dustTime >= 0 && dustTime < 1) {
      const grow = ease((age - puff.delay) / puff.grow);
      const shrink = (1 - clamp((dustTime - .3) / .7, 0, 1)) ** 1.2;
      const radius = (6 + effect.power * 6 + effect.slam * 12) * grow * shrink * puff.scale;
      if (radius < .1) continue;
      const distance = (10 + effect.power * 15 + effect.slam * 45) * puff.speed * ease(dustTime);
      const cx = x + puff.origin + puff.side * distance;
      const cy = floor - 2 - radius * puff.lift;
      const angle = puff.rotation + puff.roll * ease(dustTime), c = Math.cos(angle), s = Math.sin(angle);
      add("dust", puff.cloud.map(p => {
        const px = p.x * radius * puff.aspect * puff.side, py = p.y * radius * .65;
        return { x: cx + c * px - s * py, y: cy + s * px + c * py };
      }), "paper", "ink", puff.outline);
    }
  }
  return shapes;
}

export function drawFloorImpact(context, effect, width, height) {
  context.globalAlpha = 1;
  context.lineJoin = "round";
  context.lineCap = "round";
  for (const shape of floorImpactShapes(effect, width, height)) {
    context.beginPath();
    context.moveTo(shape.points[0].x, shape.points[0].y);
    for (const p of shape.points.slice(1)) context.lineTo(p.x, p.y);
    if (shape.closed) context.closePath();
    if (shape.fill) {
      context.fillStyle = shape.fill === "ink" ? "#292b26" : "#f8f7f3";
      context.fill();
    }
    if (shape.stroke) {
      context.strokeStyle = "#292b26";
      context.lineWidth = shape.lineWidth;
      context.stroke();
    }
  }
}
