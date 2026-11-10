const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/quick-view.js'), 'utf8');
// Exercise the canonical control handlers, without making network requests.
const controls = source.slice(source.indexOf('  function bindModalControls()'), source.indexOf('  // Global Click Trigger Delegation'));
function element() {
  return {
    handlers: {}, children: [], disabled: false, value: '',
    addEventListener(event, fn) { this.handlers[event] = fn; },
    setAttribute(name, value) { this[name] = value; if (name === 'disabled') this.disabled = true; },
    removeAttribute(name) { delete this[name]; if (name === 'disabled') this.disabled = false; },
    appendChild(child) { this.children.push(child); },
    set textContent(value) { this.value = String(value); this.children = []; },
    get textContent() { return this.value + this.children.map(c => c.textContent).join(''); },
    style: {}
  };
}
function fixture(fetchImpl = async () => ({ ok: true })) {
  const ids = Object.fromEntries(['QuickViewQtyVal', 'QuickViewQtyMinus', 'QuickViewQtyPlus', 'QuickViewAddBtn', 'QuickViewPrice', 'QuickViewComparePrice', 'QuickViewMainImg'].map(id => [id, element()]));
  const variants = [{ id: 1, price: 4800, available: true, options: ['30ml'] }, { id: 2, price: 6800, available: true, options: ['50ml'] }, { id: 3, price: 11200, available: false, options: ['100ml'] }];
  const chips = variants.map(v => {
    const chip = element(); const classes = new Set(v.id === 1 ? ['is-selected'] : []);
    chip.classList = { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n) };
    chip.getAttribute = () => v.options[0];
    chip.querySelector = () => element();
    chip.closest = () => group;
    return chip;
  });
  const group = { querySelectorAll: () => chips, querySelector: selector => selector.includes('is-selected') ? chips.find(c => c.classList.contains('is-selected')) : element() };
  const calls = []; const drawer = { opens: 0, async refreshDrawer() { return true; }, open() { this.opens++; } };
  const context = {
    document: { getElementById: id => ids[id], createElement: element, querySelector: () => drawer },
    bodyEl: { querySelectorAll: selector => selector === '.quick-view__option-group' ? [group] : chips },
    currentProduct: { variants }, selectedVariant: variants[0], currentQuantity: 1,
    getStrings: () => ({ addToCart: 'Add to cart', adding: 'Adding', soldOut: 'Sold out' }),
    formatMoney: cents => '$' + (cents / 100).toFixed(2),
    window: { theme: { routes: { cartAdd: '/fr/cart/add', cart: '/fr/cart' } }, location: {} },
    closeModal() {}, console: { error() {} },
    fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return fetchImpl(); }
  };
  vm.runInNewContext(controls + '\nbindModalControls();', context);
  return { ids, chips, calls, drawer, click: id => ids[id].handlers.click() };
}
test('quantity subtotal increases, decreases and stops at one', () => {
  const f = fixture();
  assert.equal(f.ids.QuickViewAddBtn.textContent, 'Add to cart • $48.00');
  assert.equal(f.ids.QuickViewQtyMinus.disabled, true);
  f.click('QuickViewQtyPlus'); f.click('QuickViewQtyPlus');
  assert.equal(f.ids.QuickViewAddBtn.textContent, 'Add to cart • $144.00');
  f.click('QuickViewQtyMinus');
  assert.equal(f.ids.QuickViewAddBtn.textContent, 'Add to cart • $96.00');
  f.click('QuickViewQtyMinus'); f.click('QuickViewQtyMinus');
  assert.equal(f.ids.QuickViewQtyVal.textContent, '1');
});
test('changing variants preserves quantity and recalculates the subtotal', () => {
  const f = fixture(); f.click('QuickViewQtyPlus'); f.chips[1].handlers.click();
  assert.equal(f.ids.QuickViewPrice.textContent, '$68.00');
  assert.equal(f.ids.QuickViewAddBtn.textContent, 'Add to cart • $136.00');
  f.click('QuickViewQtyPlus');
  assert.equal(f.ids.QuickViewAddBtn.textContent, 'Add to cart • $204.00');
  f.chips[0].handlers.click();
  assert.equal(f.ids.QuickViewAddBtn.textContent, 'Add to cart • $144.00');
});
test('sold-out variant stays disabled when quantity changes and recovers on available selection', () => {
  const f = fixture(); f.chips[2].handlers.click(); f.click('QuickViewQtyPlus');
  assert.equal(f.ids.QuickViewAddBtn.disabled, true);
  assert.equal(f.ids.QuickViewAddBtn.textContent, 'Sold out');
  f.chips[0].handlers.click();
  assert.equal(f.ids.QuickViewAddBtn.disabled, false);
  assert.equal(f.ids.QuickViewAddBtn.textContent, 'Add to cart • $96.00');
});
test('rapid submissions add the selected quantity once and lock variant/quantity changes', async () => {
  let release; const f = fixture(() => new Promise(resolve => { release = () => resolve({ ok: true }); }));
  f.click('QuickViewQtyPlus');
  const pending = f.click('QuickViewAddBtn');
  f.chips[1].handlers.click(); f.click('QuickViewQtyPlus'); await f.click('QuickViewAddBtn');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, '/fr/cart/add.js');
  assert.equal(JSON.stringify(f.calls[0].body), '{"items":[{"id":1,"quantity":2}]}');
  release(); await pending;
  assert.equal(f.drawer.opens, 1);
});
test('rejected add restores the selected subtotal', async () => {
  const f = fixture(async () => ({ ok: false })); f.click('QuickViewQtyPlus');
  await f.click('QuickViewAddBtn');
  assert.equal(f.ids.QuickViewAddBtn.disabled, false);
  assert.equal(f.ids.QuickViewAddBtn.textContent, 'Add to cart • $96.00');
});
