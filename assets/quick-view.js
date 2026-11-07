/**
 * Vespera Theme - Interactive Quick View Engine
 * Integrated with Universal Variant Selection & Localization.
 * Complies with Shopify Theme Store: Section 4, 8, 9, 12.
 */

(function() {
  'use strict';

  const modal = document.getElementById('QuickViewModal');
  const overlay = document.getElementById('QuickViewOverlay');
  const closeBtn = document.getElementById('QuickViewClose');
  const bodyEl = document.getElementById('QuickViewBody');

  if (!modal || !bodyEl) return;

  let activeTrigger = null;
  let currentProduct = null;
  let selectedVariant = null;
  let currentQuantity = 1;

  function getStrings() {
    return (window.theme && window.theme.strings) ? window.theme.strings : {
      addToCart: 'Add to Bag',
      soldOut: 'Sold Out',
      unavailable: 'Unavailable',
      adding: 'Adding...',
      viewDetails: 'View full details'
    };
  }

  function formatMoney(cents) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      return window.Shopify.formatMoney(cents, window.theme && window.theme.moneyFormat ? window.theme.moneyFormat : '${{amount}}');
    }
    return '$' + (cents / 100).toFixed(2);
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return tmp.textContent || tmp.innerText || '';
  }

  function openModal(trigger) {
    activeTrigger = trigger;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    bodyEl.innerHTML = `
      <div class="quick-view-modal__spinner-wrap">
        <div class="quick-view-modal__spinner"></div>
      </div>
    `;
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentProduct = null;
    selectedVariant = null;
    currentQuantity = 1;
    if (activeTrigger) {
      activeTrigger.focus();
      activeTrigger = null;
    }
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });

  // Focus trap inside Quick View Modal (F-33)
  modal.addEventListener('keydown', (e) => {
    if (modal.getAttribute('aria-hidden') !== 'false') return;
    if (e.key === 'Tab') {
      const focusable = Array.from(modal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0);

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Render product details inside modal
  function renderProduct(product) {
    currentProduct = product;
    selectedVariant = product.variants.find(v => v.available) || product.variants[0];
    currentQuantity = 1;
    const strings = getStrings();

    const formattedPrice = formatMoney(selectedVariant.price);
    const hasCompare = selectedVariant.compare_at_price && selectedVariant.compare_at_price > selectedVariant.price;
    const formattedCompare = hasCompare ? formatMoney(selectedVariant.compare_at_price) : '';
    const plainDesc = stripHtml(product.description).slice(0, 160) + '...';
    const mainImgSrc = selectedVariant.featured_image ? selectedVariant.featured_image.src : (product.featured_image || '');

    // Build options markup
    let optionsHtml = '';
    if (product.options && product.options.length > 0 && !(product.options.length === 1 && product.options[0].name === 'Title')) {
      optionsHtml = `
        <div class="quick-view__options">
          ${product.options.map((opt, optIdx) => `
            <div class="quick-view__option-group" data-option-index="${optIdx}">
              <span class="quick-view__option-title">${opt.name}: <strong>${selectedVariant.options[optIdx]}</strong></span>
              <div class="quick-view__chips">
                ${opt.values.map(val => {
                  const isSelected = selectedVariant.options[optIdx] === val;
                  // Check if any variant with this option is available
                  const isAvailable = product.variants.some(v => v.options[optIdx] === val && v.available);
                  return `
                    <button 
                      type="button" 
                      class="quick-view__chip-btn ${isSelected ? 'is-selected' : ''} ${!isAvailable ? 'is-sold-out' : ''}" 
                      data-option-value="${val}" 
                      data-option-idx="${optIdx}"
                    >
                      ${val}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    bodyEl.innerHTML = `
      <div class="quick-view__grid">
        <div class="quick-view__media-wrap">
          <img src="${mainImgSrc}" alt="${product.title}" class="quick-view__media-img" id="QuickViewMainImg" loading="lazy">
        </div>
        
        <div class="quick-view__info">
          <span class="quick-view__category">${product.type || 'Botanical Formulation'}</span>
          <h3 class="quick-view__title">
            <a href="${product.url}" class="quick-view__title-link">${product.title}</a>
          </h3>

          <div class="quick-view__prices">
            <span class="quick-view__price" id="QuickViewPrice">${formattedPrice}</span>
            <span class="quick-view__compare-price" id="QuickViewComparePrice" style="${hasCompare ? '' : 'display:none;'}">${formattedCompare}</span>
          </div>

          <p class="quick-view__desc">${plainDesc}</p>

          ${optionsHtml}

          <div class="quick-view__cta-row">
            <div class="quick-view__qty-wrap">
              <button type="button" class="quick-view__qty-btn" id="QuickViewQtyMinus" aria-label="Decrease quantity">&minus;</button>
              <span class="quick-view__qty-val" id="QuickViewQtyVal">1</span>
              <button type="button" class="quick-view__qty-btn" id="QuickViewQtyPlus" aria-label="Increase quantity">&plus;</button>
            </div>

            <button 
              type="button" 
              class="btn-primary quick-view__add-btn" 
              id="QuickViewAddBtn"
              ${selectedVariant.available ? '' : 'disabled="disabled"'}
            >
              ${selectedVariant.available ? `${strings.addToCart} &bull; <span id="QuickViewBtnPrice">${formattedPrice}</span>` : strings.soldOut}
            </button>
          </div>

          <a href="${product.url}" class="quick-view__full-details">${strings.viewDetails} &rarr;</a>
        </div>
      </div>
    `;

    bindModalControls();
  }

  function bindModalControls() {
    const qtyVal = document.getElementById('QuickViewQtyVal');
    const qtyMinus = document.getElementById('QuickViewQtyMinus');
    const qtyPlus = document.getElementById('QuickViewQtyPlus');
    const addBtn = document.getElementById('QuickViewAddBtn');
    const priceEl = document.getElementById('QuickViewPrice');
    const btnPriceEl = document.getElementById('QuickViewBtnPrice');
    const comparePriceEl = document.getElementById('QuickViewComparePrice');
    const mainImg = document.getElementById('QuickViewMainImg');
    const strings = getStrings();

    if (qtyMinus && qtyPlus && qtyVal) {
      qtyMinus.addEventListener('click', () => {
        currentQuantity = Math.max(1, currentQuantity - 1);
        qtyVal.textContent = currentQuantity;
      });
      qtyPlus.addEventListener('click', () => {
        currentQuantity = currentQuantity + 1;
        qtyVal.textContent = currentQuantity;
      });
    }

    // Option Chips Switching with Unavailable Combination Protection (F-31)
    const chips = bodyEl.querySelectorAll('.quick-view__chip-btn');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const group = chip.closest('.quick-view__option-group');
        group.querySelectorAll('.quick-view__chip-btn').forEach(c => c.classList.remove('is-selected'));
        chip.classList.add('is-selected');

        const optTitle = group.querySelector('.quick-view__option-title strong');
        if (optTitle) optTitle.textContent = chip.getAttribute('data-option-value');

        // Find active options
        const selectedOptions = Array.from(bodyEl.querySelectorAll('.quick-view__option-group')).map(g => {
          const selected = g.querySelector('.quick-view__chip-btn.is-selected');
          return selected ? selected.getAttribute('data-option-value') : null;
        });

        const matched = currentProduct.variants.find(v => {
          return v.options.every((val, idx) => val === selectedOptions[idx]);
        });

        if (matched) {
          selectedVariant = matched;
          const formatted = formatMoney(matched.price);
          if (priceEl) priceEl.textContent = formatted;
          if (btnPriceEl) btnPriceEl.textContent = formatted;

          if (matched.compare_at_price && matched.compare_at_price > matched.price) {
            if (comparePriceEl) {
              comparePriceEl.textContent = formatMoney(matched.compare_at_price);
              comparePriceEl.style.display = 'inline';
            }
          } else if (comparePriceEl) {
            comparePriceEl.style.display = 'none';
          }

          if (matched.available) {
            addBtn.removeAttribute('disabled');
            addBtn.innerHTML = `${strings.addToCart} &bull; <span id="QuickViewBtnPrice">${formatted}</span>`;
          } else {
            addBtn.setAttribute('disabled', 'disabled');
            addBtn.textContent = strings.soldOut;
          }

          if (matched.featured_image && mainImg) {
            mainImg.src = matched.featured_image.src;
          }
        } else {
          // Unavailable combination (F-31)
          selectedVariant = null;
          addBtn.setAttribute('disabled', 'disabled');
          addBtn.textContent = strings.unavailable;
          if (priceEl) priceEl.textContent = strings.unavailable;
          if (comparePriceEl) comparePriceEl.style.display = 'none';
        }
      });
    });

    // Add to Cart Submission
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        if (!selectedVariant || !selectedVariant.available) return;

        addBtn.setAttribute('disabled', 'disabled');
        addBtn.textContent = strings.adding;

        try {
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
              items: [{ id: selectedVariant.id, quantity: currentQuantity }]
            })
          });

          if (!response.ok) throw new Error('Add to cart failed');

          // Open cart drawer and refresh
          const drawer = document.querySelector('cart-drawer');
          if (drawer && typeof drawer.refreshDrawer === 'function') {
            await drawer.refreshDrawer();
            closeModal();
            drawer.open();
          } else {
            window.location.href = '/cart';
          }
        } catch (err) {
          console.error('Quick view add error:', err);
          addBtn.removeAttribute('disabled');
          addBtn.textContent = strings.addToCart;
        }
      });
    }
  }

  // Global Click Trigger Delegation
  document.addEventListener('click', async (e) => {
    const trigger = e.target.closest('[data-quick-view-handle]');
    if (!trigger) return;

    e.preventDefault();
    const handle = trigger.getAttribute('data-quick-view-handle');
    if (!handle) return;

    openModal(trigger);

    try {
      const response = await fetch(`/products/${handle}.js`);
      if (!response.ok) throw new Error('Product fetch failed');
      const product = await response.json();
      renderProduct(product);
    } catch (err) {
      console.error('Failed to load quick view:', err);
      bodyEl.innerHTML = `
        <div style="padding: 40px; text-align: center;">
          <p>Failed to load formulation details. Please view full product page.</p>
          <a href="/products/${handle}" class="btn-primary" style="margin-top: 16px;">View Formulation</a>
        </div>
      `;
    }
  });
})();
