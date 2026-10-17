// Вход и регистрация.
import { initLayout } from '../components/layout.js';
import { initScenes, layeredScene } from '../components/layers.js';
import { api } from '../core/api.js';
import { navigate } from '../core/nav.js';
import { isLoggedIn, setSession } from '../core/auth.js';
import { param } from '../core/utils.js';

// Возвращаем только на страницы этого же сайта.
const nextRaw = param('next') || '';
const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/pages/account.html';

if (isLoggedIn()) location.replace(next);

initLayout();
document.querySelector('[data-scene-slot="booking"]').innerHTML = layeredScene('booking', [
  { file: 'tools.png', cls: 'el-tools', depth: 0.03, alt: '' },
  { file: 'chair.png', cls: 'el-chair', depth: 0.06, alt: 'Барбер-кресло' },
]);
initScenes();

const form = document.getElementById('auth-form');
const errorEl = document.getElementById('error');
const submitBtn = document.getElementById('submit');
if (globalThis.BLIND_BARBER_DEMO) {
  form.elements.email.placeholder = 'visitor@example.com';
  form.elements.password.autocomplete = 'off';
  const note = document.createElement('p');
  note.className = 'muted';
  note.textContent = 'Учебное демо: для регистрации используйте вымышленный email @example.com и пароль demo123. Не вводите личные данные.';
  form.prepend(note);
}
let mode = 'login';

const TEXT = {
  login: { title: 'С возвращением', sub: 'Войдите, чтобы видеть свои записи, заказы и избранное.', btn: 'Войти' },
  register: { title: 'Создать аккаунт', sub: 'История записей, избранные барбершопы и быстрые повторные записи.', btn: 'Зарегистрироваться' },
};

function setMode(value) {
  mode = value;
  document.querySelectorAll('[data-mode]').forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
  document.querySelectorAll('[data-only="register"]').forEach((el) => el.classList.toggle('hidden', mode !== 'register'));
  document.getElementById('title').textContent = TEXT[mode].title;
  document.getElementById('subtitle').textContent = TEXT[mode].sub;
  submitBtn.textContent = TEXT[mode].btn;
  form.password.autocomplete = globalThis.BLIND_BARBER_DEMO ? 'off' : (mode === 'login' ? 'current-password' : 'new-password');
  errorEl.textContent = '';
}

document.querySelectorAll('[data-mode]').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) {
    errorEl.textContent = 'Заполните email и пароль';
    return;
  }
  if (mode === 'register' && form.name.value.trim().length < 2) {
    errorEl.textContent = 'Введите имя';
    return;
  }
  submitBtn.disabled = true;
  try {
    const res = mode === 'login'
      ? await api.login({ email, password })
      : await api.register({ name: form.name.value.trim(), email, phone: form.phone.value.trim(), password });
    setSession(res.token, res.user);
    navigate(next);
  } catch (err) {
    errorEl.textContent = err.message;
    submitBtn.disabled = false;
  }
});

if (param('tab') === 'register') setMode('register');
