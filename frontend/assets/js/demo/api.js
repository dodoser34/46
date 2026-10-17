// Browser-only GitHub Pages demo. No real API, payments, emails or bookings.
// Public demo passwords are intentional; arbitrary credentials are never stored.
import { getToken } from '../core/auth.js';

const VERSION = 1;
const ACTIVE_BOOKINGS = ['new', 'confirmed'];
const BOOKING_STATUSES = [...ACTIVE_BOOKINGS, 'done', 'cancelled'];
const ORDER_STATUSES = ['new', 'processing', 'done', 'cancelled'];
const DEMO_PASSWORD = 'demo123';
let seedPromise;
let memoryState;

function basePath() {
  const path = globalThis.BLIND_BARBER_DEMO?.basePath || '/';
  return `/${path.split('/').filter(Boolean).join('/')}${path === '/' ? '' : '/'}`;
}

function storageKey() { return `demo:${basePath()}:state:v${VERSION}`; }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function assert(condition, message, status = 400) { if (!condition) fail(message, status); }
function find(rows, id, message) {
  const item = rows.find((row) => row.id === Number(id));
  assert(item, message, 404);
  return item;
}
function nextId(rows) { return Math.max(0, ...rows.map((row) => row.id)) + 1; }
function text(value) { return String(value ?? '').trim(); }
function dateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dateAfter(days) {
  const day = new Date();
  day.setDate(day.getDate() + days);
  return dateString(day);
}
function timestamp() {
  const now = new Date();
  return `${dateString(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
function minutes(value) { const [h, m] = value.split(':').map(Number); return h * 60 + m; }
function clock(value) { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
function validName(value) {
  const name = text(value);
  assert(name.length >= 2 && name.length <= 100, 'Введите имя: от 2 до 100 символов', 422);
  return name;
}
function validPhone(value, optional = false) {
  const phone = text(value);
  if (optional && !phone) return '';
  const digits = phone.replace(/\D/g, '');
  assert(/^\+?[0-9\s()\-]{10,20}$/.test(phone) && digits.length >= 10 && digits.length <= 12,
    'Введите корректный номер телефона', 422);
  return phone;
}
function validEmail(value) {
  const email = text(value).toLowerCase();
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254, 'Введите корректный email', 422);
  return email;
}
function boundedText(value, max) {
  const result = text(value);
  assert(result.length <= max, `Не больше ${max} символов`, 422);
  return result;
}
function demoEmail(value) {
  const email = validEmail(value);
  assert(/@(example\.com|demo\.local)$/.test(email),
    'В демо используйте вымышленный email: visitor@example.com или visitor@demo.local', 422);
  return email;
}
function publicUser(user) {
  const { id, name, email, phone, is_admin } = user;
  return { id, name, email, phone, is_admin };
}
function publicBooking(booking) {
  const { user_id, service_id, date_offset, ...result } = booking;
  return result;
}
function publicOrder(order) { const { user_id, ...result } = order; return result; }
function currentUser(state, required = false) {
  const id = state.sessions[getToken()];
  const user = state.users.find((row) => row.id === id);
  if (required) assert(user, 'Войдите в демо-аккаунт', 401);
  return user;
}
function tokenFor(state, user) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const token = `pages-demo-${random}`;
  state.sessions[token] = user.id;
  return { token, user: publicUser(user) };
}
function assetPaths(value) {
  // Keep this data prefix independent of the build-time rewriting of URL literals.
  if (typeof value === 'string') return value.startsWith('/' + 'assets/') ? `${basePath()}${value.slice(1)}` : value;
  if (Array.isArray(value)) return value.map(assetPaths);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, assetPaths(v)]));
  return value;
}

async function loadState() {
  if (!seedPromise) {
    seedPromise = fetch(new URL(`${basePath()}data/demo.json`, globalThis.location.origin))
      .then(async (response) => {
        assert(response.ok, 'Не удалось загрузить данные демо', response.status);
        const seed = await response.json();
        assert(seed.version === VERSION, 'Обновите страницу: версия демо изменилась', 409);
        return seed;
      }).catch((error) => { seedPromise = undefined; throw Object.assign(error, { status: error.status || 0 }); });
  }
  const seed = await seedPromise;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(storageKey())); } catch { /* browser storage unavailable */ }
  if (saved?.version === VERSION && Array.isArray(saved.users) && saved.sessions && saved.products) return assetPaths(saved);
  if (memoryState) return memoryState;
  const state = assetPaths(copy(seed));
  state.sessions = {};
  state.favorites = {};
  state.subscribers = [];
  state.bookings.forEach((booking) => { booking.date = dateAfter(booking.date_offset || 1); });
  memoryState = state;
  return state;
}
function saveState(state) {
  memoryState = state;
  try { localStorage.setItem(storageKey(), JSON.stringify(state)); } catch { /* Keep current-tab demo functional. */ }
}

function shopView(state, shop, user, params = {}) {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  let distance = null;
  if (params.lat !== undefined && params.lng !== undefined && params.lat !== '' && params.lng !== '') {
    const lat = Number(params.lat), lng = Number(params.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const rad = (degrees) => degrees * Math.PI / 180;
      const a = Math.sin(rad(shop.lat - lat) / 2) ** 2
        + Math.cos(rad(lat)) * Math.cos(rad(shop.lat)) * Math.sin(rad(shop.lng - lng) / 2) ** 2;
      distance = Math.round(6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a))) * 10) / 10;
    }
  }
  return { ...shop, is_open: current >= minutes(shop.open_time) && current < minutes(shop.close_time),
    is_favorite: Boolean(user && (state.favorites[user.id] || []).includes(shop.id)), distance_km: distance,
    masters: shop.masters.map((master) => ({ ...master,
      rating: state.masters.find((row) => row.id === master.id)?.rating ?? master.rating,
      reviews_count: state.masters.find((row) => row.id === master.id)?.reviews_count ?? master.reviews_count })) };
}
function checkDay(day) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(day || '') && dateString(new Date(`${day}T12:00:00`)) === day,
    'Укажите корректную дату', 422);
  assert(day >= dateString() && day <= dateAfter(30), 'Запись доступна на ближайшие 30 дней');
}
function slots(state, masterId, day, serviceId, excludeId = null, fixedDuration = null) {
  const master = find(state.masters, masterId, 'Мастер не найден');
  const shop = find(state.barbershops, master.barbershop_id, 'Барбершоп не найден');
  checkDay(day);
  const service = serviceId ? find(state.services, serviceId, 'Услуга не найдена') : null;
  const duration = fixedDuration || service?.duration || 60;
  const busy = state.bookings.filter((booking) => booking.master_id === master.id && booking.date === day
    && ACTIVE_BOOKINGS.includes(booking.status) && booking.id !== excludeId);
  const now = new Date();
  const earliest = day === dateString(now) ? now.getHours() * 60 + now.getMinutes() + 15 : -1;
  const result = [];
  for (let start = minutes(shop.open_time); start + duration <= minutes(shop.close_time); start += 60) {
    result.push({ time: clock(start), available: start >= earliest && busy.every((booking) =>
      start + duration <= minutes(booking.time) || start >= minutes(booking.time) + booking.duration) });
  }
  return { date: day, slots: result };
}
function createBooking(state, body, user) {
  const shop = find(state.barbershops, body.barbershop_id, 'Барбершоп не найден');
  const master = find(state.masters, body.master_id, 'Мастер не найден');
  const service = find(state.services, body.service_id, 'Услуга не найдена');
  assert(master.barbershop_id === shop.id, 'Мастер не работает в этом барбершопе');
  const available = slots(state, master.id, body.date, service.id).slots.find((slot) => slot.time === body.time);
  assert(available, 'Выбрано недопустимое время');
  assert(available.available, 'Это время уже занято, выберите другое', 409);
  const booking = { id: nextId(state.bookings), user_id: user?.id ?? null, barbershop_id: shop.id,
    barbershop: shop.name, address: shop.address, master_id: master.id, master: master.name,
    service_id: service.id, service: service.name, date: body.date, time: body.time,
    duration: service.duration, price: service.price, client_name: validName(body.client_name),
    client_phone: validPhone(body.client_phone), comment: boundedText(body.comment, 500),
    status: 'new', created_at: timestamp() };
  state.bookings.push(booking);
  return publicBooking(booking);
}
function createOrder(state, body, user) {
  assert(Array.isArray(body.items) && body.items.length > 0 && body.items.length <= 50, 'Корзина пуста или слишком велика', 422);
  assert(['pickup', 'courier'].includes(body.delivery), 'Выберите способ доставки', 422);
  const address = boundedText(body.address, 255);
  assert(body.delivery !== 'courier' || address.length >= 5, 'Укажите адрес доставки');
  const quantities = new Map();
  body.items.forEach((item) => {
    assert(Number.isInteger(item.qty) && item.qty >= 1 && item.qty <= 20, 'Количество товара: от 1 до 20', 422);
    quantities.set(Number(item.product_id), (quantities.get(Number(item.product_id)) || 0) + item.qty);
  });
  const items = [...quantities].map(([id, qty]) => {
    const product = find(state.products, id, `Товар #${id} не найден`);
    assert(qty <= 20, 'Не больше 20 единиц одного товара в заказе');
    assert(product.stock >= qty, `«${product.name}»: в наличии только ${product.stock} шт.`, 409);
    return { product_id: id, name: product.name, price: product.price, qty };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const fee = body.delivery === 'courier' && subtotal < 30000 ? 1500 : 0;
  const order = { id: nextId(state.orders), user_id: user?.id ?? null,
    client_name: validName(body.client_name), client_phone: validPhone(body.client_phone),
    delivery: body.delivery, address: body.delivery === 'courier' ? address : '',
    comment: boundedText(body.comment, 500), delivery_fee: fee, total: subtotal + fee,
    status: 'new', created_at: timestamp(), items };
  items.forEach((item) => { find(state.products, item.product_id).stock -= item.qty; });
  state.orders.push(order);
  return publicOrder(order);
}
function setOrderStatus(state, id, status) {
  assert(ORDER_STATUSES.includes(status), 'Недопустимый статус');
  const order = find(state.orders, id, 'Заказ не найден');
  if (order.status === status) return publicOrder(order);
  if (order.status === 'cancelled') order.items.forEach((item) => {
    assert(find(state.products, item.product_id).stock >= item.qty,
      'Нельзя восстановить заказ: недостаточно товара на складе', 409);
  });
  order.items.forEach((item) => {
    if (status === 'cancelled') find(state.products, item.product_id).stock += item.qty;
    else if (order.status === 'cancelled') find(state.products, item.product_id).stock -= item.qty;
  });
  order.status = status;
  return publicOrder(order);
}
function asBoolean(value) { return value === true || value === 'true' || value === 1 || value === '1'; }
function newest(rows) { return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id); }

function dispatch(state, path, method, body, params) {
  const user = currentUser(state);
  const matches = (pattern) => path.match(pattern);
  let match;
  if (path.startsWith('/admin/')) {
    currentUser(state, true);
    assert(user.is_admin, 'Доступно только демо-администратору', 403);
  }
  if (path === '/auth/login' && method === 'POST') {
    const email = validEmail(body.email);
    const account = state.users.find((row) => row.email === email);
    assert(account && body.password === (account.password || DEMO_PASSWORD), 'Неверный email или пароль', 401);
    return tokenFor(state, account);
  }
  if (path === '/auth/register' && method === 'POST') {
    const email = demoEmail(body.email);
    assert(body.password === DEMO_PASSWORD, 'Пароль для вымышленной регистрации в демо: demo123', 422);
    assert(!state.users.some((row) => row.email === email), 'Пользователь с таким email уже существует', 409);
    const account = { id: nextId(state.users), name: validName(body.name), email,
      phone: validPhone(body.phone, true), is_admin: false };
    state.users.push(account);
    return tokenFor(state, account);
  }
  if (path === '/auth/logout' && method === 'POST') { delete state.sessions[getToken()]; return null; }
  if (path === '/auth/me') {
    const account = currentUser(state, true);
    if (method === 'PATCH') { account.name = validName(body.name); account.phone = validPhone(body.phone, true); }
    else assert(method === 'GET', 'Метод не поддерживается', 405);
    return publicUser(account);
  }
  if (path === '/cities' && method === 'GET') return state.cities;
  if (path === '/services' && method === 'GET') return state.services;
  if (path === '/categories' && method === 'GET') return state.categories;
  if (path === '/stats' && method === 'GET') return { barbershops: state.barbershops.length,
    masters: state.masters.length, bookings: state.bookings.length, cities: state.cities.length };
  if (path === '/barbershops' && method === 'GET') {
    let shops = state.barbershops.map((shop) => shopView(state, shop, user, params));
    if (params.city) shops = shops.filter((shop) => shop.city_slug === params.city);
    if (params.q) shops = shops.filter((shop) => `${shop.name} ${shop.address}`.toLowerCase().includes(text(params.q).toLowerCase()));
    if (asBoolean(params.favorites)) shops = shops.filter((shop) => shop.is_favorite);
    if (asBoolean(params.open_now)) shops = shops.filter((shop) => shop.is_open);
    return shops.sort(params.sort === 'name' ? (a, b) => a.name.localeCompare(b.name)
      : params.sort === 'distance' && shops.some((shop) => shop.distance_km !== null) ? (a, b) => a.distance_km - b.distance_km
        : (a, b) => b.rating - a.rating || b.reviews_count - a.reviews_count);
  }
  if ((match = matches(/^\/barbershops\/(\d+)$/)) && method === 'GET')
    return shopView(state, find(state.barbershops, match[1], 'Барбершоп не найден'), user);
  if ((match = matches(/^\/barbershops\/(\d+)\/favorite$/)) && method === 'POST') {
    const account = currentUser(state, true);
    const shop = find(state.barbershops, match[1], 'Барбершоп не найден');
    const ids = state.favorites[account.id] ||= [];
    const index = ids.indexOf(shop.id);
    if (index >= 0) ids.splice(index, 1); else ids.push(shop.id);
    return { is_favorite: index < 0 };
  }
  if ((match = matches(/^\/barbershops\/(\d+)\/reviews$/))) {
    const shop = find(state.barbershops, match[1], 'Барбершоп не найден');
    if (method === 'GET') return newest(state.reviews.filter((review) => review.barbershop_id === shop.id));
    if (method === 'POST') {
      const account = currentUser(state, true);
      const master = body.master_id == null ? null : find(state.masters, body.master_id, 'Мастер не найден');
      assert(!master || master.barbershop_id === shop.id, 'Мастер не работает в этом барбершопе');
      assert(Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5, 'Оценка: от 1 до 5', 422);
      const reviewText = boundedText(body.text, 1000);
      assert(reviewText.length >= 5, 'Отзыв должен содержать минимум 5 символов', 422);
      const review = { id: nextId(state.reviews), barbershop_id: shop.id, master_id: master?.id ?? null,
        author: account.name, rating: body.rating, text: reviewText, created_at: dateString() };
      [shop, master].filter(Boolean).forEach((row) => {
        row.rating = Math.round((row.rating * row.reviews_count + body.rating) / (row.reviews_count + 1) * 10) / 10;
        row.reviews_count += 1;
      });
      state.reviews.push(review);
      return review;
    }
  }
  if ((match = matches(/^\/masters\/(\d+)$/)) && method === 'GET') return find(state.masters, match[1], 'Мастер не найден');
  if ((match = matches(/^\/masters\/(\d+)\/reviews$/)) && method === 'GET')
    return newest(state.reviews.filter((review) => review.master_id === Number(match[1])));
  if ((match = matches(/^\/masters\/(\d+)\/slots$/)) && method === 'GET') return slots(state, match[1], params.date, params.service_id);
  if (path === '/subscribe' && method === 'POST') {
    // Do not retain email addresses even in local storage; only a demo counter.
    demoEmail(body.email);
    state.subscribers.push({ demo: true });
    return { ok: true, message: 'Демо-подписка показана. Письма не отправляются, email не сохранён.' };
  }
  if (path === '/bookings' && method === 'POST') return createBooking(state, body, user);
  if (path === '/me/bookings' && method === 'GET') {
    const account = currentUser(state, true);
    return state.bookings.filter((booking) => booking.user_id === account.id)
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).map(publicBooking);
  }
  if ((match = matches(/^\/me\/bookings\/(\d+)\/cancel$/)) && method === 'POST') {
    const account = currentUser(state, true);
    const booking = find(state.bookings.filter((row) => row.user_id === account.id), match[1], 'Запись не найдена');
    assert(ACTIVE_BOOKINGS.includes(booking.status), 'Эту запись уже нельзя отменить');
    booking.status = 'cancelled';
    return publicBooking(booking);
  }
  if (path === '/products' && method === 'GET') {
    let products = [...state.products];
    if (params.category) products = products.filter((product) => product.category_slug === params.category);
    if (params.q) products = products.filter((product) => `${product.name} ${product.brand} ${product.short}`.toLowerCase().includes(text(params.q).toLowerCase()));
    if (params.ids) { const ids = String(params.ids).split(',').map(Number); products = products.filter((product) => ids.includes(product.id)); }
    const sort = { price_asc: (a, b) => a.price - b.price, price_desc: (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating, popular: (a, b) => b.reviews_count - a.reviews_count };
    return products.sort(sort[params.sort] || sort.popular).map((product) => ({ ...product, in_stock: product.stock > 0 }));
  }
  if ((match = matches(/^\/products\/(\d+)$/)) && method === 'GET') {
    const product = find(state.products, match[1], 'Товар не найден');
    return { ...product, in_stock: product.stock > 0 };
  }
  if (path === '/orders' && method === 'POST') return createOrder(state, body, user);
  if (path === '/me/orders' && method === 'GET') {
    const account = currentUser(state, true);
    return newest(state.orders.filter((order) => order.user_id === account.id)).map(publicOrder);
  }
  if (path === '/admin/summary' && method === 'GET') return {
    bookings_today: state.bookings.filter((booking) => booking.date === dateString() && booking.status !== 'cancelled').length,
    bookings_new: state.bookings.filter((booking) => booking.status === 'new').length,
    orders_new: state.orders.filter((order) => order.status === 'new').length,
    revenue_orders: state.orders.filter((order) => order.status === 'done').reduce((sum, order) => sum + order.total, 0),
    users: state.users.length, subscribers: state.subscribers.length,
  };
  if (path === '/admin/bookings' && method === 'GET') return state.bookings.filter((booking) =>
    (!params.day || booking.date === params.day) && (!params.status_filter || booking.status === params.status_filter))
    .sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time)).map(publicBooking);
  if ((match = matches(/^\/admin\/bookings\/(\d+)$/)) && method === 'PATCH') {
    assert(BOOKING_STATUSES.includes(body.status), 'Недопустимый статус');
    const booking = find(state.bookings, match[1], 'Запись не найдена');
    if (ACTIVE_BOOKINGS.includes(body.status) && !ACTIVE_BOOKINGS.includes(booking.status)) {
      const available = slots(state, booking.master_id, booking.date, booking.service_id, booking.id, booking.duration)
        .slots.some((slot) => slot.time === booking.time && slot.available);
      assert(available, 'Нельзя восстановить запись: время уже занято или недоступно', 409);
    }
    booking.status = body.status;
    return publicBooking(booking);
  }
  if (path === '/admin/orders' && method === 'GET') return newest(state.orders).map(publicOrder);
  if ((match = matches(/^\/admin\/orders\/(\d+)$/)) && method === 'PATCH') return setOrderStatus(state, match[1], body.status);
  fail('Страница демо API не найдена', 404);
}

/** Same contract as core/api.js request(), with changes isolated to this browser. */
export async function demoRequest(path, { method = 'GET', body, params } = {}) {
  const url = new URL(path, 'https://demo.invalid');
  const query = Object.fromEntries(url.searchParams);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query[key] = value;
  });
  const state = copy(await loadState());
  const verb = method.toUpperCase();
  const result = dispatch(state, url.pathname.replace(/\/$/, '') || '/', verb, body || {}, query);
  if (verb !== 'GET') saveState(state);
  return copy(result);
}
