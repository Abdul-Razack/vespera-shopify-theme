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
  let productRequest = 0;
  let currentProduct = null;
  let selectedVariant = null;
  let currentQuantity = 1;

  function getStrings() {
    return (window.theme && window.theme.strings) ? window.theme.strings : {};
  }

  /**
   * Shopify-aware currency and money formatter.
   * Respects shop.money_format, active currency formats, and never falls back to hardcoded $.
   */
  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    cents = parseInt(cents, 10);
    if (isNaN(cents)) return '';

    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      const moneyFormat = format || (window.theme && window.theme.moneyFormat) || '${{amount}}';
      return window.Shopify.formatMoney(cents, moneyFormat);
    }

    const formatString = format || (window.theme && window.theme.moneyFormat) || '${{amount}}';
    function defaultOption(opt, def) {
      return (typeof opt === 'undefined' ? def : opt);
    }
    function formatWithDelimiters(number, precision, thousands, decimal) {
      precision = defaultOption(precision, 2);
      thousands = defaultOption(thousands, ',');
      decimal = defaultOption(decimal, '.');
      if (isNaN(number) || number == null) return '0';
      const numStr = (number / 100.0).toFixed(precision);
      const parts = numStr.split('.');
      const dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
      const centsPart = parts[1] ? (decimal + parts[1]) : '';
      return dollars + centsPart;
    }

    const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
    const match = formatString.match(placeholderRegex);
    if (!match) {
      const symbol = (window.theme && window.theme.currencySymbol) || '$';
      return symbol + (cents / 100).toFixed(2);
    }

    let value = '';
    switch (match[1]) {
      case 'amount':
        value = formatWithDelimiters(cents, 2);
        break;
      case 'amount_no_decimals':
        value = formatWithDelimiters(cents, 0);
        break;
      case 'amount_with_comma_separator':
        value = formatWithDelimiters(cents, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        value = formatWithDelimiters(cents, 0, '.', ',');
        break;
      case 'amount_with_space_separator':
        value = formatWithDelimiters(cents, 2, ' ', ',');
        break;
      case 'amount_no_decimals_with_space_separator':
        value = formatWithDelimiters(cents, 0, ' ', ',');
        break;
      case 'amount_with_apostrophe_separator':
        value = formatWithDelimiters(cents, 2, "'", '.');
        break;
      default:
        value = formatWithDelimiters(cents, 2);
    }
    return formatString.replace(placeholderRegex, value);
  }

  function stripHtml(html) {
    if (!html) return '';
    const spaced = html
      .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, ' ')
      .replace(/<(br|hr)\s*\/?>/gi, ' ');
    const tmp = document.createElement('div');
    tmp.innerHTML = spaced;
    const text = tmp.textContent || tmp.innerText || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  function formatExcerpt(html, maxLength = 160) {
    const text = stripHtml(html);
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
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
    productRequest++;
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
  if (modal) {
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
  }

  // Render product details inside modal using context-safe DOM construction
  function renderProduct(product, galleryEl) {
    currentProduct = product;
    selectedVariant = product.variants.find(v => v.available) || product.variants[0];
    currentQuantity = 1;
    const strings = getStrings();

    const formattedPrice = formatMoney(selectedVariant.price);
    const hasCompare = selectedVariant.compare_at_price && selectedVariant.compare_at_price > selectedVariant.price;
    const formattedCompare = hasCompare ? formatMoney(selectedVariant.compare_at_price) : '';
    const plainDesc = formatExcerpt(product.description, 160);
    const mainImgSrc = selectedVariant.featured_image ? selectedVariant.featured_image.src : (product.featured_image || '');

    // Clear and build static structural layout
    bodyEl.innerHTML = `
      <div class="quick-view__grid">
        <div class="quick-view__media-wrap" id="QuickViewMediaWrap">
          <img class="quick-view__media-img" id="QuickViewMainImg" loading="lazy">
        </div>
        
        <div class="quick-view__info">
          <span class="quick-view__category" id="QuickViewCategory"></span>
          <h3 class="quick-view__title">
            <a class="quick-view__title-link" id="QuickViewTitleLink"></a>
          </h3>

          <div class="quick-view__prices">
            <span class="quick-view__price" id="QuickViewPrice"></span>
            <span class="quick-view__compare-price" id="QuickViewComparePrice" style="display:none;"></span>
          </div>

          <p class="quick-view__desc" id="QuickViewDesc"></p>

          <div class="quick-view__options" id="QuickViewOptions"></div>

          <div class="quick-view__cta-row">
            <div class="quick-view__qty-wrap">
              <button type="button" class="quick-view__qty-btn" id="QuickViewQtyMinus">&minus;</button>
              <span class="quick-view__qty-val" id="QuickViewQtyVal">1</span>
              <button type="button" class="quick-view__qty-btn" id="QuickViewQtyPlus">&plus;</button>
            </div>

            <button type="button" class="btn-primary quick-view__add-btn" id="QuickViewAddBtn"></button>
          </div>

          <p id="QuickViewCartError" role="alert" hidden></p>
          <a class="quick-view__full-details" id="QuickViewFullDetails"></a>
        </div>
      </div>
    `;

    // Safely assign catalog text via textContent and DOM attributes (immune to quotes, ampersands, and HTML tags)
    const mainImg = bodyEl.querySelector('#QuickViewMainImg');
    if (mainImg) {
      mainImg.src = mainImgSrc;
      mainImg.alt = product.title || '';
    }

    const catEl = bodyEl.querySelector('#QuickViewCategory');
    if (catEl) catEl.textContent = product.type || '';

    const titleLink = bodyEl.querySelector('#QuickViewTitleLink');
    if (titleLink) {
      titleLink.textContent = product.title || '';
      titleLink.href = product.url || '#';
    }

    const priceEl = bodyEl.querySelector('#QuickViewPrice');
    if (priceEl) priceEl.textContent = formattedPrice;

    const comparePriceEl = bodyEl.querySelector('#QuickViewComparePrice');
    if (comparePriceEl) {
      if (hasCompare) {
        comparePriceEl.textContent = formattedCompare;
        comparePriceEl.style.display = 'inline';
      } else {
        comparePriceEl.style.display = 'none';
      }
    }

    const descEl = bodyEl.querySelector('#QuickViewDesc');
    if (descEl) descEl.textContent = plainDesc;

    const fullDetailsEl = bodyEl.querySelector('#QuickViewFullDetails');
    if (fullDetailsEl) {
      fullDetailsEl.textContent = (strings.viewDetails || 'View details') + ' \u2192';
      fullDetailsEl.href = product.url || '#';
    }

    const minusBtn = bodyEl.querySelector('#QuickViewQtyMinus');
    if (minusBtn) minusBtn.setAttribute('aria-label', strings.decreaseQuantity || 'Decrease quantity');

    const plusBtn = bodyEl.querySelector('#QuickViewQtyPlus');
    if (plusBtn) plusBtn.setAttribute('aria-label', strings.increaseQuantity || 'Increase quantity');

    // Safe options construction
    const optionsContainer = bodyEl.querySelector('#QuickViewOptions');
    if (optionsContainer && product.options && product.options.length > 0 && !(product.options.length === 1 && product.options[0].name === 'Title')) {
      product.options.forEach((opt, optIdx) => {
        const group = document.createElement('div');
        group.className = 'quick-view__option-group';
        group.setAttribute('data-option-index', String(optIdx));

        const optTitle = document.createElement('span');
        optTitle.className = 'quick-view__option-title';
        optTitle.textContent = opt.name + ': ';
        const strongVal = document.createElement('strong');
        strongVal.textContent = (selectedVariant.options && selectedVariant.options[optIdx]) ? selectedVariant.options[optIdx] : '';
        optTitle.appendChild(strongVal);
        group.appendChild(optTitle);

        const chipsWrap = document.createElement('div');
        chipsWrap.className = 'quick-view__chips';

        if (Array.isArray(opt.values)) {
          opt.values.forEach(val => {
            const isSelected = selectedVariant.options && selectedVariant.options[optIdx] === val;
            const isAvailable = product.variants.some(v => v.options[optIdx] === val && v.available);

            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = `quick-view__chip-btn ${isSelected ? 'is-selected' : ''} ${!isAvailable ? 'is-sold-out' : ''}`;
            chip.setAttribute('data-option-value', val);
            chip.setAttribute('data-option-idx', String(optIdx));
            if (!isAvailable) chip.setAttribute('aria-disabled', 'true');

            const textSpan = document.createElement('span');
            textSpan.className = 'quick-view__chip-text';
            textSpan.textContent = val;
            chip.appendChild(textSpan);

            if (!isAvailable && strings.soldOut) {
              const vhSpan = document.createElement('span');
              vhSpan.className = 'visually-hidden';
              vhSpan.textContent = ' \u2014 ' + strings.soldOut;
              chip.appendChild(vhSpan);
            }

            chipsWrap.appendChild(chip);
          });
        }

        group.appendChild(chipsWrap);
        optionsContainer.appendChild(group);
      });
    }

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

    const errorMessage = document.getElementById('QuickViewCartError');
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

              if (!found && matched.featured_image && mainImg) {
                mainImg.src = matched.featured_image.src;
              }
            } else if (matched.featured_image && mainImg) {
              mainImg.src = matched.featured_image.src;
            }
          } else if (matched.featured_image && mainImg) {
            mainImg.src = matched.featured_image.src;
          }
        } else {
          selectedVariant = null;
          updateAddButton();
        }
      });
    });

    // Add to Cart Submission Handler
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        if (!selectedVariant || !selectedVariant.available || adding) return;
        adding = true;
        if (errorMessage) errorMessage.hidden = true;

        const item = {
          id: selectedVariant.id,
          quantity: currentQuantity
        };

        addBtn.setAttribute('disabled', 'disabled');
        addBtn.textContent = strings.adding || '';

        try {
          const cartAddUrl = (window.theme && window.theme.routes && window.theme.routes.cartAdd)
            ? window.theme.routes.cartAdd + '.js'
            : '/cart/add.js';
          const response = await fetch(cartAddUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
              items: [item]
            })
          });

          if (!response.ok) {
            const details = await response.json().catch(() => ({}));
            throw new Error(details.description || strings.cartAddError);
          }

          // Open cart drawer and refresh
          const drawer = document.querySelector('cart-drawer');
          if (drawer && typeof drawer.refreshDrawer === 'function') {
            const refreshed = await drawer.refreshDrawer();
            closeModal();
            if (refreshed === false) {
              const cartUrl = (window.theme && window.theme.routes && window.theme.routes.cart) || '/cart';
              window.location.href = cartUrl;
            } else {
              drawer.open();
            }
          } else {
            const cartUrl = (window.theme && window.theme.routes && window.theme.routes.cart) || '/cart';
            window.location.href = cartUrl;
          }
        } catch (err) {
          console.error('Quick view add error:', err);
          if (errorMessage) {
            errorMessage.textContent = err instanceof TypeError ? strings.cartAddError : err.message;
            errorMessage.hidden = false;
          }
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

    const request = ++productRequest;
    openModal(trigger);

    try {
      // Localized root path preservation (market & locale aware)
      const root = (window.theme && window.theme.routes && window.theme.routes.root && window.theme.routes.root !== '/')
        ? window.theme.routes.root.replace(/\/$/, '')
        : '';

      const [productRes, sectionRes] = await Promise.all([
        fetch(`${root}/products/${encodeURIComponent(handle)}.js`),
        fetch(`${root}/products/${encodeURIComponent(handle)}?section_id=main-product`).catch(() => null)
      ]);

      if (!productRes.ok) throw new Error('Product fetch failed');
      const product = await productRes.json();

      let galleryEl = null;
      if (sectionRes && sectionRes.ok) {
        const sectionHtml = await sectionRes.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(sectionHtml, 'text/html');
        galleryEl = doc.querySelector('.product-media-gallery');
      }

      // Stale response invalidation: ignore out-of-order responses
      if (request !== productRequest) return;

      renderProduct(product, galleryEl);
    } catch (err) {
      if (request !== productRequest) return;
      console.error('Quick view load error:', err);
      bodyEl.innerHTML = `
        <div class="quick-view__error text-center" style="padding: var(--space-8);">
          <p>${getStrings().cartAddError || 'Unable to load formulation. Please try again.'}</p>
        </div>
      `;
    }
  });

  // Export for testing
  window.Vespera = window.Vespera || {};
  window.Vespera.QuickView = {
    open: (handle) => {
      const dummy = document.createElement('button');
      dummy.setAttribute('data-quick-view-handle', handle);
      document.body.appendChild(dummy);
      dummy.click();
      dummy.remove();
    },
    close: closeModal,
    renderProduct: renderProduct,
    formatMoney: formatMoney
  };
})();
