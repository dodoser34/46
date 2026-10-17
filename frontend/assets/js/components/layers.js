// Многослойные главные изображения: фон + отдельные элементы (PNG с прозрачностью) + текстовые слои.
// Каждый слой двигается со своей скоростью — получается параллакс по мыши и прокрутке.
import { esc } from '../core/utils.js';

/**
 * @param {string} name папка в /assets/img/layers/<name>/
 * @param {Array<{file?:string, text?:string, cls?:string, depth?:number, alt?:string}>} elements
 *        слои поверх фона по порядку снизу вверх; `text` — крупная надпись между фоном и фигурой
 * @param {{bg?:string, alt?:string, breakout?:boolean}} options
 *        breakout — элементы могут выходить за границы блока (фон при этом обрезается)
 */
export function layeredScene(name, elements = [], { bg = 'bg.jpg', alt = '', breakout = false } = {}) {
  const base = `/assets/img/layers/${name}`;
  const items = elements.map((el, i) => {
    const depth = el.depth ?? 0.04 * (i + 1);
    if (el.text) {
      return `<span class="layer layer-text ${el.cls || ''}" data-depth="${depth}" aria-hidden="true">${esc(el.text)}</span>`;
    }
    return `<img class="layer layer-el ${el.cls || ''}" src="${base}/${esc(el.file)}" alt="${esc(el.alt || '')}"
      data-depth="${depth}" decoding="async">`;
  }).join('');
  return `
  <div class="scene scene-${esc(name)} ${breakout ? 'scene--breakout' : ''}">
    <div class="scene-clip">
      <div class="ph layer layer-bg" data-depth="0.015"><img src="${base}/${esc(bg)}" alt="${esc(alt)}" decoding="async"></div>
    </div>
    ${items}
  </div>`;
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Включает параллакс для всех сцен на странице. */
export function initScenes(root = document) {
  const scenes = [...root.querySelectorAll('.scene')];
  if (!scenes.length || reduceMotion) return;

  let mouseX = 0;
  let mouseY = 0;
  let frame = null;

  const update = () => {
    frame = null;
    scenes.forEach((scene) => {
      const rect = scene.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      const scroll = (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight; // -1..1
      scene.querySelectorAll('.layer').forEach((layer) => {
        const depth = Number(layer.dataset.depth) || 0;
        const x = mouseX * depth * 100;
        const y = mouseY * depth * 60 + scroll * depth * 220;
        layer.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      });
    });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX / innerWidth - 0.5;
    mouseY = e.clientY / innerHeight - 0.5;
    schedule();
  }, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
  update();
}
