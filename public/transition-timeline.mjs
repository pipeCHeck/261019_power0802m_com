export class TransitionTimeline {
  constructor(duration) {
    this.duration = duration; this.elapsed = 0; this.speed = 1;
    this.playing = false; this.loop = false; this.last = null;
  }
  get position() { return Math.min(this.duration, this.elapsed); }
  play() { if (this.position >= this.duration) this.elapsed = 0; this.playing = true; this.last = null; }
  pause() { this.playing = false; this.last = null; }
  suspend() { this.last = null; }
  seek(value) { this.elapsed = Math.max(0, Math.min(this.duration, value)); this.last = null; }
  restart() { this.elapsed = 0; this.play(); }
  tick(now) {
    if (!this.playing) return;
    if (this.last !== null) this.elapsed += Math.max(0, Math.min(100, now - this.last)) * this.speed;
    this.last = now;
    if (this.loop) this.elapsed %= this.duration + 1100;
    else if (this.elapsed >= this.duration) { this.elapsed = this.duration; this.pause(); }
  }
}
