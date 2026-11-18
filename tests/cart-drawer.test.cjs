const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const cartDrawerJs = fs.readFileSync(path.join(__dirname, '../assets/cart-drawer.js'), 'utf8');

test('Cart Drawer: Serialized mutation queue and rapid double-click handling', async (t) => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  t.after(() => browser.close());
  const page = await browser.newPage();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Cart Drawer Serialized Queue Test</title>
    </head>
    <body>
      <cart-drawer id="CartDrawer" class="cart-drawer">
        <div class="cart-drawer__overlay" data-cart-drawer-overlay></div>
        <div class="cart-drawer__dialog">
          <button class="cart-drawer__close" data-cart-drawer-close aria-label="Close cart">&times;</button>
          <div class="cart-drawer__body" data-cart-items-container>
            <div class="cart-drawer__error-message" role="alert" aria-live="assertive" data-cart-drawer-error hidden></div>
            <div class="cart-drawer-item" data-line-item-key="item_soap_123">
              <span class="cart-drawer__item-title">Botanical Solid Soap</span>
              <div class="cart-drawer__qty-wrap">
                <button type="button" class="cart-drawer__qty-btn" data-qty-change="-1" aria-label="Decrease">&minus;</button>
                <span class="cart-drawer__qty-value">2</span>
                <button type="button" class="cart-drawer__qty-btn" data-qty-change="1" aria-label="Increase">&plus;</button>
              </div>
              <button type="button" class="cart-drawer__item-remove" data-cart-item-remove aria-label="Remove">Remove</button>
            </div>
          </div>
        </div>
      </cart-drawer>
      <script>
        window.theme = {
          currency: 'USD',
          moneyFormat: '\${{amount}}',
          routes: { root: '/', cart: '/cart', cartChange: '/cart/change' },
          strings: {
            cartError: 'Unable to update cart. Please try again.'
          }
        };
      </script>
      <script>${cartDrawerJs}</script>
    </body>
    </html>
  `;

  await page.setContent(html);

  // Set up mock fetch to record mutation requests
  const results = await page.evaluate(async () => {
    const drawer = document.getElementById('CartDrawer');
    const calls = [];
    let resolveFirstChange;

    window.fetch = async (url, options) => {
      const body = options && options.body ? JSON.parse(options.body) : {};
      calls.push({ url, body });

      if (url.includes('/cart/change')) {
        // Delay first request slightly to verify serialized queue processing
        if (calls.length === 1 && resolveFirstChange === undefined) {
          await new Promise(r => { resolveFirstChange = r; setTimeout(r, 60); });
        }
        const renderedHtml = '<div class="cart-drawer__error-message" role="alert" aria-live="assertive" data-cart-drawer-error hidden></div>' +
          '<div class="cart-drawer-item" data-line-item-key="item_soap_123">' +
            '<span class="cart-drawer__item-title">Botanical Solid Soap</span>' +
            '<div class="cart-drawer__qty-wrap">' +
              '<button type="button" class="cart-drawer__qty-btn" data-qty-change="-1" aria-label="Decrease">&minus;</button>' +
              '<span class="cart-drawer__qty-value">' + body.quantity + '</span>' +
              '<button type="button" class="cart-drawer__qty-btn" data-qty-change="1" aria-label="Increase">&plus;</button>' +
            '</div>' +
            '<button type="button" class="cart-drawer__item-remove" data-cart-item-remove aria-label="Remove">Remove</button>' +
          '</div>';

        return {
          ok: true,
          json: async () => ({
            items: [{ key: body.id, quantity: body.quantity }],
            item_count: body.quantity,
            sections: {
              'cart-drawer': '<cart-drawer>' + renderedHtml + '</cart-drawer>'
            }
          })
        };
      }
      return { ok: true, json: async () => ({}) };
    };

    // Simulate rapid double click on plus button (+1, +1 => quantity 2 -> 4)
    const plusBtn = drawer.querySelector('[data-qty-change="1"]');
    plusBtn.click();
    plusBtn.click();

    // Check tracked quantity immediately
    const immediateTarget = drawer._targetQuantities.get('item_soap_123');

    // Wait for the mutation queue to complete
    while (drawer._isProcessingQueue) {
      await new Promise(r => setTimeout(r, 20));
    }

    const finalVal = drawer.querySelector('.cart-drawer__qty-value').innerText.trim();

    return {
      immediateTarget,
      calls,
      finalVal
    };
  });

  // Verify that immediate target was 4 (tracked cumulatively, not dropped)
  assert.equal(results.immediateTarget, 4);
  // Verify final displayed quantity is 4
  assert.equal(results.finalVal, '4');
  // Verify that change requests culminated in quantity 4
  const lastCall = results.calls[results.calls.length - 1];
  assert.equal(lastCall.body.quantity, 4);

  await browser.close();
});

for (const errorKind of ['inventory', 'network']) {
test(`Cart Drawer: ${errorKind} rejection announces error after restoring state`, async (t) => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  t.after(() => browser.close());
  const page = await browser.newPage();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Cart Drawer Error Test</title>
    </head>
    <body>
      <cart-drawer id="CartDrawer" class="cart-drawer">
        <div class="cart-drawer__body" data-cart-items-container>
          <div class="cart-drawer__error-message" role="alert" aria-live="assertive" data-cart-drawer-error hidden></div>
          <div class="cart-drawer-item" data-line-item-key="item_soap_123">
            <span class="cart-drawer__qty-value">2</span>
            <button type="button" class="cart-drawer__qty-btn" data-qty-change="1">&plus;</button>
          </div>
        </div>
      </cart-drawer>
      <script>
        window.theme = {
          currency: 'USD',
          moneyFormat: '\${{amount}}',
          routes: { root: '/', cart: '/cart', cartChange: '/cart/change' }
        };
      </script>
      <script>${cartDrawerJs}</script>
    </body>
    </html>
  `;

  await page.setContent(html);

  const errorResult = await page.evaluate(async (errorKind) => {
    const drawer = document.getElementById('CartDrawer');

    // Simulate 422 inventory cap reached
    window.fetch = async (url) => {
      if (url.includes('/cart/change')) {
        if (errorKind === 'network') throw new Error('QA network unavailable');
        return {
          ok: false,
          status: 422,
          json: async () => ({
            status: 422,
            message: 'You cannot add more Botanical Solid Soap to the cart.',
            description: 'All 2 items are already in your cart.'
          })
        };
      }
      if (url.endsWith('/cart.js')) return { ok: true, json: async () => ({ item_count: 2 }) };
      const renderedHtml = '<div class="cart-drawer__error-message" role="alert" aria-live="assertive" data-cart-drawer-error hidden></div>' +
        '<div class="cart-drawer-item" data-line-item-key="item_soap_123">' +
          '<span class="cart-drawer__qty-value">2</span>' +
          '<button type="button" class="cart-drawer__qty-btn" data-qty-change="1">&plus;</button>' +
        '</div>';
      return {
        ok: true,
        text: async () => '<cart-drawer>' + renderedHtml + '</cart-drawer>'
      };
    };

    const plusBtn = drawer.querySelector('[data-qty-change="1"]');
    plusBtn.click();

    while (drawer._isProcessingQueue) {
      await new Promise(r => setTimeout(r, 20));
    }

    const errorEl = drawer.querySelector('[data-cart-drawer-error]');
    return {
      errorHidden: errorEl ? errorEl.hidden : null,
      errorText: errorEl ? errorEl.textContent.trim() : null,
      restoredQuantity: drawer.querySelector('.cart-drawer__qty-value').textContent.trim(),
      pendingTargetExists: drawer._targetQuantities.has('item_soap_123')
    };
  }, errorKind);

  // Verify that error is announced via live region
  assert.equal(errorResult.restoredQuantity, '2');
  assert.equal(errorResult.errorHidden, false);
  assert.match(errorResult.errorText, errorKind === 'network' ? /QA network unavailable/ : /already in your cart/);
  // Verify pending target was cleared so subsequent interactions start clean
  assert.equal(errorResult.pendingTargetExists, false);

  await browser.close();
});

}
