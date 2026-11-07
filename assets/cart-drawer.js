/**
 * Vespera Theme - Custom Web Component: <cart-drawer>
 * Fully native, framework-free Vanilla JS Ajax Cart Engine
 */

class CartDrawer extends HTMLElement {
  constructor() {
    super();
    this.overlay = this.querySelector("#CartDrawerOverlay");
    this.closeBtn = this.querySelector("#CartDrawerClose");
    this.isOpen = false;

    this.bindEvents();
  }

  bindEvents() {
    // Close button & Overlay click via delegation (survives innerHTML refreshes)
    this.addEventListener("click", (e) => {
      if (e.target.closest("#CartDrawerClose") || e.target.closest("#CartDrawerOverlay")) {
        this.close();
      }
    });

    // Keyboard ESC key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
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
          upsellBtn.textContent = "Adding...";
          this.addVariantToCart(variantId);
        }
      }
    });
  }

  open() {
    this.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    this.isOpen = true;
    if (this.closeBtn) {
      this.closeBtn.focus();
    }
  }

  close() {
    this.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    this.isOpen = false;
  }

  async handleAddToCart(form) {
    const formData = new FormData(form);
    
    try {
      const response = await fetch("/cart/add.js", {
        method: "POST",
        body: formData,
        headers: {
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      if (!response.ok) {
        throw new Error("Add to cart failed");
      }

      await this.refreshDrawer();
      this.open();
    } catch (err) {
      console.error("Cart error:", err);
      // Fallback: standard submit if Ajax encounters an error
      form.submit();
    }
  }

  async updateItem(key, quantity) {
    try {
      const response = await fetch("/cart/change.js", {
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
    try {
      const response = await fetch("/cart/add.js", {
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
        if (this.closeBtn) {
          this.closeBtn.addEventListener("click", () => this.close());
        }
        if (this.overlay) {
          this.overlay.addEventListener("click", () => this.close());
        }
      }

      // Update cart count badge in header
      const cartRes = await fetch("/cart.js");
      const cartData = await cartRes.json();
      const badges = document.querySelectorAll("[data-cart-count]");
      badges.forEach(b => b.innerText = cartData.item_count);
      const cartIcon = document.getElementById("CartIconBubble");
      if (cartIcon) {
        cartIcon.setAttribute("aria-label", `${cartData.item_count} items in cart`);
      }
    } catch (err) {
      console.error("Failed to refresh drawer:", err);
    }
  }
}

if (!customElements.get("cart-drawer")) {
  customElements.define("cart-drawer", CartDrawer);
}

