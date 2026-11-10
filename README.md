# Vespera — Luxury Shopify Theme

**Version:** 2.0.0  
**Engine:** Shopify Online Store 2.0  
**Presets:** Vespera (Parent), Luminous, Botanical  

---

## Overview

Vespera is a boutique, quiet-luxury Shopify theme crafted specifically for high-end skincare, botanicals, perfumery, and wellness merchants. Built with uncompromising standards of aesthetic restraint, editorial typography, accessibility, and platform performance, Vespera offers a tailored commerce experience that prioritizes thoughtful conversion over generic clutter.

---

## Key Features

- **Modern Architecture (OS 2.0):** 100% JSON template coverage across all 16 required Shopify templates with full app block (`@app`) and Custom Liquid block support.
- **Bespoke Product Experience:** Modular product information with reorderable blocks, clinical study metrics, ingredient glossaries, usage rituals, and local pickup availability.
- **Universal Variant Logic:** Graceful handling of unavailable variant combinations, clear sold-out visual cues, backorder inventory messaging, and instant category swatch switching.
- **Comprehensive Commerce:** Unit pricing, native gift card recipient forms, subscription selling plans, automatic cart-level discounts, dynamic accelerated checkout, and Shop Pay Installments.
- **Slide-out Cart Drawer:** Mobile safe-area padding (`100dvh`), keyboard focus trapping, quick upsells, progress-based free shipping thresholds, and direct cart page reachability.
- **Predictive Search & Filter:** Instant multi-category predictive search and accessible, URL-persisted faceted collection filtering.
- **Accessibility & Compliance:** WCAG 2.1 AA compliant color contrast, 24×24px minimum touch targets, visible focus indicators, and semantic HTML landmarks.
- **Native Account Elements:** Direct integration with `<shopify-account>` custom element and Follow on Shop merchant button.

---

## Presets

Vespera includes three distinct art directions:

1. **Vespera (Parent Preset):** Noir, deep-toned quiet luxury with high contrast and restrained warmth.
2. **Luminous:** Warm ivory, airy, sun-kissed editorial aesthetic with soft gold accents.
3. **Botanical:** Organic sage and earthy olive tones celebrating clean formulations and natural ingredients.

---

## Installation & Setup

1. **Upload Theme:**
   - In your Shopify Admin, navigate to **Online Store > Themes**.
   - In the **Theme library** section, click **Add theme > Upload zip file**.
   - Select the packaged `vespera-v2.0.0.zip` archive and click **Upload**.

2. **Select Preset:**
   - Click **Customize** to launch the Shopify Theme Editor.
   - Click **Theme settings** (gear icon) in the bottom-left sidebar.
   - At the bottom of Theme settings, select your preferred preset (`Vespera`, `Luminous`, or `Botanical`).

3. **Configure Navigation & Search:**
   - Link your main menu in **Header** settings.
   - Enable predictive search and customer account elements.

4. **Set Up Product Pages:**
   - Add app blocks or custom blocks (ingredients, ritual accordion, clinical metrics) to your product template as needed.

---

## Documentation & Support

- **Theme Documentation:** Detailed guides and component documentation are available in the theme package.
- **Merchant Support:** Dedicated support is provided for setup and configuration questions.

---

## Release Notes — Version 2.0.0

- **Initial Theme Store Release**
  - Full Online Store 2.0 architecture with all templates in JSON format.
  - Complete re-architecture of product page and featured product blocks.
  - Integration of native `<shopify-account>` and Follow on Shop components.
  - Asynchronous store pickup availability section rendering.
  - Related and complementary product recommendation engine.
  - Native gift card recipient form and QR code display on gift card template.
  - Full WCAG 2.1 AA accessibility compliance and theme editor lifecycle event integration.

## Signature commerce sections

### Curated ritual builder

Add **Curated ritual builder** in the theme editor. Reorder up to three step blocks,
set each title and description, and choose up to four products per step. The first
product is the default; the others appear in its swap menu. Shoppers can exclude
steps and select available variants. Minimum purchase quantities are respected.
Subscription-only products link to their product page for plan selection.

The subtotal uses the active market currency and excludes discounts. An optional
**Existing Shopify discount code** submits a real code after the selected items
are added. Create and configure that code in Shopify **Discounts**, including its
eligible products, minimum quantities and combination rules. The theme does not
create discounts or promise a percentage; Shopify determines actual cart savings.
Leave the setting empty to use regular prices or Shopify automatic discounts.

A single AJAX request adds the selected ritual and updates the existing cart
drawer. Repeated clicks are locked while adding. If the network result is
uncertain or stock validation rejects the request, the section asks shoppers to
check their cart before retrying, avoiding accidental duplicate submissions.
Without JavaScript, product links remain available for individual purchases.

### Ingredient spotlight

Add **Ingredient spotlight**, upload botanical photography, and edit the heading,
caption, introduction and optional product/collection CTA. Reorder up to six tab
blocks; each accepts a label, heading, rich text and optional source/product link.
Only publish verified sourcing and benefit claims. Clinical claims need supporting
evidence; the supplied demonstration uses product-description information rather
than invented trial results.

Tabs support Left/Right arrows, Home/End, visible focus, and reduced-motion
preferences. All panels share a grid cell so the tallest content reserves space,
preventing jumps when switching tabs. Without JavaScript, all content is readable.
Selecting a tab block in the theme editor reveals its corresponding panel.

Both sections appear in the root homepage and Botanical, Luminous and Vespera
listing templates. Assign products and imagery appropriate to each merchant.

### Regression checks

Run `shopify theme check --fail-level warning` and
`node --test tests/ritual-builder.test.cjs`. The tests exercise the actual section
script's multi-item payload, duplicate-click locking, uncertain responses, stock
rejections, discount failure handling, and drawer rendering fallback. Live browser
checks are also required for layout, accessibility and cart behavior.
