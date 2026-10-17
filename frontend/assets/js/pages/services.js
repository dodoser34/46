// Страница услуг и прайс-листа.
import { initLayout } from '../components/layout.js';
import { emptyState, serviceCard, skeletons } from '../components/cards.js';
import { api } from '../core/api.js';
import { esc, formatDuration, formatPrice } from '../core/utils.js';

initLayout({ active: 'services' });

const grid = document.getElementById('services');
const priceList = document.getElementById('price-list');
grid.innerHTML = skeletons(8, 300);

api.services().then((services) => {
  grid.innerHTML = services.map((s) => serviceCard(s)).join('');
  priceList.innerHTML = services.map((s) => `
    <div class="service-row">
      <div><h4>${esc(s.name)}</h4><p>${esc(s.description)}</p></div>
      <div class="right">
        <div style="text-align:right"><span class="price">${formatPrice(s.price)}</span><br><small class="muted">${formatDuration(s.duration)}</small></div>
        <a class="btn btn-outline btn-sm" href="/pages/booking.html?service=${s.id}">Записаться</a>
      </div>
    </div>`).join('');
}).catch((err) => {
  grid.innerHTML = emptyState('Ошибка загрузки', err.message);
});
