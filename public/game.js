import { radiusForDrag } from "./game-physics.mjs";
import { getBallShapePath, selectBallShape } from "./ball-shapes.mjs";
import { scene } from "./scene.js";
import { createFloorImpact, drawFloorImpact } from "./floor-effects.mjs";
import { impactStyleFromSearch } from "./effect-variants.mjs";
import { createBounceImpact, drawBounceImpact, bounceStyleFromSearch } from "./bounce-effects.mjs";
import { updateBounceImpact } from "./bounce-placement.mjs";

class ScoreTicker {
  constructor(root, motionPreference) {
    this.root = root;
    this.window = root.querySelector(".score-window");
    this.motionPreference = motionPreference;
    this.transitionTimer = undefined;
    this.hideTimer = undefined;
    this.hiding = false;
  }

  get duration() { return this.motionPreference.matches ? 0 : 650; }

  show(value, ending = false) {
    this.ending = ending;
    this.previewing = false;
    this.hiding = false;
    window.clearTimeout(this.transitionTimer);
    window.clearTimeout(this.hideTimer);
    const previous = this.window.lastElementChild;
    const next = document.createElement("span");
    next.className = "score-line is-entering";
    next.textContent = String(value);
    if (previous && !this.root.hidden) {
      previous.className = "score-line is-leaving";
      this.window.replaceChildren(previous, next);
    } else {
      this.window.replaceChildren(next);
    }
    this.root.hidden = false;
    this.root.dataset.value = String(value);
    this.transitionTimer = window.setTimeout(() => {
      this.window.replaceChildren(next);
      next.className = "score-line is-current";
      if (ending) this.hideTimer = window.setTimeout(() => this.hide(), 1000);
    }, this.duration);
  }

  preview(value) {
    if (!this.previewing || this.root.hidden) {
      this.show(value);
      this.previewing = true;
    } else {
      this.root.dataset.value = String(value);
      const line = this.window.lastElementChild;
      if (line) line.textContent = String(value);
    }
  }

  hide() {
    this.ending = false;
    this.previewing = false;
    window.clearTimeout(this.transitionTimer);
    window.clearTimeout(this.hideTimer);
    const line = this.window.lastElementChild;
    if (!line) {
      this.root.hidden = true;
      this.hiding = false;
      return;
    }
    this.hiding = true;
    this.window.replaceChildren(line);
    line.className = "score-line is-leaving";
    this.transitionTimer = window.setTimeout(() => {
      this.root.hidden = true;
      this.window.replaceChildren();
      this.hiding = false;
    }, this.duration);
  }

  clear() {
    window.clearTimeout(this.transitionTimer);
    window.clearTimeout(this.hideTimer);
    this.root.hidden = true;
    this.window.replaceChildren();
    this.ending = this.previewing = this.hiding = false;
  }

  updateMotion() {
    if (this.root.hidden) return;
    window.clearTimeout(this.transitionTimer);
    window.clearTimeout(this.hideTimer);
    if (this.hiding) {
      this.root.hidden = true;
      this.window.replaceChildren();
      this.hiding = false;
      return;
    }
    const line = this.window.lastElementChild;
    if (line) {
      line.className = "score-line is-current";
      this.window.replaceChildren(line);
    }
    if (this.ending) {
      this.hideTimer = window.setTimeout(() => this.hide(), 1000);
    }
  }
}

class ImpactTicker extends ScoreTicker {
  constructor(root, motionPreference) {
    super(root, motionPreference);
    this.counting = false;
    this.counterLine = null;
    this.quickExit = false;
  }

  showSpeed(speed) {
    this.counting = false;
    super.show("0.0px/s", true);
    this.target = speed;
    this.counterLine = this.window.lastElementChild;
    this.startedAt = window.performance.now();
    this.root.dataset.value = `${speed.toFixed(1)}px/s`;
    this.counting = !this.motionPreference.matches;
    if (!this.counting) this.finishCount();
  }

  updateCount() {
    if (!this.counting) return false;
    // Wall-clock duration is independent of both the final value and physics
    // substeps. All visible badges share the scene's existing frame callback.
    const progress = Math.min(1, (window.performance.now() - this.startedAt) / 650);
    const eased = 1 - (1 - progress) ** 3;
    this.counterLine.textContent = `${(this.target * eased).toFixed(1)}px/s`;
    if (progress === 1) this.finishCount();
    return this.counting;
  }

  finishCount() {
    if (this.counterLine) this.counterLine.textContent = `${this.target.toFixed(1)}px/s`;
    this.counting = false;
  }

  hide() { this.finishCount(); super.hide(); }

  dismissQuickly() {
    if (this.root.hidden || this.quickExit) return;
    if (this.motionPreference.matches) { this.clear(); return; }
    window.clearTimeout(this.transitionTimer);
    window.clearTimeout(this.hideTimer);
    this.counting = false;
    this.ending = false;
    this.hiding = this.quickExit = true;
    const line = this.window.lastElementChild;
    if (!line) { this.clear(); return; }
    // An interrupted entrant must not rush through the whole visible window
    // on its way down. Freeze its pose and erase only the already visible slice.
    const transform = window.getComputedStyle(line).transform;
    const start = transform === "none" ? "translateY(0)" : transform;
    const entering = window.performance.now() - this.startedAt < 650;
    let visibleTop = 0;
    if (entering) {
      const clip = this.window.getBoundingClientRect(), bounds = line.getBoundingClientRect();
      if (bounds.height > 0) visibleTop = Math.max(0, Math.min(100, (clip.top - bounds.top) / bounds.height * 100));
    }
    line.style.setProperty("--impact-exit-start", start);
    line.style.setProperty("--impact-exit-end", entering ? start : "translateY(110%)");
    line.style.setProperty("--impact-exit-clip-start", entering ? `inset(${visibleTop}% 0 0 0)` : "inset(0)");
    line.style.setProperty("--impact-exit-clip-end", entering ? "inset(100% 0 0 0)" : "inset(0)");
    this.window.replaceChildren(line);
    line.className = "score-line is-dismissed";
    this.transitionTimer = window.setTimeout(() => this.clear(), 180);
  }

  clear() {
    this.counting = false;
    this.counterLine = null;
    this.quickExit = false;
    super.clear();
  }

  updateMotion() {
    if (this.motionPreference.matches) this.finishCount();
    super.updateMotion();
  }
}

function initGame() {
  const canvas = document.getElementById("game-canvas");
  const context = canvas.getContext("2d");
  if (!context) return;
  const scoreRoot = document.getElementById("game-score");
  const scoreRoots = [scoreRoot, document.getElementById("game-score-on-ball")];
  const scoreClip = document.getElementById("score-ball-clip-path");
  const scoreMask = document.getElementById("score-ball-mask-path");
  const ballRoot = document.getElementById("game-ball");
  const ballLayers = [ballRoot, document.getElementById("game-ball-tint")];
  const status = document.getElementById("game-status");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const impactStyle = impactStyleFromSearch(window.location.search);
  const bounceStyle = bounceStyleFromSearch(window.location.search) || "pop";
  const tickers = scoreRoots.map(root => new ScoreTicker(root, reducedMotion));
  const ticker = Object.fromEntries(["show", "preview", "hide", "updateMotion"].map(method =>
    [method, (...args) => tickers.forEach(item => item[method](...args))]));
  const impactRoot = document.getElementById("impact-scores");
  const impactSlots = [];
  function createImpactSlot() {
    const root = document.createElement("div"), content = document.createElement("div");
    root.className = "game-score impact-score";
    root.hidden = true;
    content.className = "score-window";
    root.append(content);
    impactRoot.append(root);
    const slot = { root, ticker: new ImpactTicker(root, reducedMotion) };
    impactSlots.push(slot);
    return slot;
  }
  let lastImpactOffset = null;
  const game = scene.world.game;
  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const scorePosition = { x: 0, y: 0 };
  let sizing = null;
  let effects = [];

  function showImpactScore(effect, normalSpeed) {
    const x = ((effect.x % game.width) + game.width) % game.width;
    // Only recycle expired badges; live captions retain their own position.
    const slot = impactSlots.find(s => s.root.hidden) ?? createImpactSlot();
    slot.ticker.clear();
    // Same stacking level: the last sibling paints on top, including recycled nodes.
    impactRoot.append(slot.root);
    const value = `${normalSpeed.toFixed(1)}px/s`;
    const width = Math.max(116, value.length * 11 + 6);
    slot.root.style.width = `${width}px`;
    const email = document.querySelector(".contact-email")?.getBoundingClientRect?.();
    const desiredTop = email?.height > 0 ? email.top + email.height / 2 - 16.5 : effect.y - 54;
    const baseTop = Math.max(18, Math.min(desiredTop, game.height - 51));
    let offset = Math.random() * 20 - 10;
    if (lastImpactOffset !== null && Math.abs(offset - lastImpactOffset) < 5) offset = (offset + 20) % 20 - 10;
    lastImpactOffset = offset;
    const left = Math.max(8, Math.min(x - width / 2, game.width - width - 8));
    const top = Math.max(8, Math.min(baseTop + offset, game.height - 41));
    const bounds = { left, top, width };
    for (const previous of impactSlots) {
      if (previous === slot || previous.root.hidden || !previous.bounds) continue;
      const dx = Math.abs(previous.bounds.left + previous.bounds.width / 2 - left - width / 2);
      const dy = Math.abs(previous.bounds.top - top);
      if (dx <= 45 && dy <= 16) previous.ticker.dismissQuickly();
    }
    slot.bounds = bounds;
    slot.root.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    slot.root.setAttribute("title", `충돌 지점의 수직 충돌 속도 ${value}`);
    slot.ticker.showSpeed(normalSpeed);
  }

  function positionScore() {
    const x = Math.max(8, Math.min(pointer.x + 18, game.width - 104));
    const y = Math.max(8, Math.min(pointer.y - 34, game.height - 33));
    Object.assign(scorePosition, { x, y });
    for (const root of scoreRoots) root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    updateScoreClip();
  }

  function updateScoreClip() {
    const ball = game.ball;
    if (!game.active || ball.shape === "circle") {
      scoreClip.setAttribute("d", "");
      scoreMask.setAttribute("d", "");
      return;
    }
    // Clip the paper-colored score to the moving shape, in score-local coordinates.
    // Cut the same region out of the original score to avoid double-painted edges.
    const transform = `translate(${ball.x - ball.radius - scorePosition.x} ${ball.y - ball.radius - scorePosition.y}) scale(${ball.radius / 50}) rotate(${ball.angle * 180 / Math.PI} 50 50)`;
    for (const path of [scoreClip, scoreMask]) {
      path.setAttribute("d", getBallShapePath(ball.shape));
      path.setAttribute("transform", transform);
    }
  }

  function resize() {
    effects = effects.filter(effect => effect.type !== "floor" && effect.type !== "bounce");
    scene.world.drainShapeImpacts();
    for (const slot of impactSlots) slot.ticker.clear();
    lastImpactOffset = null;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    game.resize(window.innerWidth, window.innerHeight);
    canvas.width = Math.round(game.width * ratio);
    canvas.height = Math.round(game.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (sizing) updateSizing();
    positionScore();
    draw();
  }

  function clickBurst(x, y) {
    if (reducedMotion.matches) return;
    effects.push({ type: "click", x, y, age: 0, life: .46 });
  }

  function fireworks(x, y) {
    if (reducedMotion.matches) return;
    const particles = Array.from({ length: 24 }, (_, index) => ({
      angle: index * Math.PI * 2 / 24 + (Math.random() - .5) * .08,
      speed: 125 + Math.random() * 65,
      length: 10 + Math.random() * 6,
      delay: index % 2 === 0 ? 0 : .16,
    }));
    effects.push({ type: "burst", x, y, age: 0, life: 1.05, particles });
  }

  function draw() {
    updateScoreClip();
    context.clearRect(0, 0, game.width, game.height);
    context.lineWidth = 1.05;
    context.strokeStyle = "#292b26";
    context.lineCap = "round";
    for (const layer of ballLayers) layer.hidden = !sizing && !game.active;
    if (sizing || game.active) {
      const radius = sizing ? sizing.radius : game.ball.radius;
      const x = sizing ? Math.max(radius, Math.min(sizing.x, game.width - radius)) : game.ball.x;
      const y = sizing ? Math.max(radius, Math.min(sizing.y, game.height - radius)) : game.ball.y;
      const shape = sizing ? sizing.shape : game.ball.shape;
      const angle = sizing ? 0 : game.ball.angle;
      for (const layer of ballLayers) {
        const path = layer.querySelector("path");
        layer.dataset.mode = sizing ? "sizing" : "playing";
        if (layer.dataset.shape !== shape) {
          layer.dataset.shape = shape;
          path.setAttribute("d", getBallShapePath(shape));
        }
        path.setAttribute("transform", `rotate(${angle * 180 / Math.PI} 50 50)`);
        layer.style.width = `${radius * 2}px`;
        layer.style.height = `${radius * 2}px`;
        layer.style.transform = `translate3d(${x - radius}px, ${y - radius}px, 0)`;
      }
    }
    for (const effect of effects) {
      if (effect.type === "bounce") {
        drawBounceImpact(context, effect, game.width, game.height, { card: scene.world.card.body, ball: game.active ? game.ball : null });
        continue;
      }
      if (effect.type === "floor") {
        drawFloorImpact(context, effect, game.width, game.height);
        continue;
      }
      const progress = effect.age / effect.life;
      context.globalAlpha = 1;
      context.lineCap = "round";
      context.lineWidth = effect.type === "click" ? 1.05 : 1.7;
      context.beginPath();
      if (effect.type === "click") {
        const distance = 1 + 20 * (1 - (1 - progress) ** 3);
        const length = 9 * (1 - progress) ** 1.6;
        for (let index = 0; index < 8; index++) {
          const angle = index * Math.PI / 4;
          context.moveTo(effect.x + Math.cos(angle) * distance, effect.y + Math.sin(angle) * distance);
          context.lineTo(effect.x + Math.cos(angle) * (distance + length), effect.y + Math.sin(angle) * (distance + length));
        }
      } else {
        for (const particle of effect.particles) {
          const age = effect.age - particle.delay;
          if (age < 0) continue;
          const phase = Math.min(1, age / (effect.life - particle.delay));
          const distance = 5 + particle.speed * .62 * (1 - (1 - phase) ** 2.3);
          const x = effect.x + Math.cos(particle.angle) * distance;
          const y = effect.y + Math.sin(particle.angle) * distance + 18 * phase ** 2;
          context.moveTo(x, y);
          const retraction = Math.max(0, (phase - .28) / .72);
          const length = particle.length * (1 - retraction) ** 1.2;
          context.lineTo(x + Math.cos(particle.angle) * length, y + Math.sin(particle.angle) * length);
        }
      }
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function updateSizing() {
    if (!sizing) return;
    if (Math.hypot(pointer.x - sizing.x, pointer.y - sizing.y) >= 4) sizing.dragged = true;
    sizing.radius = sizing.dragged ? radiusForDrag(sizing, pointer, game) : 18;
    ticker.preview(`${Math.round(sizing.radius * 2)}px`);
  }

  function releaseCapture(pointerId) {
    if (document.documentElement.hasPointerCapture(pointerId)) {
      document.documentElement.releasePointerCapture(pointerId);
    }
  }

  function cancelSizing() {
    if (!sizing) return;
    const pointerId = sizing.pointerId;
    sizing = null;
    document.documentElement.classList.remove("game-sizing");
    releaseCapture(pointerId);
    canvas.dataset.state = "idle";
    ticker.hide();
    draw();
  }

  function requestFrame() {
    scene.requestFrame();
  }

  function frame({ seconds, ended, floorImpacts = [], shapeImpacts = [] }) {
    if (ended) {
      canvas.dataset.state = "ended";
      const ending = { heart: "LOVE", star: "STAR" }[game.ball.shape] ?? "GG";
      ticker.show(ending, true);
      status.textContent = `게임 종료. ${game.score}점. 빈 곳을 클릭하면 다시 시작합니다.`;
    }
    for (const effect of effects) {
      effect.age += seconds;
      if (effect.type === "bounce") updateBounceImpact(effect,
        { card: scene.world.card.body, ball: game.active ? game.ball : null }, game.width);
    }
    effects = effects.filter((effect) => effect.age < effect.life);
    for (const impact of floorImpacts) {
      const effect = createFloorImpact(impact, Math.random, impactStyle);
      showImpactScore(effect, impact.normalSpeed);
      if (!reducedMotion.matches) effects.push(effect);
    }
    if (bounceStyle && !reducedMotion.matches) {
      for (const impact of shapeImpacts) {
        const effect = createBounceImpact(impact, Math.random, bounceStyle);
        // A contact may occur early in a frame's physics substeps. Catch its
        // motion up to the bodies' current time before the first drawing.
        effect.age = Math.max(0, scene.world.time - (impact.time ?? scene.world.time));
        updateBounceImpact(effect, { card: scene.world.card.body, ball: game.active ? game.ball : null }, game.width);
        if (effect.age < effect.life) effects.push(effect);
      }
    }
    const counting = impactSlots.map(slot => slot.ticker.updateCount()).some(Boolean);
    draw();
    if (game.active || effects.length || counting) requestFrame();
  }

  window.addEventListener("pointermove", (event) => {
    if (!event.isPrimary) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    positionScore();
    if (sizing && event.pointerId === sizing.pointerId) {
      updateSizing();
      draw();
    }
  }, { passive: true });

  window.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (event.target.closest("a, button, input, textarea, select, [contenteditable], [data-physics-card]")) return;
    event.preventDefault();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    positionScore();
    clickBurst(pointer.x, pointer.y);
    if (!game.active) {
      sizing = { x: pointer.x, y: pointer.y, radius: 18, dragged: false, pointerId: event.pointerId, shape: selectBallShape() };
      document.documentElement.setPointerCapture(event.pointerId);
      document.documentElement.classList.add("game-sizing");
      canvas.dataset.state = "sizing";
      updateSizing();
      status.textContent = "드래그로 공 크기를 정하고 손을 떼면 시작합니다.";
    } else {
      const result = game.hit(pointer.x, pointer.y);
      if (result.hit) {
        ticker.show(game.score);
        if (result.milestone) fireworks(pointer.x, pointer.y);
      }
    }
    draw();
    requestFrame();
  }, { passive: false });

  window.addEventListener("pointerup", (event) => {
    if (!sizing || event.pointerId !== sizing.pointerId) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    updateSizing();
    const selected = sizing;
    sizing = null;
    document.documentElement.classList.remove("game-sizing");
    releaseCapture(event.pointerId);
    game.start(selected.x, selected.y, selected.radius, selected.shape);
    canvas.dataset.state = "playing";
    ticker.show(0);
    positionScore();
    status.textContent = "게임 시작. 떨어지는 공을 클릭해 계속 띄워 주세요.";
    draw();
    requestFrame();
  }, { passive: true });

  window.addEventListener("pointercancel", (event) => {
    if (sizing && event.pointerId === sizing.pointerId) cancelSizing();
  });
  document.addEventListener("lostpointercapture", (event) => {
    if (sizing && event.pointerId === sizing.pointerId) cancelSizing();
  });
  window.addEventListener("blur", cancelSizing);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") cancelSizing();
  });

  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelSizing();
      for (const slot of impactSlots) slot.ticker.clear();
    } else if (game.active || effects.length) {
      requestFrame();
    }
  });
  reducedMotion.addEventListener("change", () => {
    ticker.updateMotion();
    for (const slot of impactSlots) slot.ticker.updateMotion();
    if (reducedMotion.matches) effects = [];
    draw();
  });
  scene.subscribe(frame);
  resize();
}

initGame();
