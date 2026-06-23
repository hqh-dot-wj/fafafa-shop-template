/* ============================================================
 * 诸葛陪伴 · 主交互
 *  - Lenis: 平滑滚动
 *  - SplitType + GSAP: 标题逐字符出场
 *  - GSAP ScrollTrigger: 区块入场 / 横向卡片 pin / 进度条
 *  - 产品 Tabs 切换
 * ============================================================ */
(function () {
  'use strict';
  if (typeof gsap === 'undefined') return;
  if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Lenis 平滑滚动 ---------------- */
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !reduceMotion) {
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
    });
    window.__lenis = lenis;
    if (typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
      /* 与 GSAP 同一时钟驱动，避免 scrub 动画卡顿 */
      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }
  }

  /* ---------------- 导航滚动态 ---------------- */
  const nav = document.querySelector('[data-nav]');
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- Hero 横图轮播（两张品牌 Banner） ---------------- */
  const heroSlides = document.querySelectorAll('.hero__banner-slide');
  if (heroSlides.length > 1 && !reduceMotion) {
    let heroBannerIdx = 0;
    setInterval(() => {
      heroSlides[heroBannerIdx].classList.remove('is-active');
      heroBannerIdx = (heroBannerIdx + 1) % heroSlides.length;
      heroSlides[heroBannerIdx].classList.add('is-active');
    }, 6000);
  }

  /* ---------------- 移动菜单 ---------------- */
  const toggle = document.querySelector('.ag-nav__toggle');
  const mobile = document.querySelector('.ag-mobile');
  const mClose = document.querySelector('.ag-mobile__close');
  if (toggle && mobile) {
    toggle.addEventListener('click', () => {
      mobile.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
    const close = () => {
      mobile.classList.remove('is-open');
      document.body.style.overflow = '';
    };
    mClose?.addEventListener('click', close);
    mobile.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  }

  const TW = window.Typewriter;

  /* ---------------- Hero：按顺序打字 ---------------- */
  async function runHeroTypewriter() {
    if (!TW) return;
    const heroCta = document.querySelector('.hero__cta');
    const sequence = [
      document.querySelector('.hero__title'),
      document.querySelector('.hero__eyebrow'),
      document.querySelector('.hero__sub'),
      ...document.querySelectorAll('.hero__cta [data-type]'),
      document.querySelector('.hero__scroll-hint [data-type]'),
    ].filter(Boolean);

    await TW.playSequence(sequence);
    heroCta?.classList.add('is-typed');
    gsap.to('.hero__scroll-hint', { opacity: 0.7, duration: 0.5 });
    window.dispatchEvent(new CustomEvent('hero-typewriter-complete'));
  }

  if (reduceMotion) {
    TW?.prepareAll?.();
    document.querySelectorAll('[data-type]').forEach((el) => {
      const targets = el.querySelectorAll(el.classList.contains('type-by-word') ? '.word' : '.char');
      gsap.set(targets, { opacity: 1, x: 0 });
      el.dataset.typed = '1';
    });
    document.querySelector('.hero__cta')?.classList.add('is-typed');
    gsap.set('.hero__scroll-hint', { opacity: 0.7 });
    window.dispatchEvent(new CustomEvent('hero-typewriter-complete'));
  } else if (TW) {
    runHeroTypewriter();
  }

  if (typeof ScrollTrigger !== 'undefined' && TW) {
    /* ---------------- 全站其余文案：进入视口打字（排除已单独绑定的区域） */
    TW.bindAllIn(document, (el) => {
      const skip =
        '.hero, .blog-card, .blogs__head, .course-carousel, .features__head, .course-row, .footcta__inner, .ag-nav';
      return !el.closest(skip);
    });

    /* ---------------- 非文字容器：仅位移/淡入 ---------------- */
    gsap.utils.toArray('[data-reveal]').forEach((el) => {
      if (el.closest('#product')) return;
      if (el.classList.contains('blog-card')) return;
      const hasType = el.querySelector('[data-type]');
      if (hasType) {
        gsap.fromTo(
          el,
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration: 0.85,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          },
        );
        return;
      }
      gsap.fromTo(
        el,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 86%', once: true },
        },
      );
    });

    /* ---------------- 博客区标题：打字 ---------------- */
    const blogsHead = document.querySelector('.blogs__head');
    if (blogsHead) {
      ScrollTrigger.create({
        trigger: blogsHead,
        start: 'top 88%',
        once: true,
        onEnter: () => TW.playSequence([...blogsHead.querySelectorAll('[data-type]')]),
      });
    }

    /* ---------------- 博客卡片：先入场再打字 ---------------- */
    gsap.utils.toArray('.blog-card').forEach((card) => {
      gsap.set(card, { opacity: 0, y: 24 });
      ScrollTrigger.create({
        trigger: card,
        start: 'top 88%',
        once: true,
        onEnter: () => {
          gsap.fromTo(card, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' });
          const texts = [...card.querySelectorAll('[data-type]')];
          TW.playSequence(texts);
        },
      });
    });

    /* ---------------- 课程轮播区标题：打字 ---------------- */
    const carouselHead = document.querySelector('.course-carousel__head');
    if (carouselHead) {
      ScrollTrigger.create({
        trigger: carouselHead,
        start: 'top 88%',
        once: true,
        onEnter: () => TW.playSequence([...carouselHead.querySelectorAll('[data-type]')]),
      });
    }

    /* ---------------- Features 标题区：顺序打字 ---------------- */
    const featuresHead = document.querySelector('.features__head');
    if (featuresHead) {
      ScrollTrigger.create({
        trigger: featuresHead,
        start: 'top 88%',
        once: true,
        onEnter: () => TW.playSequence([...featuresHead.querySelectorAll('[data-type]')]),
      });
    }

    /* ---------------- 课程展示：每行左文打字 + 右图入场 ---------------- */
    document.querySelectorAll('.course-row').forEach((row) => {
      const frame = row.querySelector('.course-row__frame');
      if (frame) gsap.set(frame, { opacity: 0, scale: 0.94, y: 24 });

      ScrollTrigger.create({
        trigger: row,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          const texts = [...row.querySelectorAll('[data-type]')];
          TW.playSequence(texts);
          const frame = row.querySelector('.course-row__frame');
          if (frame) {
            gsap.fromTo(
              frame,
              { opacity: 0, scale: 0.94, y: 24 },
              { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: 0.15 },
            );
          }
        },
      });
    });

    const footctaInner = document.querySelector('.footcta__inner');
    if (footctaInner) {
      ScrollTrigger.create({
        trigger: footctaInner,
        start: 'top 88%',
        once: true,
        onEnter: () => {
          gsap.fromTo(footctaInner, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out' });
          TW.playSequence([...footctaInner.querySelectorAll('[data-type]')]);
        },
      });
    }

    /* ---------------- 产品视频：随滚动由小放大（scrub 与滚动 1:1，GPU 合成） ---------------- */
    const videoStage = document.querySelector('.product-video__stage');
    if (!reduceMotion && videoStage) {
      gsap.set(videoStage, {
        scale: 0.58,
        force3D: true,
        transformOrigin: '50% 42%',
      });
      gsap.to(videoStage, {
        scale: 1,
        ease: 'none',
        force3D: true,
        scrollTrigger: {
          trigger: videoStage,
          start: 'top 82%',
          end: 'top 28%',
          scrub: true,
          invalidateOnRefresh: true,
          fastScrollEnd: true,
        },
      });
    } else if (videoStage) {
      gsap.set(videoStage, { scale: 1, clearProps: 'willChange' });
    }
  }

  /* ---------------- 产品视频：确保可自动播放 ---------------- */
  const heroVideo = document.querySelector('.product-video__player');
  if (heroVideo) {
    heroVideo.muted = true;
    const tryPlay = () => heroVideo.play().catch(() => {});
    tryPlay();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tryPlay();
    });
  }

  /* ---------------- 锚点平滑滚动 ---------------- */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(t, { offset: -60, duration: 1.25 });
      } else {
        t.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  /* ---------------- 重新计算 ScrollTrigger ---------------- */
  window.addEventListener('load', () => {
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
  });
})();
