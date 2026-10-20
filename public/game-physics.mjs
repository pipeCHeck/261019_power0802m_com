import { GRAVITY } from "./physics-config.mjs";
import { selectBallShape } from "./ball-shapes.mjs";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function fitRadius(radius, width, height) {
  const maximum = Math.max(8, Math.min(160, width / 2 - 8, height / 2 - 8));
  return clamp(Number.isFinite(radius) ? radius : 18, 8, maximum);
}

export function radiusForDrag(origin, pointer, bounds) {
  const radius = Math.hypot(pointer.x - origin.x, pointer.y - origin.y);
  return Math.round(fitRadius(radius, bounds.width, bounds.height) * 2) / 2;
}

export class BallGame {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;
    this.gravity = GRAVITY;
    this.active = false;
    this.score = 0;
    this.ball = { x: 0, y: 0, vx: 0, vy: 0, radius: 18, shape: "circle", angle: 0, angularVelocity: 0 };
  }

  get launchSpeed() {
    // Keep the initial jump height independent of the shared gravity scale.
    return Math.min(620 * Math.sqrt(this.gravity / 900), Math.sqrt(2 * this.gravity * this.height * .38));
  }

  start(x, y, selectedRadius = 18, selectedShape = selectBallShape()) {
    const radius = fitRadius(selectedRadius, this.width, this.height);
    const shape = selectedShape === "heart" || selectedShape === "star" ? selectedShape : "circle";
    this.ball.radius = radius;
    this.score = 0;
    this.active = true;
    Object.assign(this.ball, {
      x: clamp(x, radius, this.width - radius),
      y: clamp(y, radius, this.height - radius),
      vx: 0,
      vy: -this.launchSpeed,
      shape,
      angle: 0,
      angularVelocity: shape === "circle" ? 0 : (shape === "star" ? 1.9 : 1.35) * (x < this.width / 2 ? -1 : 1),
    });
  }

  hit(x, y) {
    const ball = this.ball;
    if (!this.active || ball.vy < 0 || Math.hypot(x - ball.x, y - ball.y) > ball.radius + 10) {
      return { hit: false, milestone: false };
    }
    const direction = clamp((ball.x - x) / ball.radius, -1, 1);
    ball.vx = direction * this.launchSpeed * .65;
    // A successful click lifts the shape 10% higher than its initial launch.
    ball.vy = -this.launchSpeed * Math.sqrt(1.1) * (1 - Math.abs(direction) * .12);
    if (ball.shape !== "circle") {
      const previousSpin = ball.angularVelocity;
      const spin = clamp(previousSpin * .45 + direction * 5, -7, 7);
      ball.angularVelocity = Math.abs(spin) < .75 ? (Math.sign(spin) || Math.sign(previousSpin) || 1) * .75 : spin;
    }
    this.score += 1;
    return { hit: true, milestone: this.score % 10 === 0 };
  }

  step(seconds) {
    if (!this.active) return false;
    const ball = this.ball;
    ball.x += ball.vx * seconds;
    ball.y += ball.vy * seconds + .5 * this.gravity * seconds * seconds;
    ball.vy += this.gravity * seconds;
    const spinDecay = Math.exp(-.18 * seconds);
    ball.angle = (ball.angle + ball.angularVelocity * (1 - spinDecay) / .18) % (Math.PI * 2);
    ball.angularVelocity *= spinDecay;

    if (ball.x < ball.radius) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx) * .9;
      ball.angularVelocity *= -.8;
    } else if (ball.x > this.width - ball.radius) {
      ball.x = this.width - ball.radius;
      ball.vx = -Math.abs(ball.vx) * .9;
      ball.angularVelocity *= -.8;
    }
    if (ball.y < ball.radius) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy) * .45;
      ball.angularVelocity *= -.65;
    }
    if (ball.y - ball.radius > this.height) {
      this.active = false;
      return true;
    }
    return false;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    const radius = fitRadius(this.ball.radius, width, height);
    this.ball.radius = radius;
    this.ball.x = clamp(this.ball.x, radius, Math.max(radius, width - radius));
    this.ball.y = clamp(this.ball.y, radius, Math.max(radius, height - radius));
  }
}

