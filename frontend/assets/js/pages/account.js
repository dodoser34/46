// Личный кабинет: профиль, записи, заказы, избранное.
import { initLayout } from '../components/layout.js';
import { emptyState, shopCard, skeletons } from '../components/cards.js';
import { bindFavorites } from '../components/actions.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { api } from '../core/api.js';
import { navigate } from '../core/nav.js';
import { clearSession, isLoggedIn, requireLogin, updateUser } from '../core/auth.js';
import {
  esc, formatDate, formatPrice, initials, isoDate, ORDER_STATUS_LABELS, STATUS_LABELS,
} from '../core/utils.js';

if (!isLoggedIn()) requireLogin();

initLayout();

const el = (id) => document.getElementById(id);

function renderProfile(user) {
  el('profile').innerHTML = `
    <div class="avatar">${esc(initials(user.name))}</div>
    <h3>${esc(user.name)}</h3>
    <p>${esc(user.email)}</p>
    <p>${esc(user.phone || 'Телефон не указан')}</p>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:18px">
      <button class="btn btn-ghost btn-sm" id="edit">${icon('settings', 'icon-sm')} Редактировать</button>
      ${user.is_admin ? `<a class="btn btn-outline btn-sm" href="/pages/admin.html">Панель администратора</a>` : ''}
      <button class="btn btn-danger btn-sm" id="logout">${icon('logout', 'icon-sm')} Выйти</button>
    </div>`;
  const form = el('profile-form');
  form.name.value = user.name;
  form.phone.value = user.phone || '';
  el('edit').addEventListener('click', () => form.classList.toggle('hidden'));
  el('logout').addEventListener('click', async () => {
    try { await api.logout(); } catch { /* токен уже недействителен */ }
    clearSession();
    navigate('/');
  });
}

el('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const user = await api.updateMe({ name: e.target.name.value.trim(), phone: e.target.phone.value.trim() });
    updateUser(user);
    renderProfile(user);
    e.target.classList.add('hidden');
    toast('Профиль сохранён');
  } catch (err) {
    toast(err.message, 'error');
  }
});

function renderBookings(bookings) {
  const box = el('bookings');
  if (!bookings.length) {
    box.innerHTML = emptyState('Записей пока нет', 'Выберите барбершоп и запишитесь к мастеру онлайн.',
      '<a class="btn btn-primary" href="/pages/booking.html">Записаться</a>');
    return;
  }
  const today = isoDate(new Date());
  box.innerHTML = bookings.map((b) => {
    const canCancel = ['new', 'confirmed'].includes(b.status) && b.date >= today;
    return `
    <div class="card list-card">
      <div>
        <h4>${esc(b.service)} · ${esc(b.barbershop)}</h4>
        <div class="meta">
          <span>${icon('calendar', 'icon-xs')} ${formatDate(b.date)}, ${b.time}</span>
          <span>${icon('user', 'icon-xs')} ${esc(b.master)}</span>
          <span>${icon('pin', 'icon-xs')} ${esc(b.address)}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <span class="price">${formatPrice(b.price)}</span>
        <span class="status ${b.status}">${STATUS_LABELS[b.status] || b.status}</span>
        ${canCancel ? `<button class="btn btn-danger btn-sm" data-cancel="${b.id}">Отменить</button>` : ''}
        ${b.status === 'done' ? `<a class="btn btn-outline btn-sm" href="/pages/booking.html?shop=${b.barbershop_id}&master=${b.master_id}">Повторить</a>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderOrders(orders) {
  el('orders').innerHTML = orders.length ? orders.map((o) => `
    <div class="card list-card">
      <div>
        <h4>Заказ #${o.id}</h4>
        <div class="meta"><span>${o.created_at}</span><span>${o.delivery === 'courier' ? `Курьер: ${esc(o.address)}` : 'Самовывоз'}</span></div>
        <p class="muted" style="font-size:13px;margin-top:6px">${o.items.map((i) => `${esc(i.name)} × ${i.qty}`).join(', ')}</p>
      </div>
      <div style="display:flex;align-items:center;gap:14px">
        <span class="price">${formatPrice(o.total)}</span>
        <span class="status ${o.status}">${ORDER_STATUS_LABELS[o.status] || o.status}</span>
      </div>
    </div>`).join('')
    : emptyState('Заказов пока нет', 'В магазине — средства для волос и бороды, которыми пользуются барберы.',
      '<a class="btn btn-primary" href="/pages/shop.html">В магазин</a>');
}

async function loadFavorites() {
  const shops = await api.barbershops({ favorites: true });
  el('favorites').innerHTML = shops.length ? shops.map(shopCard).join('')
    : `<div style="grid-column:1/-1">${emptyState('Избранное пусто', 'Нажимайте на сердечко у барбершопа, чтобы сохранить его здесь.',
      '<a class="btn btn-primary" href="/pages/barbershops.html">К барбершопам</a>')}</div>`;
}

el('bookings').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-cancel]');
  if (!btn || !confirm('Отменить запись?')) return;
  try {
    await api.cancelBooking(btn.dataset.cancel);
    toast('Запись отменена');
    renderBookings(await api.myBookings());
  } catch (err) {
    toast(err.message, 'error');
  }
});

bindFavorites(el('favorites'), () => loadFavorites());

function setupTabs() {
  const open = (name) => {
    document.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
  };
  document.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => {
    open(t.dataset.tab);
    history.replaceState(null, '', `#${t.dataset.tab}`);
  }));
  const hash = location.hash.slice(1);
  if (['bookings', 'orders', 'favorites'].includes(hash)) open(hash);
}

async function init() {
  setupTabs();
  el('bookings').innerHTML = skeletons(2, 90);
  const [user, bookings, orders] = await Promise.all([api.me(), api.myBookings(), api.myOrders()]);
  updateUser(user);
  renderProfile(user);
  renderBookings(bookings);
  renderOrders(orders);
  loadFavorites();
}

if (isLoggedIn()) {
  init().catch((err) => {
    if (err.status === 401) requireLogin();
    else toast(err.message, 'error');
  });
}
