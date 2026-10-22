import { PhysicsCard } from "./card-physics.mjs";
import { BallGame } from "./game-physics.mjs";
import { getBallConvexPieces } from "./ball-shapes.mjs";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

function inside(point, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) &&
      point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

function overlapPoints(a, b) {
  const points = [...a.filter(p => inside(p, b)), ...b.filter(p => inside(p, a))];
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p = a[i], q = b[j], r = subtract(a[(i + 1) % a.length], p), s = subtract(b[(j + 1) % b.length], q);
    const denominator = cross(r, s);
    if (Math.abs(denominator) < .000001) continue;
    const t = cross(subtract(q, p), s) / denominator, u = cross(subtract(q, p), r) / denominator;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) points.push({ x: p.x + t * r.x, y: p.y + t * r.y });
  }
  return points;
}

function convexContact(box, { points: outline, externalEdges }) {
  let best = null;
  for (const polygon of [box, outline]) {
    for (let i = 0; i < polygon.length; i++) {
      const edge = subtract(polygon[(i + 1) % polygon.length], polygon[i]);
      const length = Math.hypot(edge.x, edge.y);
      if (length < .000001) continue;
      const axis = { x: -edge.y / length, y: edge.x / length };
      const a = box.map(p => dot(p, axis)), b = outline.map(p => dot(p, axis));
      const positive = Math.max(...a) - Math.min(...b), negative = Math.max(...b) - Math.min(...a);
      if (positive < 0 || negative < 0) return null;
      // Internal decomposition edges can reject disjoint pieces, but cannot
      // be physical surfaces or normals: that would create invisible seams.
      if (polygon === outline && !externalEdges[i]) continue;
      const depth = Math.min(positive, negative);
      if (best && depth >= best.depth) continue;
      const normal = positive < negative ? axis : { x: -axis.x, y: -axis.y };
      const support = Math.min(...outline.map(p => dot(p, normal)));
      const points = outline.filter(p => dot(p, normal) <= support + .5);
      best = { depth, normal, point: { x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length } };
    }
  }
  return best;
}

function polygonContact(box, pieces) {
  // Collect only the actual overlapping regions, never a convex hull that
  // would fill the star's valleys or the heart's notch.
  const overlap = pieces.flatMap(piece => overlapPoints(box, piece.points));
  if (!overlap.length) return null;
  let best = null;
  for (const piece of pieces) {
    const contact = convexContact(box, piece);
    if (contact && (!best || contact.depth < best.depth)) best = contact;
  }
  if (best) {
    const projections = overlap.map(p => dot(p, best.normal));
    const support = Math.min(...projections);
    const supportPoints = overlap.filter(p => dot(p, best.normal) <= support + .00001);
    const points = supportPoints.filter((p, index) => supportPoints.findIndex(q =>
      Math.hypot(q.x - p.x, q.y - p.y) < .00001) === index);
    // A pair of star tips can touch one face simultaneously. Use their
    // shared support point so the response does not invent a one-sided spin.
    best.point = { x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length };
    best.depth = Math.max(...projections) - support;
  }
  return best;
}

function circleContact(card, centerX, ball) {
  const b = card.body, c = Math.cos(b.angle), s = Math.sin(b.angle);
  const dx = ball.x - centerX, dy = ball.y - b.y;
  const local = { x: c * dx + s * dy, y: -s * dx + c * dy };
  const point = { x: clamp(local.x, -b.width / 2, b.width / 2), y: clamp(local.y, -b.height / 2, b.height / 2) };
  const delta = subtract(local, point), distance = Math.hypot(delta.x, delta.y);
  if (distance > ball.radius) return null;
  let normal, depth;
  if (distance > .000001) {
    normal = { x: delta.x / distance, y: delta.y / distance };
    depth = ball.radius - distance;
  } else {
    const faces = [{ distance: b.width / 2 - local.x, x: 1, y: 0 },
      { distance: b.width / 2 + local.x, x: -1, y: 0 },
      { distance: b.height / 2 - local.y, x: 0, y: 1 },
      { distance: b.height / 2 + local.y, x: 0, y: -1 }];
    const face = faces.reduce((a, f) => f.distance < a.distance ? f : a);
    normal = face;
    depth = ball.radius + face.distance;
    point.x += normal.x * face.distance; point.y += normal.y * face.distance;
  }
  return { depth, normal: { x: c * normal.x - s * normal.y, y: s * normal.x + c * normal.y },
    point: { x: centerX + c * point.x - s * point.y, y: b.y + s * point.x + c * point.y } };
}

export class PhysicsWorld {
  constructor(bounds) {
    this.card = new PhysicsCard(bounds);
    this.game = new BallGame(bounds);
    this.time = 0;
    this.shapeImpacts = [];
    this.lastShapeImpact = -Infinity;
  }

  get awake() { return this.card.awake || this.game.active; }

  drainShapeImpacts() {
    const events = this.shapeImpacts;
    this.shapeImpacts = [];
    return events;
  }

  resolveContacts() {
    if (!this.game.active) return false;
    const card = this.card, b = card.body, ball = this.game.ball;
    const centers = [-1, 0, 1].map(offset => card.displayX + offset * card.viewportWidth)
      .sort((a, c) => Math.abs(a - ball.x) - Math.abs(c - ball.x));
    for (const centerX of centers) {
      if (Math.hypot(ball.x - centerX, ball.y - b.y) > Math.hypot(b.width, b.height) / 2 + ball.radius) continue;
      const box = card.corners.map(p => ({ x: p.x + centerX - b.x, y: p.y }));
      const contact = ball.shape === "circle" ? circleContact(card, centerX, ball) : polygonContact(box, getBallConvexPieces(ball));
      if (!contact) continue;
      const { normal: n, point, depth } = contact;
      const rb = subtract(point, ball), rc = { x: point.x - centerX, y: point.y - b.y };
      const invBallMass = 1 / clamp((ball.radius / 30) ** 2, .4, 4);
      const invBallInertia = invBallMass / (.5 * ball.radius ** 2);
      const mounted = card.mounted;
      const invCardMass = card.drag || mounted ? 0 : 1 / card.mass;
      const invCardInertia = mounted ? card.mount.inverseInertia : invCardMass / card.inertia;
      const rotationArm = mounted ? { x: point.x - (card.mount.pivot.x + centerX - b.x), y: point.y - card.mount.pivot.y } : rc;
      const relativeVelocity = () => ({ x: ball.vx - ball.angularVelocity * rb.y - b.vx + b.angularVelocity * rc.y,
        y: ball.vy + ball.angularVelocity * rb.x - b.vy - b.angularVelocity * rc.x });
      const apply = (direction, impulse) => {
        ball.vx += direction.x * impulse * invBallMass;
        ball.vy += direction.y * impulse * invBallMass;
        ball.angularVelocity += cross(rb, direction) * impulse * invBallInertia;
        b.vx -= direction.x * impulse * invCardMass;
        b.vy -= direction.y * impulse * invCardMass;
        b.angularVelocity -= cross(rotationArm, direction) * impulse * invCardInertia;
        if (mounted) card.mount.syncPose();
      };
      const denominator = direction => invBallMass + invCardMass +
        cross(rb, direction) ** 2 * invBallInertia + cross(rotationArm, direction) ** 2 * invCardInertia;
      const velocity = dot(relativeVelocity(), n);
      const before = { vx: ball.vx, vy: ball.vy };
      let impact = null;
      if (velocity < 0) {
        if (velocity < -70 && this.time - this.lastShapeImpact >= .06) {
          impact = { x: point.x, y: point.y, time: this.time, normal: { x: n.x, y: n.y },
            speed: -velocity, tangentSpeed: dot(relativeVelocity(), { x: -n.y, y: n.x }),
            shape: ball.shape, radius: ball.radius };
        }
        const impulse = -(1 + (velocity < -80 ? .62 : 0)) * velocity / denominator(n);
        apply(n, impulse);
        const tangent = { x: -n.y, y: n.x };
        apply(tangent, clamp(-dot(relativeVelocity(), tangent) / denominator(tangent), -.22 * impulse, .22 * impulse));
        if (!card.drag && impulse > .1) card.wake();
      }
      // The heavier card (or the user's hand) supports position correction;
      // keep the grabbed pivot and solid floor intact by separating the ball.
      ball.x += n.x * (depth + .01);
      ball.y += n.y * (depth + .01);
      ball.vx = clamp(ball.vx, -2800, 2800); ball.vy = clamp(ball.vy, -2800, 2800);
      ball.angularVelocity = clamp(ball.angularVelocity, -14, 14);
      if (impact) {
        card.receiveShapeImpact(impact);
        // Measure the actual kick delivered to the ball, after response and speed limits.
        impact.bounceSpeed = Math.max(0, (ball.vx - before.vx) * n.x + (ball.vy - before.vy) * n.y);
        impact.velocity = { x: b.vx - b.angularVelocity * rc.y, y: b.vy + b.angularVelocity * rc.x };
        this.shapeImpacts.push(impact);
        if (this.shapeImpacts.length > 16) this.shapeImpacts.shift();
        this.lastShapeImpact = this.time;
      }
      return true;
    }
    return false;
  }

  step(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return false;
    const duration = Math.min(seconds, .1), card = this.card, ball = this.game.ball;
    if (!this.game.active) { this.time += duration; card.step(duration); return false; }
    const drag = card.drag;
    const target = drag && { x: drag.x, y: drag.y, startX: drag.previousX, startY: drag.previousY };
    const movement = target ? Math.hypot(target.x - target.startX, target.y - target.startY) : 0;
    const speed = Math.hypot(ball.vx, ball.vy) + Math.hypot(card.body.vx, card.body.vy) +
      Math.abs(card.body.angularVelocity) * Math.hypot(card.body.width, card.body.height) / 2;
    const resolution = Math.max(3, Math.min(ball.radius, card.body.height / 4) * .5);
    const count = Math.min(1024, Math.max(1, Math.ceil(duration * 240), Math.ceil((speed * duration + movement) / resolution)));
    let ended = false;
    for (let i = 1; i <= count; i++) {
      this.time += duration / count;
      if (target) card.moveDrag(target.startX + (target.x - target.startX) * i / count, target.startY + (target.y - target.startY) * i / count);
      card.step(duration / count);
      if (this.game.step(duration / count)) ended = true;
      this.resolveContacts();
    }
    return ended;
  }
}
