# Real Product Validation Workflow

This checklist is for validating TazaScore Beta against real packaged products before any production scoring switch.

Do not invent nutrition, ingredient, or official Nutri-Score inputs. Use packaging, manufacturer data, or another recorded source.

## Required Field Audit

| Field | Status | Notes |
| --- | --- | --- |
| Barcode | Already editable | Required product identifier. Do not guess. |
| Product name | Already editable | Use package/manufacturer name. |
| Brand | Already editable | Nullable when not present. |
| Category label | Already editable | Useful fallback only. Do not treat as official Nutri-Score category. |
| Ingredients | Already editable | Keep original package order where possible. Empty means unknown, not additive-free. |
| Serving type per 100g/per 100ml | Already editable | Required. Use the package nutrition basis. |
| Energy kcal | Already editable | Nullable. Required for official preview unless energy kJ is added later. |
| Protein | Already editable | Nullable. Required for official preview. |
| Carbohydrates | Already editable | Nullable. Stored for display/context. |
| Sugars | Already editable | Nullable. Required for official preview. |
| Fat | Already editable | Nullable. Stored for display/context. |
| Saturated fat | Already editable | Nullable. Required for official preview. |
| Fiber | Already editable | Nullable. Required for official preview. |
| Salt | Already editable | Nullable. Required for official preview. |
| Official Nutri-Score category | Already editable | Required for reliable category-specific preview. Do not infer when uncertain. |
| Fruit/vegetable/legume percentage | Already editable | Nullable. Enter 0 only when supported by source/package. |
| Contains non-sugar sweeteners | Already editable | Nullable. Enter No only when supported by ingredients/source. |
| Data status | Already editable | Use verified only after checking source/package. |
| Source | Already editable | Record package/manufacturer/source name. |
| Last verified date | Already editable | Use date of verification. |
| Energy kJ | Missing from Product model/database | Official algorithm can accept kJ conceptually, but Product currently stores kcal only. Do not add schema in this validation task. |
| NOVA/processing level | Missing from Product model/database | Not currently scored in TazaScore v1. Do not infer. |
| Structured allergens | Missing from Product model/database | Do not infer allergen absence from missing data. |

## Data Quality Rules

- Nutrition values must be per 100g or per 100ml.
- Unknown is not 0.
- Unknown boolean is not false.
- Do not infer allergen absence.
- Do not infer non-sugar sweetener absence.
- Do not infer fruit/vegetable/legume percentage without evidence.
- Preserve source information.
- Preserve verification status.
- Preview before saving, then save, reopen, and preview again to confirm persisted values produce the same result.

## Validation Checklist

| Product | Category | Barcode | Data source | Nutrition complete | Ingredients complete | Official inputs complete | Official Nutri-Score | TazaScore | Confidence | Warnings/reasons | Manual sanity check | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Coca-Cola Original Taste | Sugary soft drink | 5449000000996 | Existing seed/package data | Partial | Yes | No | Pending after official inputs | Pending after official inputs | Medium currently | Missing fruit/vegetable/legume %, sweetener status | Legacy score remains separate | Already exists; fill official fields from package/source before final validation. |
| Zero-sugar soft drink | Zero-sugar soft drink | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Enter only from real package/source. |
| Plain bottled water | Plain bottled water | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Official category should be water when verified. |
| Plain milk | Plain milk | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Confirm per 100ml values. |
| Sweetened yogurt | Sweetened yogurt | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Confirm dairy category handling and sugar. |
| Plain oats/oatmeal | Plain oats/oatmeal | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Confirm per 100g dry product values. |
| Bread | Bread | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Record whole-grain status only if supported by ingredients/source. |
| Potato chips | Potato chips | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Confirm salt and saturated fat values. |
| Chocolate | Chocolate | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Confirm sugars and saturated fat values. |
| 100% fruit juice | 100% fruit juice | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | Confirm juice percentage and beverage category from package/source. |

## Admin Workflow

1. Open admin.
2. Create or edit the product.
3. Enter package/source data only.
4. Leave unknown numeric fields blank.
5. Leave unknown booleans as Unknown.
6. Select Official Nutri-Score category only when supported.
7. Click Preview Nutri-Score.
8. Click Preview TazaScore.
9. If either preview says insufficient data, fill only verified missing fields.
10. Save the product.
11. Reopen the product edit page.
12. Preview again and record the persisted result in the checklist.

## Current Schema Limitations

- Energy kJ is not stored on Product; kcal is used for current previews.
- Structured allergen data is not stored.
- NOVA/processing level is not stored and is not scored in TazaScore v1.
- Additive evidence risk is conservative; E-number presence alone should not create a penalty.
