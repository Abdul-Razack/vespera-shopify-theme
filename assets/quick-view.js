/**
 * Aura Theme - Awwwards-Grade Interactive Quick View Engine
 * Vanilla JS, zero dependencies, accessible modal dialog with variant switcher
 */

(function() {
  const modal = document.getElementById('QuickViewModal');
  const overlay = document.getElementById('QuickViewOverlay');
  const closeBtn = document.getElementById('QuickViewClose');
  const bodyEl = document.getElementById('QuickViewBody');

  if (!modal || !bodyEl) return;

  let activeTrigger = null;
  let currentProduct = null;
  let selectedVariant = null;
  let currentQuantity = 1;

  function formatMoney(cents) {
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

  // Close bindings
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });

  // Render product details inside modal
  function renderProduct(product) {
    currentProduct = product;
    selectedVariant = product.variants[0];
    currentQuantity = 1;

    const formattedPrice = formatMoney(selectedVariant.price);
    const hasCompare = selectedVariant.compare_at_price && selectedVariant.compare_at_price > selectedVariant.price;
    const formattedCompare = hasCompare ? formatMoney(selectedVariant.compare_at_price) : '';
    const plainDesc = stripHtml(product.description).slice(0, 180) + '...';
    const mainImgSrc = selectedVariant.featured_image ? selectedVariant.featured_image.src : (product.featured_image || '');

    // Build options markup
    let optionsHtml = '';
    if (product.options && product.options.length > 0 && !(product.options.length === 1 && product.options[0].name === 'Title')) {
      optionsHtml = `
        <div class="quick-view__options">
          ${product.options.map((opt, optIdx) => `
            <div class="quick-view__option-group" data-option-index="${optIdx}">
              <span class="quick-view__option-title">${opt.name}: <strong>${opt.values[0]}</strong></span>
              <div class="quick-view__chips">
                ${opt.values.map((val, valIdx) => `
                  <button 
                    type="button" 
                    class="quick-view__chip-btn ${valIdx === 0 ? 'is-selected' : ''}" 
                    data-option-value="${val}" 
                    data-option-idx="${optIdx}"
                  >
                    ${val}
                  </button>
                `).join('')}
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
              ${selectedVariant.available ? `Add to Bag &bull; <span id="QuickViewBtnPrice">${formattedPrice}</span>` : 'Sold Out'}
            </button>
          </div>

          <a href="${product.url}" class="quick-view__full-details">View Full Formulation &rarr;</a>
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

    // Option Chips Switching
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
            addBtn.innerHTML = `Add to Bag &bull; <span id="QuickViewBtnPrice">${formatted}</span>`;
          } else {
            addBtn.setAttribute('disabled', 'disabled');
            addBtn.textContent = 'Sold Out';
          }

          if (matched.featured_image && mainImg) {
            mainImg.src = matched.featured_image.src;
          }
        }
      });
    });

    // Add to Bag Submission
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        if (!selectedVariant || !selectedVariant.available) return;

        addBtn.setAttribute('disabled', 'disabled');
        addBtn.textContent = 'Adding to Bag...';

        try {
          const res = await fetch('/cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
              items: [{
                id: selectedVariant.id,
                quantity: currentQuantity
              }]
            })
          });

          if (!res.ok) throw new Error('Add to cart failed');

          // Close Quick View
          closeModal();

          // Refresh and Open Cart Drawer
          const cartDrawer = document.querySelector('cart-drawer');
          if (cartDrawer && typeof cartDrawer.refreshDrawer === 'function') {
            await cartDrawer.refreshDrawer();
            cartDrawer.open();
          } else {
            window.location.href = '/cart';
          }
        } catch (err) {
          console.error('Quick View Add Error:', err);
          addBtn.removeAttribute('disabled');
          addBtn.textContent = 'Sold Out or Error';
        }
      });
    }
  }

  // Global delegation for opening Quick View
  document.addEventListener('click', async (e) => {
    const trigger = e.target.closest('[data-quick-view-handle]');
    if (!trigger) return;

    e.preventDefault();
    const handle = trigger.getAttribute('data-quick-view-handle');
    if (!handle) return;

    openModal(trigger);

    try {
      const response = await fetch(`/products/${handle}.js`);
      if (!response.ok) throw new Error('Failed to fetch product data');
      const product = await response.json();
      renderProduct(product);
    } catch (err) {
      console.error('Failed to load Quick View product:', err);
      bodyEl.innerHTML = `
        <div style="padding: 40px; text-align: center;">
          <p style="color: var(--color-text-muted); margin-bottom: 16px;">Unable to load formulation details.</p>
          <button type="button" class="btn-primary" onclick="document.getElementById('QuickViewModal').setAttribute('aria-hidden', 'true'); document.body.style.overflow='';">Close</button>
        </div>
      `;
    }
  });
})();