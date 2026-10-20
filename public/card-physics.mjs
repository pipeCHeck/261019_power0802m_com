import { GRAVITY } from "./physics-config.mjs";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, width) => ((value % width) + width) % width;

export class PhysicsCard {
  constructor({ width, height }) {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    this.body = { x: width / 2, y: height * .2, width: 0, height: 0,
      angle: 0, vx: 0, vy: 0, angularVelocity: 0 };
    this.drag = null;
    this.mass = 12;
    this.sleeping = false;
    this.restTime = 0;
    this.resize(width, height);
  }

  get displayX() { return wrap(this.body.x, this.viewportWidth); }
  get awake() { return Boolean(this.drag) || !this.sleeping; }
  get corners() {
    const b = this.body, c = Math.cos(b.angle), s = Math.sin(b.angle);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({
      x: b.x + c * x * b.width / 2 - s * y * b.height / 2,
      y: b.y + s * x * b.width / 2 + c * y * b.height / 2,
    }));
  }

  wake() { this.sleeping = false; this.restTime = 0; }

  resize(width, height) {
    if (this.drag) this.endDrag({ throwing: false });
    const ratio = this.displayX / this.viewportWidth;
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    const sizeMargin = Math.min(16, height * .1);
    this.floor = this.viewportHeight;
    this.body.width = Math.max(1, Math.min(460, Math.max(1, width - 32),
      (height - sizeMargin * 2) / Math.hypot(1, .42)));
    this.body.height = this.body.width * .42;
    this.inertia = (this.body.width ** 2 + this.body.height ** 2) / 12;
    this.body.x = wrap(ratio * this.viewportWidth, this.viewportWidth);
    this.containVertically();
    this.wake();
  }

  beginDrag(x, y, copyCenterX) {
    const b = this.body;
    const c = Math.cos(b.angle), s = Math.sin(b.angle);
    const nearest = b.x + Math.round((x - b.x) / this.viewportWidth) * this.viewportWidth;
    const centers = copyCenterX === undefined ? [nearest, nearest - this.viewportWidth, nearest + this.viewportWidth] : [copyCenterX];
    for (const centerX of centers) {
      const dx = x - centerX, dy = y - b.y;
      const localX = c * dx + s * dy, localY = -s * dx + c * dy;
      if (Math.abs(localX) > b.width / 2 + 1 || Math.abs(localY) > b.height / 2 + 1) continue;
      b.x = centerX;
      const pivotInertia = this.inertia + dx * dx + dy * dy;
      // Stopping the grabbed material point changes the rotation axis. Keep
      // angular momentum about that point, rather than inheriting free spin.
      b.angularVelocity = clamp((this.inertia * b.angularVelocity + dy * b.vx - dx * b.vy) / pivotInertia, -6, 6);
      b.vx = b.angularVelocity * dy;
      b.vy = -b.angularVelocity * dx;
      const pendulumFrequency = Math.sqrt(GRAVITY * Math.hypot(dx, dy) / pivotInertia);
      // Continuous grip friction, about 30% of critical damping, lets inertia
      // carry the plate through balance before each swing loses energy.
      // The same torque/damping applies while the hand moves or stays still.
      const gripDamping = Math.max(.85, .6 * pendulumFrequency);
      this.drag = { localX, localY, x, y, previousX: x, previousY: y, pivotX: x, pivotY: y,
        vx: 0, vy: 0, curveVX: 0, curveVY: 0, turnRate: 0, motionX: x, motionY: y, gripDamping };
      this.wake();
      return true;
    }
    return false;
  }

  moveDrag(x, y) { if (this.drag) Object.assign(this.drag, { x, y }); }

  endDrag({ throwing = true } = {}) {
    if (!this.drag) return;
    if (throwing && (this.drag.x !== this.drag.previousX || this.drag.y !== this.drag.previousY)) this.step(1 / 120);
    this.drag = null;
    this.body.x = this.displayX;
    if (!throwing) Object.assign(this.body, { vx: 0, vy: 0, angularVelocity: 0 });
    this.wake();
  }

  containVertically() {
    const ys = this.corners.map(p => p.y);
    const bottom = Math.max(...ys);
    if (bottom > this.floor) this.body.y -= bottom - this.floor;
  }

  floorPivotLimit(angle) {
    const b = this.body, drag = this.drag;
    const s = Math.sin(angle), c = Math.cos(angle);
    const bottom = Math.abs(s) * b.width / 2 + Math.abs(c) * b.height / 2;
    return this.floor - bottom + s * drag.localX + c * drag.localY;
  }

  constrainPinnedAngle(wanted, pointerY) {
    const b = this.body;
    const fits = angle => pointerY <= this.floorPivotLimit(angle) + .0000001;
    if (fits(wanted)) return wanted;
    // The current pose remains feasible because pressure is stopped at the
    // floor first. Follow only this small continuous angular step to contact;
    // never switch to a distant pose just to force the pointer downward.
    let low = 0, high = 1;
    for (let i = 0; i < 24; i++) {
      const middle = (low + high) / 2;
      if (fits(b.angle + (wanted - b.angle) * middle)) low = middle;
      else high = middle;
    }
    b.angularVelocity = 0;
    return b.angle + (wanted - b.angle) * low;
  }

  collide(dt) {
    const b = this.body;
    const corners = this.corners;
    const bottom = Math.max(...corners.map(p => p.y));
    if (bottom < this.floor - .01) return false;
    const contacts = corners.filter(p => Math.abs(p.y - bottom) < .5);
    const rx = contacts.reduce((sum, p) => sum + p.x - b.x, 0) / contacts.length;
    const ry = bottom - b.y;
    b.y += this.floor - bottom;
    const velocity = b.vy + b.angularVelocity * rx;
    let impulse = 0;
    if (velocity > 0) {
      const restitution = velocity > 140 ? .18 : 0;
      impulse = (1 + restitution) * velocity / (1 + rx * rx / this.inertia);
      b.vy -= impulse;
      b.angularVelocity -= rx * impulse / this.inertia;
    }
    const tangentSpeed = b.vx - b.angularVelocity * ry;
    // The normal impulse already includes this step's gravity. Adding gravity
    // again doubles resting friction and even brakes contacts moving away.
    const frictionLimit = .7 * impulse;
    const friction = clamp(-tangentSpeed / (1 + ry * ry / this.inertia),
      -frictionLimit, frictionLimit);
    b.vx += friction;
    b.angularVelocity -= ry * friction / this.inertia;
    // Plastic loses rocking energy through contact deformation even when
    // the corner is rolling without slipping. Air motion is unaffected.
    b.angularVelocity *= Math.exp(-1.5 * dt);
    // Static floor support removes subpixel edge rocking once the plate has
    // lost its impact energy. It must not keep drifting on alternating corners.
    const flatAngle = Math.round(b.angle / (Math.PI / 2)) * Math.PI / 2;
    const motionEnergy = b.vx ** 2 + b.vy ** 2 + this.inertia * b.angularVelocity ** 2;
    // Only capture motion whose total kinetic energy could lift the plate
    // less than an eighth of a pixel. This scales with gravity and inertia,
    // including upright contacts on the short edge.
    if (Math.abs(b.angle - flatAngle) < .002 && motionEnergy < 2 * GRAVITY * .125) {
      b.angle = flatAngle;
      b.y = this.floor - (Math.abs(Math.sin(flatAngle)) * b.width + Math.abs(Math.cos(flatAngle)) * b.height) / 2;
      Object.assign(b, { vx: 0, vy: 0, angularVelocity: 0 });
    }
    return true;
  }

  step(seconds) {
    if (!this.awake || !Number.isFinite(seconds) || seconds <= 0) return;
    const duration = Math.min(seconds, .8);
    const steps = Math.ceil(duration * 240), dt = duration / steps;
    const b = this.body, drag = this.drag;
    let startX = 0, startY = 0, targetY = 0;
    if (drag) {
      startX = drag.pivotX; startY = drag.pivotY;
      targetY = Math.min(drag.y, this.floorPivotLimit(b.angle));
    }
    for (let i = 1; i <= steps; i++) {
      if (drag) {
        const previousX = b.x, previousY = b.y;
        const pointerX = startX + (drag.x - startX) * i / steps;
        const pointerY = Math.min(startY + (targetY - startY) * i / steps, this.floorPivotLimit(b.angle));
        const blend = 1 - Math.exp(-dt / .012);
        const vx = drag.vx + (clamp((pointerX - drag.pivotX) / dt, -2800, 2800) - drag.vx) * blend;
        const vy = drag.vy + (clamp((pointerY - drag.pivotY) / dt, -2800, 2800) - drag.vy) * blend;
        const ax = clamp((vx - drag.vx) / dt, -60000, 60000);
        const ay = clamp((vy - drag.vy) / dt, -60000, 60000);
        // Signed curvature of the moving hand drives a bounded turning torque.
        // Regularize low speeds and smooth direction changes so small deliberate
        // circles work, while cursor jitter and straight reversals do not spin it.
        // Only the assist uses this slower direction signal; the material point
        // and inertial torque still follow the original, immediate hand motion.
        const curveBlend = 1 - Math.exp(-dt / .06);
        const curveVX = drag.curveVX + (vx - drag.curveVX) * curveBlend;
        const curveVY = drag.curveVY + (vy - drag.curveVY) * curveBlend;
        const speedSquared = curveVX * curveVX + curveVY * curveVY;
        const turnRate = (drag.curveVX * curveVY - drag.curveVY * curveVX) / (dt * (speedSquared + 80 ** 2));
        drag.curveVX = curveVX; drag.curveVY = curveVY;
        // Average before limiting: sparse pointer events concentrate direction
        // changes into brief peaks that should carry the same turning impulse.
        drag.turnRate = clamp(drag.turnRate + (turnRate - drag.turnRate) * (1 - Math.exp(-dt / .04)), -12, 12);
        const motionBlend = 1 - Math.exp(-dt / .08);
        drag.motionX += (pointerX - drag.motionX) * motionBlend;
        drag.motionY += (pointerY - drag.motionY) * motionBlend;
        // Speed alone cannot distinguish a tiny fast jitter from a deliberate
        // arc. Require a few pixels of recent spatial movement as well.
        const arcStrength = clamp((Math.hypot(pointerX - drag.motionX, pointerY - drag.motionY) - 1) / 3, 0, 1);
        drag.vx = vx; drag.vy = vy;
        const c = Math.cos(b.angle), s = Math.sin(b.angle);
        const rx = c * drag.localX - s * drag.localY;
        const ry = s * drag.localX + c * drag.localY;
        const torque = -rx * (GRAVITY - ay) - ry * ax;
        b.angularVelocity += torque / (this.inertia + rx * rx + ry * ry) * dt;
        const turnStrength = arcStrength * clamp((Math.abs(drag.turnRate) - 1) / 1.5, 0, 1)
          * speedSquared / (speedSquared + 80 ** 2);
        b.angularVelocity += (clamp(drag.turnRate * 1.3, -10, 10) - b.angularVelocity)
          * (1 - Math.exp(-8 * turnStrength * dt));
        b.angularVelocity *= Math.exp(-drag.gripDamping * dt);
        b.angularVelocity = clamp(b.angularVelocity, -12, 12);
        b.angle = this.constrainPinnedAngle(b.angle + b.angularVelocity * dt, pointerY);
        const nextRx = Math.cos(b.angle) * drag.localX - Math.sin(b.angle) * drag.localY;
        const nextRy = Math.sin(b.angle) * drag.localX + Math.cos(b.angle) * drag.localY;
        b.x = pointerX - nextRx;
        b.y = pointerY - nextRy;
        this.containVertically();
        // Collision and release velocities follow actual material motion,
        // including a hand stopped by the floor, rather than raw mouse speed.
        b.vx = clamp((b.x - previousX) / dt, -2800, 2800);
        b.vy = clamp((b.y - previousY) / dt, -2800, 2800);
        drag.pivotX = b.x + nextRx; drag.pivotY = b.y + nextRy;
      } else {
        const nextVy = clamp(b.vy + GRAVITY * dt, -2800, 2800);
        b.y += (b.vy + nextVy) * .5 * dt;
        b.vy = nextVy;
        b.vx *= Math.exp(-.04 * dt);
        b.angularVelocity *= Math.exp(-.1 * dt);
        b.x = wrap(b.x + b.vx * dt, this.viewportWidth);
        b.angle += b.angularVelocity * dt;
        const grounded = this.collide(dt);
        if (grounded && Math.abs(b.vx) < 2 && Math.abs(b.vy) < 2 && Math.abs(b.angularVelocity) < .025) {
          this.restTime += dt;
          if (this.restTime > .35) {
            Object.assign(b, { vx: 0, vy: 0, angularVelocity: 0 });
            this.sleeping = true;
          }
        } else this.restTime = 0;
      }
    }
    if (drag) {
      drag.previousX = drag.x; drag.previousY = drag.y;
      drag.pivotX = b.x + Math.cos(b.angle) * drag.localX - Math.sin(b.angle) * drag.localY;
      drag.pivotY = b.y + Math.sin(b.angle) * drag.localX + Math.cos(b.angle) * drag.localY;
    }
    b.angle %= Math.PI * 2;
    this.containVertically();
  }
}
