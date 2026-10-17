// HTTP-клиент для REST API бэкенда.
import { getToken, clearSession } from './auth.js';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function errorMessage(data, status) {
  const detail = data && data.detail;
  if (typeof detail === 'string') return detail;
  // Ошибки валидации Pydantic приходят списком.
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d) => (d.msg || '').replace(/^Value error, /, '')).join('. ');
  }
  if (status === 0) return 'Нет соединения с сервером';
  return 'Что-то пошло не так. Попробуйте ещё раз';
}

export async function request(path, { method = 'GET', body, params } = {}) {
  if (globalThis.BLIND_BARBER_DEMO) {
    const { demoRequest } = await import('../demo/api.js');
    try {
      return await demoRequest(path, { method, body, params });
    } catch (error) {
      if (error.status === 401 && getToken()) clearSession();
      throw new ApiError(error.message || 'Не удалось выполнить действие в демо', error.status || 400);
    }
  }
  const url = new URL(API_BASE + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(errorMessage(null, 0), 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) clearSession();
    throw new ApiError(errorMessage(data, res.status), res.status);
  }
  return data;
}

export const api = {
  // Авторизация
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  updateMe: (body) => request('/auth/me', { method: 'PATCH', body }),

  // Каталог
  cities: () => request('/cities'),
  services: () => request('/services'),
  stats: () => request('/stats'),
  barbershops: (params) => request('/barbershops', { params }),
  barbershop: (id) => request(`/barbershops/${id}`),
  shopReviews: (id) => request(`/barbershops/${id}/reviews`),
  addReview: (id, body) => request(`/barbershops/${id}/reviews`, { method: 'POST', body }),
  toggleFavorite: (id) => request(`/barbershops/${id}/favorite`, { method: 'POST' }),
  master: (id) => request(`/masters/${id}`),
  masterReviews: (id) => request(`/masters/${id}/reviews`),
  slots: (masterId, date, serviceId) => request(`/masters/${masterId}/slots`, { params: { date, service_id: serviceId } }),
  subscribe: (email) => request('/subscribe', { method: 'POST', body: { email } }),

  // Запись
  createBooking: (body) => request('/bookings', { method: 'POST', body }),
  myBookings: () => request('/me/bookings'),
  cancelBooking: (id) => request(`/me/bookings/${id}/cancel`, { method: 'POST' }),

  // Магазин
  categories: () => request('/categories'),
  products: (params) => request('/products', { params }),
  product: (id) => request(`/products/${id}`),
  createOrder: (body) => request('/orders', { method: 'POST', body }),
  myOrders: () => request('/me/orders'),

  // Администратор
  admin: {
    summary: () => request('/admin/summary'),
    bookings: (params) => request('/admin/bookings', { params }),
    setBookingStatus: (id, status) => request(`/admin/bookings/${id}`, { method: 'PATCH', body: { status } }),
    orders: () => request('/admin/orders'),
    setOrderStatus: (id, status) => request(`/admin/orders/${id}`, { method: 'PATCH', body: { status } }),
  },
};
