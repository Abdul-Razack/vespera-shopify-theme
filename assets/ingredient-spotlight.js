/* Progressive enhancement: content stays readable when JavaScript is unavailable. */
(() => {
  if (customElements.get('ingredient-spotlight')) return;
  class IngredientSpotlight extends HTMLElement {
    connectedCallback() {
      this.controller?.abort();
      this.controller = new AbortController();
      const { signal } = this.controller;
      this.tabs = [...this.querySelectorAll('[data-ingredient-tab]')];
      this.panels = [...this.querySelectorAll('[data-ingredient-panel]')];
      if (!this.tabs.length) return;
      const list = this.querySelector('[data-ingredient-tabs]');
      list.hidden = false;
      list.setAttribute('role', 'tablist');
      this.tabs.forEach((tab, index) => {
        tab.setAttribute('role', 'tab');
        const panel = this.panels[index];
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        panel.tabIndex = 0;
        tab.addEventListener('click', () => this.select(index), { signal });
        tab.addEventListener('keydown', (event) => {
          const rtl = getComputedStyle(this).direction === 'rtl';
          let next;
          if (event.key === 'ArrowRight') next = index + (rtl ? -1 : 1);
          if (event.key === 'ArrowLeft') next = index + (rtl ? 1 : -1);
          if (event.key === 'Home') next = 0;
          if (event.key === 'End') next = this.tabs.length - 1;
          if (next === undefined) return;
          event.preventDefault();
          next = (next + this.tabs.length) % this.tabs.length;
          this.select(next);
          this.tabs[next].focus();
        }, { signal });
      });
      this.classList.add('is-enhanced');
      this.select(0);
      document.addEventListener('shopify:block:select', (event) => {
        const index = this.panels.findIndex(panel => panel.dataset.blockId === event.detail.blockId);
        if (index !== -1) this.select(index);
      }, { signal });
    }
    select(index) {
      this.tabs.forEach((tab, i) => {
        const active = i === index;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        this.panels[i].classList.toggle('is-active', active);
        this.panels[i].setAttribute('aria-hidden', String(!active));
        this.panels[i].inert = !active;
      });
    }
    disconnectedCallback() { this.controller?.abort(); }
  }
  customElements.define('ingredient-spotlight', IngredientSpotlight);
})();
