// Всплывающие уведомления.
import { icon } from './icons.js';
import { esc } from '../core/utils.js';

let container;

export function toast(message, type = 'success', timeout = 3500) {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toasts';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.append(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'error' ? 'close' : 'check')}<span>${esc(message)}</span>`;
  container.append(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, timeout);
}
