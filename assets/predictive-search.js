/**
 * Vespera Theme - Predictive Search Component (<predictive-search>)
 * Live Instant Search-As-You-Type via Shopify Suggest API
 */

class PredictiveSearch extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input[type="search"]');
    this.resultsContainer = this.querySelector('.predictive-search__results');
    this.abortController = null;
    this.debounceTimer = null;

    if (!this.input || !this.resultsContainer) return;
    this.bindEvents();
  }

  bindEvents() {
    this.input.addEventListener('input', () => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.onChange(), 250);
    });

    this.input.addEventListener('focus', () => {
      const query = this.input.value.trim();
      if (query.length > 0 && this.resultsContainer.innerHTML.trim() !== '') {
        this.open();
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.contains(e.target)) {
        this.close();
      }
    });

    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
        this.input.blur();
      }
    });
  }

  async onChange() {
    const query = this.input.value.trim();
    if (!query || query.length === 0) {
      this.close();
      this.resultsContainer.innerHTML = '';
      return;
    }

    this.getSuggestions(query);
  }

  async getSuggestions(query) {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const endpoint = `/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product,collection&resources[limit]=5`;
      const response = await fetch(endpoint, { signal: this.abortController.signal });
      if (!response.ok) return;

      const data = await response.json();
      this.renderSuggestions(data.resources.results, query);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Predictive search error:', err);
      }
    }
  }

  renderSuggestions(results, query) {
    const products = results.products || [];
    const collections = results.collections || [];

    if (products.length === 0 && collections.length === 0) {
      this.resultsContainer.innerHTML = `
        <div class="predictive-search__empty">
          <p class="predictive-search__empty-text">No formulations found for "<strong>${this.escapeHTML(query)}</strong>"</p>
        </div>
      `;
      this.open();
      return;
    }

    let html = '';

    if (collections.length > 0) {
      html += `
        <div class="predictive-search__section">
          <span class="predictive-search__heading">Collections & Rituals</span>
          <ul class="predictive-search__list" role="list">
            ${collections.map(c => `
              <li class="predictive-search__item">
                <a href="${c.url}" class="predictive-search__collection-link">
                  <span class="predictive-search__collection-name">${this.escapeHTML(c.title)}</span>
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    if (products.length > 0) {
      html += `
        <div class="predictive-search__section">
          <span class="predictive-search__heading">Suggested Formulations</span>
          <ul class="predictive-search__list" role="list">
            ${products.map(p => `
              <li class="predictive-search__item">
                <a href="${p.url}" class="predictive-search__product-link">
                  ${p.image ? `
                    <div class="predictive-search__thumb-wrap">
                      <img src="${p.image}" alt="${this.escapeHTML(p.title)}" width="48" height="48" class="predictive-search__thumb">
                    </div>
                  ` : ''}
                  <div class="predictive-search__info">
                    <span class="predictive-search__title">${this.escapeHTML(p.title)}</span>
                    <span class="predictive-search__price">$${p.price}</span>
                  </div>
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    html += `
      <div class="predictive-search__footer">
        <a href="/search?q=${encodeURIComponent(query)}" class="predictive-search__view-all">
          View all results for "${this.escapeHTML(query)}" &rarr;
        </a>
      </div>
    `;

    this.resultsContainer.innerHTML = html;
    this.open();
  }

  open() {
    this.resultsContainer.style.display = 'block';
    this.input.setAttribute('aria-expanded', 'true');
  }

  close() {
    this.resultsContainer.style.display = 'none';
    this.input.setAttribute('aria-expanded', 'false');
  }

  escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
}

if (!customElements.get('predictive-search')) {
  customElements.define('predictive-search', PredictiveSearch);
}

