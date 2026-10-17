// Профиль мастера.
import { initLayout } from '../components/layout.js';
import { emptyState, img, reviewItem, stars } from '../components/cards.js';
import { bindLightbox } from '../components/lightbox.js';
import { icon } from '../components/icons.js';
import { api } from '../core/api.js';
import { esc, intParam, pluralize } from '../core/utils.js';

initLayout({ active: 'barbershops' });

const root = document.getElementById('master');
const id = intParam('id');

async function init() {
  if (!id) throw new Error('Мастер не найден');
  const [m, reviews] = await Promise.all([api.master(id), api.masterReviews(id)]);
  document.title = `${m.name} — барбер ${m.barbershop_name} — Blind Barber`;

  root.innerHTML = `
    <div>
      <nav class="breadcrumbs">
        <a href="/">Главная</a><span class="sep">/</span>
        <a href="/pages/barbershop.html?id=${m.barbershop_id}">${esc(m.barbershop_name)}</a><span class="sep">/</span>
        <span>Мастера</span>
      </nav>
      <h1>${esc(m.name)}</h1>
      <p class="muted" style="margin:6px 0 12px">${esc(m.title)} · <a class="accent" href="/pages/barbershop.html?id=${m.barbershop_id}">${esc(m.barbershop_name)}</a>, ${esc(m.barbershop_address)}</p>
      ${stars(m.rating, `${m.reviews_count} ${pluralize(m.reviews_count, 'отзыв', 'отзыва', 'отзывов')}`)}

      <div class="master-stats">
        <div class="card"><b>${m.experience}</b><span>${pluralize(m.experience, 'год', 'года', 'лет')} опыта</span></div>
        <div class="card"><b>${m.rating.toFixed(1)}</b><span>средняя оценка</span></div>
        <div class="card"><b>${m.reviews_count}</b><span>отзывов</span></div>
      </div>

      <h2 class="block-title">Специализация</h2>
      <div class="chips">${m.specializations.map((s, i) => `<span class="tag ${i === 0 ? 'accent' : ''}">${esc(s)}</span>`).join('')}</div>

      <h2 class="block-title">О мастере</h2>
      <p class="muted">${esc(m.bio)}</p>

      <h2 class="block-title">Работы мастера</h2>
      <div class="works" id="works">
        ${m.works.map((src, i) => `<button class="ph" data-lightbox="${esc(src)}" data-alt="Работа ${i + 1}" aria-label="Открыть работу ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}
      </div>

      <a class="btn btn-primary btn-block" style="margin-top:28px" href="/pages/booking.html?shop=${m.barbershop_id}&master=${m.id}">
        Записаться к мастеру ${icon('arrow-right')}
      </a>

      <h2 class="block-title">Отзывы</h2>
      <div>${reviews.length ? reviews.map(reviewItem).join('') : '<p class="muted">Отзывов о мастере пока нет.</p>'}</div>
    </div>
    ${img(m.photo, m.name, 'master-photo', { eager: true })}`;
  bindLightbox(document.getElementById('works'));
}

init().catch((err) => {
  root.outerHTML = emptyState('Мастер не найден', err.message, '<a class="btn btn-primary" href="/pages/barbershops.html">К барбершопам</a>');
});
