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
    return (window.theme && window.theme.strings) ? window.theme.strings : {};
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
    // Pause any playing videos inside the modal
    modal.querySelectorAll('video').forEach(v => {
      try { v.pause(); } catch(err) {}
    });

    // Reset iframe embeds (YouTube / Vimeo)
    modal.querySelectorAll('iframe').forEach(iframe => {
      try {
        const src = iframe.src;
        iframe.src = src;
      } catch(err) {}
    });

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
  function renderProduct(product, galleryEl) {
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
                      ${!isAvailable ? 'aria-disabled="true"' : ''}
                    >
                      <span class="quick-view__chip-text">${val}</span>
                      ${!isAvailable && strings.soldOut ? `<span class="visually-hidden"> — ${strings.soldOut}</span>` : ''}
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
        <div class="quick-view__media-wrap" id="QuickViewMediaWrap">
          <img src="${mainImgSrc}" alt="${product.title}" class="quick-view__media-img" id="QuickViewMainImg" loading="lazy">
        </div>
        
        <div class="quick-view__info">
          <span class="quick-view__category">${product.type || ''}</span>
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
              <button type="button" class="quick-view__qty-btn" id="QuickViewQtyMinus" aria-label="${strings.decreaseQuantity || ''}">&minus;</button>
              <span class="quick-view__qty-val" id="QuickViewQtyVal">1</span>
              <button type="button" class="quick-view__qty-btn" id="QuickViewQtyPlus" aria-label="${strings.increaseQuantity || ''}">&plus;</button>
            </div>

            <button 
              type="button" 
              class="btn-primary quick-view__add-btn" 
              id="QuickViewAddBtn"
              ${selectedVariant.available ? '' : 'disabled="disabled"'}
            >
              ${selectedVariant.available ? `${strings.addToCart || ''} &bull; <span id="QuickViewBtnPrice">${formattedPrice}</span>` : (strings.soldOut || '')}
            </button>
          </div>

          <a href="${product.url}" class="quick-view__full-details">${strings.viewDetails || ''} &rarr;</a>
        </div>
      </div>
    `;

    // Inject Shared Media Gallery (Image, Video, External Video, 3D Model - R4.15)
    const mediaWrap = bodyEl.querySelector('#QuickViewMediaWrap');
    if (mediaWrap && galleryEl) {
      mediaWrap.innerHTML = '';
      mediaWrap.appendChild(galleryEl);

      // Lazy-load official Shopify model-viewer script only if needed
      if (galleryEl.querySelector('model-viewer') && !customElements.get('model-viewer')) {
        if (!document.querySelector('script[src*="model-viewer-ui"]')) {
          const script = document.createElement('script');
          script.type = 'module';
          script.src = 'https://cdn.shopify.com/shopifycloud/model-viewer-ui/assets/v1.0/model-viewer-ui.en.js';
          document.head.appendChild(script);
        }
      }

      // Thumbnail navigation inside quick view gallery
      galleryEl.addEventListener('click', (e) => {
        const thumb = e.target.closest('.product-media-gallery__thumb-btn');
        if (!thumb) return;
        const mediaId = thumb.getAttribute('data-thumbnail-id');
        if (!mediaId) return;

        // Pause any active videos
        galleryEl.querySelectorAll('video').forEach(v => {
          try { v.pause(); } catch(err) {}
        });

        // Toggle active media item
        const items = galleryEl.querySelectorAll('.product-media-gallery__item');
        items.forEach(item => {
          if (item.getAttribute('data-media-id') === mediaId) {
            item.style.display = 'block';
            item.classList.add('is-active');
            item.classList.remove('is-hidden');
          } else {
            item.style.display = 'none';
            item.classList.remove('is-active');
            item.classList.add('is-hidden');
          }
        });

        // Update active thumbnail state
        const thumbs = galleryEl.querySelectorAll('.product-media-gallery__thumb-btn');
        thumbs.forEach(t => {
          if (t === thumb) {
            t.classList.add('is-active');
            t.setAttribute('aria-current', 'true');
          } else {
            t.classList.remove('is-active');
            t.removeAttribute('aria-current');
          }
        });
      });
    }

    bindModalControls();
  }

  function bindModalControls() {
    const qtyVal = document.getElementById('QuickViewQtyVal');
    const qtyMinus = document.getElementById('QuickViewQtyMinus');
    const qtyPlus = document.getElementById('QuickViewQtyPlus');
    const addBtn = document.getElementById('QuickViewAddBtn');
    const priceEl = document.getElementById('QuickViewPrice');
    const comparePriceEl = document.getElementById('QuickViewComparePrice');
    const mainImg = document.getElementById('QuickViewMainImg');
    const strings = getStrings();

    let adding = false;

    function updateAddButton() {
      if (adding) return;
      addBtn.disabled = !selectedVariant || !selectedVariant.available;
      if (!selectedVariant) {
        addBtn.textContent = strings.unavailable || '';
      } else if (!selectedVariant.available) {
        addBtn.textContent = strings.soldOut || '';
      } else {
        addBtn.textContent = `${strings.addToCart || ''} • `;
        const total = document.createElement('span');
        total.id = 'QuickViewBtnPrice';
        total.textContent = formatMoney(selectedVariant.price * currentQuantity);
        addBtn.appendChild(total);
      }
      if (qtyMinus) qtyMinus.disabled = currentQuantity <= 1;
    }

    updateAddButton();
    if (qtyMinus && qtyPlus && qtyVal) {
      qtyMinus.addEventListener('click', () => {
        if (adding) return;
        currentQuantity = Math.max(1, currentQuantity - 1);
        qtyVal.textContent = currentQuantity;
        updateAddButton();
      });
      qtyPlus.addEventListener('click', () => {
        if (adding) return;
        currentQuantity = currentQuantity + 1;
        qtyVal.textContent = currentQuantity;
        updateAddButton();
      });
    }

    // Option Chips Switching with Unavailable Combination Protection (F-31)
    const chips = bodyEl.querySelectorAll('.quick-view__chip-btn');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        if (adding) return;
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

        // Dynamically update availability cues across all chips in modal (F-34)
        bodyEl.querySelectorAll('.quick-view__option-group').forEach((g, gIdx) => {
          g.querySelectorAll('.quick-view__chip-btn').forEach(btn => {
            const vVal = btn.getAttribute('data-option-value');
            const testOpts = [...selectedOptions];
            testOpts[gIdx] = vVal;
            const matchTest = currentProduct.variants.find(v => {
              return v.options.every((optV, i) => testOpts[i] === null || optV === testOpts[i]);
            });
            let vhEl = btn.querySelector('.visually-hidden');
            if (!vhEl) {
              vhEl = document.createElement('span');
              vhEl.className = 'visually-hidden';
              btn.appendChild(vhEl);
            }
            if (!matchTest) {
              btn.classList.add('is-unavailable');
              btn.classList.remove('is-sold-out');
              btn.setAttribute('aria-disabled', 'true');
              vhEl.textContent = strings.unavailable ? ` — ${strings.unavailable}` : '';
            } else if (!matchTest.available) {
              btn.classList.add('is-sold-out');
              btn.classList.remove('is-unavailable');
              btn.setAttribute('aria-disabled', 'true');
              vhEl.textContent = strings.soldOut ? ` — ${strings.soldOut}` : '';
            } else {
              btn.classList.remove('is-sold-out', 'is-unavailable');
              btn.removeAttribute('aria-disabled');
              vhEl.textContent = '';
            }
          });
        });

        if (matched) {
          selectedVariant = matched;
          const formatted = formatMoney(matched.price);
          if (priceEl) priceEl.textContent = formatted;

          if (matched.compare_at_price && matched.compare_at_price > matched.price) {
            if (comparePriceEl) {
              comparePriceEl.textContent = formatMoney(matched.compare_at_price);
              comparePriceEl.style.display = 'inline';
            }
          } else if (comparePriceEl) {
            comparePriceEl.style.display = 'none';
          }

          updateAddButton();

          // Switch matching media item in shared gallery (R4.15)
          if (matched.featured_media && matched.featured_media.id) {
            const galleryEl = bodyEl.querySelector('.product-media-gallery');
            if (galleryEl) {
              const mediaId = String(matched.featured_media.id);
              const items = galleryEl.querySelectorAll('.product-media-gallery__item');
              let found = false;
              items.forEach(item => {
                if (item.getAttribute('data-media-id') === mediaId) {
                  item.style.display = 'block';
                  item.classList.add('is-active');
                  item.classList.remove('is-hidden');
                  found = true;
                } else {
                  item.style.display = 'none';
                  item.classList.remove('is-active');
                  item.classList.add('is-hidden');
                }
              });
              if (found) {
                const thumbs = galleryEl.querySelectorAll('.product-media-gallery__thumb-btn');
                thumbs.forEach(t => {
                  if (t.getAttribute('data-thumbnail-id') === mediaId) {
                    t.classList.add('is-active');
                    t.setAttribute('aria-current', 'true');
                  } else {
                    t.classList.remove('is-active');
                    t.removeAttribute('aria-current');
                  }
                });
              }
            }
          }
          if (matched.featured_image && mainImg) {
            mainImg.src = matched.featured_image.src;
          }
        } else {
          // Unavailable combination (F-31)
          selectedVariant = null;
          updateAddButton();
          if (priceEl) priceEl.textContent = strings.unavailable || '';
          if (comparePriceEl) comparePriceEl.style.display = 'none';
        }
      });
    });

    // Add to Cart Submission
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        if (adding || !selectedVariant || !selectedVariant.available) return;
        adding = true;
        const item = { id: selectedVariant.id, quantity: currentQuantity };

        addBtn.setAttribute('disabled', 'disabled');
        addBtn.textContent = strings.adding || '';

        try {
          const response = await fetch(`${window.theme.routes.cartAdd}.js`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
              items: [item]
            })
          });

          if (!response.ok) throw new Error('Add to cart failed');

          // Open cart drawer and refresh
          const drawer = document.querySelector('cart-drawer');
          if (drawer && typeof drawer.refreshDrawer === 'function') {
            const refreshed = await drawer.refreshDrawer();
            closeModal();
            if (refreshed === false) {
              window.location.href = window.theme.routes.cart;
            } else {
              drawer.open();
            }
          } else {
            window.location.href = window.theme.routes.cart;
          }
        } catch (err) {
          console.error('Quick view add error:', err);
          adding = false;
          updateAddButton();
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
      // Fetch product data and section media gallery in parallel (R4.15)
      const [productRes, sectionRes] = await Promise.all([
        fetch(`/products/${handle}.js`),
        fetch(`/products/${handle}?section_id=main-product`).catch(() => null)
      ]);

      if (!productRes.ok) throw new Error('Product fetch failed');
      const product = await productRes.json();

      let galleryEl = null;
      if (sectionRes && sectionRes.ok) {
        const sectionHtml = await sectionRes.text();
        const doc = new DOMParser().parseFromString(sectionHtml, 'text/html');
        galleryEl = doc.querySelector('.product-media-gallery');
      }

      renderProduct(product, galleryEl);
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
