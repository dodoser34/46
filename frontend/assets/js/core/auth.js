// Хранение сессии пользователя в localStorage.
import { navigate } from './nav.js';

const DEMO_SCOPE = globalThis.BLIND_BARBER_DEMO ? `demo:${globalThis.BLIND_BARBER_DEMO.basePath}:` : '';
const TOKEN_KEY = `${DEMO_SCOPE}barber_token`;
const USER_KEY = `${DEMO_SCOPE}barber_user`;

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* приватный режим — сессия просто не сохранится */ }
}

export function getToken() {
  return safeGet(TOKEN_KEY);
}

export function getUser() {
  try { return JSON.parse(safeGet(USER_KEY)); } catch { return null; }
}

export function setSession(token, user) {
  safeSet(TOKEN_KEY, token);
  safeSet(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('auth:change'));
}

export function updateUser(user) {
  safeSet(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('auth:change'));
}

export function clearSession() {
  safeSet(TOKEN_KEY, null);
  safeSet(USER_KEY, null);
  window.dispatchEvent(new CustomEvent('auth:change'));
}

export function isLoggedIn() {
  return Boolean(getToken());
}

/** Перенаправляет на страницу входа с возвратом на текущую страницу. */
export function requireLogin() {
  const next = encodeURIComponent(location.pathname + location.search);
  navigate(`/pages/login.html?next=${next}`);
}
