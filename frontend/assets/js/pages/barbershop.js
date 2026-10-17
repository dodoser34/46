// Страница барбершопа: галерея, вкладки, отзывы и виджет быстрой записи.
import { initLayout } from '../components/layout.js';
import { emptyState, favButton, img, masterCard, reviewItem, stars } from '../components/cards.js';
import { bindFavorites } from '../components/actions.js';
import { bindLightbox } from '../components/lightbox.js';
import { createSlotPicker } from '../components/slot-picker.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { api } from '../core/api.js';
import { navigate } from '../core/nav.js';
import { isLoggedIn } from '../core/auth.js';
import { esc, formatDuration, formatPrice, intParam, pluralize } from '../core/utils.js';

initLayout({ active: 'barbershops' });

const shopId = intParam('id');
const main = document.getElementById('main');

function setupTabs() {
  const tabs = document.querySelectorAll('[data-tab]');
  const open = (name) => {
    tabs.forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === name);
      t.setAttribute('aria-selected', String(t.dataset.tab === name));
    });
    document.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
  };
  tabs.forEach((t) => t.addEventListener('click', () => {
    open(t.dataset.tab);
    history.replaceState(null, '', `#${t.dataset.tab}`);
  }));
  const hash = location.hash.slice(1);
  if (hash && document.querySelector(`[data-tab="${hash}"]`)) open(hash);
}

function renderHero(shop) {
  document.title = `${shop.name} — Blind Barber`;
  document.getElementById('hero').innerHTML = `
    ${img(shop.images[0], shop.name, '', { eager: true })}
    <div class="shop-hero-top"><div class="container">
      <a class="icon-btn bordered" href="/pages/barbershops.html" aria-label="Назад к списку">${icon('arrow-left')}</a>
      <div class="group">
        ${favButton(shop).replace('icon-btn', 'icon-btn bordered')}
        <button class="icon-btn bordered" id="share" aria-label="Поделиться">${icon('share')}</button>
      </div>
    </div></div>
    <div class="shop-hero-info"><div class="container">
      <nav class="breadcrumbs"><a href="/">Главная</a><span class="sep">/</span><a href="/pages/barbershops.html">Барбершопы</a><span class="sep">/</span><span>${esc(shop.name)}</span></nav>
      <h1>${esc(shop.name)}</h1>
      <div class="metas">
        ${stars(shop.rating, `${shop.reviews_count} ${pluralize(shop.reviews_count, 'отзыв', 'отзыва', 'отзывов')}`)}
        <span class="meta">${icon('pin')}${esc(shop.city)}, ${esc(shop.address)}</span>
        <span class="meta">${icon('clock')}${shop.open_time} – ${shop.close_time}</span>
      </div>
    </div></div>`;

  document.getElementById('share').addEventListener('click', async () => {
    const data = { title: shop.name, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(location.href);
        toast('Ссылка скопирована');
      }
    } catch { /* пользователь закрыл окно */ }
  });
}

function renderOverview(shop) {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = shop.images.map((src, i) => `
    <button class="ph" data-lightbox="${esc(src)}" data-alt="${esc(shop.name)} — фото ${i + 1}" aria-label="Открыть фото ${i + 1}">
      <img src="${esc(src)}" alt="" loading="lazy">
    </button>`).join('');
  bindLightbox(gallery);
  document.getElementById('description').innerHTML = `
    <p>${esc(shop.description)}</p>
    <p>В команде ${shop.masters.length} мастера. Работаем ежедневно с ${shop.open_time} до ${shop.close_time}, запись онлайн — без звонков и ожидания.</p>`;
}

function renderServices(services) {
  document.getElementById('services-list').innerHTML = services.map((s) => `
    <div class="service-row">
      <div><h4>${esc(s.name)}</h4><p>${esc(s.description)}</p></div>
      <div class="right">
        <div style="text-align:right"><span class="price">${formatPrice(s.price)}</span><br><small class="muted">${formatDuration(s.duration)}</small></div>
        <a class="btn btn-outline btn-sm" href="/pages/booking.html?shop=${shopId}&service=${s.id}">Записаться</a>
      </div>
    </div>`).join('');
}

function renderContacts(shop) {
  const mapUrl = `https://2gis.kz/search/${encodeURIComponent(`${shop.city} ${shop.address}`)}`;
  document.getElementById('contacts').innerHTML = `
    <li>${icon('pin')}<div><small>Адрес</small>${esc(shop.city)}, ${esc(shop.address)}<br><a class="link-arrow" href="${mapUrl}" target="_blank" rel="noopener">Открыть на карте ${icon('arrow-right', 'icon-xs')}</a></div></li>
    <li>${icon('phone')}<div><small>Телефон</small><a href="tel:${shop.phone.replace(/\s/g, '')}">${esc(shop.phone)}</a></div></li>
    <li>${icon('clock')}<div><small>Часы работы</small>Ежедневно ${shop.open_time} – ${shop.close_time}</div></li>`;
}

async function renderReviews(shop) {
  const wrap = document.getElementById('review-form-wrap');
  if (isLoggedIn()) {
    wrap.innerHTML = `
      <form class="card card-pad form-grid" id="review-form" style="margin:24px 0 8px">
        <h3 style="font-size:16px;font-weight:600">Оставить отзыв</h3>
        <div class="form-row">
          <div class="field"><label for="r-rating">Оценка</label>
            <select class="select" id="r-rating" name="rating">
              ${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${'★'.repeat(n)} ${n}</option>`).join('')}
            </select></div>
          <div class="field"><label for="r-master">Мастер</label>
            <select class="select" id="r-master" name="master_id"><option value="">Не указывать</option>
              ${shop.masters.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}
            </select></div>
        </div>
        <div class="field"><label for="r-text">Отзыв</label>
          <textarea class="textarea" id="r-text" name="text" minlength="5" maxlength="1000" required placeholder="Расскажите, как всё прошло"></textarea></div>
        <div><button class="btn btn-primary" type="submit">Отправить</button></div>
      </form>`;
    wrap.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await api.addReview(shopId, {
          rating: Number(f.rating.value), text: f.text.value.trim(),
          master_id: f.master_id.value ? Number(f.master_id.value) : null,
        });
        toast('Спасибо за отзыв!');
        f.reset();
        loadReviews();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  } else {
    wrap.innerHTML = `<p class="muted" style="margin:24px 0 8px"><a class="accent" href="/pages/login.html?next=${encodeURIComponent(location.pathname + location.search + '#reviews')}">Войдите</a>, чтобы оставить отзыв.</p>`;
  }
  loadReviews();
}

async function loadReviews() {
  const reviews = await api.shopReviews(shopId);
  document.getElementById('reviews').innerHTML = reviews.length
    ? reviews.map(reviewItem).join('')
    : emptyState('Пока нет отзывов', 'Станьте первым, кто поделится впечатлениями.');
}

function setupWidget(shop, services) {
  const serviceEl = document.getElementById('w-service');
  const masterEl = document.getElementById('w-master');
  const btn = document.getElementById('w-continue');
  serviceEl.innerHTML = services.map((s) => `<option value="${s.id}">${esc(s.name)} · ${formatPrice(s.price)}</option>`).join('');
  masterEl.innerHTML = shop.masters.map((m) => `<option value="${m.id}">${esc(m.name)} — ${esc(m.title)}</option>`).join('');
  const preset = intParam('service');
  if (preset) serviceEl.value = String(preset);

  let selection = {};
  const picker = createSlotPicker(document.getElementById('picker'), {
    getMaster: () => Number(masterEl.value) || null,
    getService: () => Number(serviceEl.value) || null,
    onChange: (sel) => {
      selection = sel;
      btn.disabled = !sel.time;
    },
  });
  serviceEl.addEventListener('change', picker.reload);
  masterEl.addEventListener('change', picker.reload);

  btn.addEventListener('click', () => {
    const params = new URLSearchParams({
      shop: shop.id, service: serviceEl.value, master: masterEl.value, date: selection.date, time: selection.time,
    });
    navigate(`/pages/booking.html?${params}`);
  });
}

async function init() {
  if (!shopId) throw new Error('Барбершоп не найден');
  const [shop, services] = await Promise.all([api.barbershop(shopId), api.services()]);
  renderHero(shop);
  renderOverview(shop);
  renderServices(services);
  document.getElementById('masters').innerHTML = shop.masters.map(masterCard).join('');
  renderContacts(shop);
  renderReviews(shop);
  setupWidget(shop, services);
  bindFavorites(document.getElementById('hero'));
}

setupTabs();
init().catch((err) => {
  main.innerHTML = `<div class="container">${emptyState('Барбершоп не найден', err.message,
    '<a class="btn btn-primary" href="/pages/barbershops.html">Все барбершопы</a>')}</div>`;
});
