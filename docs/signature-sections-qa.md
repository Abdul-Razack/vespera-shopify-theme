# Signature sections release verification — 2026-11-10

Canonical Vespera v2.0.0, branch `main`, Shopify theme `147081363507`.

## Automated checks

- Shopify Theme Check: 106 files, zero offenses; no configuration suppressions.
- Seven Node regression tests pass against `assets/ritual-builder.js`.
- JavaScript syntax checks and `git diff --check` pass.
- Root, Botanical, Luminous and Vespera homepage templates contain both sections,
  with matching valid block order and preserved pre-existing settings.

## Live browser checks

- 1440px: three-column ritual, default subtotal USD 124.00.
- Swap cleanser to soap: USD 96.00.
- Change serum to 50ml: USD 116.00.
- Exclude toner: USD 82.00; include again: USD 116.00.
- Rapid double-click adds three selected units once, opening the existing AJAX
  drawer. Baseline was one 50ml serum (USD 68.00); result was one soap, one toner,
  and two 50ml serums (four units, USD 184.00). No page navigation occurred.
- Removed test additions and restored the baseline cart item.
- Escape closes the drawer and restores focus to the ritual button.
- 375px and 390px: no horizontal document overflow; cards and controls flow
  vertically without overlap. All current product images load.
- Excluding every step gives USD 0.00, disables submission and announces guidance.
- Swap toner to essence: USD 128.00; select the 200ml refill: USD 148.00.
- Ingredient tabs support click, ArrowRight, Home and End, selected-state updates,
  visible keyboard focus, and inert/hidden inactive panels.
- At 1440px and 375px, switching through all four tabs leaves the next section's
  document position unchanged. At 390px, Home/End switching retains panel height.
- Final botanical fallback image loads successfully; merchant image-picker remains
  available. Temporary browser viewport overrides were reset after testing.

## Scope and remaining verification

Stock rejection, network uncertainty, discount-request failure, preserving an
existing discount code, and drawer-render failure were exercised in regression
tests. No live discount code was supplied, so no live discount redemption or
checkout order was performed. Actual discount rules must be configured in Shopify.
Theme-editor reload/block-selection support is implemented but not exercised in
an authenticated editor session. Listing template structure was checked; all
three presets were not activated on the live store during this release.

This verifies the signature sections, not complete Theme Store certification.
The catalog still mixes flat product illustrations with photographic imagery,
which limits the overall premium visual consistency.
