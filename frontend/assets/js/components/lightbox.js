// Просмотр фото на весь экран.
import { icon } from './icons.js';
import { esc } from '../core/utils.js';

export function openLightbox(src, alt = '') {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <button class="icon-btn bordered modal-close" aria-label="Закрыть">${icon('close')}</button>
    <div class="ph lightbox-img"><img src="${esc(src)}" alt="${esc(alt)}"></div>`;
  const close = () => {
    modal.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('.modal-close')) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(modal);
  modal.querySelector('.modal-close').focus();
}

/** Делегирует клики по [data-lightbox] внутри контейнера. */
export function bindLightbox(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lightbox]');
    if (btn) openLightbox(btn.dataset.lightbox, btn.dataset.alt || '');
  });
}
