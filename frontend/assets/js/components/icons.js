// SVG-иконки сайта. Исходники — frontend/assets/img/icons/<имя>.svg,
// они собраны в спрайт sprite.svg (scripts/build_icons.py). Цвет и толщина линии — в CSS (.icon).
const SPRITE = '/assets/img/icons/sprite.svg';

export function icon(name, cls = '') {
  const isStar = name === 'star';
  return `<svg class="icon ${isStar ? 'star' : ''} ${cls}" aria-hidden="true" focusable="false"><use href="${SPRITE}#${name}"></use></svg>`;
}
