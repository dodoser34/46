// Карточка товара.
import { initLayout } from '../components/layout.js';
import { emptyState, img, productCard, stars } from '../components/cards.js';
import { bindAddToCart } from '../components/actions.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { flyToCart } from '../components/motion.js';
import { api } from '../core/api.js';
import { cart } from '../core/cart.js';
import { esc, formatPrice, intParam, pluralize } from '../core/utils.js';

initLayout({ active: 'shop' });

const root = document.getElementById('product');
const id = intParam('id');

function render(p) {
  document.title = `${p.name} — Blind Barber`;
  document.getElementById('crumbs').insertAdjacentHTML('beforeend',
    `<span class="sep">/</span><a href="/pages/shop.html?category=${esc(p.category_slug)}">${esc(p.category)}</a>`);

  root.innerHTML = `
    ${img(p.image, p.name, 'product-image', { eager: true })}
    <div class="product-info">
      <span class="brand">${esc(p.brand)}${p.volume ? ` · ${esc(p.volume)}` : ''}</span>
      <h1>${esc(p.name)}</h1>
      <p class="product-price">${formatPrice(p.price)}</p>
      ${stars(p.rating, `${p.reviews_count} ${pluralize(p.reviews_count, 'отзыв', 'отзыва', 'отзывов')}`)}
      <p class="lead">${esc(p.short)} ${esc(p.description.split('.')[0])}.</p>
      <div class="buy-row">
        <div class="qty" aria-label="Количество">
          <button type="button" data-qty="-1" aria-label="Меньше">−</button>
          <input id="qty" type="number" min="1" max="20" value="1" aria-label="Количество">
          <button type="button" data-qty="1" aria-label="Больше">+</button>
        </div>
        <button class="btn btn-primary" id="add" ${p.in_stock ? '' : 'disabled'}>
          ${p.in_stock ? `Добавить в корзину ${icon('cart')}` : 'Нет в наличии'}
        </button>
      </div>
      <div class="perks">
        <div class="card">${icon('truck')}Доставка по городу за 1 день</div>
        <div class="card">${icon('shield')}Оригинальная продукция</div>
        <div class="card">${icon('gift')}Самовывоз из барбершопа</div>
      </div>

      <div class="tabs" role="tablist" style="margin-top:36px">
        <button class="tab active" data-tab="desc">Описание</button>
        <button class="tab" data-tab="usage">Применение</button>
        <button class="tab" data-tab="delivery">Доставка</button>
      </div>
      <div class="tab-panel active prose" data-panel="desc" style="padding-top:18px"><p>${esc(p.description)}</p></div>
      <div class="tab-panel prose" data-panel="usage" style="padding-top:18px"><p>${esc(p.usage)}</p></div>
      <div class="tab-panel prose" data-panel="delivery" style="padding-top:18px">
        <p>Самовывоз — бесплатно из любого барбершопа сети в день заказа.</p>
        <p>Курьером по городу — 1 500 ₸, бесплатно при заказе от 30 000 ₸. Оплата при получении.</p>
      </div>
    </div>`;

  const qty = root.querySelector('#qty');
  root.addEventListener('click', (e) => {
    const step = e.target.closest('[data-qty]');
    const tab = e.target.closest('[data-tab]');
    if (step) qty.value = Math.max(1, Math.min(20, Number(qty.value) + Number(step.dataset.qty)));
    if (tab) {
      root.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('active', t === tab));
      root.querySelectorAll('[data-panel]').forEach((pnl) => pnl.classList.toggle('active', pnl.dataset.panel === tab.dataset.tab));
    }
  });
  root.querySelector('#add').addEventListener('click', () => {
    cart.add(p.id, Math.max(1, Math.min(20, Number(qty.value) || 1)));
    flyToCart(root.querySelector('#add'), root.querySelector('.product-image img.is-loaded')?.src);
    toast('Товар добавлен в корзину');
  });
}

async function init() {
  if (!id) throw new Error('Товар не найден');
  const p = await api.product(id);
  render(p);
  // Сначала товары той же категории, затем самые популярные — ровно 4 карточки, чтобы ряд был полным.
  const sameCategory = (await api.products({ category: p.category_slug })).filter((x) => x.id !== p.id);
  const popular = (await api.products({ sort: 'rating' })).filter((x) => x.id !== p.id && !sameCategory.some((s) => s.id === x.id));
  const relatedEl = document.getElementById('related');
  relatedEl.innerHTML = [...sameCategory, ...popular].slice(0, 4).map((x) => productCard(x, cart.has(x.id))).join('');
  bindAddToCart(relatedEl);
}

init().catch((err) => {
  root.outerHTML = emptyState('Товар не найден', err.message, '<a class="btn btn-primary" href="/pages/shop.html">В магазин</a>');
  document.getElementById('related-wrap').remove();
});
