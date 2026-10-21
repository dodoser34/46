// Страница «О нас».
import { initLayout } from '../components/layout.js';
import { initScenes, layeredScene } from '../components/layers.js';
import { shopCard } from '../components/cards.js';
import { bindFavorites, bindSubscribe } from '../components/actions.js';
import { api } from '../core/api.js';

initLayout({ active: 'about' });

document.querySelector('[data-scene-slot="about"]').innerHTML = layeredScene('about', [
  { text: 'Since 2024', cls: 'el-word', depth: 0.02 },
  { file: 'portrait.webp', cls: 'el-portrait fade-bottom', depth: 0.04, alt: 'Портрет мастера' },
]);
initScenes();

bindSubscribe(document.getElementById('subscribe'));

const shopsEl = document.getElementById('shops');
bindFavorites(shopsEl);

Promise.all([api.barbershops({ sort: 'name' }), api.stats()]).then(([shops, stats]) => {
  shopsEl.innerHTML = shops.map(shopCard).join('');
  document.querySelectorAll('[data-stat]').forEach((el) => {
    if (stats[el.dataset.stat]) el.textContent = stats[el.dataset.stat];
  });
}).catch(() => {});
