// Каталог барбершопов: фильтр по городу, поиск, «рядом со мной», избранное.
import { initLayout } from '../components/layout.js';
import { emptyState, shopRow, skeletons } from '../components/cards.js';
import { bindFavorites } from '../components/actions.js';
import { toast } from '../components/toast.js';
import { api } from '../core/api.js';
import { isLoggedIn, requireLogin } from '../core/auth.js';
import { debounce, esc, param, pluralize } from '../core/utils.js';

initLayout({ active: 'barbershops' });

const listEl = document.getElementById('list');
const countEl = document.getElementById('count');
const cityEl = document.getElementById('city');
const qEl = document.getElementById('q');
const filtersEl = document.getElementById('filters');

const state = {
  city: param('city') || '',
  q: param('q') || '',
  filter: 'all',
  coords: null,
  service: param('service'),
};

let requestId = 0;

async function load() {
  const id = ++requestId;
  listEl.innerHTML = skeletons(4, 150);
  const params = { city: state.city, q: state.q, sort: 'rating' };
  if (state.filter === 'open') params.open_now = true;
  if (state.filter === 'fav') params.favorites = true;
  if (state.filter === 'near' && state.coords) Object.assign(params, { sort: 'distance', ...state.coords });

  try {
    const shops = await api.barbershops(params);
    if (id !== requestId) return;
    countEl.textContent = `Найдено ${shops.length} ${pluralize(shops.length, 'барбершоп', 'барбершопа', 'барбершопов')}`;
    if (!shops.length) {
      const text = state.filter === 'fav' ? 'Добавляйте барбершопы в избранное, нажимая на сердечко.' : 'Попробуйте изменить город или запрос.';
      listEl.innerHTML = emptyState('Ничего не найдено', text);
      return;
    }
    const suffix = state.service ? `&service=${state.service}` : '';
    listEl.innerHTML = shops.map(shopRow).join('').replaceAll(/barbershop\.html\?id=(\d+)/g, `barbershop.html?id=$1${suffix}`);
  } catch (err) {
    listEl.innerHTML = emptyState('Ошибка загрузки', err.message);
  }
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.city) params.set('city', state.city);
  if (state.q) params.set('q', state.q);
  if (state.service) params.set('service', state.service);
  history.replaceState(null, '', `?${params}`);
}

function setFilter(filter) {
  state.filter = filter;
  filtersEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.filter === filter));
  load();
}

filtersEl.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-filter]');
  if (!chip) return;
  const filter = chip.dataset.filter;

  if (filter === 'fav' && !isLoggedIn()) {
    toast('Войдите, чтобы видеть избранное', 'error');
    setTimeout(requireLogin, 900);
    return;
  }
  if (filter === 'near') {
    if (!navigator.geolocation) {
      toast('Браузер не поддерживает геолокацию', 'error');
      return;
    }
    chip.textContent = 'Определяем…';
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        chip.textContent = 'Рядом со мной';
        state.coords = { lat: coords.latitude, lng: coords.longitude };
        state.city = '';
        cityEl.value = '';
        syncUrl();
        setFilter('near');
      },
      () => {
        chip.textContent = 'Рядом со мной';
        toast('Не удалось определить местоположение', 'error');
      },
      { timeout: 8000 },
    );
    return;
  }
  setFilter(filter);
});

cityEl.addEventListener('change', () => {
  state.city = cityEl.value;
  syncUrl();
  load();
});

qEl.addEventListener('input', debounce(() => {
  state.q = qEl.value.trim();
  syncUrl();
  load();
}, 350));

bindFavorites(listEl, (_, fav) => {
  if (state.filter === 'fav' && !fav) load();
});

async function init() {
  qEl.value = state.q;
  const [cities, services] = await Promise.all([api.cities(), api.services()]);
  cityEl.insertAdjacentHTML('beforeend', cities.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join(''));
  cityEl.value = state.city;
  const service = services.find((s) => String(s.id) === state.service);
  if (service) {
    document.getElementById('service-note').innerHTML = `Услуга: <b class="accent">${esc(service.name)}</b> — выберите барбершоп, чтобы записаться.`;
  }
  load();
}

init().catch((err) => { listEl.innerHTML = emptyState('Ошибка загрузки', err.message); });
