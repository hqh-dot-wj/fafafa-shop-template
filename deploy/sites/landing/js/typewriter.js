/* 全站打字机：SplitType 拆字 + GSAP 逐字弹出 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    headingGap: 0.075,
    headingDur: 0.055,
    bodyGap: 0.028,
    bodyDur: 0.038,
    labelGap: 0.05,
    labelDur: 0.045,
  };

  function getSpeed(el) {
    if (el.matches('h1, h2, .hero__title, .features__title, .cta-card__title')) {
      return { gap: DEFAULTS.headingGap, dur: DEFAULTS.headingDur };
    }
    if (el.matches('h3, h4')) {
      return { gap: 0.065, dur: 0.048 };
    }
    if (el.matches('.eyebrow, .tabs__kicker, .cta-card__tag, .blog-card__meta, .hero__eyebrow')) {
      return { gap: DEFAULTS.labelGap, dur: DEFAULTS.labelDur };
    }
    return { gap: DEFAULTS.bodyGap, dur: DEFAULTS.bodyDur };
  }

  function getSplitMode(el) {
    if (
      el.classList.contains('features__title-line') ||
      el.classList.contains('type-line') ||
      el.classList.contains('hero__title')
    ) {
      return 'chars';
    }
    if (el.matches('.course-row__price, .course-row__tag, .blog-card__meta')) {
      return 'words';
    }
    return 'full';
  }

  function getTargets(el) {
    return el.classList.contains('type-by-word') ? el.querySelectorAll('.word') : el.querySelectorAll('.char');
  }

  function splitElement(el) {
    if (typeof SplitType === 'undefined') return [];
    if (el._typeSplit) return getTargets(el);

    const mode = getSplitMode(el);
    const types = mode === 'chars' ? 'chars' : mode === 'words' ? 'words' : 'lines,words,chars';

    const split = new SplitType(el, {
      types,
      tagName: 'span',
    });
    el._typeSplit = split;
    el.classList.add('type-split');
    if (mode === 'words') el.classList.add('type-by-word');
    el.querySelectorAll('.hero__accent .char').forEach((c) => c.classList.add('char--accent'));
    const targets = getTargets(el);
    if (typeof gsap !== 'undefined' && targets.length) {
      gsap.set(targets, { opacity: 0, x: -8 });
    }
    return targets;
  }

  /** 页面加载时预拆全部 [data-type]，消除首屏闪烁 */
  function prepareAll(root) {
    const scope = root || document;
    const items = scope.querySelectorAll('[data-type]');
    if (typeof SplitType === 'undefined') {
      items.forEach((el) => el.classList.add('type-split'));
      return;
    }
    items.forEach(splitElement);
  }

  function placeCursor(afterEl, cursor) {
    if (afterEl && cursor) afterEl.insertAdjacentElement('afterend', cursor);
  }

  /** 播放打字机，返回 Promise */
  function play(el, options = {}) {
    if (!el || el.dataset.typed === '1') return Promise.resolve();

    const targets = splitElement(el);
    if (!targets.length) {
      el.dataset.typed = '1';
      return Promise.resolve();
    }

    const { gap, dur } = { ...getSpeed(el), ...options };
    const useCursor = options.cursor === true;

    gsap.set(targets, { opacity: 0, x: -8 });

    return new Promise((resolve) => {
      let cursorEl = null;
      if (useCursor) {
        cursorEl = document.createElement('span');
        cursorEl.className = 'hero__type-cursor';
        cursorEl.setAttribute('aria-hidden', 'true');
        targets[0].insertAdjacentElement('beforebegin', cursorEl);
      }

      gsap.to(targets, {
        opacity: 1,
        x: 0,
        duration: dur,
        ease: 'steps(1)',
        stagger: {
          each: gap,
          from: 'start',
          onComplete() {
            if (cursorEl) placeCursor(this.targets()[0], cursorEl);
          },
        },
        onComplete: () => {
          if (cursorEl) gsap.to(cursorEl, { opacity: 0, duration: 0.3, delay: 0.35 });
          el.dataset.typed = '1';
          resolve();
        },
      });
    });
  }

  /** 按顺序播放多个元素 */
  async function playSequence(elements, options = {}) {
    for (const el of elements) {
      if (!el) continue;
      const opts = el.hasAttribute('data-type-cursor') ? { ...options, cursor: true } : options;
      await play(el, opts);
    }
  }

  /** 并行播放（用于卡片内多段文案） */
  function playParallel(elements, options = {}) {
    return Promise.all(elements.map((el) => play(el, options)));
  }

  /** 重置并可重播（Tab 切换） */
  function reset(el) {
    if (!el) return;
    delete el.dataset.typed;
    const targets = getTargets(el);
    if (targets.length) gsap.set(targets, { opacity: 0, x: -8 });
  }

  function resetAndPlay(container) {
    if (!container) return;
    const items = container.querySelectorAll('[data-type]');
    items.forEach(reset);
    return playSequence([...items]);
  }

  /** 进入视口时播放 */
  function bindScroll(el, opts = {}) {
    if (typeof ScrollTrigger === 'undefined') {
      play(el, opts);
      return;
    }
    ScrollTrigger.create({
      trigger: opts.trigger || el,
      start: opts.start || 'top 90%',
      once: true,
      onEnter: () => play(el, opts),
    });
  }

  /** 批量绑定视口打字 */
  function bindAllIn(root, filter) {
    const scope = root || document;
    scope.querySelectorAll('[data-type]').forEach((el) => {
      if (filter && !filter(el)) return;
      if (el.dataset.typed === '1') return;
      if (el.closest('.hero')) return;
      if (el.closest('.tabs__pane:not(.is-active)')) return;
      bindScroll(el);
    });
  }

  function boot() {
    prepareAll();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.Typewriter = {
    play,
    playSequence,
    playParallel,
    reset,
    resetAndPlay,
    bindScroll,
    bindAllIn,
    splitElement,
    prepareAll,
  };
})(window);
