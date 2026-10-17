// Логотип Blind Barber, встроенный в страницу (тот же, что assets/img/brand/logo.svg).
// Встроенная версия использует шрифт сайта и цвет текста (currentColor) — поэтому не подключается как <img>.
const MARK = `
  <g fill="none" stroke="#C08A5B" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 61V26a22 22 0 0 1 44 0v35" stroke-width="1.8"/>
    <path d="M14.5 61V26.5a17.5 17.5 0 0 1 35 0V61" stroke-width=".9" stroke-opacity=".55"/>
    <path d="M5 61h54" stroke-width="1.8"/>
    <path d="M18 34q14 14 28 0" stroke-width="2.2"/>
    <path class="logo-lashes" d="M22.7 37.9 21.3 41.9M27.3 40.2 26.6 45.2M32 41v6M36.7 40.2 37.4 45.2M41.3 37.9 42.7 41.9" stroke-width="1.9"/>
  </g>
  <path class="logo-star" fill="#C08A5B" d="M32 13l1.4 3.6L37 18l-3.6 1.4L32 23l-1.4-3.6L27 18l3.6-1.4z"/>`;

export function logo() {
  return `<svg class="logo-svg" viewBox="0 0 232 64" role="img" aria-label="Blind Barber">
    ${MARK}
    <text x="78" y="26" class="logo-small">BLIND</text>
    <text x="76" y="55" class="logo-big">BARBER</text>
  </svg>`;
}
