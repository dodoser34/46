// Мастер записи в 4 шага: услуга → мастер → дата и время → подтверждение.
import { initLayout } from '../components/layout.js';
import { emptyState, img } from '../components/cards.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { burstFrom } from '../components/motion.js';
import { api } from '../core/api.js';
import { getUser } from '../core/auth.js';
import {
  $, $$, addDays, esc, formatDate, formatDuration, formatPrice, intParam, isoDate, param, parseIsoDate,
} from '../core/utils.js';

initLayout();

const HORIZON_DAYS = 30;
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const today = new Date();
today.setHours(0, 0, 0, 0);
const lastDay = addDays(today, HORIZON_DAYS);

const state = {
  step: 1,
  shops: [],
  services: [],
  shop: null,        // полный объект барбершопа с мастерами
  serviceId: intParam('service'),
  masterId: intParam('master'),
  date: param('date') || isoDate(today),
  time: param('time'),
  month: null,
};

const els = {
  shop: $('#shop'),
  services: $('#service-list'),
  masters: $('#master-list'),
  calendar: $('#calendar'),
  times: $('#time-list'),
  slotsNote: $('#slots-note'),
  summary: $('#summary'),
  next: $('#next'),
  back: $('#back'),
  form: $('#client-form'),
};

const service = () => state.services.find((s) => s.id === state.serviceId);
const master = () => state.shop?.masters.find((m) => m.id === state.masterId);

// ---------- Проверка готовности шагов ----------
function stepValid(step) {
  if (step === 1) return Boolean(state.shop && service());
  if (step === 2) return Boolean(master());
  if (step === 3) return Boolean(state.date && state.time);
  return true;
}

function goTo(step) {
  state.step = step;
  $('#stepper').style.setProperty('--progress', (step - 1) / 3);
  $$('.booking-step').forEach((s) => s.classList.toggle('active', Number(s.dataset.step) === step));
  $$('.stepper-item').forEach((item) => {
    const n = Number(item.dataset.goto);
    item.classList.toggle('active', n === step);
    item.classList.toggle('done', n < step);
    item.disabled = n > step && !Array.from({ length: n - 1 }, (_, i) => stepValid(i + 1)).every(Boolean);
  });
  els.back.style.visibility = step === 1 ? 'hidden' : 'visible';
  els.next.innerHTML = step === 4 ? `Записаться ${icon('check')}` : `Продолжить ${icon('arrow-right')}`;
  if (step === 3) { renderCalendar(); loadSlots(); }
  if (step === 4) $('#name').focus({ preventScroll: true });
  updateNext();
  renderSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateNext() {
  els.next.disabled = !stepValid(state.step);
}

// ---------- Шаг 1 ----------
function renderShops() {
  const byCity = {};
  state.shops.forEach((s) => { (byCity[s.city] ||= []).push(s); });
  els.shop.innerHTML = Object.entries(byCity).map(([city, shops]) => `
    <optgroup label="${esc(city)}">${shops.map((s) => `<option value="${s.id}">${esc(s.name)} — ${esc(s.address)}</option>`).join('')}</optgroup>`).join('');
  if (state.shop) els.shop.value = String(state.shop.id);
}

function renderServices() {
  els.services.innerHTML = state.services.map((s) => `
    <button class="pick-item ${s.id === state.serviceId ? 'active' : ''}" data-service="${s.id}" aria-pressed="${s.id === state.serviceId}">
      ${img(s.image, s.name)}
      <div class="grow"><h4>${esc(s.name)}</h4><p>${formatDuration(s.duration)} · ${esc(s.description)}</p></div>
      <span class="price">${formatPrice(s.price)}</span>
      <span class="check">${icon('check')}</span>
    </button>`).join('');
}

async function selectShop(id) {
  state.shop = await api.barbershop(id);
  if (!master()) state.masterId = null;
  state.time = null;
  renderMasters();
  updateNext();
  renderSummary();
}

// ---------- Шаг 2 ----------
function renderMasters() {
  els.masters.innerHTML = state.shop.masters.map((m) => `
    <button class="pick-item ${m.id === state.masterId ? 'active' : ''}" data-master="${m.id}" aria-pressed="${m.id === state.masterId}">
      ${img(m.photo, m.name)}
      <div class="grow">
        <h4>${esc(m.name)}</h4>
        <p>${esc(m.title)} · стаж ${m.experience} ${m.experience < 5 ? 'года' : 'лет'}</p>
        <p><span class="accent">★ ${m.rating.toFixed(1)}</span> · ${esc(m.specializations.join(', '))}</p>
      </div>
      <span class="check">${icon('check')}</span>
    </button>`).join('');
}

// ---------- Шаг 3 ----------
function renderCalendar() {
  const selected = parseIsoDate(state.date);
  if (!state.month) state.month = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const m = state.month;
  const first = new Date(m.getFullYear(), m.getMonth(), 1);
  const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // понедельник — первый день недели

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span></span>');
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(m.getFullYear(), m.getMonth(), d);
    const iso = isoDate(date);
    const disabled = date < today || date > lastDay;
    cells.push(`<button class="cal-day ${iso === state.date ? 'active' : ''} ${+date === +today ? 'today' : ''}"
      data-day="${iso}" ${disabled ? 'disabled' : ''} aria-label="${formatDate(date, { day: 'numeric', month: 'long' })}">${d}</button>`);
  }
  const prevDisabled = m <= new Date(today.getFullYear(), today.getMonth(), 1);
  const nextDisabled = new Date(m.getFullYear(), m.getMonth() + 1, 1) > lastDay;

  els.calendar.innerHTML = `
    <div class="calendar-head">
      <button class="icon-btn" data-month="-1" ${prevDisabled ? 'disabled' : ''} aria-label="Предыдущий месяц">${icon('chevron-left', 'icon-sm')}</button>
      <b>${m.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '')}</b>
      <button class="icon-btn" data-month="1" ${nextDisabled ? 'disabled' : ''} aria-label="Следующий месяц">${icon('chevron-right', 'icon-sm')}</button>
    </div>
    <div class="calendar-grid">${DOW.map((d) => `<span class="dow">${d}</span>`).join('')}${cells.join('')}</div>`;
}

let slotsRequest = 0;
async function loadSlots() {
  const id = ++slotsRequest;
  els.times.innerHTML = '<div class="skeleton" style="height:200px;width:100%"></div>';
  els.slotsNote.textContent = '';
  try {
    const { slots } = await api.slots(state.masterId, state.date, state.serviceId);
    if (id !== slotsRequest) return;
    if (state.time && !slots.some((s) => s.time === state.time && s.available)) state.time = null;
    els.times.innerHTML = slots.map((s) => `
      <button class="time-btn ${s.time === state.time ? 'active' : ''}" data-time="${s.time}" ${s.available ? '' : 'disabled'}>${s.time}</button>`).join('');
    if (!slots.some((s) => s.available)) els.slotsNote.textContent = 'Свободного времени нет — выберите другой день';
  } catch (err) {
    if (id !== slotsRequest) return;
    els.times.innerHTML = '';
    els.slotsNote.textContent = err.message;
  }
  updateNext();
  renderSummary();
}

// ---------- Итог ----------
function renderSummary() {
  const s = service();
  const m = master();
  const row = (label, value) => `<div class="summary-row"><span>${label}</span><b>${value || '—'}</b></div>`;
  els.summary.innerHTML = `
    ${s ? `<div class="pick-item" style="margin-bottom:10px">${img(s.image, s.name)}<div class="grow"><h4>${esc(s.name)}</h4><p>${formatDuration(s.duration)}</p></div></div>` : ''}
    ${row('Барбершоп', state.shop && esc(state.shop.name))}
    ${row('Адрес', state.shop && esc(state.shop.address))}
    ${row('Мастер', m && esc(m.name))}
    ${row('Дата', state.step >= 3 || state.time ? formatDate(state.date) : '')}
    ${row('Время', state.time)}
    <div class="summary-total"><span class="muted">Итого</span><b>${s ? formatPrice(s.price) : '—'}</b></div>`;
}

// ---------- Отправка ----------
function validateForm() {
  const name = $('#name');
  const phone = $('#phone');
  const errors = {};
  if (name.value.trim().length < 2) errors.name = 'Введите имя';
  const digits = phone.value.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 12) errors.phone = 'Введите номер в формате +7 7XX XXX XX XX';
  ['name', 'phone'].forEach((f) => {
    $(`[data-error="${f}"]`).textContent = errors[f] || '';
    $(`#${f}`).classList.toggle('invalid', Boolean(errors[f]));
  });
  return !Object.keys(errors).length;
}

async function submit() {
  if (els.next.disabled) return;
  if (!validateForm()) return;
  els.next.disabled = true;
  try {
    const booking = await api.createBooking({
      barbershop_id: state.shop.id, master_id: state.masterId, service_id: state.serviceId,
      date: state.date, time: state.time,
      client_name: $('#name').value.trim(), client_phone: $('#phone').value.trim(), comment: $('#comment').value.trim(),
    });
    showSuccess(booking);
  } catch (err) {
    toast(err.message, 'error');
    if (err.status === 409) {
      state.time = null;
      goTo(3);
    }
    els.next.disabled = false;
  }
}

function showSuccess(b) {
  $('#wizard').classList.add('hidden');
  const success = $('#success');
  success.classList.remove('hidden');
  const user = getUser();
  success.innerHTML = `
    <div class="card success-box">
      <div class="success-icon">${icon('check')}</div>
      <h2>Вы записаны!</h2>
      <p class="muted" style="margin:10px 0 24px">Номер записи #${b.id}. Мастер будет ждать вас — пожалуйста, приходите за 5 минут.</p>
      <div class="summary-row"><span>Барбершоп</span><b>${esc(b.barbershop)}, ${esc(b.address)}</b></div>
      <div class="summary-row"><span>Услуга</span><b>${esc(b.service)}</b></div>
      <div class="summary-row"><span>Мастер</span><b>${esc(b.master)}</b></div>
      <div class="summary-row"><span>Дата и время</span><b>${formatDate(b.date)}, ${b.time}</b></div>
      <div class="summary-total"><span class="muted">К оплате в барбершопе</span><b>${formatPrice(b.price)}</b></div>
      <div class="actions">
        ${user ? '<a class="btn btn-primary" href="/pages/account.html">Мои записи</a>' : '<a class="btn btn-primary" href="/pages/login.html?tab=register">Создать аккаунт</a>'}
        <a class="btn btn-outline" href="/">На главную</a>
      </div>
    </div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => burstFrom(success.querySelector('.success-icon'), { count: 22, spread: 140 }), 350);
}

// ---------- События ----------
els.shop.addEventListener('change', () => selectShop(Number(els.shop.value)));

els.services.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-service]');
  if (!btn) return;
  state.serviceId = Number(btn.dataset.service);
  state.time = null;
  renderServices();
  updateNext();
  renderSummary();
});

els.masters.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-master]');
  if (!btn) return;
  state.masterId = Number(btn.dataset.master);
  state.time = null;
  renderMasters();
  updateNext();
  renderSummary();
});

els.calendar.addEventListener('click', (e) => {
  const day = e.target.closest('[data-day]');
  const nav = e.target.closest('[data-month]');
  if (day) {
    state.date = day.dataset.day;
    state.time = null;
    renderCalendar();
    loadSlots();
  } else if (nav) {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() + Number(nav.dataset.month), 1);
    renderCalendar();
  }
});

els.times.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-time]');
  if (!btn) return;
  state.time = btn.dataset.time;
  $$('.time-btn', els.times).forEach((b) => b.classList.toggle('active', b === btn));
  updateNext();
  renderSummary();
});

$('#stepper').addEventListener('click', (e) => {
  const item = e.target.closest('[data-goto]');
  if (item && !item.disabled) goTo(Number(item.dataset.goto));
});

els.back.addEventListener('click', () => goTo(Math.max(1, state.step - 1)));
els.next.addEventListener('click', () => {
  if (state.step === 4) submit();
  else if (stepValid(state.step)) goTo(state.step + 1);
});
els.form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

// ---------- Старт ----------
async function init() {
  const [shops, services] = await Promise.all([api.barbershops({ sort: 'name' }), api.services()]);
  state.shops = shops;
  state.services = services;
  if (!services.some((s) => s.id === state.serviceId)) state.serviceId = null;

  const shopId = intParam('shop') || shops[0]?.id;
  await selectShop(shopId);
  state.masterId = intParam('master');
  if (!master()) state.masterId = null;
  state.time = param('time');
  renderShops();
  renderServices();
  renderMasters();

  const user = getUser();
  if (user) {
    $('#name').value = user.name;
    $('#phone').value = user.phone || '';
  }

  // Открываем самый дальний шаг, для которого уже всё выбрано (переход со страницы барбершопа/мастера).
  let step = 1;
  while (step < 4 && stepValid(step)) step += 1;
  if (step === 4 && !state.time) step = 3;
  goTo(step);
}

init().catch((err) => {
  $('#wizard').innerHTML = emptyState('Не удалось загрузить данные', err.message);
});
