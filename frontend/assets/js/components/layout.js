// Общий каркас страницы: шапка, мобильное меню, подвал и глобальные обработчики.
import { icon } from './icons.js';
import { logo } from './logo.js';
import { initMotion } from './motion.js';
import { getUser, isLoggedIn } from '../core/auth.js';
import { cart } from '../core/cart.js';
import { esc } from '../core/utils.js';

const NAV = [
  { id: 'home', href: '/', label: 'Главная' },
  { id: 'barbershops', href: '/pages/barbershops.html', label: 'Барбершопы' },
  { id: 'services', href: '/pages/services.html', label: 'Услуги' },
  { id: 'shop', href: '/pages/shop.html', label: 'Магазин' },
  { id: 'about', href: '/pages/about.html', label: 'О нас' },
];

function navLinks(active) {
  return NAV.map((n) => `<a href="${n.href}" class="${n.id === active ? 'active' : ''}"
    ${n.id === active ? 'aria-current="page"' : ''}>${n.label}</a>`).join('');
}

function accountHref() {
  return isLoggedIn() ? '/pages/account.html' : '/pages/login.html';
}

function renderHeader(active, transparent) {
  const header = document.createElement('header');
  header.className = `header ${transparent ? 'is-transparent' : ''}`;
  const user = getUser();
  header.innerHTML = `
    <div class="container header-inner">
      <a class="logo" href="/" aria-label="Blind Barber — на главную">${logo()}</a>
      <nav class="nav" aria-label="Основное меню">${navLinks(active)}</nav>
      <div class="header-actions">
        <a class="icon-btn hide-mobile" href="/pages/barbershops.html" aria-label="Поиск барбершопа">${icon('search')}</a>
        <a class="icon-btn" href="/pages/cart.html" aria-label="Корзина">${icon('cart')}<span class="badge-count hidden" data-cart-count></span></a>
        <a class="icon-btn hide-mobile" href="${accountHref()}" aria-label="${user ? esc(user.name) : 'Войти'}" title="${user ? esc(user.name) : 'Войти'}">${icon('user')}</a>
        <a class="btn btn-primary btn-sm" href="/pages/booking.html">Записаться</a>
        <button class="icon-btn burger" aria-label="Открыть меню" aria-expanded="false">${icon('menu')}</button>
      </div>
    </div>`;

  const menu = document.createElement('div');
  menu.className = 'mobile-menu';
  menu.innerHTML = `
    <div class="mobile-menu-panel" role="dialog" aria-label="Меню">
      <div class="top">
        <span class="logo">${logo()}</span>
        <button class="icon-btn" data-close aria-label="Закрыть меню">${icon('close')}</button>
      </div>
      <nav>${navLinks(active)}<a href="${accountHref()}">${user ? 'Личный кабинет' : 'Войти'}</a></nav>
      <a class="btn btn-primary btn-block" href="/pages/booking.html">Записаться ${icon('arrow-right')}</a>
    </div>`;

  const burger = header.querySelector('.burger');
  const toggle = (open) => {
    menu.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => toggle(true));
  menu.addEventListener('click', (e) => {
    if (e.target === menu || e.target.closest('[data-close]')) toggle(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });

  if (transparent) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  document.body.prepend(menu);
  document.body.prepend(header);
}

function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'footer';
  const year = new Date().getFullYear();
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="logo logo-lg" href="/" aria-label="Blind Barber — на главную">${logo()}</a>
          <p>Сервис онлайн-записи в лучшие барбершопы Казахстана и магазин профессиональных средств для ухода.</p>
        </div>
        <div>
          <h4>Сервис</h4>
          <ul>
            <li><a href="/pages/barbershops.html">Барбершопы</a></li>
            <li><a href="/pages/services.html">Услуги и цены</a></li>
            <li><a href="/pages/booking.html">Онлайн-запись</a></li>
            <li><a href="/pages/shop.html">Магазин</a></li>
          </ul>
        </div>
        <div>
          <h4>Компания</h4>
          <ul>
            <li><a href="/pages/about.html">О нас</a></li>
            <li><a href="/pages/about.html#contacts">Контакты</a></li>
            <li><a href="${accountHref()}">Личный кабинет</a></li>
          </ul>
        </div>
        <div>
          <h4>Контакты</h4>
          <ul>
            <li><a href="tel:+77273551225">+7 727 355 12 25</a></li>
            <li><a href="mailto:hello@barber.kz">hello@barber.kz</a></li>
            <li>Алматы · Астана · Костанай</li>
            <li>Ежедневно 09:00 – 22:00</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${year} Blind Barber</span>
        <span>Алматы · Астана · Костанай</span>
      </div>
    </div>`;
  document.body.append(footer);
}

function updateCartCount() {
  const count = cart.count();
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = count > 9 ? '9+' : count;
    el.classList.toggle('hidden', count === 0);
  });
}

/** Скрывает изображения, которые ещё не загружены в проект, — остаётся стилизованная подложка. */
function handleImages() {
  document.addEventListener('error', (e) => {
    if (e.target instanceof HTMLImageElement) e.target.classList.add('is-missing');
  }, true);
  document.addEventListener('load', (e) => {
    if (e.target instanceof HTMLImageElement) e.target.classList.add('is-loaded');
  }, true);
  // Изображения, загруженные до запуска скрипта (из кэша).
  document.querySelectorAll('img').forEach((img) => {
    if (img.complete && img.naturalWidth) img.classList.add('is-loaded');
  });
}

export function initLayout({ active = '', transparent = false } = {}) {
  handleImages();
  renderHeader(active, transparent);
  renderFooter();
  if (globalThis.BLIND_BARBER_DEMO) {
    const notice = document.createElement('aside');
    notice.className = 'demo-notice';
    notice.setAttribute('aria-label', 'Режим демонстрации');
    notice.innerHTML = '<span><b>Учебное демо</b> · Действия сохраняются только в этом браузере. Используйте вымышленные данные.</span><button type="button">Сбросить демо</button>';
    notice.querySelector('button').addEventListener('click', () => {
      if (!confirm('Сбросить записи, заказы и вход в этом демо?')) return;
      const prefix = `demo:${globalThis.BLIND_BARBER_DEMO.basePath}:`;
      try {
        Object.keys(localStorage).filter((key) => key.startsWith(prefix)).forEach((key) => localStorage.removeItem(key));
      } catch { /* хранилище браузера может быть недоступно */ }
      location.reload();
    });
    document.body.append(notice);
    document.body.classList.add('is-demo');
  }
  updateCartCount();
  window.addEventListener('cart:change', updateCartCount);
  window.addEventListener('storage', updateCartCount);
  initMotion();
}
