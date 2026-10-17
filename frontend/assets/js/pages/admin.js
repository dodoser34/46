// Панель администратора: сводка, управление записями и заказами.
import { initLayout } from '../components/layout.js';
import { emptyState } from '../components/cards.js';
import { toast } from '../components/toast.js';
import { api } from '../core/api.js';
import { getUser, isLoggedIn, requireLogin } from '../core/auth.js';
import { esc, formatDate, formatPrice, ORDER_STATUS_LABELS, STATUS_LABELS } from '../core/utils.js';

if (!isLoggedIn()) requireLogin();
initLayout();

const BOOKING_STATUSES = ['new', 'confirmed', 'done', 'cancelled'];
const ORDER_STATUSES = ['new', 'processing', 'done', 'cancelled'];
const $ = (id) => document.getElementById(id);

function statusSelect(kind, id, current, statuses, labels) {
  return `<select class="select" data-kind="${kind}" data-id="${id}" aria-label="Статус">
    ${statuses.map((s) => `<option value="${s}" ${s === current ? 'selected' : ''}>${labels[s]}</option>`).join('')}
  </select>`;
}

async function loadSummary() {
  const s = await api.admin.summary();
  $('summary').innerHTML = [
    [s.bookings_today, 'Записей сегодня'],
    [s.bookings_new, 'Новых записей'],
    [s.orders_new, 'Новых заказов'],
    [formatPrice(s.revenue_orders), 'Выполненные заказы, ₸'],
    [s.users, 'Пользователей'],
    [s.subscribers, 'Подписчиков'],
  ].map(([v, l]) => `<div class="card stat-card"><b>${v}</b><span>${l}</span></div>`).join('');
}

async function loadBookings() {
  const rows = await api.admin.bookings({ day: $('f-day').value, status_filter: $('f-status').value });
  $('bookings').innerHTML = rows.length ? `
    <thead><tr><th>#</th><th>Дата и время</th><th>Клиент</th><th>Барбершоп / мастер</th><th>Услуга</th><th>Статус</th></tr></thead>
    <tbody>${rows.map((b) => `
      <tr>
        <td>${b.id}</td>
        <td>${formatDate(b.date, { day: 'numeric', month: 'short' })}<small>${b.time}, ${b.duration} мин</small></td>
        <td>${esc(b.client_name)}<small><a href="tel:${esc(b.client_phone)}">${esc(b.client_phone)}</a></small>${b.comment ? `<small>«${esc(b.comment)}»</small>` : ''}</td>
        <td>${esc(b.barbershop)}<small>${esc(b.master)}</small></td>
        <td>${esc(b.service)}<small>${formatPrice(b.price)}</small></td>
        <td>${statusSelect('booking', b.id, b.status, BOOKING_STATUSES, STATUS_LABELS)}</td>
      </tr>`).join('')}</tbody>`
    : `<tbody><tr><td>${emptyState('Записей нет', 'Измените фильтры.')}</td></tr></tbody>`;
}

async function loadOrders() {
  const rows = await api.admin.orders();
  $('orders').innerHTML = rows.length ? `
    <thead><tr><th>#</th><th>Дата</th><th>Клиент</th><th>Состав</th><th>Доставка</th><th>Сумма</th><th>Статус</th></tr></thead>
    <tbody>${rows.map((o) => `
      <tr>
        <td>${o.id}</td>
        <td>${o.created_at}</td>
        <td>${esc(o.client_name)}<small>${esc(o.client_phone)}</small></td>
        <td>${o.items.map((i) => `${esc(i.name)} × ${i.qty}`).join('<br>')}</td>
        <td>${o.delivery === 'courier' ? `Курьер<small>${esc(o.address)}</small>` : 'Самовывоз'}</td>
        <td>${formatPrice(o.total)}</td>
        <td>${statusSelect('order', o.id, o.status, ORDER_STATUSES, ORDER_STATUS_LABELS)}</td>
      </tr>`).join('')}</tbody>`
    : `<tbody><tr><td>${emptyState('Заказов нет', 'Здесь появятся заказы из магазина.')}</td></tr></tbody>`;
}

document.addEventListener('change', async (e) => {
  const sel = e.target.closest('[data-kind]');
  if (!sel) return;
  sel.disabled = true;
  try {
    if (sel.dataset.kind === 'booking') await api.admin.setBookingStatus(sel.dataset.id, sel.value);
    else await api.admin.setOrderStatus(sel.dataset.id, sel.value);
    toast('Статус обновлён');
    await loadSummary();
  } catch (err) {
    toast(err.message, 'error');
    try {
      if (sel.dataset.kind === 'booking') await loadBookings();
      else await loadOrders();
    } catch (loadError) { toast(loadError.message, 'error'); }
  } finally {
    sel.disabled = false;
  }
});

$('f-day').addEventListener('change', loadBookings);
$('f-status').addEventListener('change', loadBookings);
$('f-reset').addEventListener('click', () => {
  $('f-day').value = '';
  $('f-status').value = '';
  loadBookings();
});

document.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === t));
  document.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('active', p.dataset.panel === t.dataset.tab));
}));

async function init() {
  if (!getUser()?.is_admin) throw Object.assign(new Error('Доступ только для администратора'), { status: 403 });
  await Promise.all([loadSummary(), loadBookings(), loadOrders()]);
}

if (isLoggedIn()) {
  init().catch((err) => {
    $('main').querySelector('.container').innerHTML = emptyState('Нет доступа', err.message,
      '<a class="btn btn-primary" href="/pages/account.html">В личный кабинет</a>');
  });
}
