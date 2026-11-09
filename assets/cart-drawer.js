/**
 * Vespera Theme - Custom Web Component: <cart-drawer>
 * Fully native, framework-free Vanilla JS Ajax Cart Engine.
 * Supports keyboard focus trapping, Esc key dismissal, and return-of-focus (F-33).
 */

class CartDrawer extends HTMLElement {
  constructor() {
    super();
    this.overlay = this.querySelector("#CartDrawerOverlay");
    this.closeBtn = this.querySelector("#CartDrawerClose");
    this.panel = this.querySelector(".cart-drawer__panel");
    this.isOpen = false;
    this.previousActiveElement = null;

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
    const cartTriggers = document.querySelectorAll("#CartIconBubble");
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
        const key = item.getAttribute("data-line-item-key");
        const change = parseInt(qtyBtn.getAttribute("data-qty-change"), 10);
        const currentQty = parseInt(item.querySelector(".cart-drawer__qty-value").innerText, 10);
        this.updateItem(key, Math.max(0, currentQty + change));
      } else if (removeBtn) {
        const item = removeBtn.closest("[data-line-item-key]");
        const key = item.getAttribute("data-line-item-key");
        this.updateItem(key, 0);
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
        throw new Error(errorData.description || "Add to cart failed");
      }

      await this.refreshDrawer();
      this.open();
    } catch (err) {
      console.error("Cart error:", err);
      const errorContainer = form.querySelector('[data-product-error], .product-form__error-message');
      if (errorContainer) {
        errorContainer.textContent = err.message || "Could not add formulation to cart. Please try again.";
        errorContainer.hidden = false;
      }
    } finally {
      form.dataset.submitting = "false";
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
      }
    }
  }

  async updateItem(key, quantity) {
    try {
      const changeUrl = (window.theme && window.theme.routes && window.theme.routes.cartChange)
        ? window.theme.routes.cartChange + '.js'
        : '/cart/change.js';
      const response = await fetch(changeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({ id: key, quantity })
      });

      if (!response.ok) throw new Error("Update failed");

      await this.refreshDrawer();
    } catch (err) {
      console.error("Failed to update item:", err);
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

  async refreshDrawer() {
    try {
      const res = await fetch(`${window.location.pathname}?section_id=cart-drawer`);
      const html = await res.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const newDrawer = doc.querySelector("cart-drawer");

      if (newDrawer) {
        this.innerHTML = newDrawer.innerHTML;
        this.overlay = this.querySelector("#CartDrawerOverlay");
        this.closeBtn = this.querySelector("#CartDrawerClose");
        this.panel = this.querySelector(".cart-drawer__panel");
      }

      // Update cart count badge in header
      const cartRes = await fetch("/cart.js");
      const cartData = await cartRes.json();
      const badges = document.querySelectorAll("[data-cart-count]");
      badges.forEach(b => b.innerText = cartData.item_count);
      const cartIcon = document.getElementById("CartIconBubble");
      if (cartIcon) {
        const countLabel = cartData.item_count === 1
          ? "1 item in cart"
          : `${cartData.item_count} items in cart`;
        cartIcon.setAttribute("aria-label", countLabel);
      }
    } catch (err) {
      console.error("Failed to refresh drawer:", err);
    }
  }
}

if (!customElements.get("cart-drawer")) {
  customElements.define("cart-drawer", CartDrawer);
}
