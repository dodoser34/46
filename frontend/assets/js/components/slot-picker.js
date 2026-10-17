// Компонент выбора даты (полоса из 7 дней) и времени для мастера.
import { icon } from './icons.js';
import { api } from '../core/api.js';
import { addDays, esc, isoDate } from '../core/utils.js';

const HORIZON_DAYS = 30;
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/**
 * @param {HTMLElement} root
 * @param {{ getMaster: () => number|null, getService: () => number|null, onChange?: (sel) => void }} opts
 */
export function createSlotPicker(root, { getMaster, getService, onChange = () => {} }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let weekStart = new Date(today);
  const state = { date: isoDate(today), time: null };
  let requestId = 0;

  root.innerHTML = `
    <div class="date-strip-head">
      <span data-month></span>
      <div class="nav-btns">
        <button class="icon-btn" data-prev aria-label="Предыдущая неделя">${icon('chevron-left', 'icon-sm')}</button>
        <button class="icon-btn" data-next aria-label="Следующая неделя">${icon('chevron-right', 'icon-sm')}</button>
      </div>
    </div>
    <div class="date-strip" data-days></div>
    <div class="time-grid" data-times></div>
    <p class="slots-note" data-note></p>`;

  const daysEl = root.querySelector('[data-days]');
  const timesEl = root.querySelector('[data-times]');
  const noteEl = root.querySelector('[data-note]');
  const monthEl = root.querySelector('[data-month]');
  const last = addDays(today, HORIZON_DAYS);

  function renderDays() {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    monthEl.textContent = days[3].toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
    daysEl.innerHTML = days.map((d) => {
      const iso = isoDate(d);
      const disabled = d < today || d > last;
      return `<button class="day-btn ${iso === state.date ? 'active' : ''}" data-date="${iso}" ${disabled ? 'disabled' : ''}>
        <small>${WEEKDAYS[d.getDay()]}</small><b>${d.getDate()}</b></button>`;
    }).join('');
    root.querySelector('[data-prev]').disabled = weekStart <= today;
    root.querySelector('[data-next]').disabled = addDays(weekStart, 7) > last;
  }

  async function loadSlots() {
    const id = ++requestId;
    const master = getMaster();
    state.time = null;
    onChange({ ...state });
    if (!master) {
      timesEl.innerHTML = '';
      noteEl.textContent = 'Выберите мастера, чтобы увидеть свободное время';
      return;
    }
    timesEl.innerHTML = '<div class="skeleton" style="grid-column:1/-1;height:92px"></div>';
    noteEl.textContent = '';
    try {
      const { slots } = await api.slots(master, state.date, getService());
      if (id !== requestId) return;
      const free = slots.filter((s) => s.available).length;
      timesEl.innerHTML = slots.map((s) => `<button class="time-btn" data-time="${esc(s.time)}"
        ${s.available ? '' : 'disabled aria-label="' + s.time + ' занято"'}>${s.time}</button>`).join('');
      noteEl.textContent = free ? '' : 'На этот день свободного времени нет — выберите другой день';
    } catch (err) {
      if (id !== requestId) return;
      timesEl.innerHTML = '';
      noteEl.textContent = err.message;
    }
  }

  root.addEventListener('click', (e) => {
    const day = e.target.closest('[data-date]');
    const time = e.target.closest('[data-time]');
    if (e.target.closest('[data-prev]')) {
      weekStart = addDays(weekStart, -7);
      if (weekStart < today) weekStart = new Date(today);
      renderDays();
    } else if (e.target.closest('[data-next]')) {
      weekStart = addDays(weekStart, 7);
      renderDays();
    } else if (day) {
      state.date = day.dataset.date;
      renderDays();
      loadSlots();
    } else if (time) {
      state.time = time.dataset.time;
      timesEl.querySelectorAll('.time-btn').forEach((b) => b.classList.toggle('active', b === time));
      onChange({ ...state });
    }
  });

  renderDays();
  loadSlots();

  return {
    reload: loadSlots,
    get value() { return { ...state }; },
  };
}
