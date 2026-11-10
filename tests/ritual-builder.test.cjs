const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../assets/ritual-builder.js'), 'utf8');

function fixture(fetchImpl, selections = [{ id: '101', quantity: 1 }, { id: '202', quantity: 1 }], discount = '') {
  let Component;
  const calls = [];
  const drawer = { refreshes: 0, opened: 0, async refreshDrawer() { this.refreshes++; return true; }, open() { this.opened++; } };
  const context = {
    HTMLElement: class {},
    customElements: { get() {}, define(_, value) { Component = value; } },
    window: { location: { pathname: '/fr' } },
    document: { querySelector() { return drawer; } },
    fetch: async (url, options) => { calls.push({ url, body: options ? JSON.parse(options.body) : null }); return fetchImpl(url, options); },
    Intl, Map, Set, AbortController
  };
  vm.runInNewContext(source, context);
  const component = new Component();
  Object.assign(component, {
    dataset: { addUrl: '/fr/cart/add.js', cartUrl: '/fr/cart', updateUrl: '/fr/cart/update.js', discount, adding: 'Adding', success: 'Added', error: 'Failed', uncertain: 'Check cart first', discountNote: 'Check discounts' },
    button: { disabled: false, textContent: 'Add ritual', focus() {} },
    buttonLabel: 'Add ritual', status: { textContent: '' }, cartLink: { hidden: true },
    form: { setAttribute() {}, removeAttribute() {} }, querySelectorAll() { return []; },
    selected() { return selections.map(s => ({ included: s.included !== false, option: { value: s.id, dataset: { quantity: String(s.quantity), available: String(s.available !== false) } } })); },
    update() { this.button.disabled = !!this.busy || !!this.uncertain; }
  });
  return { component, calls, drawer };
}
const ok = data => ({ ok: true, json: async () => data });
test('one localized multi-item request; duplicate variants aggregate, excluded steps stay out', async () => {
  const f = fixture(async () => ok({ sections: { 'cart-drawer': '<cart-drawer />' } }), [{ id: '101', quantity: 1 }, { id: '101', quantity: 2 }, { id: '202', quantity: 1, included: false }]);
  await f.component.add();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, '/fr/cart/add.js');
  assert.deepEqual(f.calls[0].body.items, [{ id: '101', quantity: 3 }]);
  assert.equal(f.calls[0].body.sections_url, '/fr');
  assert.equal(f.drawer.opened, 1);
  assert.equal(f.component.button.disabled, false);
});
test('rapid repeated submissions stay locked while the request is in flight', async () => {
  let release;
  const f = fixture(() => new Promise(resolve => { release = () => resolve(ok({})); }));
  const first = f.component.add();
  await f.component.add(); await f.component.add();
  assert.equal(f.calls.length, 1);
  release(); await first;
  assert.equal(f.drawer.opened, 1);
});
test('transport failure prevents a duplicate retry and exposes the cart link', async () => {
  const f = fixture(async () => { throw new TypeError('Network lost'); });
  await f.component.add(); await f.component.add();
  assert.equal(f.calls.length, 1);
  assert.equal(f.component.button.disabled, true);
  assert.equal(f.component.cartLink.hidden, false);
  assert.equal(f.component.status.textContent, 'Check cart first');
});
test('inventory rejection refreshes cart and does not silently retry a partially fulfilled add', async () => {
  const f = fixture(async () => ({ ok: false, json: async () => ({ description: 'Only 1 available' }) }));
  await f.component.add(); await f.component.add();
  assert.equal(f.calls.length, 1);
  assert.equal(f.drawer.refreshes, 1);
  assert.equal(f.drawer.opened, 0);
  assert.match(f.component.status.textContent, /Only 1 available/);
  assert.equal(f.component.button.disabled, true);
});
test('discount submission preserves existing codes and never changes quoted item prices', async () => {
  const f = fixture(async url => url.endsWith('/cart.js') ? ok({ discount_codes: [{ code: 'WELCOME' }] }) : ok({ sections: {} }), undefined, 'RITUAL');
  await f.component.add();
  assert.equal(f.calls.length, 3);
  assert.equal(f.calls[2].body.discount, 'WELCOME,RITUAL');
  assert.equal(f.component.status.textContent, 'Check discounts');
  assert.equal(f.drawer.opened, 1);
});
test('discount failure does not repeat the successful add', async () => {
  const f = fixture(async url => {
    if (url.endsWith('/cart.js')) return ok({});
    if (url.endsWith('/update.js')) throw new Error('Discount request failed');
    return ok({});
  }, undefined, 'INVALID');
  await f.component.add();
  assert.equal(f.calls.filter(c => c.url.endsWith('/add.js')).length, 1);
  assert.equal(f.drawer.opened, 1);
  assert.equal(f.component.status.textContent, 'Check discounts');
});
test('drawer render failure offers the cart link instead of opening stale contents', async () => {
  const f = fixture(async () => ok({}));
  f.drawer.refreshDrawer = async () => false;
  await f.component.add();
  assert.equal(f.drawer.opened, 0);
  assert.equal(f.component.status.textContent, 'Added');
  assert.equal(f.component.cartLink.hidden, false);
});
