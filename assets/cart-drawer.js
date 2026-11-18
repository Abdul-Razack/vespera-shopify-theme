/**
 * Vespera Theme - Custom Web Component: <cart-drawer>
 * Fully native, framework-free Vanilla JS Ajax Cart Engine.
 * Supports serialized cart mutations, optimistic quantity tracking,
 * live-region error announcements, keyboard focus trapping, Esc key dismissal,
 * and seamless return-of-focus (Shopify Theme Store Section 4, 8, 9, 12, 14, 22).
 */

class CartDrawer extends HTMLElement {
  constructor() {
    super();
    this.overlay = this.querySelector("#CartDrawerOverlay");
    this.closeBtn = this.querySelector("#CartDrawerClose");
    this.panel = this.querySelector(".cart-drawer__panel");
    this.isOpen = false;
    this.previousActiveElement = null;

    // Serialized mutation queue & tracked desired quantities
    this._targetQuantities = new Map(); // key -> desiredQuantity (int)
    this._isProcessingQueue = false;
    this._activeFocusTarget = null; // { key, action: 'plus' | 'minus' | 'remove' }
    this._refreshRequestId = 0;

    this.bindEvents();
  }

  bindEvents() {
    // Close button & Overlay click via delegation
    this.addEventListener("click", (e) => {
      if (e.target.closest("#CartDrawerClose") || e.target.closest("#CartDrawerOverlay")) {
        this.close();
      }
    });

    // Keyboard ESC key and Focus Trap (F-33)
    document.addEventListener("keydown", (e) => {
      if (!this.isOpen) return;

      if (e.key === "Escape") {
        this.close();
        return;
      }

      if (e.key === "Tab") {
        this.trapFocus(e);
      }
    });

    // Intercept all "Add to Cart" forms across the storefront
    document.addEventListener("submit", (e) => {
      const form = e.target;
      if (form && form.getAttribute("action") && form.getAttribute("action").includes("/cart/add")) {
        e.preventDefault();
        this.handleAddToCart(form);
      }
    });

    // Cart bubble triggers in header
    const cartTriggers = document.querySelectorAll("#CartIconBubble, [data-cart-drawer-trigger]");
    cartTriggers.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.open();
      });
    });

    // Delegate quantity & remove buttons inside the drawer
    this.addEventListener("click", (e) => {
      const qtyBtn = e.target.closest("[data-qty-change]");
      const removeBtn = e.target.closest("[data-item-remove]");
      const upsellBtn = e.target.closest("[data-upsell-add-variant]");

      if (qtyBtn) {
        const item = qtyBtn.closest("[data-line-item-key]");
        if (!item) return;
        const key = item.getAttribute("data-line-item-key");
        const change = parseInt(qtyBtn.getAttribute("data-qty-change"), 10);
        this._activeFocusTarget = { key, action: change > 0 ? 'plus' : 'minus' };
        this.queueQuantityChange(key, change, item);
      } else if (removeBtn) {
        const item = removeBtn.closest("[data-line-item-key]");
        if (!item) return;
        const key = item.getAttribute("data-line-item-key");
        this._activeFocusTarget = { key, action: 'remove' };
        this.queueSetQuantity(key, 0, item);
      } else if (upsellBtn) {
        const variantId = upsellBtn.getAttribute("data-upsell-add-variant");
        if (variantId) {
          upsellBtn.setAttribute("disabled", "disabled");
          upsellBtn.textContent = (window.theme && window.theme.strings && window.theme.strings.adding) ? window.theme.strings.adding : "";
          this.addVariantToCart(variantId);
        }
      }
    });

    // Debounced Cart Note Auto-Saving
    let noteTimer;
    this.addEventListener("input", (e) => {
      if (e.target && e.target.matches("[data-cart-drawer-note]")) {
        clearTimeout(noteTimer);
        const noteVal = e.target.value;
        noteTimer = setTimeout(async () => {
          try {
            const updateUrl = (window.theme && window.theme.routes && window.theme.routes.cartUpdate)
              ? window.theme.routes.cartUpdate + '.js'
              : '/cart/update.js';
            await fetch(updateUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: JSON.stringify({ note: noteVal })
            });
          } catch (err) {
            console.error('Note update failed:', err);
          }
        }, 500);
      }
    });
  }

  showError(message) {
    const errorEl = this.querySelector('[data-cart-drawer-error]');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  clearError() {
    const errorEl = this.querySelector('[data-cart-drawer-error]');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  }

  /**
   * Queues an incremental quantity change (+1 or -1) with desired quantity tracking.
   * Multiple rapid clicks track cumulative target quantity rather than stale DOM readings.
   */
  queueQuantityChange(key, change, itemEl) {
    const currentDomQty = parseInt(itemEl?.querySelector(".cart-drawer__qty-value")?.innerText || '1', 10);
    const baseQty = this._targetQuantities.has(key)
      ? this._targetQuantities.get(key)
      : (isNaN(currentDomQty) ? 1 : currentDomQty);
    const desiredQty = Math.max(0, baseQty + change);
    this.queueSetQuantity(key, desiredQty, itemEl);
  }

  /**
   * Sets the target quantity for an item and triggers the serialized mutation runner.
   */
  queueSetQuantity(key, desiredQty, itemEl) {
    // Keep the error region stable while retrying so rapid clicks do not move
    // off their target. A successful drawer refresh clears the previous error.
    this._targetQuantities.set(key, desiredQty);

    // Optimistic UI feedback
    if (itemEl) {
      if (desiredQty === 0) {
        itemEl.style.opacity = '0.4';
        itemEl.setAttribute('aria-disabled', 'true');
      } else {
        const valSpan = itemEl.querySelector(".cart-drawer__qty-value");
        if (valSpan) valSpan.innerText = String(desiredQty);
        itemEl.setAttribute('aria-busy', 'true');
      }
    }

    this._processMutationQueue();
  }

  /**
   * Serialized mutation worker: executes in-flight cart mutations one at a time,
   * submitting the most current desired quantity and preventing lost increments or stale state.
   */
  async _processMutationQueue() {
    if (this._isProcessingQueue) return;
    this._isProcessingQueue = true;

    try {
      while (this._targetQuantities.size > 0) {
        const entry = this._targetQuantities.entries().next().value;
        if (!entry) break;
        const [key, targetQty] = entry;

        const submittingQty = targetQty;
        const changeUrl = (window.theme && window.theme.routes && window.theme.routes.cartChange)
          ? window.theme.routes.cartChange + '.js'
          : '/cart/change.js';

        let response;
        try {
          response = await fetch(changeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
              id: key,
              quantity: submittingQty,
              sections: 'cart-drawer'
            })
          });
        } catch (networkErr) {
          console.error('Cart network mutation error:', networkErr);
          this._targetQuantities.delete(key);
          await this.refreshDrawer();
          this.showError(networkErr.message || (window.theme?.strings?.cartError || 'Network error updating cart. Please check your connection.'));
          break;
        }

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.description || errData.message || (window.theme?.strings?.cartAddError || 'Could not update cart quantity. Please try again.');
          console.error('Cart mutation rejected:', errMsg);
          // Remove from queue so we don't loop on inventory rejection
          this._targetQuantities.delete(key);
          await this.refreshDrawer();
          this.showError(errMsg);
          break;
        }

        const cartData = await response.json();

        // Check if user clicked + or - again while this mutation was in flight:
        if (this._targetQuantities.get(key) === submittingQty) {
          this._targetQuantities.delete(key);
        }

        // When all pending target quantities are completed, reconcile drawer with Shopify
        if (this._targetQuantities.size === 0) {
          await this.refreshDrawer(cartData.sections, cartData);
        }
      }
    } finally {
      this._isProcessingQueue = false;
      if (this._targetQuantities.size > 0) {
        this._processMutationQueue();
      }
    }
  }

  /**
   * Public backward-compatible API
   */
  async updateItem(key, quantity) {
    const itemEl = this.querySelector(`[data-line-item-key="${key}"]`);
    this.queueSetQuantity(key, Math.max(0, parseInt(quantity, 10)), itemEl);
  }

  getFocusableElements() {
    if (!this.panel) return [];
    return Array.from(this.panel.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0);
  }

  trapFocus(e) {
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first || !this.panel.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !this.panel.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  open() {
    this.previousActiveElement = document.activeElement;
    this.setAttribute("aria-hidden", "false");
    this.classList.add("active");
    this.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    this.isOpen = true;

    requestAnimationFrame(() => {
      const closeBtn = this.querySelector("#CartDrawerClose");
      if (closeBtn) {
        closeBtn.focus();
      }
    });
  }

  close() {
    this.setAttribute("aria-hidden", "true");
    this.classList.remove("active");
    this.removeAttribute("open");
    document.body.style.overflow = "";
    this.isOpen = false;

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === "function") {
      this.previousActiveElement.focus();
      this.previousActiveElement = null;
    }
  }

  async handleAddToCart(form) {
    if (form.dataset.submitting === "true") return;
    form.dataset.submitting = "true";

    const submitBtn = form.querySelector('[type="submit"], [name="add"], .product-form__submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
    }

    document.dispatchEvent(new CustomEvent('vespera:cart:add:start', { detail: { form } }));

    const formData = new FormData(form);
    
    try {
      const addUrl = (window.theme && window.theme.routes && window.theme.routes.cartAdd)
        ? window.theme.routes.cartAdd + '.js'
        : '/cart/add.js';
      const response = await fetch(addUrl, {
        method: "POST",
        body: formData,
        headers: {
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.description || (window.theme?.strings?.cartAddError || "Add to cart failed"));
      }

      await this.refreshDrawer();
      this.open();
    } catch (err) {
      console.error("Cart error:", err);
      const errorContainer = form.querySelector('[data-product-error], .product-form__error-message');
      if (errorContainer) {
        errorContainer.textContent = err.message || (window.theme?.strings?.cartAddError || "Could not add formulation to cart. Please try again.");
        errorContainer.hidden = false;
      }
    } finally {
      form.dataset.submitting = "false";
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
      }
      document.dispatchEvent(new CustomEvent('vespera:cart:add:complete', { detail: { form } }));
    }
  }

  async addVariantToCart(variantId) {
    if (this.isAddingVariant) return;
    this.isAddingVariant = true;

    try {
      const addUrl = (window.theme && window.theme.routes && window.theme.routes.cartAdd)
        ? window.theme.routes.cartAdd + '.js'
        : '/cart/add.js';
      const response = await fetch(addUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({
          items: [{ id: parseInt(variantId, 10), quantity: 1 }]
        })
      });

      if (!response.ok) throw new Error("Add variant failed");

      await this.refreshDrawer();
    } catch (err) {
      console.error("Failed to add upsell variant:", err);
      await this.refreshDrawer();
    } finally {
      this.isAddingVariant = false;
    }
  }

  /**
   * Refreshes the cart drawer with given HTML/sections or re-fetches from Shopify,
   * updates header badges, and restores keyboard focus to the active line item action.
   */
  async refreshDrawer(sections, preloadedCartData) {
    const requestId = ++this._refreshRequestId;

    try {
      let html = sections && sections['cart-drawer'];
      if (!html) {
        const rootUrl = (window.theme && window.theme.routes && window.theme.routes.cart)
          ? window.theme.routes.cart
          : '/cart';
        const res = await fetch(`${rootUrl}?section_id=cart-drawer`);
        if (!res.ok) throw new Error('Cart section unavailable');
        html = await res.text();
      }

      // Stale response guard
      if (requestId !== this._refreshRequestId) return false;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const newDrawer = doc.querySelector("cart-drawer");

      if (!newDrawer) throw new Error('Cart drawer missing from response');

      this.innerHTML = newDrawer.innerHTML;
      this.overlay = this.querySelector("#CartDrawerOverlay");
      this.closeBtn = this.querySelector("#CartDrawerClose");
      this.panel = this.querySelector(".cart-drawer__panel");

      // Update cart count badge in header
      let cartData = preloadedCartData;
      if (!cartData || typeof cartData.item_count !== 'number') {
        const cartUrl = (window.theme && window.theme.routes && window.theme.routes.cart)
          ? window.theme.routes.cart + '.js'
          : '/cart.js';
        const cartRes = await fetch(cartUrl);
        if (cartRes.ok) {
          cartData = await cartRes.json();
        }
      }

      if (cartData && typeof cartData.item_count === 'number') {
        const badges = document.querySelectorAll("[data-cart-count]");
        badges.forEach(b => b.innerText = cartData.item_count);
        const cartIcon = document.getElementById("CartIconBubble");
        if (cartIcon) {
          const countLabel = cartData.item_count === 1
            ? "1 item in cart"
            : `${cartData.item_count} items in cart`;
          cartIcon.setAttribute("aria-label", countLabel);
        }
      }

      // Focus restoration
      if (this._activeFocusTarget) {
        const { key, action } = this._activeFocusTarget;
        const itemEl = this.querySelector(`[data-line-item-key="${key}"]`);
        if (itemEl) {
          if (action === 'plus') {
            const plusBtn = itemEl.querySelector('[data-qty-change="1"]');
            if (plusBtn) plusBtn.focus();
          } else if (action === 'minus') {
            const minusBtn = itemEl.querySelector('[data-qty-change="-1"]');
            if (minusBtn) minusBtn.focus();
          } else if (action === 'remove') {
            const rmBtn = itemEl.querySelector('[data-item-remove]');
            if (rmBtn) rmBtn.focus();
          }
        } else {
          // Item was removed; focus next available item or drawer close button
          const nextItemBtn = this.querySelector('[data-qty-change="1"], .cart-drawer__checkout-btn, #CartDrawerClose');
          if (nextItemBtn) nextItemBtn.focus();
        }
        this._activeFocusTarget = null;
      }

      return true;
    } catch (err) {
      console.error("Failed to refresh drawer:", err);
      return false;
    }
  }
}

if (!customElements.get("cart-drawer")) {
  customElements.define("cart-drawer", CartDrawer);
}
