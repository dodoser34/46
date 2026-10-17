// Шаблоны карточек и мелких элементов интерфейса.
import { icon } from './icons.js';
import { esc, formatDuration, formatPrice } from '../core/utils.js';

/** Изображение в обёртке с заглушкой — пока фото нет, видна стилизованная подложка. */
export function img(src, alt = '', cls = '', { eager = false } = {}) {
  return `<div class="ph ${cls}"><img src="${esc(src)}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"></div>`;
}

export function stars(rating, count) {
  const tail = count !== undefined ? ` <span>(${count})</span>` : '';
  return `<span class="stars">${icon('star')}<b>${Number(rating).toFixed(1)}</b>${tail}</span>`;
}

export function openBadge(shop) {
  return shop.is_open
    ? '<span class="status-dot open">Открыто</span>'
    : '<span class="status-dot closed">Закрыто</span>';
}

export function favButton(shop) {
  return `<button class="icon-btn fav-btn ${shop.is_favorite ? 'active' : ''}" data-fav="${shop.id}"
    aria-label="${shop.is_favorite ? 'Убрать из избранного' : 'В избранное'}" aria-pressed="${shop.is_favorite}">${icon('heart')}</button>`;
}

export function shopCard(shop) {
  return `
  <article class="card shop-card">
    <a href="/pages/barbershop.html?id=${shop.id}">${img(shop.cover, shop.name)}</a>
    <div class="shop-card-body">
      <div class="shop-card-title">
        <h3><a href="/pages/barbershop.html?id=${shop.id}">${esc(shop.name)}</a></h3>
        ${favButton(shop)}
      </div>
      ${stars(shop.rating, shop.reviews_count)}
      <span class="meta">${icon('pin')}${esc(shop.city)}, ${esc(shop.address)}</span>
      <span class="meta">${icon('clock')}${shop.open_time} – ${shop.close_time} · ${openBadge(shop)}</span>
    </div>
  </article>`;
}

export function shopRow(shop) {
  const distance = shop.distance_km != null ? `<span class="meta">${icon('location')}${shop.distance_km} км от вас</span>` : '';
  return `
  <article class="card shop-row">
    <a href="/pages/barbershop.html?id=${shop.id}" tabindex="-1">${img(shop.cover, shop.name)}</a>
    <div class="info">
      <h3><a href="/pages/barbershop.html?id=${shop.id}">${esc(shop.name)}</a></h3>
      ${stars(shop.rating, shop.reviews_count)}
      <span class="meta">${icon('pin')}${esc(shop.city)}, ${esc(shop.address)}</span>
      <span class="meta">${icon('clock')}${shop.open_time} – ${shop.close_time}</span>
      ${distance}
    </div>
    <div class="side">
      ${favButton(shop)}
      ${openBadge(shop)}
    </div>
  </article>`;
}

export function serviceCard(service, href) {
  return `
  <a class="card service-card" href="${href || `/pages/booking.html?service=${service.id}`}">
    ${img(service.image, service.name)}
    <div class="service-card-body">
      <div>
        <h3>${esc(service.name)}</h3>
        <span class="price">${formatPrice(service.price)}</span><span class="duration">${formatDuration(service.duration)}</span>
      </div>
      <span class="round-arrow">${icon('arrow-right')}</span>
    </div>
  </a>`;
}

export function masterCard(master) {
  return `
  <a class="card master-card" href="/pages/master.html?id=${master.id}">
    ${img(master.photo, master.name)}
    <div class="master-card-body">
      <h3>${esc(master.name)}</h3>
      <p class="role">${esc(master.title)} · стаж ${master.experience} ${master.experience < 5 ? 'года' : 'лет'}</p>
      ${stars(master.rating, master.reviews_count)}
    </div>
  </a>`;
}

export function productCard(product, inCart = false) {
  return `
  <article class="card product-card">
    <a href="/pages/product.html?id=${product.id}" class="ph-link">
      <div class="ph">
        ${product.badge ? `<span class="badge">${esc(product.badge)}</span>` : ''}
        <img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy" decoding="async">
      </div>
    </a>
    <div class="product-card-body">
      <div>
        <p class="brand">${esc(product.brand)}</p>
        <h3><a href="/pages/product.html?id=${product.id}">${esc(product.name)}</a></h3>
        <span class="price">${formatPrice(product.price)}</span>
      </div>
      <button class="cart-btn ${inCart ? 'added' : ''}" data-add-cart="${product.id}" aria-label="Добавить в корзину"
        ${product.in_stock ? '' : 'disabled title="Нет в наличии"'}>${icon(inCart ? 'check' : 'cart')}</button>
    </div>
  </article>`;
}

export function reviewItem(review) {
  const date = new Date(review.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return `
  <div class="review">
    <div class="review-head">
      <div style="display:flex;gap:12px;align-items:center">
        <span class="avatar">${esc(review.author[0] || '?')}</span>
        <div><b>${esc(review.author)}</b><br><small class="muted">${date}</small></div>
      </div>
      ${stars(review.rating)}
    </div>
    <p>${esc(review.text)}</p>
  </div>`;
}

export function skeletons(count, height = 280) {
  return Array.from({ length: count }, () => `<div class="skeleton" style="height:${height}px"></div>`).join('');
}

export function emptyState(title, text, action = '') {
  return `<div class="empty"><p class="display">${esc(title)}</p><p>${esc(text)}</p>${action}</div>`;
}
