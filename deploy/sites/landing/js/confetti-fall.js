/* ============================================================
 * Hero 碎花纸屑下落层（独立 Canvas，不占用鼠标斥力）
 *   - Hero 打字机结束后由 main.js 触发
 *   - 自顶部飘落，在区域底部堆积
 * ============================================================ */
(function () {
  'use strict';

  const canvas = document.getElementById('confetti-fall-canvas');
  if (!canvas) return;

  const stage = canvas.parentElement;
  const hero = document.querySelector('.hero');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const palette = ['#ea4335', '#fbbc04', '#4285f4', '#34a853', '#a06bff', '#ff6d00', '#1a73e8'];

  const PILE_BAND = 72;
  const MAX_PIECES = prefersReduced ? 0 : 220;
  const SPAWN_INTERVAL = 140;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let pieces = [];
  let active = false;
  let alpha = 0;
  let spawnAcc = 0;
  let lastT = 0;
  let rafId = 0;

  function resize() {
    const rect = stage.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function trimOverflow() {
    while (pieces.length > MAX_PIECES) {
      const idx = pieces.findIndex((p) => !p.settled);
      pieces.splice(idx >= 0 ? idx : 0, 1);
    }
  }

  function spawnOne(yOverride) {
    if (pieces.length >= MAX_PIECES) trimOverflow();
    if (pieces.length >= MAX_PIECES) return;
    const color = palette[(Math.random() * palette.length) | 0];
    pieces.push({
      x: rand(0.04 * w, 0.96 * w),
      y: yOverride != null ? yOverride : rand(-24, -6),
      vx: rand(-0.35, 0.35),
      vy: rand(0.55, 1.15),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.06, 0.06),
      w: rand(3, 7),
      h: rand(10, 22),
      color,
      settled: false,
    });
  }

  function spawnBurst(count) {
    for (let i = 0; i < count; i++) spawnOne(rand(-h * 0.15, 0));
  }

  function floorY() {
    return h - PILE_BAND * 0.35;
  }

  function update(dt) {
    if (!active) return;

    spawnAcc += dt;
    while (spawnAcc >= SPAWN_INTERVAL) {
      spawnAcc -= SPAWN_INTERVAL;
      spawnOne();
      if (Math.random() < 0.35) spawnOne();
    }

    const bottom = floorY();
    const pileTop = h - PILE_BAND;

    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      if (p.settled) continue;

      p.vy += 0.0018 * dt;
      p.vx += Math.sin(p.rot * 2 + lastT * 0.001) * 0.00015 * dt;
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      p.rot += p.vr * dt * 0.06;

      const halfH = p.h * 0.5;
      if (p.y + halfH >= bottom) {
        p.y = bottom - halfH - rand(0, PILE_BAND * 0.55);
        p.vy = 0;
        p.vx *= 0.25;
        p.vr *= 0.2;
        if (p.y + halfH > pileTop - 4) {
          p.settled = true;
          p.vx = 0;
          p.vr = 0;
        }
      }

      if (p.x < -20 || p.x > w + 20) {
        pieces.splice(i, 1);
      }
    }
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!active && alpha <= 0) return;

    ctx.globalAlpha = alpha;

    for (const p of pieces) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha * (p.settled ? 0.62 : 0.88);
      const thin = p.settled ? 0.75 : 1;
      ctx.fillRect(-p.w * 0.5 * thin, -p.h * 0.5, p.w * thin, p.h);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (document.hidden) return;

    const dt = lastT ? Math.min(now - lastT, 48) : 16;
    lastT = now;

    if (alpha < 1 && active) alpha = Math.min(1, alpha + 0.025);

    update(dt);
    draw();
  }

  function inHero() {
    if (!hero) return true;
    const r = hero.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  function start() {
    if (prefersReduced || active) return;
    active = true;
    resize();
    spawnBurst(48);
    if (!rafId) {
      lastT = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  function stop() {
    active = false;
  }

  resize();
  let resizeT;
  window.addEventListener(
    'resize',
    () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(resize, 180);
    },
    { passive: true },
  );

  window.addEventListener(
    'hero-typewriter-complete',
    () => {
      if (inHero()) start();
    },
    { once: false },
  );

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) lastT = 0;
  });

  window.HeroConfettiFall = { start, stop, isActive: () => active };
})();
