// Повторяющиеся действия на карточках: избранное и добавление в корзину.
import { icon } from './icons.js';
import { toast } from './toast.js';
import { api } from '../core/api.js';
import { isLoggedIn, requireLogin } from '../core/auth.js';
import { cart } from '../core/cart.js';
import { burstFrom, flyToCart } from './motion.js';

export function bindFavorites(root, onToggle = () => {}) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-fav]');
    if (!btn) return;
    e.preventDefault();
    if (!isLoggedIn()) {
      toast('Войдите, чтобы сохранять избранное', 'error');
      setTimeout(requireLogin, 900);
      return;
    }
    btn.disabled = true;
    try {
      const { is_favorite: fav } = await api.toggleFavorite(btn.dataset.fav);
      btn.classList.toggle('active', fav);
      btn.setAttribute('aria-pressed', String(fav));
      btn.setAttribute('aria-label', fav ? 'Убрать из избранного' : 'В избранное');
      if (fav) burstFrom(btn, { count: 10, spread: 50 });
      toast(fav ? 'Добавлено в избранное' : 'Удалено из избранного');
      onToggle(Number(btn.dataset.fav), fav);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

export function bindAddToCart(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add-cart]');
    if (!btn) return;
    e.preventDefault();
    cart.add(Number(btn.dataset.addCart));
    flyToCart(btn, btn.closest('.product-card')?.querySelector('img.is-loaded')?.src);
    btn.classList.add('added');
    btn.innerHTML = icon('check');
    toast('Товар добавлен в корзину');
  });
}

export function bindSubscribe(form) {
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const res = await api.subscribe(input.value.trim());
      toast(res.message);
      form.reset();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}
