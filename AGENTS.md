# Vespera Theme Contributor & Agent Guide

Vespera v2.0.0 is an editorial, botanical-focused Shopify Online Store 2.0 theme engineered for premium skincare, wellness, and beauty merchants.

This guide outlines canonical repository conventions for engineers and AI agents working on Vespera. The codebase and live verification are the sources of truth.

---

## 1. Architectural Foundations (Shopify OS 2.0)

- **Sections & JSON Templates:** All pages are constructed from modular Shopify OS 2.0 sections in `sections/` and composed via JSON templates in `templates/` (e.g., `templates/index.json`, `templates/product.json`, `templates/collection.json`).
- **Presets & Commercial Styles:** The theme ships with three distinct commercial presets: **Botanical**, **Luminous**, and **Vespera**, configured in `config/settings_data.json` and mirrored in `listings/`.
- **Reusable Snippets:** Pure presentational markup and modular components reside in `snippets/` (e.g., `snippets/product-card.liquid`, `snippets/facets.liquid`, `snippets/ritual-product.liquid`).
- **Asset Separation:** Scripts and styles live in `assets/`. No Liquid-embedded inline styles or scripts inside sections unless dynamically binding schema tokens.

---

## 2. Non-Negotiables & Development Rules

1. **Strict Zero Theme Check Offenses:**
   Every commit must pass `shopify theme check` with **0 offenses** across all Liquid, JSON, and asset files.
2. **Vanilla Framework-Free JavaScript:**
   Client features are implemented as native Custom Web Components (`<cart-drawer>`, `<variant-picker>`, `<quick-view>`, `<ritual-builder>`, `<predictive-search>`) using standard DOM APIs. Do not introduce monolithic frontend frameworks (React, Vue) or jQuery.
3. **DOM Safety & Catalog Sanitization:**
   Never concatenate raw catalog strings, titles, options, descriptions, or attributes into `innerHTML`. Always use safe DOM element creation, `.textContent`, and `.setAttribute()`.
4. **Dynamic Currency & Localization:**
   Never assume USD or hardcode `$` symbols. Format money dynamically using Shopify's `window.theme.moneyFormat` or Liquid money filters (`{{ amount | money }}`).
5. **Shopify Native Routing:**
   Storefront paths must use Shopify route objects (`routes.root_url`, `routes.cart_url`, `routes.all_products_collection_url`, `routes.collections_url`). Never hardcode `/cart`, `/search`, or `/collections/all`.
6. **Complete Accessibility (WCAG 2.1 AA):**
   - Modals and drawers must trap focus, dismiss on `Escape`, and return focus to the originating trigger element on close.
   - Dynamic error messages, status changes, and cart updates must use live regions (`role="alert"`, `aria-live="assertive"` or `polite`).
   - All interactive controls must meet minimum 44×44px touch targets.
   - Screen readers must be announced of state transitions.
7. **Preset Portability & Merchant Onboarding:**
   Listing presets (`listings/*/templates/index.json`) must never contain demo-only product handles or dead URLs. Sections must provide graceful empty states and onboarding placeholders (`placeholder_svg_tag`) when products or collections are not yet configured.

---

## 3. Key Storefront Components

- **Cart Drawer (`assets/cart-drawer.js`, `sections/cart-drawer.liquid`):**
  Uses a serialized mutation queue to process rapid quantity changes sequentially, tracking cumulative desired quantities and preventing race conditions. Includes live-region error announcements and focus preservation.
- **Variant Picker (`assets/variant-picker.js`):**
  Coordinates option selection across desktop, mobile, and sticky purchase docks. Emits and listens to `variant:change` events to ensure 100% synchronization across all controls.
- **Quick View (`assets/quick-view.js`):**
  Safely renders product data via DOM constructors, supports localized fetching via `window.theme.routes.root`, and formats prices with `window.theme.moneyFormat`.
- **Collection Filtering (`sections/main-collection.liquid`):**
  Leverages Shopify's native server-side collection type routing (`/collections/types?q=...`) and Storefront Faceted Filtering (`snippets/facets.liquid`) for true catalog-wide pagination and filtering.

---

## 4. Testing & Verification Requirements

Before reporting completion or creating commits:
1. Run `shopify theme check` (must return 0 offenses).
2. Run `node tests/quick-view.test.cjs`.
3. Run `node tests/ritual-builder.test.cjs`.
4. Run `node tests/cart-drawer.test.cjs`.
5. Run Playwright regression suites for sticky variant synchronization.
6. Verify responsive viewports (375px mobile, 1440px desktop) with zero horizontal overflow.
