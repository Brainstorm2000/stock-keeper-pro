## Variable Products

Add a third product kind — **Variable Product** — alongside the existing simple Product and Service. A variable product is a parent shell whose actual sellable units are its **variations** (e.g. T-Shirt → Small/Red, Medium/Blue). Each variation tracks its own SKU, stock, cost price, and selling price. Attributes (Size, Color, …) are predefined per organization.

### 1. Data model (new migration)

New tables (all org-scoped, RLS + GRANTs):

- `product_attributes` — `id, organization_id, name, created_by, timestamps` (e.g. "Size"). Unique `(organization_id, lower(name))`.
- `product_attribute_values` — `id, attribute_id, value, sort_order` (e.g. "Small"). Unique `(attribute_id, lower(value))`.
- `product_variations` — `id, product_id, organization_id, sku, current_stock, opening_stock, low_stock_threshold, out_of_stock_threshold, cost_price, selling_price, is_active, timestamps, created_by`. Unique `(product_id, sku)`, partial-unique on SKU per org.
- `product_variation_attributes` — `variation_id, attribute_id, value_id` (PK composite). Enforces one value per attribute per variation.

Changes to existing tables:

- `products.item_type` enum gains `'variable'` (DB-side it's already free text/check — extend the check constraint or enum).
- `sale_items.variation_id uuid null references product_variations(id)`.
- `purchase_items.variation_id uuid null` (so purchases stock variations).
- `sale_return_items.variation_id uuid null`, `purchase_return_items.variation_id uuid null`.
- `stock_history.variation_id uuid null` (records movement on a specific variation).

Triggers:

- `set_audit_actor_from_auth` extended to fill `created_by` on `product_variations` and `product_attributes`.
- Stock movement RPCs / hooks updated so when `variation_id` is present, the variation's `current_stock` is mutated instead of the parent's. Parent `products.current_stock` for variable products is **derived = SUM(variations.current_stock)** and recomputed by trigger after variation insert/update.

### 2. Frontend — product management

- `ProductDialog.tsx`: when item type = **Variable**, hide single-stock/price fields and show a **Variations** section:
  - Pick attributes used by this product (multi-select from `product_attributes`, with inline create).
  - "Generate variations" button creates the cartesian product of selected attribute values.
  - Editable table of variations: attribute combo (read-only), SKU (auto-gen `PRD-...-V1`), opening/current stock, low/OOS thresholds, cost, selling price, active toggle, remove.
- `ProductTable.tsx`: variable products show a chevron to expand and list variations with their own stock badge using existing status colors.
- New page section under Settings (or inline dialog) **Attributes Manager** — CRUD for attributes and their values.
- `useProducts` extended: variable products return nested `variations`. New `useProductAttributes`, `useProductVariations` hooks.

### 3. POS, Sales, Purchases, Returns

- **POS**: clicking a variable product opens a small picker showing each in-stock variation. The cart line stores `variation_id` and uses variation price/SKU. Stock decrement targets the variation.
- **Purchases**: line item lets you pick a variation when product is variable. `purchase_items.variation_id` populated; receiving stock increments the variation.
- **Returns** (sale + purchase): inherit `variation_id` from source line; max-return checks already keyed on line id remain correct.
- **Stock History**: shows `Variation` column when applicable. Recent Stock Changes table picks up variation label from `product_variations`.

### 4. CSV import / export (one row per variation)

Existing template gains five columns:

```
Product Name | Item Type | Category | ... | Is Variation | Parent SKU | Variation Attributes | Variation SKU | Variation Stock | Variation Cost | Variation Price
```

Rules:

- A **variable parent row** has `Item Type = variable`. Its stock/price columns are ignored on import.
- A **variation row** has `Is Variation = yes`, references the parent through `Parent SKU` (or matching `Product Name`), and provides `Variation Attributes` in the form `Size:Small|Color:Red`. Unknown attributes/values are auto-created.
- Export emits the parent row followed by one row per variation in the same format so the file round-trips.
- Importer pseudocode:
  1. Pass 1: upsert parent products (simple + variable).
  2. Pass 2: for each variation row, ensure attributes/values exist, then upsert `product_variations` and `product_variation_attributes`.
- Validation errors per row are surfaced in the existing CSV import dialog summary.

### 5. Permissions & misc

- No new module — variations inherit `products` permissions (existing role/user overrides).
- Naira formatting unchanged.
- Subscription read-only RLS already blanket-applies via existing policy; new tables get the same guard.

### Technical notes

- Parent stock for variable products becomes computed (`current_stock = SUM(variation.current_stock)`); UI shows it as "Total across variations".
- All sanitization rules (empty string → null for uuids/dates) apply to variation form inputs.
- Pagination on the variations table inside the dialog uses the shared `TablePagination`.

### Out of scope (for now)

- Variation-level images.
- Per-variation barcodes beyond SKU.
- Reporting breakdowns by attribute (will fall out naturally from sale_items.variation_id later).