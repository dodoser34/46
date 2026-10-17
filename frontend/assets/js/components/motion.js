// Анимации сайта: появление блоков при прокрутке, «выезжающие» слова заголовков, счётчики,
// наклон карточек, магнитные кнопки, курсор-кольцо, волна на кнопках, прогресс прокрутки,
// прячущаяся шапка, полёт товара в корзину и искры.
// Всё отключается, если в системе включено «уменьшить движение».

import { navigate } from '../core/nav.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Блоки, которые плавно появляются при прокрутке.
const REVEAL = [
  '.eyebrow', '.page-sub', '.breadcrumbs', '.link-arrow',
  '.shop-card', '.shop-row', '.service-card', '.master-card', '.product-card',
  '.step', '.value', '.numbers > div', '.newsletter', '.promo', '.about-teaser > *',
  '.list-card', '.review', '.service-row', '.stat-card', '.split > *', '.gallery > *', '.works > *',
  '.contact-list li', '.booking-widget', '.summary', '.cat-list', '.toolbar', '.chips',
  '.master-stats > *', '.perks > *', '.product-image', '.master-photo', '.shop-banner',
  '.cart-item', '.success-box', '.footer-grid > div', '.empty', '.pick-item', '.calendar-wrap',
].join(',');

// Заголовки, у которых слова выезжают снизу по очереди.
const SPLIT = [
  '.section-title', '.page-title', '.about-hero h1', '.shop-hero-info h1', '.master-page h1',
  '.product-info h1', '.auth-form h1', '.shop-banner h1', '.promo-content h2',
  '.about-teaser-body h2', '.newsletter h2', '.success-box h2', '.empty .display',
].join(',');

const COUNTERS = '.hero-stats b, .numbers b, .stat-card b, .master-stats b';
const TILT = '.shop-card, .service-card, .product-card, .master-card';
const MAGNETIC = '.btn-primary, .search-bar .go, .newsletter-form .go, .icon-btn.bordered';

// ---------- Появление при прокрутке ----------
let revealObserver;
let batch = [];
let batchFrame = null;

function flushBatch() {
  batchFrame = null;
  batch.forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i, 8) * 70}ms`;
    el.classList.add('in');
    const clear = () => { el.style.transitionDelay = ''; };
    setTimeout(clear, 1200 + Math.min(i, 8) * 70);
    if (el.matches(COUNTERS) || el.querySelector?.(COUNTERS)) {
      [el, ...el.querySelectorAll(COUNTERS)].filter((n) => n.matches(COUNTERS)).forEach(countUp);
    }
  });
  batch = [];
}

function onIntersect(entries) {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    revealObserver.unobserve(entry.target);
    batch.push(entry.target);
  });
  if (batch.length && !batchFrame) batchFrame = requestAnimationFrame(flushBatch);
}

function register(el, cls) {
  if (el.dataset.motion || el.closest('.header, .mobile-menu, .toasts, .modal')) return;
  el.dataset.motion = '1';
  el.classList.add(cls);
  revealObserver.observe(el);
}

// ---------- Слова заголовков ----------
function splitWords(el) {
  let index = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.append(document.createTextNode(part));
            return;
          }
          const outer = document.createElement('span');
          outer.className = 'w';
          const inner = document.createElement('span');
          inner.className = 'wi';
          inner.style.setProperty('--i', index++);
          inner.textContent = part;
          outer.append(inner);
          frag.append(outer);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR' && !child.classList.contains('w')) {
        walk(child);
      }
    });
  };
  walk(el);
}

// ---------- Счётчики ----------
function countUp(el) {
  if (el.dataset.counted) return;
  const match = el.textContent.trim().match(/^([\d\s ]+)(.*)$/);
  if (!match) return;
  el.dataset.counted = '1';
  const target = Number(match[1].replace(/[\s ]/g, ''));
  const suffix = match[2];
  const grouped = /[\s ]/.test(match[1].trim());
  if (!target) return;
  const start = performance.now();
  const duration = 1400;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 4;
    const value = Math.round(target * eased);
    el.textContent = (grouped ? value.toLocaleString('ru-RU') : value) + suffix;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function scan(root) {
  if (!(root instanceof Element)) return;
  const pick = (selector) => [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
  pick(SPLIT).forEach((el) => {
    if (el.dataset.motion) return;
    splitWords(el);
    register(el, 'split-reveal');
  });
  pick(REVEAL).forEach((el) => register(el, 'reveal'));
  pick(COUNTERS).forEach((el) => {
    if (el.dataset.motion) return;
    el.dataset.motion = '1';
    revealObserver.observe(el);
  });
}

function watchDom() {
  let pending = [];
  let frame = null;
  new MutationObserver((mutations) => {
    mutations.forEach((m) => m.addedNodes.forEach((n) => pending.push(n)));
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = null;
        const nodes = pending;
        pending = [];
        nodes.forEach(scan);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}

// ---------- Главный экран ----------
function heroIntro() {
  document.querySelectorAll('.hero-title > span').forEach((line, i) => {
    line.innerHTML = `<span class="line-inner" style="--i:${i}">${line.innerHTML}</span>`;
  });
  document.documentElement.classList.add('intro');
}

// ---------- Наклон карточек ----------
function initTilt() {
  let current = null;
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.(TILT);
    if (current && current !== card) {
      current.style.transform = '';
      current.classList.remove('tilting');
      current = null;
    }
    if (!card) return;
    current = card;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    card.classList.add('tilting');
    card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    card.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 7).toFixed(2)}deg) rotateY(${((x - 0.5) * 9).toFixed(2)}deg) translateY(-4px)`;
  }, { passive: true });
}

// ---------- Магнитные кнопки ----------
function initMagnetic() {
  document.addEventListener('pointermove', (e) => {
    document.querySelectorAll('.magnet-active').forEach((el) => {
      if (!el.contains(e.target)) {
        el.classList.remove('magnet-active');
        el.style.translate = '';
      }
    });
    const el = e.target.closest?.(MAGNETIC);
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.classList.add('magnet-active');
    el.style.translate = `${(dx * 0.22).toFixed(1)}px ${(dy * 0.32).toFixed(1)}px`;
  }, { passive: true });
}

// ---------- Курсор-кольцо ----------
function initCursor() {
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.innerHTML = '<span></span>';
  document.body.append(ring);
  const label = ring.firstElementChild;
  let x = innerWidth / 2;
  let y = innerHeight / 2;
  let rx = x;
  let ry = y;
  let visible = false;

  document.addEventListener('pointermove', (e) => {
    x = e.clientX;
    y = e.clientY;
    if (!visible) {
      visible = true;
      rx = x;
      ry = y;
      ring.classList.add('on');
    }
    const target = e.target.closest?.('a, button, select, label, [data-lightbox], input, textarea');
    const view = e.target.closest?.('[data-lightbox], .shop-card .ph, .product-card .ph, .master-card, .service-card');
    ring.classList.toggle('hover', Boolean(target));
    ring.classList.toggle('view', Boolean(view));
    label.textContent = view ? (e.target.closest('[data-lightbox]') ? 'Смотреть' : 'Открыть') : '';
  }, { passive: true });
  document.addEventListener('pointerdown', () => ring.classList.add('down'));
  document.addEventListener('pointerup', () => ring.classList.remove('down'));
  document.documentElement.addEventListener('pointerleave', () => {
    visible = false;
    ring.classList.remove('on');
  });

  const loop = () => {
    rx += (x - rx) * 0.18;
    ry += (y - ry) * 0.18;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
    requestAnimationFrame(loop);
  };
  loop();
}

// ---------- Волна при нажатии ----------
function initRipple() {
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest?.('.btn, .chip, .time-btn, .day-btn, .cal-day, .cart-btn');
    if (!btn || btn.disabled) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const wave = document.createElement('span');
    wave.className = 'ripple';
    wave.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    btn.append(wave);
    wave.addEventListener('animationend', () => wave.remove());
  });
}

// ---------- Прогресс прокрутки и прячущаяся шапка ----------
function initScrollUi() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.append(bar);
  const header = document.querySelector('.header');
  let lastY = scrollY;
  let frame = null;
  const update = () => {
    frame = null;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? (scrollY / max).toFixed(4) : 0})`;
    if (header && !document.querySelector('.mobile-menu.open')) {
      const goingDown = scrollY > lastY;
      header.classList.toggle('is-hidden', goingDown && scrollY > 240);
    }
    lastY = scrollY;
  };
  window.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
  update();
}

// ---------- Переход между страницами (шторка) ----------

function isInternalPageLink(link, e) {
  if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return false;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return false; // внешние ссылки, tel:, mailto:
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/docs')) return false;
  if (url.pathname === location.pathname && url.search === location.search) return false; // та же страница / якорь
  return url;
}

function initPageTransitions() {
  const root = document.documentElement;

  // Приход: шторка уже закрыта (её поставил скрипт в <head>) — открываем, когда страница готова.
  if (root.classList.contains('page-entering')) {
    const reveal = () => {
      root.classList.add('page-arrived');
      requestAnimationFrame(() => root.classList.remove('page-entering'));
    };
    Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 350))]).then(reveal);
  }

  // Уход: закрываем шторку и только потом переходим по ссылке.
  document.addEventListener('click', (e) => {
    const url = isInternalPageLink(e.target.closest?.('a[href]'), e);
    if (!url) return;
    e.preventDefault();
    navigate(url.href);
  });

  // Возврат кнопкой «Назад» из кэша браузера — снимаем шторку.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) root.classList.remove('page-leaving', 'page-entering');
  });
}

// ---------- Публичные эффекты ----------

/** Искры из точки (x, y) — для избранного, успешной записи и заказа. */
export function burst(x, y, { count = 14, spread = 90, symbol = '✦' } = {}) {
  if (reduceMotion) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'spark';
    p.textContent = symbol;
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = spread * (0.55 + Math.random() * 0.6);
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.fontSize = `${8 + Math.random() * 10}px`;
    document.body.append(p);
    p.animate([
      { transform: 'translate(-50%, -50%) scale(.2) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(1) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.2,1)' }).onfinish = () => p.remove();
  }
}

/** Искры из центра элемента. */
export function burstFrom(el, options) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, options);
}

/** Полёт товара от кнопки к иконке корзины в шапке. */
export function flyToCart(fromEl, imageSrc) {
  const cartIcon = document.querySelector('.header [data-cart-count]')?.parentElement;
  if (!fromEl || !cartIcon || reduceMotion) return;
  const from = fromEl.getBoundingClientRect();
  const to = cartIcon.getBoundingClientRect();
  const dot = document.createElement('div');
  dot.className = 'fly-dot';
  if (imageSrc) dot.style.backgroundImage = `url("${imageSrc}")`;
  dot.style.left = `${from.left + from.width / 2}px`;
  dot.style.top = `${from.top + from.height / 2}px`;
  document.body.append(dot);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  dot.animate([
    { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
    { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 120}px)) scale(.8)`, opacity: 1, offset: 0.5 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.25)`, opacity: 0.4 },
  ], { duration: 800, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => {
    dot.remove();
    cartIcon.classList.remove('bump');
    void cartIcon.offsetWidth; // перезапуск анимации
    cartIcon.classList.add('bump');
  };
}

export function initMotion() {
  if (reduceMotion) return;
  document.documentElement.classList.add('motion');
  revealObserver = new IntersectionObserver(onIntersect, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  heroIntro();
  scan(document.body);
  watchDom();
  initRipple();
  initScrollUi();
  initPageTransitions();
  if (finePointer) {
    initTilt();
    initMagnetic();
    initCursor();
  }
}
