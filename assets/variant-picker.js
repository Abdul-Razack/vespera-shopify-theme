/**
 * Vespera Theme - Universal Variant Selection & State Manager
 * Shared across: Product Page (PDP), Featured Product, Quick View Modal, Quick Add.
 * Complies with Shopify Theme Store Section 4, 8, 9, 12.
 */

(function() {
  'use strict';

  window.Vespera = window.Vespera || {};

  function formatMoney(cents) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      return window.Shopify.formatMoney(cents, window.theme && window.theme.moneyFormat ? window.theme.moneyFormat : '${{amount}}');
    }
    return '$' + (cents / 100).toFixed(2);
  }

  class VariantPicker {
    constructor(container) {
      this.container = container;
      this.sectionId = container.dataset.sectionId || '';
      this.productId = container.dataset.productId || '';
      
      const variantDataEl = container.querySelector('[data-product-variants-json]');
      if (!variantDataEl) return;

      try {
        this.variants = JSON.parse(variantDataEl.textContent);
      } catch (e) {
        console.error('Failed to parse variants JSON', e);
        return;
      }

      this.hiddenIdInput = container.querySelector('[name="id"]');
      this.addBtn = container.querySelector('[data-add-to-cart-btn]');
      this.priceEl = container.querySelector('[data-regular-price]');
      this.comparePriceEl = container.querySelector('[data-compare-price]');
      this.unitPriceEl = container.querySelector('[data-unit-price-wrapper]');
      this.stockTextEl = container.querySelector('[data-stock-text]');
      this.stockDotEl = container.querySelector('[data-stock-dot]');
      this.dynamicCheckoutEl = container.querySelector('[data-dynamic-checkout]');
      this.mediaGallery = container.querySelector('[data-gallery]');

      this.optionGroups = Array.from(container.querySelectorAll('[data-option-index]'));
      this.bindEvents();
      this.updateState();
    }

    bindEvents() {
      this.optionGroups.forEach(group => {
        const inputs = group.querySelectorAll('input[type="radio"], select');
        inputs.forEach(input => {
          input.addEventListener('change', () => this.updateState());
        });
      });
    }

    getSelectedOptions() {
      return this.optionGroups.map(group => {
        const checkedRadio = group.querySelector('input[type="radio"]:checked');
        if (checkedRadio) return checkedRadio.value;
        const select = group.querySelector('select');
        if (select) return select.value;
        return null;
      });
    }

    findMatchingVariant(selectedOptions) {
      return this.variants.find(variant => {
        return variant.options.every((optValue, idx) => optValue === selectedOptions[idx]);
      });
    }

    updateOptionAvailabilityCues(selectedOptions) {
      // For each option group and value, determine if available variant exists
      this.optionGroups.forEach((group, groupIdx) => {
        const optionInputs = group.querySelectorAll('input[type="radio"]');
        optionInputs.forEach(input => {
          const val = input.value;
          // Build hypothetical options array with this value substituted
          const testOptions = [...selectedOptions];
          testOptions[groupIdx] = val;

          // Check if any matching variant exists
          const matching = this.variants.find(v => {
            return v.options.every((opt, idx) => {
              if (testOptions[idx] === null) return true;
              return opt === testOptions[idx];
            });
          });

          const label = input.closest('label') || group.querySelector(`label[for="${input.id}"]`);
          const noticeEl = label ? label.querySelector('[data-availability-notice]') : null;
          const strings = (window.theme && window.theme.strings) || {};

          if (label) {
            if (!matching) {
              label.classList.add('is-unavailable');
              label.classList.remove('is-sold-out');
              input.setAttribute('aria-disabled', 'true');
              if (noticeEl) noticeEl.textContent = strings.unavailable ? ` — ${strings.unavailable}` : '';
            } else if (!matching.available) {
              label.classList.add('is-sold-out');
              label.classList.remove('is-unavailable');
              input.setAttribute('aria-disabled', 'true');
              if (noticeEl) noticeEl.textContent = strings.soldOut ? ` — ${strings.soldOut}` : '';
            } else {
              label.classList.remove('is-sold-out', 'is-unavailable');
              input.removeAttribute('aria-disabled');
              if (noticeEl) noticeEl.textContent = '';
            }
          }
        });
      });
    }

    updateState() {
      const selectedOptions = this.getSelectedOptions();
      const variant = this.findMatchingVariant(selectedOptions);

      // Update selected value text in group labels
      this.optionGroups.forEach((group, idx) => {
        const labelVal = group.querySelector('[data-selected-option-value]');
        if (labelVal && selectedOptions[idx]) {
          labelVal.textContent = selectedOptions[idx];
        }
      });

      // Update visual availability cues across pills/swatches
      this.updateOptionAvailabilityCues(selectedOptions);

      const strings = (window.theme && window.theme.strings) || {};

      if (!variant) {
        // CASE: Unavailable combination (F-31)
        if (this.hiddenIdInput) {
          this.hiddenIdInput.value = '';
          this.hiddenIdInput.setAttribute('disabled', 'disabled');
        }
        if (this.addBtn) {
          this.addBtn.setAttribute('disabled', 'disabled');
          this.addBtn.textContent = strings.unavailable || '';
        }
        if (this.dynamicCheckoutEl) {
          this.dynamicCheckoutEl.style.display = 'none';
        }
        if (this.stockDotEl) {
          this.stockDotEl.className = 'stock-dot stock-dot--out';
        }
        if (this.stockTextEl) {
          this.stockTextEl.textContent = strings.unavailable || '';
        }
        return;
      }

      // CASE: Valid variant
      if (this.hiddenIdInput) {
        this.hiddenIdInput.removeAttribute('disabled');
        this.hiddenIdInput.value = variant.id;
      }

      const formattedPrice = formatMoney(variant.price);
      if (this.priceEl) this.priceEl.textContent = formattedPrice;

      // Compare at price
      if (this.comparePriceEl) {
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          this.comparePriceEl.textContent = formatMoney(variant.compare_at_price);
          this.comparePriceEl.style.display = 'inline';
        } else {
          this.comparePriceEl.style.display = 'none';
        }
      }

      // Unit price
      if (this.unitPriceEl) {
        if (variant.unit_price_measurement) {
          const unitPriceVal = this.unitPriceEl.querySelector('[data-unit-price]');
          const unitPriceBase = this.unitPriceEl.querySelector('[data-unit-price-base]');
          if (unitPriceVal) unitPriceVal.textContent = formatMoney(variant.unit_price);
          if (unitPriceBase) {
            const base = (variant.unit_price_measurement.reference_value !== 1 ? variant.unit_price_measurement.reference_value : '') + variant.unit_price_measurement.reference_unit;
            unitPriceBase.textContent = base;
          }
          this.unitPriceEl.style.display = '';
        } else {
          this.unitPriceEl.style.display = 'none';
        }
      }

      // Stock status & Inventory message (F-32)
      if (variant.available) {
        if (this.addBtn) {
          this.addBtn.removeAttribute('disabled');
          const addLabel = strings.addToCart || '';
          this.addBtn.innerHTML = `<span>${addLabel}</span>`;
        }
        if (this.dynamicCheckoutEl) {
          this.dynamicCheckoutEl.style.display = '';
        }

        // Check if backorder / continue selling
        const isBackorder = (variant.inventory_policy === 'continue' && variant.inventory_quantity <= 0);
        if (isBackorder) {
          if (this.stockDotEl) this.stockDotEl.className = 'stock-dot stock-dot--backorder';
          if (this.stockTextEl) this.stockTextEl.textContent = strings.backorder || '';
        } else {
          if (this.stockDotEl) this.stockDotEl.className = 'stock-dot stock-dot--in';
          if (this.stockTextEl) this.stockTextEl.textContent = strings.inStock || '';
        }
      } else {
        if (this.addBtn) {
          this.addBtn.setAttribute('disabled', 'disabled');
          this.addBtn.textContent = strings.soldOut || '';
        }
        if (this.dynamicCheckoutEl) {
          this.dynamicCheckoutEl.style.display = 'none';
        }
        if (this.stockDotEl) {
          this.stockDotEl.className = 'stock-dot stock-dot--out';
        }
        if (this.stockTextEl) {
          this.stockTextEl.textContent = strings.soldOut || '';
        }
      }

      // Media synchronization
      if (variant.featured_media && this.mediaGallery) {
        const targetMediaId = variant.featured_media.id;
        const matchingThumb = this.mediaGallery.querySelector(`[data-thumbnail-id="${targetMediaId}"]`);
        if (matchingThumb) {
          matchingThumb.click();
        } else if (variant.featured_image) {
          const featuredImg = this.container.querySelector('[data-featured-image]');
          if (featuredImg) featuredImg.src = variant.featured_image.src;
        }
      }

      // Update URL on PDP (without page reload)
      if (this.container.hasAttribute('data-update-url') && window.history && window.history.replaceState) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('variant', variant.id);
        window.history.replaceState({ variantId: variant.id }, '', newUrl.toString());
      }

      // Synchronize Pickup Availability
      this.updatePickupAvailability(variant);

      // Dispatch custom event for external components (like Sticky Dock)
      const event = new CustomEvent('vespera:variant:change', {
        bubbles: true,
        detail: { variant, formattedPrice }
      });
      this.container.dispatchEvent(event);
    }

    updatePickupAvailability(variant) {
      const pickupContainer = this.container.querySelector('[data-pickup-availability-container]');
      if (!pickupContainer || !variant || !variant.available) {
        if (pickupContainer) pickupContainer.innerHTML = '';
        return;
      }

      const rootUrl = pickupContainer.dataset.baseUrl || '';
      const requestUrl = `${rootUrl}/variants/${variant.id}/?section_id=pickup-availability`;

      fetch(requestUrl)
        .then(res => res.text())
        .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const newAvailability = doc.querySelector('.pickup-availability-information');
          if (newAvailability) {
            pickupContainer.innerHTML = newAvailability.outerHTML;
          } else {
            pickupContainer.innerHTML = '';
          }
        })
        .catch(err => {
          console.warn('Pickup availability fetch error:', err);
        });
    }
  }

  window.Vespera.VariantPicker = VariantPicker;

  // Auto-initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-variant-picker-container]').forEach(el => {
      new VariantPicker(el);
    });
  });

  // Re-init on Shopify Section Load in Theme Editor (F-25)
  document.addEventListener('shopify:section:load', (e) => {
    e.target.querySelectorAll('[data-variant-picker-container]').forEach(el => {
      new VariantPicker(el);
    });
  });
})();
