# Product data normalization

This document covers duplicate-product auditing and multilingual ingredient
handling. It is separate from scoring methodology.

## Duplicate audit

Run:

```bash
cd backend/api
npm run audit:product-duplicates
```

The audit is read-only. It does not delete, merge, or modify products.

Likely duplicate groups are classified as:

- `exact_duplicate`: normalized identity, category, nutrition values, and
  ingredients match.
- `package_variant`: same practical product data with package-size wording in
  the product name.
- `recipe_or_market_variant`: similar identity, but nutrition or ingredients
  differ.
- `uncertain`: possible duplicate where available data is not enough for a safe
  decision.

Recommended actions are intentionally non-destructive: keep separate, link as
package variants, review manually, or safe merge candidate. No automatic merge
exists in this task.

## Coca-Cola-like products

Coca-Cola-like records must not be merged by name alone. Different barcodes can
represent different package sizes, markets, recipes, or source quality. The audit
prints each record with barcode, source, nutrition, ingredients, category,
TazaScore, confidence, coverage, data-quality warnings, and score-difference
reasons.

Different TazaScore values are explained only through existing inputs such as
nutrition values, ingredients, official Nutri-Score category, missing critical
fields, or safeguards. Scoring rules are not changed to make similar-looking
products match.

## Source ingredient language policy

Consumer-facing ingredient display prefers:

1. Russian OFF ingredient text, when available.
2. Kazakh OFF ingredient text, when available.
3. Original/default OFF ingredient text.
4. Existing stored ingredient list.

This source repair flow does not perform generated translation. Generated
Russian fallback is handled separately below and stored in its own provenance
fields.

Original source text is preserved in `ingredientsTextOriginal` with
`ingredientsTextOriginalLanguage` where known. Russian text is stored separately
in `ingredientsTextRu`.

The existing `ingredients` array remains the original/scoring input. This avoids
changing current TazaScore, Official Nutri-Score, or legacy scoring behavior.
The API DTO can expose Russian consumer ingredients while scoring continues to
use the original stored ingredient list.

## OFF ingredients repair

Dry run:

```bash
cd backend/api
npm run repair:off-ingredients -- --dry-run
```

Real repair:

```bash
cd backend/api
npm run repair:off-ingredients
```

The repair:

- re-fetches Open Food Facts by barcode;
- updates only ingredient language metadata fields;
- never updates nutrition, scoring fields, image, name, brand, `dataStatus`,
  `lastVerifiedAt`, or verification status;
- skips verified/manual products;
- makes no writes in dry-run mode;
- never replaces known data with empty/null OFF data.

## Prisma change

The schema adds nullable metadata fields:

- `ingredientsTextOriginal`
- `ingredientsTextOriginalLanguage`
- `ingredientsTextRu`

They are nullable to preserve existing products and avoid forcing unknown values
into fake defaults.

## Scoring

Scoring methodology changed: NO.

TazaScore methodology is tracked separately. OfficialNutriScoreEngine and
legacy scoring are unchanged by ingredient normalization.

## Ingredient language/provenance policy

Ingredient text has separate source and presentation fields. The original source
text remains the source of truth and must not be overwritten by generated
consumer translations.

Field semantics:

- `ingredientsTextOriginal`: original external/manual ingredient text when
  available.
- `ingredientsTextOriginalLanguage`: language code or `unknown` for the
  original ingredient text.
- `ingredientsTextRu`: Russian ingredient text provided by the original source,
  for example Open Food Facts `ingredients_text_ru`.
- `ingredientsTextTranslatedRu`: generated Russian convenience translation.
- `ingredientsTranslationSource`: translation provider/provenance identifier.
- `ingredientsTranslatedAt`: timestamp when the generated translation was
  written.

Consumer display priority:

```text
ingredientsTextRu
?? ingredientsTextTranslatedRu
?? ingredientsTextOriginal
?? legacy ingredients[]
?? unavailable
```

Source-provided Russian always wins over generated Russian. Generated
translations never overwrite original text, source-provided Russian text, or
legacy structured ingredients.

Generated translation is consumer convenience only. It must not feed:

- TazaScore;
- Official NutriScoreEngine;
- legacy scoring;
- ingredient-risk calculations.

The current MVP translation command uses a local deterministic glossary provider
(`local_glossary_v1`). It translates only known ingredient segments and leaves
unknown segments unchanged. If no known segment can be translated, no generated
translation is written. Missing ingredients are never invented.

Commands:

```bash
npm run translate:ingredients-ru -- --dry-run
npm run translate:ingredients-ru
```

The command is idempotent. Products with existing source Russian text or
existing generated translation are skipped. Verified products are not modified.

## Canonical Product Family Policy

Barcode is not the same thing as recipe identity. One real consumer recipe can
have multiple barcode records because of package sizes, markets, source quality
or community imports. TazaScan keeps every barcode record for scanning and
provenance, but confirmed same-recipe records can be linked through a canonical
product family.

Schema:

- `CanonicalProductFamily`: canonical family metadata.
- `canonicalProductId`: existing Product row used as canonical recipe source.
- `Product.canonicalProductFamilyId`: optional membership link from barcode
  records to the family.

Consumer score resolution:

```text
barcode record -> canonical family? -> canonical product recipe -> TazaScore
barcode record -> no family -> product record -> TazaScore
```

The score is still calculated dynamically from Product data. It is not copied
or manually persisted across family members. Barcode-specific rows preserve
their own name, barcode, source, nutrition, ingredients, images and dataStatus.

Different variants and recipes must stay separate:

- regular vs zero-sugar/light/diet variants are separate;
- materially different nutrition per 100 g/ml is separate;
- country-specific recipe differences remain separate when evidence shows a
  difference;
- generated Russian ingredient translation is consumer convenience only and is
  not authoritative evidence for family matching.

Automatic linking is allowed only for very high-confidence `same_recipe`
candidates. Ambiguous cases such as compatible nutrition but different source
or incomplete ingredients are reported as `likely_same_recipe` and require
manual review.

Audit command:

```bash
cd backend/api
npm run audit:product-families
```

Controlled manual assignment:

```bash
cd backend/api
npm run link:product-family -- --dry-run --canonical=<barcode> --members=<barcode1,barcode2>
npm run link:product-family -- --canonical=<barcode> --members=<barcode1,barcode2>
npm run link:product-family -- --dry-run --remove=<barcode1,barcode2>
npm run link:product-family -- --inspect
```

The link command validates all requested products through the same conservative
family classifier. It rejects detectable `different_variant` and
`different_recipe` assignments, is idempotent for existing canonical families,
and never deletes Product records.

Coca-Cola validation result from the current local dataset:

- `5449000000996`, `42105220`, and `5449000000286` are classified as
  `likely_same_recipe` for manual review.
- They were not automatically linked because source/ingredient evidence is not
  identical.
- `5449000131836` Coca-Cola Zero is rejected as `different_variant` and remains
  separate.

No brand/SKU-specific scoring rules are allowed. Canonical family normalization
is a data identity layer, not a scoring shortcut.
