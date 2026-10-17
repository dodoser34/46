// Переход на другую страницу сайта с анимацией «шторки» (см. motion.css → html::after).
const LEAVE_MS = 380;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function navigate(href, { replace = false } = {}) {
  const go = () => (replace ? location.replace(href) : location.assign(href));
  if (reduceMotion) {
    go();
    return;
  }
  try { sessionStorage.setItem('bb-nav', '1'); } catch { /* приватный режим — без шторки на новой странице */ }
  document.documentElement.classList.add('page-leaving');
  setTimeout(go, LEAVE_MS);
}
