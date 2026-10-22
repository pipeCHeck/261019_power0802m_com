import { bounceOrigin, clipBounceStrokes } from "./bounce-placement.mjs";

const TAU = Math.PI * 2;
const clamp = v => Math.max(0, Math.min(1, v));
const ease = v => 1 - (1 - clamp(v)) ** 3;
export const BOUNCE_STYLES = Object.freeze([
  { id: "pop", letter: "A", name: "톡! 선 팝", description: "클릭처럼 선들이 톡 펼쳐집니다. 실제 튕겨 나가는 힘에 따라 선의 길이와 퍼지는 크기가 달라집니다." },
  { id: "bubbles", letter: "B", name: "미니 선 폭죽", description: "작은 폭죽처럼 선들이 튀어 올라 휘어지고, 시차를 두고 짧아집니다." },
  { id: "spring", letter: "C", name: "통통 곡선", description: "짧은 곡선들이 튕기는 방향을 따라 펴졌다 흔들리며 빠져나갑니다." },
]);
export const bounceStyleFromSearch = search => {
  const id = new URLSearchParams(search).get("bounce");
  return BOUNCE_STYLES.some(s => s.id === id) ? id : null;
};

export function createBounceImpact(hit, random = Math.random, style = "pop") {
  const selectedStyle = BOUNCE_STYLES.some(s => s.id === style) ? style : "pop";
  const kickSpeed = Math.max(0, hit.bounceSpeed ?? hit.speed * 1.62);
  const strength = selectedStyle === "pop" ? (kickSpeed / 1050) ** .72
    : .3 + Math.log1p(Math.max(0, hit.speed) / 600) * .65;
  const range = (a, b) => a + (b - a) * random();
  const normalLength = Math.hypot(hit.normal.x, hit.normal.y) || 1;
  const count = 7 + Math.floor(strength * 3);
  const velocity = { x: hit.velocity?.x ?? 0, y: hit.velocity?.y ?? 0 };
  const duration = selectedStyle === "pop" ? Math.max(.46,
    .60 / (1 + Math.hypot(velocity.x, velocity.y) / 18000 + kickSpeed / 36000)) : .72;
  return { type: "bounce", style: selectedStyle,
    x: hit.x, y: hit.y, normal: { x: hit.normal.x / normalLength, y: hit.normal.y / normalLength },
    age: 0, life: duration, duration, retractDuration: .16, velocity, retiredAt: null, strength, shape: hit.shape,
    size: selectedStyle === "pop" ? 17 * (Math.max(6, hit.radius) / 30) ** .7 * (.25 + .85 * strength)
      : 9 + Math.min(hit.radius, 60) * .16 + strength * 8,
    lean: Math.max(-.6, Math.min(.6, hit.tangentSpeed / (hit.speed + 200))),
    bits: Array.from({ length: count }, (_, i) => ({
      angle: -1.35 + (i + range(.15, .85)) / count * 2.7, speed: range(.65, 1.25), radius: range(.5, 1.1),
      delay: i === 0 ? 0 : range(.008, .065), life: range(.38, .62),
      phase: range(0, TAU), curl: range(-1, 1),
    })),
  };
}

export function bounceShapes(e, width, height, bodies) {
  if (e.age >= e.life || width <= 0 || height <= 0) return [];
  const shapes = [], n = e.normal, tangent = { x: -n.y, y: n.x };
  const origin = bounceOrigin(e, width), x = origin.x;
  const visibility = e.retiredAt == null ? 1 : 1 - ease((e.age - e.retiredAt) / e.retractDuration);
  const add = (role, local, fill = null, closed = true, lineWidth = 1.2) => {
    const points = local.map(p => ({ x: x + tangent.x * p.x + n.x * p.y,
      y: origin.y + tangent.y * p.x + n.y * p.y }));
    const left = Math.min(...points.map(p => p.x)), right = Math.max(...points.map(p => p.x));
    for (const offset of [-width, 0, width]) {
      if (right + offset < 0 || left + offset > width) continue;
      shapes.push({ role, fill, closed, lineWidth, points: points.map(p => ({ x: p.x + offset, y: p.y })) });
    }
  };
  const size = e.size, age = e.age;
  for (const b of e.bits) {
    const duration = e.style === "pop" ? (e.duration - b.delay) * (.8 + .2 * (b.life - .38) / .24) : b.life;
    const t = (age - b.delay) / duration;
    if (t <= 0 || t >= 1) continue;
    const envelope = ease(t / .16) * (1 - ease((t - .48) / .52)) * visibility;
    if (envelope < .008) continue;
    const dx = Math.sin(b.angle), dy = Math.cos(b.angle);
    if (e.style === "pop") {
      const distance = size * (.15 + 2 * b.speed * ease(t));
      const length = size * (.3 + b.radius * .3) * envelope;
      const cx = dx * distance + e.lean * size * t, cy = 2 + dy * distance;
      add("pop-ray", [{ x: cx, y: cy }, { x: cx + dx * length, y: cy + dy * length }], null, false, 1.2);
    } else if (e.style === "bubbles") {
      // Sample a short moving slice of each ballistic path, like the site's fireworks.
      const tail = Math.max(0, t - .15 * envelope);
      const points = Array.from({ length: 8 }, (_, i) => {
        const u = tail + (t - tail) * i / 7;
        return { x: dx * size * 4.4 * b.speed * u + e.lean * size * u,
          y: 2 + dy * size * 4.4 * b.speed * u - size * 2 * u * u };
      });
      add("firework-trail", points, null, false, 1.35);
    } else {
      const distance = size * (.25 + 2.2 * b.speed * ease(t * .85));
      const length = size * (.55 + b.radius * .3) * envelope;
      const bend = Math.sin(t * 9 + b.phase) * (1 - t) * size * .25 * b.curl;
      const points = Array.from({ length: 12 }, (_, i) => {
        const u = i / 11, along = distance + u * length;
        const across = Math.sin(u * Math.PI) * bend;
        return { x: dx * along + dy * across + e.lean * size * t,
          y: 2 + dy * along - dx * across };
      });
      add("spring-stroke", points, null, false, 1.2);
    }
  }
  return clipBounceStrokes(shapes, bodies, width);
}

export function drawBounceImpact(ctx, e, width, height, bodies) {
  ctx.globalAlpha = 1; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const s of bounceShapes(e, width, height, bodies)) {
    ctx.beginPath(); ctx.moveTo(s.points[0].x, s.points[0].y);
    for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
    if (s.closed) ctx.closePath();
    if (s.fill) { ctx.fillStyle = s.fill === "paper" ? "#f8f7f3" : "#292b26"; ctx.fill(); }
    ctx.lineWidth = s.lineWidth; ctx.strokeStyle = "#292b26"; ctx.stroke();
  }
}
