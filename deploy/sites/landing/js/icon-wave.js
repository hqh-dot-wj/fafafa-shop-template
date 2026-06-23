/* 特性区：圆形图标波浪
 *  - 滚动时：跟手推进波浪相位
 *  - 停手后：仅缓慢自播（不再读 ScrollTrigger progress，避免 Lenis 惯性微抖）
 */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;

  const section = document.querySelector('[data-icon-wave]');
  if (!section) return;

  const orbits = section.querySelectorAll('.icon-wave__orbit');
  if (!orbits.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const WAVE_AMP = 22;
  const PHASE_STEP = 0.62;
  /** 停手后的自播速度（弧度/秒） */
  const IDLE_SPEED = 0.85;
  /** 滚轮 deltaY → 相位 */
  const WHEEL_GAIN = 0.0028;
  const IDLE_MS = 280;
  const MAX_WHEEL_STEP = 48;

  const drivers = [...orbits].map((el, i) => {
    gsap.set(el, { y: 0, force3D: true });
    return {
      phase: i * PHASE_STEP,
      y: 0,
      setY: gsap.quickSetter(el, 'y', 'px'),
    };
  });

  let inView = false;
  let wavePhase = 0;
  let lastInputAt = 0;
  let io = null;

  function markInput() {
    lastInputAt = performance.now();
  }

  function onWheel(e) {
    if (!inView) return;
    const dy = Math.max(-MAX_WHEEL_STEP, Math.min(MAX_WHEEL_STEP, e.deltaY));
    if (dy === 0) return;
    wavePhase += dy * WHEEL_GAIN;
    markInput();
  }

  /* 视口检测：不用 ScrollTrigger progress，避免停手后 progress 抖动 */
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((en) => en.isIntersecting);
        inView = hit;
        if (!hit) lastInputAt = 0;
      },
      { root: null, rootMargin: '80px 0px', threshold: 0.05 },
    );
    io.observe(section);
  } else if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onEnter: () => {
        inView = true;
      },
      onEnterBack: () => {
        inView = true;
      },
      onLeave: () => {
        inView = false;
        lastInputAt = 0;
      },
      onLeaveBack: () => {
        inView = false;
        lastInputAt = 0;
      },
    });
  } else {
    inView = true;
  }

  window.addEventListener('wheel', onWheel, { passive: true });

  function tick(_, deltaTime) {
    if (!inView) return;

    const dt = Math.min(deltaTime, 0.05);
    const isIdle = performance.now() - lastInputAt > IDLE_MS;
    if (isIdle) {
      wavePhase += dt * IDLE_SPEED;
    }

    const smooth = 1 - Math.pow(0.001, dt);
    for (let i = 0; i < drivers.length; i++) {
      const d = drivers[i];
      const target = Math.sin(wavePhase + d.phase) * WAVE_AMP;
      d.y += (target - d.y) * smooth;
      d.setY(d.y);
    }
  }

  gsap.ticker.add(tick);

  window.addEventListener('load', () => {
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
  });
})();
