const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '../assets/quick-view.js'), 'utf8');

test('Quick View security and currency verification in real browser', async () => {
  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Quick View Test</title>
      </head>
      <body>
        <div id="QuickViewModal" class="quick-view" aria-hidden="true">
          <div class="quick-view__overlay" id="QuickViewOverlay"></div>
          <div class="quick-view__dialog">
            <button class="quick-view__close" id="QuickViewClose">&times;</button>
            <div class="quick-view__body" id="QuickViewBody"></div>
          </div>
        </div>
        <cart-drawer id="CartDrawer"></cart-drawer>
        <script>
          window.theme = {
            currency: 'USD',
            currencySymbol: '$',
            moneyFormat: '\${{amount}}',
            routes: { root: '/', cartAdd: '/cart/add', cart: '/cart' },
            strings: {
              addToCart: 'Add to cart',
              soldOut: 'Sold out',
              adding: 'Adding...'
            }
          };
        </script>
        <script>${source}</script>
      </body>
      </html>
    `;

    await page.setContent(html);

    // 1. Test formatMoney directly in browser
    const moneyTests = await page.evaluate(() => {
      const fn = window.Vespera.QuickView.formatMoney;
      return {
        usd: fn(4800, '${{amount}}'),
        eur: fn(4800, '{{amount_with_comma_separator}} €'),
        gbp: fn(1250, '£{{amount}}'),
        jpy: fn(500000, '¥{{amount_no_decimals}}')
      };
    });

    assert.equal(moneyTests.usd, '$48.00');
    assert.equal(moneyTests.eur, '48,00 €');
    assert.equal(moneyTests.gbp, '£12.50');
    assert.equal(moneyTests.jpy, '¥5,000');

    // 2. Test rendering hostile product data
    const renderResult = await page.evaluate(() => {
      const hostileProduct = {
        id: 999,
        title: 'Hostile <script>alert("xss")</script> & "Dangerous" Title',
        type: 'Body & "Special" <mark>Serum</mark>',
        url: '/products/hostile-test',
        price: 3500,
        description: '<p>A <strong>potent</strong> blend of <em>botanicals</em>.</p>',
        options: [
          {
            name: 'Size & "Volume"',
            values: ['30"ml', '50\'ml', '<bold>100ml</bold>', 'Botanical 🌿 150ml']
          }
        ],
        variants: [
          { id: 9991, title: '30"ml', price: 3500, available: true, options: ['30"ml'] },
          { id: 9992, title: '50\'ml', price: 5500, available: true, options: ['50\'ml'] },
          { id: 9993, title: '<bold>100ml</bold>', price: 9500, available: true, options: ['<bold>100ml</bold>'] },
          { id: 9994, title: 'Botanical 🌿 150ml', price: 13500, available: true, options: ['Botanical 🌿 150ml'] }
        ]
      };

      window.Vespera.QuickView.renderProduct(hostileProduct, null);

      const body = document.getElementById('QuickViewBody');
      const titleLink = document.getElementById('QuickViewTitleLink');
      const category = document.getElementById('QuickViewCategory');
      const chips = Array.from(body.querySelectorAll('.quick-view__chip-btn'));

      return {
        titleText: titleLink ? titleLink.textContent : null,
        titleHtml: titleLink ? titleLink.innerHTML : null,
        categoryText: category ? category.textContent : null,
        categoryHtml: category ? category.innerHTML : null,
        scriptsInBody: body.querySelectorAll('script').length,
        marksInBody: body.querySelectorAll('mark').length,
        boldsInBody: body.querySelectorAll('bold').length,
        chips: chips.map(c => ({
          attrVal: c.getAttribute('data-option-value'),
          textContent: c.textContent.trim(),
          innerHTML: c.innerHTML.trim()
        }))
      };
    });

    // Verify that dangerous tags did not execute or get parsed as HTML tags
    assert.equal(renderResult.titleText, 'Hostile <script>alert("xss")</script> & "Dangerous" Title');
    assert.equal(renderResult.titleHtml, 'Hostile &lt;script&gt;alert("xss")&lt;/script&gt; &amp; "Dangerous" Title');
    assert.equal(renderResult.categoryText, 'Body & "Special" <mark>Serum</mark>');
    assert.equal(renderResult.scriptsInBody, 0);
    assert.equal(renderResult.marksInBody, 0);
    assert.equal(renderResult.boldsInBody, 0);

    // Verify option chips with quotes, tags, apostrophes, Unicode
    assert.equal(renderResult.chips.length, 4);
    assert.equal(renderResult.chips[0].attrVal, '30"ml');
    assert.equal(renderResult.chips[0].textContent, '30"ml');
    assert.equal(renderResult.chips[1].attrVal, "50'ml");
    assert.equal(renderResult.chips[2].attrVal, '<bold>100ml</bold>');
    assert.equal(renderResult.chips[2].textContent, '<bold>100ml</bold>');
    assert.equal(renderResult.chips[3].attrVal, 'Botanical 🌿 150ml');
    assert.equal(renderResult.chips[3].textContent, 'Botanical 🌿 150ml');

    await browser.close();
  } catch (err) {
    console.error('TEST ERROR:', err);
    throw err;
  }
});
