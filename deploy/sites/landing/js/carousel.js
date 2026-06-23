/* 热门课程横向轮播：上图下文，文案自下往上（箭头 / 拖拽切换，不绑定页面滚动） */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;

  const section = document.querySelector('.course-carousel');
  if (!section) return;

  const track = section.querySelector('.course-carousel__track');
  const slides = [...section.querySelectorAll('.course-carousel__slide')];
  const prevBtns = section.querySelectorAll('[data-carousel-prev]');
  const nextBtns = section.querySelectorAll('[data-carousel-next]');
  if (!track || !slides.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeIndex = 0;
  let moveTween = null;

  function slideWidth() {
    const first = slides[0];
    if (!first) return 0;
    const gap = parseFloat(getComputedStyle(track).gap) || 24;
    return first.offsetWidth + gap;
  }

  function getMaxIndex() {
    return Math.max(0, slides.length - 1);
  }

  function setActiveIndex(i) {
    activeIndex = Math.max(0, Math.min(i, getMaxIndex()));
    slides.forEach((s, idx) => {
      const on = idx === activeIndex;
      s.classList.toggle('is-active', on);
      const nav = s.querySelector('.course-carousel__nav');
      if (nav) {
        nav.setAttribute('aria-hidden', on ? 'false' : 'true');
        nav.querySelectorAll('button').forEach((btn) => {
          btn.tabIndex = on ? 0 : -1;
        });
      }
    });
    prevBtns.forEach((btn) => {
      btn.disabled = activeIndex === 0;
    });
    nextBtns.forEach((btn) => {
      btn.disabled = activeIndex === getMaxIndex();
    });
  }

  function revealCopy(slide) {
    const items = slide?.querySelectorAll('[data-rise]');
    if (!items?.length) return;
    gsap.killTweensOf(items);
    if (reduceMotion) {
      gsap.set(items, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(
      items,
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: 0.55,
        stagger: 0.09,
        ease: 'power3.out',
        overwrite: true,
      },
    );
  }

  function hideCopy(slide) {
    const items = slide?.querySelectorAll('[data-rise]');
    if (!items?.length) return;
    gsap.killTweensOf(items);
    gsap.set(items, { opacity: 0, y: 28 });
  }

  function goToSlide(index, animate = true) {
    setActiveIndex(index);

    if (moveTween) moveTween.kill();
    const x = -activeIndex * slideWidth();

    slides.forEach((s, i) => {
      if (i !== activeIndex) hideCopy(s);
    });

    if (!animate || reduceMotion) {
      gsap.set(track, { x });
      revealCopy(slides[activeIndex]);
      return;
    }

    moveTween = gsap.to(track, {
      x,
      duration: 0.75,
      ease: 'power3.inOut',
      onComplete: () => revealCopy(slides[activeIndex]),
    });
  }

  const INTERACTIVE_SEL =
    '[data-carousel-prev], [data-carousel-next], .course-carousel__nav, .course-carousel__link, a, button';

  function isInteractiveTarget(el) {
    return el && el.closest && el.closest(INTERACTIVE_SEL);
  }

  section.addEventListener('click', (e) => {
    const prev = e.target.closest('[data-carousel-prev]');
    const next = e.target.closest('[data-carousel-next]');
    if (prev && !prev.disabled) {
      e.preventDefault();
      e.stopPropagation();
      goToSlide(activeIndex - 1);
      return;
    }
    if (next && !next.disabled) {
      e.preventDefault();
      e.stopPropagation();
      goToSlide(activeIndex + 1);
    }
  });

  /* 拖拽切换（忽略导航按钮与链接，避免抢走 pointer 导致指示器无效） */
  if (!reduceMotion) {
    let dragStartX = 0;
    let dragStartTx = 0;
    let dragging = false;

    track.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (isInteractiveTarget(e.target)) return;
      dragging = true;
      dragStartX = e.clientX;
      dragStartTx = gsap.getProperty(track, 'x') || 0;
      if (moveTween) moveTween.kill();
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const minX = -getMaxIndex() * slideWidth();
      const x = Math.max(minX, Math.min(0, dragStartTx + (e.clientX - dragStartX)));
      gsap.set(track, { x });
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      track.releasePointerCapture?.(e.pointerId);
      const dx = e.clientX - dragStartX;
      const threshold = slideWidth() * 0.18;
      if (dx < -threshold) goToSlide(activeIndex + 1);
      else if (dx > threshold) goToSlide(activeIndex - 1);
      else goToSlide(activeIndex);
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
  }

  slides.forEach((s, i) => {
    if (i !== 0) hideCopy(s);
  });
  setActiveIndex(0);
  goToSlide(0, false);

  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 82%',
      once: true,
      onEnter: () => revealCopy(slides[0]),
    });
  } else {
    revealCopy(slides[0]);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => goToSlide(activeIndex, false), 200);
  });
})();
