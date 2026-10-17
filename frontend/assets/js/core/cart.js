// Корзина магазина: хранится в localStorage как [{ id, qty }].
// Цены здесь не хранятся — сервер всегда пересчитывает сумму заказа сам.
const DEMO_SCOPE = globalThis.BLIND_BARBER_DEMO ? `demo:${globalThis.BLIND_BARBER_DEMO.basePath}:` : '';
const CART_KEY = `${DEMO_SCOPE}barber_cart`;
const MAX_QTY = 20;

function read() {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY));
    if (!Array.isArray(items)) return [];
    const merged = new Map();
    items.forEach((item) => {
      if (!item || !Number.isInteger(item.id) || item.id < 1 || !Number.isInteger(item.qty) || item.qty < 1) return;
      merged.set(item.id, Math.min(MAX_QTY, (merged.get(item.id) || 0) + item.qty));
    });
    return Array.from(merged, ([id, qty]) => ({ id, qty }));
  } catch {
    return [];
  }
}

function write(items) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* недоступно */ }
  window.dispatchEvent(new CustomEvent('cart:change'));
}

export const cart = {
  items: read,
  count: () => read().reduce((sum, i) => sum + i.qty, 0),
  has: (id) => read().some((i) => i.id === id),

  add(id, qty = 1) {
    const items = read();
    const item = items.find((i) => i.id === id);
    if (item) item.qty = Math.min(MAX_QTY, item.qty + qty);
    else items.push({ id, qty: Math.min(MAX_QTY, qty) });
    write(items);
  },

  setQty(id, qty) {
    const items = read();
    const item = items.find((i) => i.id === id);
    if (!item) return;
    item.qty = Math.max(1, Math.min(MAX_QTY, qty));
    write(items);
  },

  remove(id) {
    write(read().filter((i) => i.id !== id));
  },

  clear() {
    write([]);
  },
};
