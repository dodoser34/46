// Каталог магазина: категории, поиск, сортировка.
import { initLayout } from '../components/layout.js';
import { initScenes, layeredScene } from '../components/layers.js';
import { emptyState, productCard, skeletons } from '../components/cards.js';
import { bindAddToCart } from '../components/actions.js';
import { api } from '../core/api.js';
import { cart } from '../core/cart.js';
import { debounce, esc, param, pluralize } from '../core/utils.js';

initLayout({ active: 'shop' });

document.querySelector('[data-scene-slot="shop"]').innerHTML = layeredScene('shop', [
  { text: 'Care', cls: 'el-word', depth: 0.02 },
  { file: 'jar.png', cls: 'el-jar', depth: 0.03, alt: 'Баночка матовой пасты' },
  { file: 'bottle.png', cls: 'el-bottle', depth: 0.06, alt: 'Флакон Hard Wax' },
], { breakout: true });
initScenes();

const state = { category: param('category') || '', q: '', sort: 'popular' };
const grid = document.getElementById('products');
const countEl = document.getElementById('count');
const catEl = document.getElementById('categories');
bindAddToCart(grid);

let requestId = 0;
async function load() {
  const id = ++requestId;
  grid.innerHTML = skeletons(6, 340);
  try {
    const products = await api.products({ category: state.category, q: state.q, sort: state.sort });
    if (id !== requestId) return;
    countEl.textContent = `${products.length} ${pluralize(products.length, 'товар', 'товара', 'товаров')}`;
    grid.innerHTML = products.length
      ? products.map((p) => productCard(p, cart.has(p.id))).join('')
      : emptyState('Ничего не найдено', 'Попробуйте другую категорию или запрос.');
  } catch (err) {
    grid.innerHTML = emptyState('Ошибка загрузки', err.message);
  }
}

function renderCategories(categories) {
  const all = [{ slug: '', name: 'Все товары' }, ...categories];
  catEl.innerHTML = all.map((c) => `<button class="${c.slug === state.category ? 'active' : ''}" data-cat="${esc(c.slug)}">${esc(c.name)}</button>`).join('');
}

catEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cat]');
  if (!btn) return;
  state.category = btn.dataset.cat;
  catEl.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
  history.replaceState(null, '', state.category ? `?category=${state.category}` : location.pathname);
  load();
});

document.getElementById('q').addEventListener('input', debounce((e) => {
  state.q = e.target.value.trim();
  load();
}, 350));

document.getElementById('sort').addEventListener('change', (e) => {
  state.sort = e.target.value;
  load();
});

api.categories().then(renderCategories).catch(() => {});
load();
