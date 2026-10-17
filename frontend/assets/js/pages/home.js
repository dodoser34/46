// Главная страница.
import { initLayout } from '../components/layout.js';
import { layeredScene, initScenes } from '../components/layers.js';
import { serviceCard, shopCard, skeletons } from '../components/cards.js';
import { bindFavorites, bindSubscribe } from '../components/actions.js';
import { api } from '../core/api.js';
import { navigate } from '../core/nav.js';
import { esc } from '../core/utils.js';

initLayout({ active: 'home', transparent: true });

document.querySelector('[data-scene-slot="home"]').innerHTML = layeredScene('home', [
  { text: 'Style', cls: 'el-word', depth: 0.02 },
  { file: 'man.png', cls: 'el-man fade-bottom', depth: 0.05, alt: 'Мужчина в барбер-кресле' },
  { file: 'haze.png', cls: 'el-haze', depth: 0.09 },
], { alt: 'Интерьер барбершопа' });
document.querySelector('[data-scene-slot="shop"]').innerHTML = layeredScene('shop', [
  { text: 'Care', cls: 'el-word', depth: 0.02 },
  { file: 'jar.png', cls: 'el-jar', depth: 0.03, alt: 'Баночка матовой пасты' },
  { file: 'bottle.png', cls: 'el-bottle', depth: 0.06, alt: 'Флакон Hard Wax' },
], { breakout: true });
initScenes();

const shopsEl = document.getElementById('top-shops');
const servicesEl = document.getElementById('services');
shopsEl.innerHTML = skeletons(3, 380);
servicesEl.innerHTML = skeletons(4, 300);
bindFavorites(shopsEl);
bindSubscribe(document.getElementById('subscribe'));

async function load() {
  const [cities, services, shops, stats] = await Promise.all([
    api.cities(), api.services(), api.barbershops({ sort: 'rating' }), api.stats(),
  ]);

  const form = document.getElementById('hero-search');
  form.city.insertAdjacentHTML('beforeend', cities.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join(''));
  form.service.insertAdjacentHTML('beforeend', services.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join(''));

  document.querySelectorAll('[data-stat]').forEach((el) => {
    const value = stats[el.dataset.stat];
    if (value) el.textContent = value;
  });

  shopsEl.innerHTML = shops.slice(0, 3).map(shopCard).join('');
  servicesEl.innerHTML = services.slice(0, 4).map((s) => serviceCard(s)).join('');
}

document.getElementById('hero-search').addEventListener('submit', (e) => {
  e.preventDefault();
  const { city, service } = e.target;
  const params = new URLSearchParams();
  if (city.value) params.set('city', city.value);
  if (service.value) params.set('service', service.value);
  navigate(`/pages/barbershops.html?${params}`);
});

load().catch((err) => {
  shopsEl.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
  servicesEl.innerHTML = '';
});
