(() => {
  if (customElements.get('ritual-builder')) return;
  class RitualBuilder extends HTMLElement {
    connectedCallback() {
      this.controller?.abort();
      this.controller = new AbortController();
      const { signal } = this.controller;
      this.form = this.querySelector('[data-ritual-form]');
      this.button = this.querySelector('[data-ritual-add]');
      this.buttonLabel = this.button.textContent;
      this.status = this.querySelector('[data-ritual-status]');
      this.cartLink = this.querySelector('[data-ritual-cart]');
      this.steps = [...this.querySelectorAll('[data-ritual-step]')];
      this.formatter = new Intl.NumberFormat(this.dataset.locale || 'en', { style: 'currency', currency: this.dataset.currency || 'USD', currencyDisplay: 'code' });
      this.form.addEventListener('change', () => { this.status.textContent = ''; this.update(); }, { signal });
      this.form.addEventListener('submit', event => { event.preventDefault(); this.add(); }, { signal });
      this.update();
    }
    selected() {
      return this.steps.map(step => {
        const index = step.querySelector('[data-ritual-swap]')?.value || '0';
        const product = [...step.querySelectorAll('[data-ritual-product]')].find(p => p.dataset.ritualProduct === index);
        const option = product?.querySelector('[data-ritual-variant]')?.selectedOptions[0];
        return { step, product, option, included: step.querySelector('[data-ritual-toggle]').checked };
      });
    }
    update() {
      let total = 0;
      let count = 0;
      let unavailable = false;
      this.selected().forEach(({ step, product, option, included }) => {
        step.classList.toggle('is-excluded', !included);
        step.querySelectorAll('[data-ritual-product]').forEach(p => { p.hidden = p !== product; });
        if (!option) return;
        const quantity = Number(option.dataset.quantity) || 1;
        const price = Number(option.dataset.price);
        product.querySelector('[data-ritual-price]').textContent = quantity > 1 ? `${quantity} × ${option.dataset.money}` : option.dataset.money;
        const available = option.dataset.available === 'true';
        product.querySelector('[data-ritual-availability]').hidden = available;
        const image = product.querySelector('img');
        if (image) {
          image.dataset.defaultSrc ||= image.getAttribute('src');
          image.dataset.defaultSrcset ||= image.getAttribute('srcset') || '';
          const source = option.dataset.image || image.dataset.defaultSrc;
          if (image.getAttribute('src') !== source) {
            image.src = source;
            if (!option.dataset.image && image.dataset.defaultSrcset) image.setAttribute('srcset', image.dataset.defaultSrcset);
            else image.removeAttribute('srcset');
          }
        }
        if (included) {
          unavailable ||= !available;
          if (available) { total += price * quantity; count += quantity; }
        }
      });
      // Shopify prices use hundredths even for currencies without fractional units.
      this.querySelector('[data-ritual-total]').textContent = this.formatter.format(total / 100);
      this.button.disabled = !!this.busy || !!this.uncertain || !count || unavailable;
      if (!count && !this.busy && !this.uncertain) this.status.textContent = this.dataset.empty;
    }
    async request(url, body) {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(typeof data.description === 'string' ? data.description : this.dataset.error);
        error.rejected = true;
        throw error;
      }
      return data;
    }
    async add() {
      if (this.busy || this.button.disabled) return;
      const items = new Map();
      this.selected().forEach(({ option, included }) => {
        if (!included || !option || option.dataset.available !== 'true') return;
        const id = option.value;
        items.set(id, (items.get(id) || 0) + (Number(option.dataset.quantity) || 1));
      });
      if (!items.size) { this.status.textContent = this.dataset.empty; return; }
      this.busy = true;
      this.button.disabled = true;
      this.button.textContent = this.dataset.adding;
      this.form.setAttribute('aria-busy', 'true');
      // Lock selections before the request; do not let the displayed ritual drift.
      const controls = [...this.querySelectorAll('input, select')];
      const previousDisabled = controls.map(control => control.disabled);
      controls.forEach(control => { control.disabled = true; });
      this.status.textContent = '';
      this.cartLink.hidden = true;
      let added = false;
      try {
        const result = await this.request(this.dataset.addUrl, {
          items: [...items].map(([id, quantity]) => ({ id, quantity })),
          sections: ['cart-drawer'], sections_url: window.location.pathname
        });
        added = true;
        let sections = result.sections;
        if (this.dataset.discount) {
          try {
            const response = await fetch(`${this.dataset.cartUrl}.js`);
            if (!response.ok) throw new Error('Cart unavailable');
            const cart = await response.json();
            const codes = (cart.discount_codes || []).map(discount => discount.code);
            (cart.cart_level_discount_applications || []).forEach(discount => {
              if (discount.type === 'discount_code') codes.push(discount.title);
            });
            const discounted = await this.request(this.dataset.updateUrl, {
              discount: [...new Set([...codes, this.dataset.discount])].join(','),
              sections: ['cart-drawer'], sections_url: window.location.pathname
            });
            sections = discounted.sections;
          } catch (_) { sections = null; }
        }
        this.status.textContent = this.dataset.discount ? this.dataset.discountNote : this.dataset.success;
        this.cartLink.hidden = false;
        const drawer = document.querySelector('cart-drawer');
        if (drawer && typeof drawer.refreshDrawer === 'function') {
          const refreshed = await drawer.refreshDrawer(sections);
          if (!refreshed) return;
          // Re-enable before capturing focus so Escape restores it reliably.
          this.button.disabled = false;
          this.button.focus({ preventScroll: true });
          drawer.open();
        }
      } catch (error) {
        // An ambiguous transport error must never offer an automatic duplicate add.
        this.uncertain = !added;
        this.status.textContent = added ? this.dataset.success : this.uncertain ? `${error.rejected ? error.message + " " : ""}${this.dataset.uncertain}` : error.message;
        this.cartLink.hidden = false;
        if (error.rejected) await document.querySelector('cart-drawer')?.refreshDrawer();
      } finally {
        this.busy = false;
        controls.forEach((control, i) => { control.disabled = previousDisabled[i]; });
        this.button.textContent = this.buttonLabel;
        this.form.removeAttribute('aria-busy');
        this.update();
      }
    }
    disconnectedCallback() { this.controller?.abort(); }
  }
  customElements.define('ritual-builder', RitualBuilder);
})();
