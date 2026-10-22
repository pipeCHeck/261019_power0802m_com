import { GRAVITY } from "./physics-config.mjs";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// A rotational fastener, not a canned shake. Collisions supply angular impulse;
// HP changes the joint's compliance, restoring torque and damping continuously.
export class CardMount {
  constructor(card) {
    this.card = card;
    this.hp = this.maxHp = 300;
    this.attached = true;
    this.restAngle = 0;
    this.lastHit = -Infinity;
    this.pivot = { x: 0, y: 0 };
    card.body.angle = this.restAngle;
    this.place();
  }

  get localY() { return -this.card.body.height / 2 + 16; }
  get pivotInertia() { return this.card.inertia + this.localY ** 2; }
  get health() { return clamp(this.hp / this.maxHp, 0, 1); }
  get inverseInertia() { return (.015 + .985 * (1 - this.health) ** 1.3) / (this.card.mass * this.pivotInertia); }

  place(x = this.card.viewportWidth / 2, top = this.card.viewportHeight * .50) {
    if (!this.attached) return;
    const card = this.card;
    const bottomLimit = Math.max(24, card.viewportHeight - card.body.height - 64);
    this.pivot = { x, y: clamp(top, Math.min(90, bottomLimit), bottomLimit) + 16 };
    this.syncPose();
  }

  syncPose() {
    const b = this.card.body, rx = -Math.sin(b.angle) * this.localY, ry = Math.cos(b.angle) * this.localY;
    b.x = this.pivot.x - rx; b.y = this.pivot.y - ry;
    b.vx = b.angularVelocity * ry; b.vy = -b.angularVelocity * rx;
  }

  receive({ speed, radius, time }) {
    if (!this.attached || !Number.isFinite(speed) || !Number.isFinite(radius) || !Number.isFinite(time) ||
      speed < 90 || time - this.lastHit < .08) return false;
    const damage = clamp(4 + 7 * (speed / 700) ** 1.1 * Math.sqrt(clamp(radius / 30, .3, 3)), 4, 28);
    this.hp = Math.max(0, this.hp - damage);
    this.lastHit = time;
    this.card.wake();
    if (this.hp === 0) this.attached = false;
    return true;
  }

  step(seconds) {
    const b = this.card.body, ratio = this.health, stiffness = 5 + 900 * ratio ** 4;
    const gravity = GRAVITY * -this.localY / this.pivotInertia;
    const damping = 2 * (.14 + .65 * ratio) * Math.sqrt(stiffness + gravity);
    const steps = Math.ceil(seconds * 240), dt = seconds / steps;
    for (let i = 0; i < steps; i++) {
      // Restoring torque keeps the installed horizontal pose stable until an
      // actual collision supplies angular momentum.
      const torque = -stiffness * (b.angle - this.restAngle) - gravity * (Math.sin(b.angle) - Math.sin(this.restAngle));
      b.angularVelocity = clamp((b.angularVelocity + torque * dt) * Math.exp(-damping * dt), -12, 12);
      b.angle += b.angularVelocity * dt;
      this.syncPose();
      if (Math.abs(b.angle - this.restAngle) < .00004 && Math.abs(b.angularVelocity) < .0006) {
        this.card.restTime += dt;
        if (this.card.restTime > .25) {
          b.angle = this.restAngle; b.angularVelocity = 0; this.syncPose(); this.card.sleeping = true;
        }
      } else this.card.restTime = 0;
    }
  }
}
