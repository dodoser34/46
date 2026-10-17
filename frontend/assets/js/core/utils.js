// Небольшие вспомогательные функции общего назначения.

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Экранирует строку перед вставкой в HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPE[ch]);
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export function param(name) {
  return new URLSearchParams(location.search).get(name);
}

export function intParam(name) {
  const value = Number.parseInt(param(name), 10);
  return Number.isFinite(value) ? value : null;
}

export function formatPrice(value) {
  return `${Number(value).toLocaleString('ru-RU').replace(/,/g, ' ')} ₸`;
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Дата в формате YYYY-MM-DD по локальному времени. */
export function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(value, opts = { day: 'numeric', month: 'long', weekday: 'short' }) {
  const d = typeof value === 'string' ? parseIsoDate(value) : value;
  return d.toLocaleDateString('ru-RU', opts);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export const STATUS_LABELS = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  processing: 'В работе',
  done: 'Выполнена',
  cancelled: 'Отменена',
};

export const ORDER_STATUS_LABELS = {
  new: 'Новый',
  processing: 'В работе',
  done: 'Выполнен',
  cancelled: 'Отменён',
};
