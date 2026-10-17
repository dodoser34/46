// Корзина и оформление заказа.
import { initLayout } from '../components/layout.js';
import { emptyState, img } from '../components/cards.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { burstFrom } from '../components/motion.js';
import { api } from '../core/api.js';
import { getUser } from '../core/auth.js';
import { cart } from '../core/cart.js';
import { esc, formatPrice } from '../core/utils.js';

initLayout({ active: 'shop' });

// Совпадает с правилами на сервере (app/services/order_service.py).
const DELIVERY_FEE = 1500;
const FREE_DELIVERY_FROM = 30000;

const root = document.getElementById('cart-root');
let products = new Map();

function lines() {
  return cart.items().filter((i) => products.has(i.id)).map((i) => ({ ...products.get(i.id), qty: i.qty }));
}

function deliveryFee(subtotal) {
  const form = root.querySelector('#order-form');
  const courier = form?.delivery.value === 'courier';
  return courier && subtotal < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
}

function renderTotals() {
  const items = lines();
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const fee = deliveryFee(subtotal);
  root.querySelector('#totals').innerHTML = `
    <div class="summary-row"><span>Товары (${items.reduce((s, i) => s + i.qty, 0)} шт.)</span><b>${formatPrice(subtotal)}</b></div>
    <div class="summary-row"><span>Доставка</span><b>${fee ? formatPrice(fee) : 'Бесплатно'}</b></div>
    <div class="summary-total"><span class="muted">Итого</span><b>${formatPrice(subtotal + fee)}</b></div>`;
}

function renderItems() {
  const items = lines();
  if (!items.length) {
    root.innerHTML = emptyState('Корзина пуста', 'Загляните в магазин — там средства, которыми пользуются наши барберы.',
      '<a class="btn btn-primary" href="/pages/shop.html">Перейти в магазин</a>');
    return false;
  }
  root.querySelector('#items').innerHTML = items.map((p) => `
    <div class="cart-item">
      <a href="/pages/product.html?id=${p.id}">${img(p.image, p.name)}</a>
      <div>
        <p class="muted" style="font-size:12px">${esc(p.brand)}</p>
        <h4><a href="/pages/product.html?id=${p.id}">${esc(p.name)}</a></h4>
        <span class="muted" style="font-size:13px">${formatPrice(p.price)} / шт.</span>
        ${p.in_stock ? '' : '<p class="field-error">Нет в наличии. Удалите товар, чтобы оформить заказ.</p>'}
        <div class="controls">
          <div class="qty sm">
            <button data-dec="${p.id}" aria-label="Меньше">−</button>
            <input value="${p.qty}" readonly aria-label="Количество">
            <button data-inc="${p.id}" aria-label="Больше">+</button>
          </div>
          <button class="remove" data-remove="${p.id}">${icon('trash', 'icon-sm')} Удалить</button>
        </div>
      </div>
      <b class="line-total">${formatPrice(p.price * p.qty)}</b>
    </div>`).join('');
  renderTotals();
  root.querySelector('[type="submit"]').disabled = items.some((p) => !p.in_stock);
  return true;
}

function renderLayout() {
  const user = getUser();
  root.innerHTML = `
    <div class="cart-layout">
      <div id="items"></div>
      <aside class="card card-pad summary">
        <h3>Оформление заказа</h3>
        <form class="form-grid" id="order-form" novalidate>
          <div class="field"><label for="o-name">Имя</label>
            <input class="input" id="o-name" name="name" autocomplete="name" required minlength="2" maxlength="100" value="${esc(user?.name || '')}"></div>
          <div class="field"><label for="o-phone">Телефон</label>
            <input class="input" id="o-phone" name="phone" type="tel" autocomplete="tel" required placeholder="+7 7__ ___ __ __" value="${esc(user?.phone || '')}"></div>
          <div class="radio-cards">
            <label class="radio-card"><input type="radio" name="delivery" value="pickup" checked><span><b>Самовывоз</b><small>Из барбершопа</small></span></label>
            <label class="radio-card"><input type="radio" name="delivery" value="courier"><span><b>Курьер</b><small>${formatPrice(DELIVERY_FEE)}, от ${formatPrice(FREE_DELIVERY_FROM)} — бесплатно</small></span></label>
          </div>
          <div class="field hidden" id="address-field"><label for="o-address">Адрес доставки</label>
            <input class="input" id="o-address" name="address" autocomplete="street-address" placeholder="Город, улица, дом, квартира"></div>
          <div class="field"><label for="o-comment">Комментарий</label>
            <textarea class="textarea" id="o-comment" name="comment" maxlength="500" style="min-height:70px"></textarea></div>
          <div id="totals"></div>
          <button class="btn btn-primary btn-block" type="submit">Оформить заказ ${icon('arrow-right')}</button>
          <p class="muted" style="font-size:12px">Оплата при получении. Менеджер свяжется с вами для подтверждения.</p>
        </form>
      </aside>
    </div>`;

  const form = root.querySelector('#order-form');
  form.addEventListener('change', (e) => {
    if (e.target.name === 'delivery') {
      root.querySelector('#address-field').classList.toggle('hidden', e.target.value !== 'courier');
      form.elements.address.required = e.target.value === 'courier';
      form.elements.address.minLength = e.target.value === 'courier' ? 5 : 0;
      renderTotals();
    }
  });
  form.addEventListener('submit', submit);
}

async function submit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('[type="submit"]');
  if (btn.disabled || !form.reportValidity()) return;
  if (form.elements.name.value.trim().length < 2) {
    toast('Введите имя: не меньше двух символов', 'error');
    return;
  }
  btn.disabled = true;
  try {
    const order = await api.createOrder({
      items: cart.items().map(({ id, qty }) => ({ product_id: id, qty })),
      client_name: form.name.value.trim(),
      client_phone: form.phone.value.trim(),
      delivery: form.delivery.value,
      address: form.address.value.trim(),
      comment: form.comment.value.trim(),
    });
    cart.clear();
    root.innerHTML = `
      <div class="card success-box">
        <div class="success-icon">${icon('check')}</div>
        <h2>Заказ оформлен</h2>
        <p class="muted" style="margin:10px 0 24px">Заказ #${order.id} на сумму ${formatPrice(order.total)}. Мы позвоним по номеру ${esc(order.client_phone)} для подтверждения.</p>
        <div class="actions">
          ${getUser() ? '<a class="btn btn-primary" href="/pages/account.html#orders">Мои заказы</a>' : ''}
          <a class="btn btn-outline" href="/pages/shop.html">Продолжить покупки</a>
        </div>
      </div>`;
    setTimeout(() => burstFrom(root.querySelector('.success-icon'), { count: 22, spread: 140 }), 350);
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
  }
}

root.addEventListener('click', (e) => {
  const inc = e.target.closest('[data-inc]');
  const dec = e.target.closest('[data-dec]');
  const rm = e.target.closest('[data-remove]');
  if (inc) cart.setQty(Number(inc.dataset.inc), cart.items().find((i) => i.id === Number(inc.dataset.inc)).qty + 1);
  if (dec) cart.setQty(Number(dec.dataset.dec), cart.items().find((i) => i.id === Number(dec.dataset.dec)).qty - 1);
  if (rm) cart.remove(Number(rm.dataset.remove));
  if (inc || dec || rm) renderItems();
});

async function init() {
  const ids = cart.items().map((i) => i.id);
  if (!ids.length) {
    root.innerHTML = '<div id="items"></div>';
    renderItems();
    return;
  }
  const list = await api.products({ ids: ids.join(',') });
  products = new Map(list.map((p) => [p.id, p]));
  const missing = ids.filter((id) => !products.has(id));
  missing.forEach((id) => cart.remove(id));
  if (missing.length) toast('Товары, которых больше нет в каталоге, удалены из корзины');
  renderLayout();
  renderItems();
}

init().catch((err) => { root.innerHTML = emptyState('Ошибка загрузки', err.message); });
