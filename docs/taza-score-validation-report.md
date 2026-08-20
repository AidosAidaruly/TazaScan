# TazaScore validation report

This report validates the current `OfficialNutriScoreEngine` and revised
`TazaScoreEngine` on isolated fixtures. No validation products were persisted.

TazaScore is a TazaScan consumer-facing score whose nutritional foundation is
based on Nutri-Score V2-2023. It is not an official Nutri-Score value and not a
scientifically validated health score.

## Freeze decision

`taza-score-v1` is frozen for consumer UI presentation. Production persisted
legacy scoring remains unchanged for compatibility, but consumer-facing product
details and product lists should display TazaScore separately from official
Nutri-Score. If TazaScore is unavailable, the UI must show an unavailable state
instead of silently falling back to the legacy score.

Product duplicate auditing and multilingual ingredient normalization are tracked
separately in `docs/product-data-normalization.md`. Those workflows must not
change TazaScore formulas, thresholds, safeguards, or confidence rules.

## Root-cause audit

The main anomaly came from the previous raw-score conversion:

```text
nutrition = linear raw Nutri-Score conversion to 0-90
```

That mapping could give official C-grade products A-like TazaScore values. The
clearest examples were zero-sugar cola and plain milk, both official C with raw
score 4 but TazaScore 82.

The revised mapping is generic and grade-aware:

```text
Official A -> 76-90 nutrition points
Official B -> 63-75 nutrition points
Official C -> 45-62 nutrition points
Official D -> 25-44 nutrition points
Official E ->  0-24 nutrition points
```

The official raw score still positions a product inside its official grade band.
The official Nutri-Score calculation itself was not changed.

## Before -> after table

| Product | Old TazaScore | New TazaScore | Official raw | Official grade | Nutrition | Ingredients | Confidence | Main positive | Main negative | Explanation of change |
|---|---:|---:|---:|:---:|---:|---:|:---:|---|---|---|
| Plain water | 100 | 100 | 0 | A | 90/90 | 10/10 | high | Nutri-Score A | Low favorable components | Water remains the official special case. |
| Sugary cola | 41 | 27 | 13 | E | 17/90 | 10/10 | high | No additive penalty | High sugar; energy contributes; low favorable components | Beverage E now maps to the E nutrition band instead of a broad linear scale. |
| Zero-sugar cola | 82 | 66 | 4 | C | 56/90 | 10/10 | high | No additive penalty | Non-sugar sweeteners; low favorable components | Official C no longer receives an A-like TazaScore. |
| Plain milk | 82 | 66 | 4 | C | 56/90 | 10/10 | high | No additive penalty | Sugar contributes; high energy | Official C no longer receives an A-like TazaScore. |
| Sweetened yogurt | 69 | 70 | 4 | C | 60/90 | 10/10 | high | No additive penalty | Sugar contributes | Generic C-band mapping slightly raises this raw-score position; reason generation is improved. |
| Potato chips | 53 | 46 | 14 | D | 36/90 | 10/10 | high | No additive penalty | High energy; high salt; saturated fat contributes | Official D maps lower than before. |
| Plain oats | 85 | 92 | -6 | A | 82/90 | 10/10 | high | Nutri-Score A | Energy contributes | Strong A products are better differentiated upward. |
| Whole-grain bread | 67 | 67 | 5 | C | 57/90 | 10/10 | high | No additive penalty | Energy contributes; salt contributes | This C product stays stable but now has clearer reasons. |
| Chocolate | 31 | 25 | 27 | E | 15/90 | 10/10 | high | No additive penalty | High sugar; high energy; high saturated fat | Official E maps lower than before. |
| 100% orange juice | 78 | 61 | 5 | C | 51/90 | 10/10 | high | No additive penalty | High sugar; energy contributes | Official C beverage no longer appears A-like despite fruit percentage credit. |

## Anomaly analysis

### Zero-sugar cola

Root cause: raw-score-to-TazaScore mapping, not the sweetener calculation.
`OfficialNutriScoreEngine` already applies the V2 beverage sweetener points.
The revised mapping lowers zero-sugar cola from 82 to 66 without adding a second
sweetener penalty.

### 100% orange juice

Root cause: mapping plus official beverage fruit percentage credit. The revised
mapping lowers orange juice from 78 to 61. It still shows high sugar as a
negative reason.

### Potato chips

Root cause: no processing component and previous D-grade mapping was generous.
The revised mapping lowers chips from 53 to 46. Ingredient/additive scoring
remains neutral because no structured risk source is available.

### Sweetened yogurt

Root cause: missing reason generation. The score changes only slightly, from 69
to 70, because the generic C-band mapping places raw score 4 near the stronger
side of C for general foods. The improved reason layer now reports that sugar
contributes to the nutritional score.

### Oats and whole foods

Oats rise from 85 to 92 because a strong official A should not be compressed too
close to weaker foods. This is acceptable, but the UI should still show that
energy contributes to the raw score.

## Ingredient/additive component

The ingredient component remains conservative:

- E-number alone receives no penalty.
- Unknown additive risk is neutral.
- Only structured evidence-based risk rules may reduce this component in a
  future version.

This is a known limitation, not a silent claim that all additives are harmless.

## Confidence

Confidence remains metadata only:

- high
- medium
- low

It does not add or subtract score points.

## Production recommendation

TazaScore is closer to production readiness after the grade-aware mapping, but
it should remain admin-preview-only for now.

Reasons:

1. Ingredient/additive scoring is still neutral without a structured risk
   dataset.
2. There is no NOVA/processing field yet, so highly processed products may still
   look more favorable than expected.
3. Sweetened yogurt still scores fairly high because the official general-food C
   raw score is strong inside the C band.
4. Production UI needs careful wording: TazaScore is not official Nutri-Score
   and not a health percentage.

Recommended next step: review presentation wording and decide whether v1 needs
structured ingredient-risk data or processing metadata before production
integration.

## Partial-data validation update

TazaScore v1 now keeps Official Nutri-Score strict while allowing TazaScore to
calculate from partial product-label data. Unknown values remain null and do not
become zero. Missing fields are reported separately and reduce confidence rather
than directly adding or subtracting score points.

When Official Nutri-Score cannot be calculated, TazaScore uses known nutrition
components only, normalizes the known weighted components to 0-90, and adds the
existing conservative 0-10 ingredient component.

Minimum evidence threshold:

```text
nutritionCoverage >= 0.25
at least 3 scored core nutrition fields
at least 2 known negative nutrition fields
```

### Real product preview results

These results were generated from the local development database after seeding
real product-label data.

| Product | Barcode | Official Nutri-Score | Before safeguard | After safeguard | Confidence | Coverage | Missing critical fields | Safeguard applied | Reason |
|---|---|---|---:|---:|:---:|---:|---|---|---|
| WOTO Drinking Water | 4870207510444 | A, raw 0 | 100 | 100 | high | 1.00 | none | no | Complete official foundation. |
| Coca-Cola Original Taste | 5449000000996 | E, raw 13 | 27 | 27 | high | 1.00 | none | no | Complete official foundation. |
| Махеевъ Кетчуп Шашлычный | 4604248020767 | unavailable | 74 | 74 | medium | 0.78 | none | no | Critical negatives sugar, salt and saturated fat are known. |
| Bon Appetit Майонез Провансаль 67% | 4870144749266 | unavailable | 24 | 24 | low | 0.31 | sugars, salt, saturatedFatApproximation | no | Known energy and fat already produce a low score below the cap. |
| Томатный рай Томатная паста 25% | 4870144745152 | unavailable | 89 | 28 | low | 0.31 | sugars, salt, saturatedFatApproximation | yes | Low coverage plus missing critical negatives capped an inflated partial score. |

Detailed fields:

| Product | Used fields | Missing fields |
|---|---|---|
| WOTO Drinking Water | officialNutriScore | none |
| Coca-Cola Original Taste | officialNutriScore | none |
| Махеевъ Кетчуп Шашлычный | energyKcal, sugars, saturatedFat, salt, protein | fiber, fruitVegetableLegumePercent |
| Bon Appetit Майонез Провансаль 67% | energyKcal, fat, protein | sugars, saturatedFat, salt, fiber, fruitVegetableLegumePercent |
| Томатный рай Томатная паста 25% | energyKcal, fat, protein | sugars, saturatedFat, salt, fiber, fruitVegetableLegumePercent |

### Interpretation notes

- Water and Coca-Cola still use the complete official foundation and remain high
  confidence.
- Ketchup can now be scored because energy, sugar, saturated fat, salt and
  protein are known. Official Nutri-Score remains unavailable because fiber and
  fruit/vegetable/legume percentage are missing.
- Mayonnaise can now be scored with low confidence. Total fat is used only as a
  lower-weight fallback because saturated fat is missing.
- Tomato paste previously received a high partial score because only favorable
  known fields participated in normalization. The missing-data safeguard now
  caps it because sugar, salt and saturated fat are unavailable.
- No validation product returns `insufficient_data` after this update. A product
  with only calories or only a name still returns `insufficient_data`.

### Synthetic edge-case coverage

Regression tests cover:

- only low calories known while sugar and salt are unknown -> insufficient data;
- energy and sugar known while salt and saturated fat are unknown -> calculated
  with a missing-critical-negative cap;
- all negative fields known while positive fields are missing -> calculated
  without a critical cap;
- most fields known -> calculated with high coverage;
- only positive fields known -> insufficient data.

### Remaining interpretation risk

Partial TazaScore is suitable for beta/admin preview when shown with confidence,
coverage and missing fields. It is not ready to be presented alone as a
production consumer score, because a generic cap cannot replace missing label
data and does not model processing level or structured additive risk.

## First repaired Open Food Facts validation batch

This section records observed engine behavior for the first repaired Open Food
Facts products in the local development database. It does not introduce any
methodology, threshold, category-mapping, confidence, safeguard, Prisma,
Flutter, Admin, or scoring-engine changes.

Source of truth:

- persisted `Product` rows in PostgreSQL;
- `ProductService.previewProductScore`;
- current `TazaScoreEngine` result metadata.

The Open Food Facts category repair updated only
`officialNutriScoreCategory`. Product nutrition, ingredients, image, name,
brand, `dataStatus`, `source`, and `lastVerifiedAt` were not changed by this
report.

### Summary table

| Product | Barcode | Brand | Official category | Nutrition component | Ingredient component | Score before safeguard | Score cap | Final TazaScore | Confidence | Coverage | Safeguards |
|---|---|---|---|---:|---:|---:|---:|---:|:---:|---:|---|
| Merci Milk Selection | 4014400901405 | Merci | general_food | 27/90 | 10/10 | 37 | none | 37 | medium | 85% | none |
| MMMAX Oreo | 7622210750495 | Milka | general_food | 29/90 | 10/10 | 39 | none | 39 | medium | 85% | none |
| Dark Chocolate | 4870036001205 | Kazakhstan | general_food | 68/90 | 10/10 | 78 | none | 78 | medium | 85% | none |
| Greek yogurt | 4870207313328 | FoodMaster | general_food | 69/90 | 10/10 | 79 | 28 | 28 | low | 31% | coverage_cap, missing_critical_negative_cap |
| творог 9% | 4600605029329 | Простоквашино | general_food | 80/90 | 10/10 | 90 | 28 | 28 | low | 31% | coverage_cap, missing_critical_negative_cap |

### Raw scoring inputs

Missing values are shown as `null`, not as zero or false.

| Product | Serving | Energy kcal | Protein | Carbs | Sugars | Fat | Saturated fat | Fiber | Salt | FVL % | Non-sugar sweeteners | Ingredients count | Data status |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---:|---|
| Merci Milk Selection | per100g | 579 | 8.1 | 50.1 | 48.3 | 37.8 | 20.4 | 0 | 0.21 | null | null | 19 | community |
| MMMAX Oreo | per100g | 557 | 4.8 | 56 | 48 | 34 | 19 | 1.6 | 0.38 | null | null | 21 | community |
| Dark Chocolate | per100g | 532.74378585086 | 6.3 | 52.7 | 0 | 33.4 | 0 | 0 | 0 | null | null | 7 | community |
| Greek yogurt | per100g | 122.4 | 4.8 | 6.9 | null | 8.4 | null | null | null | null | null | 22 | community |
| творог 9% | per100g | 153 | 15 | 3 | null | 9 | null | null | null | null | null | 3 | community |

### Partial-data diagnostics

| Product | Status | Used fields | Missing fields | Missing critical fields | Reason codes |
|---|---|---|---|---|---|
| Merci Milk Selection | calculated | energyKcal, sugars, saturatedFat, salt, fiber, protein | fruitVegetableLegumePercent | none | PARTIAL_NUTRITION_FOUNDATION, HIGH_ENERGY, HIGH_SUGAR, HIGH_SATURATED_FAT, LOW_FAVORABLE_NUTRITIONAL_COMPONENTS |
| MMMAX Oreo | calculated | energyKcal, sugars, saturatedFat, salt, fiber, protein | fruitVegetableLegumePercent | none | PARTIAL_NUTRITION_FOUNDATION, HIGH_ENERGY, HIGH_SUGAR, HIGH_SATURATED_FAT, LOW_FAVORABLE_NUTRITIONAL_COMPONENTS |
| Dark Chocolate | calculated | energyKcal, sugars, saturatedFat, salt, fiber, protein | fruitVegetableLegumePercent | none | PARTIAL_NUTRITION_FOUNDATION, HIGH_ENERGY, LOW_FAVORABLE_NUTRITIONAL_COMPONENTS |
| Greek yogurt | calculated | energyKcal, fat, protein | sugars, saturatedFat, salt, fiber, fruitVegetableLegumePercent | sugars, salt, saturatedFatApproximation | PARTIAL_NUTRITION_FOUNDATION, PARTIAL_DATA_CONFIDENCE_LIMIT, LOW_FAVORABLE_NUTRITIONAL_COMPONENTS, LOW_NUTRITION_COVERAGE, MISSING_CRITICAL_NEGATIVE_FIELD, PARTIAL_SCORE_CAP_APPLIED |
| творог 9% | calculated | energyKcal, fat, protein | sugars, saturatedFat, salt, fiber, fruitVegetableLegumePercent | sugars, salt, saturatedFatApproximation | PARTIAL_NUTRITION_FOUNDATION, PARTIAL_DATA_CONFIDENCE_LIMIT, HIGH_PROTEIN, LOW_FAVORABLE_NUTRITIONAL_COMPONENTS, LOW_NUTRITION_COVERAGE, MISSING_CRITICAL_NEGATIVE_FIELD, PARTIAL_SCORE_CAP_APPLIED |

Official Nutri-Score remains unavailable for all five rows because
`fruitVegetableLegumePercent` is missing for the three chocolate/confectionery
rows, and several required nutrients are missing for Greek yogurt and tvorog.
TazaScore still calculates because the partial-data path has enough evidence.

The current `TazaScoreResult` exposes component scores and reason codes. It
does not expose numeric per-field contribution rows. This report therefore
does not present invented per-field point totals.

### Product explanations

#### Merci Milk Selection

Observed result: `37/100`, medium confidence, 85% coverage.

The engine uses energy, sugars, saturated fat, salt, fiber and protein. High
energy, high sugar and high saturated fat are present in the reason codes, and
fruit/vegetable/legume percentage is missing. Ingredient data is present, so
the ingredient component is `10/10`. No safeguard is applied because coverage
is high enough and no critical negative field is missing.

Final score remains the pre-safeguard score: `37`.

#### MMMAX Oreo

Observed result: `39/100`, medium confidence, 85% coverage.

The engine uses the same fields as Merci: energy, sugars, saturated fat, salt,
fiber and protein. Reason codes again include high energy, high sugar and high
saturated fat. The nutrition component is slightly higher than Merci
(`29/90` vs `27/90`) because the persisted inputs are slightly less severe in
the current methodology: lower energy, slightly lower sugar, lower saturated
fat, and some fiber. No safeguard is applied.

Final score remains the pre-safeguard score: `39`.

#### Dark Chocolate

Observed result: `78/100`, medium confidence, 85% coverage.

The engine uses energy, sugars, saturated fat, salt, fiber and protein. The
key difference is the persisted Open Food Facts data: sugars, saturated fat and
salt are all `0`. Because explicit zero is valid data and must remain zero, the
engine treats those negative nutrients as known low values. The reason codes
show high energy, but do not show high sugar or high saturated fat.

Ingredient data is present and no structured additive-risk penalty is applied,
so the ingredient component is `10/10`. No safeguard is applied because the
critical negative fields are not missing; they are present as explicit zeroes.

Final score remains the pre-safeguard score: `78`.

### Dark Chocolate comparison

| Field / result | Merci Milk Selection | MMMAX Oreo | Dark Chocolate |
|---|---:|---:|---:|
| Energy kcal | 579 | 557 | 532.74378585086 |
| Sugars | 48.3 | 48 | 0 |
| Saturated fat | 20.4 | 19 | 0 |
| Salt | 0.21 | 0.38 | 0 |
| Fiber | 0 | 1.6 | 0 |
| Protein | 8.1 | 4.8 | 6.3 |
| Nutrition component | 27/90 | 29/90 | 68/90 |
| Ingredient component | 10/10 | 10/10 | 10/10 |
| Score before safeguard | 37 | 39 | 78 |
| Safeguard applied | none | none | none |
| Final TazaScore | 37 | 39 | 78 |
| Reason codes | HIGH_ENERGY, HIGH_SUGAR, HIGH_SATURATED_FAT | HIGH_ENERGY, HIGH_SUGAR, HIGH_SATURATED_FAT | HIGH_ENERGY |

Observed engine behavior is internally consistent with the current inputs:
Dark Chocolate scores much higher because the persisted OFF record reports
zero sugar, zero saturated fat and zero salt. The current engine is not
contradicting itself.

Possible validation concern: this may reveal a general data-quality failure
mode. For chocolate-like products, an external record with explicit zero sugar
or saturated fat can produce a high TazaScore if the values are inaccurate in
Open Food Facts. This is not a scoring-methodology bug by itself, because
explicit zero must not be treated as missing. It is a data-validation concern
for future review.

#### Greek yogurt

Observed result: `28/100`, low confidence, 31% coverage.

Only energy, total fat and protein are used. Sugars, saturated fat, salt, fiber
and fruit/vegetable/legume percentage are missing. Because saturated fat is
missing while total fat is known, the engine uses the lower-weight total-fat
fallback and reports `saturatedFatApproximation` as a missing critical field.

The preliminary score is `79`, but the missing-data safeguard caps it to `28`.
Both `coverage_cap` and `missing_critical_negative_cap` apply.

Final score after safeguard: `28`.

#### творог 9%

Observed result: `28/100`, low confidence, 31% coverage.

Only energy, total fat and protein are used. Protein is high enough to appear
as a favorable reason, producing a high preliminary score of `90`. However,
sugars, saturated fat, salt, fiber and fruit/vegetable/legume percentage are
missing. As with Greek yogurt, saturated fat is missing while total fat is
known, so the engine reports `saturatedFatApproximation`.

The missing-data safeguard caps the score from `90` to `28`. Both
`coverage_cap` and `missing_critical_negative_cap` apply.

Final score after safeguard: `28`.

### Greek yogurt and tvorog comparison

| Field / result | Greek yogurt | творог 9% |
|---|---:|---:|
| Energy kcal | 122.4 | 153 |
| Protein | 4.8 | 15 |
| Carbohydrates | 6.9 | 3 |
| Sugars | null | null |
| Fat | 8.4 | 9 |
| Saturated fat | null | null |
| Fiber | null | null |
| Salt | null | null |
| Used fields | energyKcal, fat, protein | energyKcal, fat, protein |
| Coverage | 31% | 31% |
| Score before safeguard | 79 | 90 |
| Score cap | 28 | 28 |
| Final TazaScore | 28 | 28 |

Both products have low coverage because the only participating fields are
energy, total fat fallback and protein. The critical missing fields are the
same, so both are capped to the same final score.

### General potential failure modes

Observed behavior is internally consistent with the current engine result
metadata, but the batch reveals two general validation concerns:

1. External records with explicit zeroes for important negative nutrients can
   score much higher than similar products. This is correct if the zeroes are
   truly label-backed, but risky if Open Food Facts data is incomplete or
   inaccurate while still represented as `0`.
2. Dairy-like products with missing sugar, saturated fat and salt can have high
   preliminary partial scores from energy, fat fallback and protein, then rely
   heavily on safeguards. The final score is protected, but the expanded beta
   UI should keep showing confidence, coverage, missing critical fields and
   safeguards.

No scoring bug is asserted here. These are validation concerns to review before
production UI exposure.

## External data-quality validation

External and community product data is now checked by a separate diagnostic
layer. This does not change TazaScore inputs, formula, thresholds, safeguards,
confidence, Official Nutri-Score, or legacy scoring.

The validator is intentionally conservative:

- Open Food Facts/community provenance is distinguishable, but not automatically
  treated as incorrect.
- Missing critical nutrition fields are reported as data-completeness warnings.
  They do not replace TazaScore coverage or confidence.
- Explicit zero remains explicit zero. It is never converted to null and never
  overwritten.
- Verified/manual products are not downgraded by this diagnostic layer.
- Water and other structured low-energy contexts are not flagged merely because
  nutrition fields are zero.

### Suspicious external zero pattern

The first repaired OFF batch exposed a data-quality failure mode separate from
the scoring engine. Dark Chocolate (`4870036001205`) is a general-food product
from Open Food Facts with high energy and dense macronutrients, while sugars,
saturated fat and salt are persisted as explicit `0`.

Because explicit zero is valid input, TazaScore correctly used those values and
returned `78/100`. The scoring engine itself was not the cause of that result.
The concern is that an external record may contain incorrect explicit zeroes.

For external/community `general_food` products, the validator now flags a
review warning when multiple important negative nutrients are explicit zeroes
in a dense product context, for example:

```text
SUSPICIOUS_EXTERNAL_ZERO_PATTERN
fields: sugars, saturatedFat, salt
```

This warning means: review the external nutrition against the package label. It
does not mean the product data has been modified, and it does not reduce or
increase TazaScore.

## Second Open Food Facts validation batch tooling

A second controlled Open Food Facts validation batch importer was added for
broader category discovery. This is still not a production sync: there are no
cron jobs, no background workers, no schema changes, no Flutter changes, and no
TazaScore methodology changes.

Commands:

```bash
npm run import:off-validation-batch-2 -- --dry-run
npm run import:off-validation-batch-2
```

The batch-2 importer uses the official Open Food Facts API only. It discovers
candidate products from category-oriented searches, fetches the selected
barcode records through the existing OFF product endpoint, and then reuses the
existing `mapOpenFoodFactsProduct` mapping path.

Data-quality diagnostics are reported beside TazaScore diagnostics:

- `dataQuality.status`
- warning codes
- warning fields
- TazaScore score/confidence/coverage
- missing critical fields
- score before safeguard
- score cap
- safeguards applied

### Dry-run observation

The first dry-run with global search terms returned many irrelevant high-quality
records from outside Kazakhstan/CIS, mostly water/milk-like products. Discovery
was then tightened with country/category filters and round-robin category
selection.

The final dry-run produced 21 selected products. Nineteen were import-compatible
in dry-run mode; two failed during the per-barcode OFF fetch because Open Food
Facts returned `429`.

| Barcode | Query | Product | Category | Ingredients | Image | Nutrition | TazaScore | Confidence | Data quality |
|---|---|---|---|---|---|---|---:|---|---|
| 6111246721261 | water | Fromage Blanc Nature | cheese | yes | yes | full | 73 | medium | ok |
| 6111035000058 | soda | Eau minérale naturelle | water | yes | yes | partial | 100 | medium | review: missing critical nutrition |
| 6111242106949 | cheese | Jben | cheese | yes | yes | full | 66 | medium | ok |
| 20002183 | cottage-cheese | Fiocchi di latte | cheese | yes | yes | full | 83 | medium | ok |
| 7622210449283 | chocolate | Prince | general_food | yes | yes | full | 63 | medium | ok |
| 3175680011480 | cookies | Sésame | general_food | yes | yes | full | 76 | medium | ok |
| 6111128000071 | chips-snacks | Ain Saïss | water | yes | yes | full | 100 | medium | ok |
| 4601576007231 | sauce-ketchup | Кетчуп | general_food | yes | yes | partial | unavailable | low | review: missing critical nutrition |
| 6111035000430 | water | Sidi Ali | water | yes | yes | full | 100 | medium | ok |
| 6111266962187 | soda | Lait de la ferme jaouda | beverage | yes | yes | partial | 90 | low | ok |
| 6111246721278 | cheese | Cream cheese | cheese | yes | yes | full | 85 | medium | ok |
| 8480000609632 | cottage-cheese | Queso fresco cottage | cheese | yes | yes | full | 82 | medium | ok |
| 6111242101180 | chocolate | uht jaouda 1L | beverage | yes | yes | partial | 90 | low | ok |
| 6111031005064 | cookies | Tonik | general_food | yes | yes | full | 42 | medium | ok |
| 6111252421568 | chips-snacks | اكوافينا | water | yes | yes | full | 100 | medium | ok |
| 6111242100992 | water | Perly | general_food | yes | yes | full | 84 | medium | ok |
| 6111035002175 | soda | Sidi Ali | water | yes | yes | none | 100 | medium | review: missing critical nutrition |
| 6111203006653 | cheese | unavailable | unavailable | no | no | none | unavailable | unavailable | failed: OFF 429 |
| 3033491997792 | cottage-cheese | Cottage cheese | cheese | yes | yes | partial | 89 | medium | ok |
| 3274080005003 | chocolate | unavailable | unavailable | no | no | none | unavailable | unavailable | failed: OFF 429 |
| 3229820100234 | cookies | Fourrés Chocolat Noir | general_food | yes | yes | full | 61 | medium | ok |

Aggregate dry-run findings:

- candidates considered: 21
- selected products: 21
- would import/import-compatible: 19
- ingredients available: 19
- without ingredients: 2
- images available: 19
- full nutrition: 13
- partial nutrition: 5
- data-quality warnings: 3
- confidence distribution: medium 16, low 3
- category distribution: cheese 6, water 5, general_food 6, beverage 2
- TazaScore distribution: 80-100 = 12, 60-79 = 5, 40-59 = 1, unavailable = 3

Open Food Facts returned `503` for two discovery searches during the run:

- cereals-oats
- sausage-meat

Open Food Facts returned `429` while fetching two selected barcodes:

- 6111203006653
- 3274080005003

### General validation concerns

This batch currently shows source/discovery limitations more than formula
limitations:

1. Open Food Facts search can return intermittent `503` responses.
2. Even with Kazakhstan/CIS-oriented filters, category availability is uneven.
3. Several records have images but no ingredients.
4. Several records have partial nutrition and require low-confidence TazaScore
   interpretation.
5. Some products score unexpectedly high for their category because the current
   engine has no processing penalty and additive scoring remains conservative.

These findings are data-quality/discovery concerns. They are not implemented as
formula changes.

### Real import result

The real batch-2 import was run after dry-run review.

Command:

```bash
npm run import:off-validation-batch-2
```

Result:

- candidates considered: 16
- selected products: 16
- imported: 15
- already existing: 0
- skipped incompatible: 1
- ingredients available: 11
- without ingredients: 5
- images available: 15
- full nutrition: 10
- partial nutrition: 4
- data-quality warnings: 4
- confidence distribution: medium 6, low 9
- category distribution: water 1, beverage 3, general_food 10,
  fats_oils_nuts_seeds 1
- TazaScore distribution: 80-100 = 7, 60-79 = 4, 40-59 = 1, 20-39 = 3,
  unavailable = 1

Imported products:

| Barcode | Query | Product | Category | Ingredients | Image | Nutrition | TazaScore | Confidence | Data quality |
|---|---|---|---|---|---|---|---:|---|---|
| 4670001494397 | water | Nestle PureLife Water | water | yes | yes | none | 100 | medium | review: missing critical nutrition |
| 5449000131836 | soda | Coca-Cola Zero 500ml | beverage | yes | yes | full | 83 | low | ok |
| 3760049790214 | bread | Pain De Mie Bio | general_food | yes | yes | full | 81 | medium | ok |
| 3229820019307 | cereals-oats | Flocons d'avoine | general_food | yes | yes | full | 89 | medium | ok |
| 4630026561825 | cookies | Яшкино ChocoStix в молочном шоколаде | general_food | yes | yes | partial | 29 | low | review: missing critical nutrition |
| 4690388123635 | chips-snacks | лейс стейк рибай с соусом | general_food | no | yes | full | 69 | low | ok |
| 5449000000286 | soda | Coca Cola | beverage | yes | yes | full | 58 | low | ok |
| 3760049798609 | bread | Pain de mie grandes tranches Seigle & Graines 500g | general_food | yes | yes | full | 85 | medium | ok |
| 3168930009078 | cereals-oats | Flocons d'avoine complète | general_food | yes | yes | full | 89 | medium | ok |
| 4680021880490 | cookies | jaskino | general_food | yes | yes | partial | 28 | low | review: missing critical nutrition |
| 4690388121419 | chips-snacks | Шевченко 9 Lay's Maxx Двойной Гамбургер | general_food | no | yes | full | 69 | low | ok |
| 42105220 | soda | Coca Cola | beverage | yes | yes | partial | 63 | low | ok |
| 3228857002344 | bread | Pain de mie american sandwich complet sans sucres ajoutés 600g | general_food | yes | yes | full | 85 | medium | ok |
| 4607109843741 | cookies | Батончик Чио Рио | general_food | no | yes | partial | 28 | low | review: missing critical nutrition |
| 4690388110277 | chips-snacks | Чипсы (Сметана и зелень) | fats_oils_nuts_seeds | no | yes | full | 79 | low | ok |

Skipped:

| Barcode | Query | Status | Reason |
|---|---|---|---|
| 20003166 | cereals-oats | skipped_incompatible | OFF product is missing fields required by Product creation |

Discovery errors during the real import:

- cheese: OFF search returned `503`
- chocolate: OFF search returned `503`
- sauce-ketchup: OFF search returned `503`
- mayonnaise: OFF search returned `503`
- staples: OFF search returned `503`

The real import did not overwrite existing products and did not mark Open Food
Facts data as verified. Imported rows remain community/external data and should
be reviewed before any production use.

## Consolidated TazaScore v1 Validation Audit

This audit uses the current local database rows imported from controlled Open
Food Facts validation batches. It is analysis only. No TazaScore formula,
threshold, safeguard, confidence, category mapping, Product data, Prisma,
Flutter, Admin UI, or legacy scoring behavior was changed.

Dataset rule:

```text
source = "Open Food Facts"
```

Products included: `24`.

Products excluded: none from the OFF-imported dataset. Rows that cannot produce
TazaScore are still included below as unavailable-score cases.

### Consolidated per-product table

Missing values are shown as `null` and were not converted to zero.

| Barcode | Product | Brand | Status | Category | kcal | Protein | Carbs | Sugars | Fat | Sat fat | Fiber | Salt | FVL % | Sweeteners | TazaScore | Conf. | Cov. | Used fields | Missing critical | Before | Cap | Safeguards | Data quality |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---:|---|---:|---|---|---:|---:|---|---|
| 4014400901405 | Merci Milk Selection | Merci | calculated | general_food | 579 | 8.1 | 50.1 | 48.3 | 37.8 | 20.4 | 0 | 0.21 | null | null | 37 | medium | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 37 | null | none | ok |
| 7622210750495 | MMMAX Oreo | Milka | calculated | general_food | 557 | 4.8 | 56 | 48 | 34 | 19 | 1.6 | 0.38 | null | null | 39 | medium | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 39 | null | none | ok |
| 4600375913798 | барни | null | insufficient_data | null | 119 | 1.8 | 18 | 9.6 | 4.5 | 0.0009 | 0.3 | null | null | null | null | low | 0% | none | none | null | null | none | review: MISSING_CRITICAL_NUTRITION |
| 4870112006902 | Halley ulker | null | insufficient_data | null | null | null | null | null | null | null | null | null | null | null | null | low | 0% | none | none | null | null | none | review: MISSING_CRITICAL_NUTRITION |
| 4870036001205 | Dark Chocolate | Kazakhstan | calculated | general_food | 532.74 | 6.3 | 52.7 | 0 | 33.4 | 0 | 0 | 0 | null | null | 78 | medium | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 78 | null | none | review: SUSPICIOUS_EXTERNAL_ZERO_PATTERN |
| 4870207313328 | Greek yogurt | FoodMaster | calculated | general_food | 122.4 | 4.8 | 6.9 | null | 8.4 | null | null | null | null | null | 28 | low | 31% | energyKcal, fat, protein | sugars, salt, saturatedFatApproximation | 79 | 28 | coverage_cap, missing_critical_negative_cap | review: MISSING_CRITICAL_NUTRITION |
| 4600605029329 | творог 9% | Простоквашино | calculated | general_food | 153 | 15 | 3 | null | 9 | null | null | null | null | null | 28 | low | 31% | energyKcal, fat, protein | sugars, salt, saturatedFatApproximation | 90 | 28 | coverage_cap, missing_critical_negative_cap | review: MISSING_CRITICAL_NUTRITION |
| 4607016243160 | Kascha | null | insufficient_data | null | 350 | 10 | 65 | 22.5 | 0.84 | 0.84 | 7.5 | 1.1875 | null | null | null | low | 0% | none | none | null | null | none | ok |
| 4602481106309 | царь 5 злаков | null | insufficient_data | null | null | null | null | null | null | null | null | null | null | null | null | low | 0% | none | none | null | null | none | review: MISSING_CRITICAL_NUTRITION |
| 4670001494397 | Nestle PureLife Water | Nestlé | calculated | water | null | null | null | null | null | null | null | null | null | null | 100 | medium | 100% | officialNutriScore | none | null | null | none | review: MISSING_CRITICAL_NUTRITION |
| 5449000131836 | Coca-Cola Zero 500ml | Coca-Cola | calculated | beverage | 0.2 | 0 | 0 | 0 | 0 | 0 | 0 | 0.05 | null | null | 83 | low | 89% | energyKcal, sugars, saturatedFat, salt, containsNonSugarSweeteners, fiber, protein | none | 83 | null | none | ok |
| 3760049790214 | Pain De Mie Bio | La Boulangère | calculated | general_food | 268 | 8.1 | 47 | 6.3 | 4.2 | 0.4 | 4.9 | 1.1 | null | null | 81 | medium | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 81 | null | none | ok |
| 3229820019307 | Flocons d'avoine | BJORG | calculated | general_food | 363.33 | 11 | 58 | 1.7 | 7.1 | 1.3 | 11 | 0.02 | null | null | 89 | medium | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 89 | null | none | ok |
| 4630026561825 | Яшкино ChocoStix в молочном шоколаде | KDV | calculated | general_food | 500 | 6.5 | 61 | null | 26 | 12.9 | null | null | null | null | 29 | low | 38% | energyKcal, saturatedFat, protein | sugars, salt | 29 | null | none | review: MISSING_CRITICAL_NUTRITION |
| 4690388123635 | лейс стейк рибай с соусом | Lay's | calculated | general_food | 530 | 6.5 | 52 | 1.5 | 32 | 3.9 | 4.4 | 1.0825 | null | null | 69 | low | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 69 | null | none | ok |
| 5449000000286 | Coca Cola | Coca-Cola | calculated | beverage | 42 | 0 | 10.6 | 10.6 | 0 | 0 | 0 | 0 | null | null | 58 | low | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 58 | null | none | ok |
| 3760049798609 | Pain de mie grandes tranches Seigle & Graines 500g | La boulangere | calculated | general_food | 297 | 12 | 37 | 4.2 | 9.6 | 1 | 7.2 | 0.96 | null | null | 85 | medium | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 85 | null | none | ok |
| 3168930009078 | Flocons d'avoine complète | Quaker | calculated | general_food | 395 | 11 | 60 | 1.1 | 8 | 1.5 | 9 | 0.01 | null | null | 89 | medium | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 89 | null | none | ok |
| 4680021880490 | jaskino | KDV | calculated | general_food | 470 | 5.5 | 61 | null | 23 | null | null | null | null | null | 28 | low | 31% | energyKcal, fat, protein | sugars, salt, saturatedFatApproximation | 57 | 28 | coverage_cap, missing_critical_negative_cap | review: MISSING_CRITICAL_NUTRITION |
| 4690388121419 | Шевченко 9 Lay's Maxx Двойной Гамбургер | Lay's | calculated | general_food | 530 | 6 | 53 | 1.8 | 32 | 3.9 | 4.4 | 1.2 | null | null | 69 | low | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 69 | null | none | ok |
| 42105220 | Coca Cola | Coca-Cola | calculated | beverage | 42 | 0 | 10.6 | 10.6 | 0 | 0 | null | 0 | null | null | 63 | low | 78% | energyKcal, sugars, saturatedFat, salt, protein | none | 63 | null | none | ok |
| 3228857002344 | Pain de mie american sandwich complet sans sucres ajoutés 600g | Harrys | calculated | general_food | 280 | 7.7 | 43 | 3.6 | 6.8 | 0.5 | 8.1 | 1.1 | null | null | 85 | medium | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 85 | null | none | ok |
| 4607109843741 | Батончик Чио Рио | KDV | calculated | general_food | 510 | 3.5 | 59 | null | 29 | null | null | null | null | null | 28 | low | 31% | energyKcal, fat, protein | sugars, salt, saturatedFatApproximation | 45 | 28 | coverage_cap, missing_critical_negative_cap | review: MISSING_CRITICAL_NUTRITION |
| 4690388110277 | Чипсы (Сметана и зелень) | Lay's | calculated | fats_oils_nuts_seeds | 2190 | 6 | 53 | 2.4 | 32 | 3.9 | 4.4 | 1.6 | null | null | 79 | low | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 79 | null | none | ok |

### High-score analysis

High-score products are those with `TazaScore >= 80`.

| Product | Score | Confidence | Main reason for high score | Audit note |
|---|---:|---|---|---|
| Nestle PureLife Water | 100 | medium | official water special case | Score is expected for water, but external row still has missing nutrition warnings. This is source completeness, not score inflation. |
| Coca-Cola Zero 500ml | 83 | low | very low known sugar/energy/salt values | Score depends on partial beverage path because sweetener status is unknown. This is a data-completeness concern, not enough evidence alone to change formula. |
| Pain De Mie Bio | 81 | medium | known low saturated fat plus fiber/protein | High bread score appears driven by favorable fiber/protein and low sat fat. Missing FVL keeps it partial. |
| Flocons d'avoine | 89 | medium | high fiber/protein, low sugar/salt | Expected favorable whole-grain pattern. |
| Pain de mie Seigle & Graines | 85 | medium | fiber/protein with low sugar/sat fat | Plausible within current v1, though processing is not scored. |
| Flocons d'avoine complète | 89 | medium | high fiber/protein, low sugar/salt | Expected favorable oats pattern. |
| Pain de mie sans sucres ajoutés | 85 | medium | high fiber and low sugar/sat fat | Plausible within v1; processing/ultra-processing not modeled. |

High scores are mostly explained by genuinely favorable known nutrition under
the current v1 rules. The two interpretation cautions are:

1. processed breads can score high because v1 has no processing/NOVA component;
2. zero-sugar beverage confidence remains low when sweetener status is unknown.

Neither pattern alone proves a systemic scoring failure, but both should remain
visible in beta UI via confidence, missing fields and method disclosure.

### Low-confidence products

| Product | Score | Coverage | Used fields | Missing critical | Before -> final | Safeguards | Interpretation |
|---|---:|---:|---|---|---|---|---|
| барни | null | 0% | none | none | null -> null | none | Unavailable because category is missing. |
| Halley ulker | null | 0% | none | none | null -> null | none | Unavailable because category and nutrition are missing. |
| Greek yogurt | 28 | 31% | energyKcal, fat, protein | sugars, salt, saturatedFatApproximation | 79 -> 28 | coverage_cap, missing_critical_negative_cap | Safeguards correctly prevent inflated dairy score. |
| творог 9% | 28 | 31% | energyKcal, fat, protein | sugars, salt, saturatedFatApproximation | 90 -> 28 | coverage_cap, missing_critical_negative_cap | Same safeguard behavior as Greek yogurt; consistent. |
| Kascha | null | 0% | none | none | null -> null | none | Nutrition exists, but category is missing, so engine correctly refuses. |
| царь 5 злаков | null | 0% | none | none | null -> null | none | Category and nutrition are missing. |
| Coca-Cola Zero 500ml | 83 | 89% | energyKcal, sugars, saturatedFat, salt, sweeteners, fiber, protein | none | 83 -> 83 | none | Low confidence is from unknown sweetener status/partial official input, not low coverage. |
| Яшкино ChocoStix | 29 | 38% | energyKcal, saturatedFat, protein | sugars, salt | 29 -> 29 | none | Known energy/sat fat already keep score low; cap not needed. |
| лейс стейк рибай | 69 | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 69 -> 69 | none | Low confidence comes from missing ingredients/partial official input, not missing critical negatives. |
| Coca Cola 5449000000286 | 58 | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 58 -> 58 | none | Low confidence due unknown beverage sweetener status/FVL, with high sugar still reflected. |
| jaskino | 28 | 31% | energyKcal, fat, protein | sugars, salt, saturatedFatApproximation | 57 -> 28 | coverage_cap, missing_critical_negative_cap | Safeguard works as intended. |
| Lay's Maxx Двойной Гамбургер | 69 | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 69 -> 69 | none | Complete critical nutrition but missing ingredients lowers confidence. |
| Coca Cola 42105220 | 63 | 78% | energyKcal, sugars, saturatedFat, salt, protein | none | 63 -> 63 | none | Similar to other cola, with missing fiber and sweetener status. |
| Батончик Чио Рио | 28 | 31% | energyKcal, fat, protein | sugars, salt, saturatedFatApproximation | 45 -> 28 | coverage_cap, missing_critical_negative_cap | Safeguard works as intended. |
| Чипсы (Сметана и зелень) | 79 | 85% | energyKcal, sugars, saturatedFat, salt, fiber, protein | none | 79 -> 79 | none | Category is fats/oils/nuts/seeds; no ingredients. This is a category/mapping concern to review, not a formula failure. |

Low-confidence behavior is internally consistent. The main repeated pattern is
that missing sugar/salt/saturated fat in dairy/confectionery-like rows either
prevents scoring or triggers caps. Products with full critical nutrition can
still be low confidence when ingredient data or official-only inputs are
missing.

### Data-quality warnings

| Product | Warning | Scoring behavior | Source/input interpretation |
|---|---|---|---|
| барни | missing salt | score unavailable | Category is missing; no score inflation. |
| Halley ulker | missing all critical nutrition | score unavailable | OFF record is too incomplete. |
| Dark Chocolate | suspicious explicit zeroes: sugars, saturatedFat, salt | 78, no safeguard | Strange high score is explained by external explicit zeroes. This is source quality, not current formula behavior. |
| Greek yogurt | missing sugars, saturatedFat, salt | 28 after cap | Safeguards separate partial-data risk from product score. |
| творог 9% | missing sugars, saturatedFat, salt | 28 after cap | Same consistent cap behavior. |
| царь 5 злаков | missing all critical nutrition | score unavailable | OFF record is too incomplete. |
| Nestle PureLife Water | missing critical nutrition | 100 water special case | Water score is expected; warning is too broad for water completeness and should be read as provenance warning, not health concern. |
| Яшкино ChocoStix | missing sugars and salt | 29 | Known energy/saturated fat already keep score low. |
| jaskino | missing sugars, saturatedFat, salt | 28 after cap | Safeguard behaves as intended. |
| Батончик Чио Рио | missing sugars, saturatedFat, salt | 28 after cap | Safeguard behaves as intended. |

Only Dark Chocolate shows a high score with a data-quality warning. The
diagnostic correctly separates suspicious external zeroes from the scoring
engine. This supports keeping data-quality review separate from score formula.

### Unavailable scores

| Product | Barcode | Blocking reason | Blocker class |
|---|---|---|---|
| барни | 4600375913798 | `officialNutriScoreCategory` missing | category mapping / incomplete OFF metadata |
| Halley ulker | 4870112006902 | `officialNutriScoreCategory` and ingredients missing, nutrition missing | ingestion/source incompleteness |
| Kascha | 4607016243160 | `officialNutriScoreCategory` missing despite nutrition present | category mapping gap |
| царь 5 злаков | 4602481106309 | `officialNutriScoreCategory` and ingredients missing, nutrition missing | ingestion/source incompleteness |

No unavailable score indicates a formula defect. The blocking issues are
category metadata and insufficient OFF source data.

### Category-level findings

| Category | Count | Score range | Mean | Median | Confidence | Common missing fields | Safeguards | DQ warnings |
|---|---:|---|---:|---:|---|---|---|---:|
| general_food | 15 | 28-89 | 57.5 | 69 | medium 8, low 7 | fruitVegetableLegumePercent, sugars, saturatedFat, salt, fiber | coverage_cap, missing_critical_negative_cap | 6 |
| null | 4 | unavailable | null | null | low 4 | officialNutriScoreCategory, ingredients | none | 3 |
| water | 1 | 100 | 100 | 100 | medium 1 | none | none | 1 |
| beverage | 3 | 58-83 | 68 | 63 | low 3 | fruitVegetableLegumePercent, containsNonSugarSweeteners, fiber | none | 0 |
| fats_oils_nuts_seeds | 1 | 79 | 79 | 79 | low 1 | fruitVegetableLegumePercent | none | 0 |

Repeated patterns:

1. `general_food` is the broadest bucket and contains both expected low scores
   for sweets and high scores for oats/breads.
2. Null category rows never score, which is safe but highlights mapping gaps.
3. Beverages remain low confidence when sweetener status is unknown.
4. `fats_oils_nuts_seeds` has only one imported example, and it is a chips
   product. That row should be reviewed as category-mapping/source quality
   before drawing methodology conclusions.

### General failure-mode conclusion

The current dataset does not demonstrate a reproducible general TazaScore
methodology failure.

Observed concerns are real, but they are mostly outside formula stability:

- OFF records are sometimes incomplete.
- Some imported rows lack official category mapping.
- One Dark Chocolate row appears high because OFF reports explicit zero sugar,
  saturated fat and salt.
- Breads and oats can score high because v1 scores nutrition only and does not
  model processing level.
- Beverages with unknown sweetener status are scored but low-confidence.

The safeguards behave consistently in the clearest risky partial-data cases:
Greek yogurt, tvorog, jaskino and Chio Rio. The score caps prevent high
preliminary partial scores from appearing as reliable final scores when
critical negative nutrients are missing.

Final recommendation:

```text
READY_TO_FREEZE_V1
```

Rationale: no clear systemic methodology failure was found. Remaining concerns
are data quality, category completeness, source provenance and future
methodology scope such as processing/additive evidence. Those should be handled
as validation and product-data work, not as last-minute v1 formula changes.

## Coca-Cola Cross-Variant Audit

This audit compares every Coca-Cola-like product currently found in the local
development database. It is analysis only; no scoring formula, threshold,
product data, category mapping, UI, schema or merge behavior was changed.

### Records found

Four Coca-Cola records were found. A broad text search also matched one
unrelated `Dark Chocolate` product because `cola` appears inside `chocolate`;
that false positive is excluded from this audit.

| Product | Barcode | Source | Data status | Category | Official category | Nutrition summary | Structured sweetener value | Visible sweeteners in ingredients | TazaScore | Confidence | Coverage | Official Nutri-Score | Safeguards |
|---|---|---|---|---|---|---|---|---|---:|---|---:|---|---|
| Coca-Cola Original Taste | 5449000000996 | seed | verified | Soft Drinks | beverage | 42 kcal, 10.6 g sugar, 0 g saturated fat, 0 g salt | false | no | 27 | high | 100% | E, raw 13 | none |
| Coca-Cola Zero 500ml | 5449000131836 | Open Food Facts | community | Diet cola soft drink | beverage | 0.2 kcal, 0 g sugar, 0 g saturated fat, 0.05 g salt | null | yes | 83 | low | 89% | unavailable: missing FVL % | none |
| Coca Cola | 42105220 | Open Food Facts | community | Cola with sugar | beverage | 42 kcal, 10.6 g sugar, 0 g saturated fat, 0 g salt, fiber unknown | null | no | 63 | low | 78% | unavailable: missing fiber and FVL % | none |
| Coca Cola | 5449000000286 | Open Food Facts | community | Cola with sugar | beverage | 42 kcal, 10.6 g sugar, 0 g saturated fat, 0 g salt, 0 g fiber | null | no | 58 | low | 85% | unavailable: missing FVL % | none |

### Why Coca-Cola Original is 27

The verified seed Coca-Cola has complete official beverage inputs. The
standards-based official path can be used, so TazaScore is based on the
Official Nutri-Score foundation rather than the partial-data fallback.

Official beverage raw score:

| Component | Points |
|---|---:|
| Energy, 42 kcal | 3 |
| Sugars, 10.6 g | 10 |
| Saturated fat, 0 g | 0 |
| Salt, 0 g | 0 |
| Non-sugar sweeteners, false | 0 |
| Fruit/vegetable/legume %, 0 | 0 |
| Fiber, 0 g | 0 |
| Protein, 0 g | 0 |
| Negative total | 13 |
| Positive total | 0 |
| Raw score | 13 |
| Grade | E |

TazaScore then maps the official E foundation to `17 / 90` nutrition points.
The conservative ingredient component is `10 / 10`, because the current v1
does not penalize E-numbers or additives without structured evidence-based risk
rules. Final score: `17 + 10 = 27`.

Reason codes include `HIGH_SUGAR`, `LOW_FAVORABLE_NUTRITIONAL_COMPONENTS`,
`VERIFIED_PRODUCT_DATA` and `OFFICIAL_NUTRI_SCORE_FOUNDATION`.

### Why the OFF sugary colas are 58 and 63

Both OFF sugary colas have the same important negative beverage nutrition as
the verified original: 42 kcal, 10.6 g sugar, 0 g saturated fat and 0 g salt.
However, they do not have all strict official fields:

- both have `fruitVegetableLegumePercent = null`;
- both have `containsNonSugarSweeteners = null`;
- barcode `42105220` also has `fiber = null`.

Because Official Nutri-Score is unavailable, TazaScore uses the partial-data
path. The partial path still sees high sugar and marks confidence low, but it
normalizes over available known fields and applies no safeguard because the
critical negative fields sugar, salt, saturated fat and energy are present.

That produces:

- `42105220`: nutrition `53 / 90` + ingredients `10 / 10` = `63`;
- `5449000000286`: nutrition `48 / 90` + ingredients `10 / 10` = `58`.

The 63 vs 58 difference is data-driven, not SKU-specific logic. The rows have
different persisted ingredient text and different known/missing nutrition
fields, especially `fiber = null` versus `fiber = 0`.

### Why Coca-Cola Zero is 83

Coca-Cola Zero has very low known negative nutrition values: nearly zero
energy, zero sugar, zero saturated fat and low salt. Under the current
partial-data formula this yields a high nutrition component:

- nutrition `73 / 90`;
- ingredients `10 / 10`;
- final score `83`.

The result is low confidence, because Official Nutri-Score is unavailable and
the structured sweetener field is unknown. The ingredient text visibly includes
sweeteners, so this row is a data-structure/provenance issue: the product text
contains sweetener evidence, but `containsNonSugarSweeteners` is still `null`.
The current v1 does not automatically infer that boolean from free-text
ingredients.

### Difference classification

| Comparison | Explanation | Classification |
|---|---|---|
| Verified original 27 vs OFF sugary colas 58/63 | Complete official foundation vs partial-data fallback caused by missing official-only fields. | data completeness / methodology interaction |
| OFF sugary cola 63 vs OFF sugary cola 58 | Different persisted fields and ingredients; one row has missing fiber, the other has explicit 0 fiber. | data-driven |
| Verified original 27 vs Zero 83 | Zero has genuinely different known nutrition: 0 sugar and very low energy. | product-data-driven, with low-confidence sweetener metadata |
| Zero 83 with visible sweeteners | Ingredient text contains sweeteners, but structured sweetener value is null. | external data normalization gap |

### Duplicate and variant findings

The existing duplicate audit groups `42105220` and `5449000000286` as a
Coca-Cola-like pair. The current classification is `recipe_or_market_variant`,
not an automatic duplicate merge. They should remain separate until manually
reviewed because the persisted ingredient and nutrition data are not identical.

The verified seed record `5449000000996` should not be overwritten by Open Food
Facts data. No merge, delete or overwrite action was performed.

### Methodology conclusion

```text
POTENTIAL_GENERAL_SCORING_ISSUE
```

This is not a Coca-Cola-specific bug and not a database corruption issue. The
general concern is that high-sugar beverages with known sugar/energy but
missing official-only inputs can receive a materially higher partial-data
TazaScore than the same beverage with complete official inputs.

The current safeguards protect against missing critical negative nutrients, but
they do not cap a beverage when sugar, salt, saturated fat and energy are known
while official-only inputs such as FVL percentage and non-sugar sweetener status
are missing. That behavior is generic and should be reviewed before using
partial-data TazaScore as the sole consumer-facing production score.

No scoring methodology was changed in this audit.

## Partial Beverage Score Inflation Follow-Up

This follow-up validates and fixes the general partial-data beverage issue
identified by the Coca-Cola cross-variant audit. Unlike the previous audit,
this section records a methodology change. The frozen `taza-score-v1` behavior
is preserved historically; the active engine now reports `taza-score-v1.1`.

No SKU-specific logic was added. Product names, barcodes, brands and imported
rows are not used by the safeguard.

### Regression matrix

Focused engine-level fixtures were created so the same beverage nutrition could
be compared while changing only official-only metadata where practical.

| Case | v1 score | v1.1 score | Confidence | Coverage | Before safeguard | Score cap | Safeguards | Used fields |
|---|---:|---:|---|---:|---:|---:|---|---|
| High-sugar/high-energy beverage, complete metadata | 27 | 27 | high | 100% | null | null | none | officialNutriScore |
| Same nutrition, FVL missing | 60 | 44 | medium | 89% | 60 | 44 | beverage_official_metadata_cap | energyKcal, sugars, saturatedFat, salt, containsNonSugarSweeteners, fiber, protein |
| Same nutrition, sweetener metadata missing | 27 | 27 | medium | 100% | null | null | none | officialNutriScore |
| Same nutrition, FVL and sweetener missing | 58 | 44 | low | 85% | 58 | 44 | beverage_official_metadata_cap | energyKcal, sugars, saturatedFat, salt, fiber, protein |
| Zero-sugar/near-zero-energy beverage, sweetener detected from ingredients, FVL missing | 83 | 76 | low | 89% | 83 | 76 | beverage_official_metadata_cap | energyKcal, sugars, saturatedFat, salt, containsNonSugarSweeteners, fiber, protein |
| Plain water | 100 | 100 | high | 100% | null | null | none | officialNutriScore |
| Moderate-sugar beverage, FVL and sweetener missing | 72 | 62 | low | 85% | 72 | 62 | beverage_official_metadata_cap | energyKcal, sugars, saturatedFat, salt, fiber, protein |
| Moderate-sugar beverage, complete metadata | 54 | 54 | high | 100% | null | null | none | officialNutriScore |

The matrix reproduces the general failure mode. A high-sugar beverage with
complete metadata scores `27`, but the same nutrition with missing FVL metadata
previously scored `60`. With both FVL and sweetener metadata missing it scored
`58`. This is materially inflated relative to the complete official beverage
foundation.

### Root methodological reason

The partial-data path normalizes only over known weighted fields. That is
usually acceptable when the missing fields are non-critical or are handled by
existing coverage and missing-critical-negative caps. For beverages, however,
`fruitVegetableLegumePercent` and `containsNonSugarSweeteners` are
official-only metadata fields that can determine whether the strict official
beverage foundation is available.

When sugars, energy, saturated fat and salt are known, the existing
missing-critical-negative cap does not apply. The product can therefore avoid
the complete official beverage mapping and receive a higher partial score even
when known sugar/energy already show a materially negative beverage profile.

### v1.1 safeguard

`taza-score-v1.1` adds a generic partial beverage metadata cap.

It applies only when:

- category is `beverage`;
- the partial-data path is used;
- FVL percentage or sweetener metadata is missing;
- known factual beverage negative points indicate risk.

Cap rules:

```text
known beverage sugar points >= 8 -> max 44
known beverage negative points >= 10 -> max 44
known beverage negative points >= 7 -> max 62
known/detected non-sugar sweeteners -> max 76
otherwise -> no beverage metadata cap
```

Null semantics remain unchanged:

- unknown FVL is not converted to `0`;
- unknown sweetener status is not converted to `false`;
- explicit `0` remains `0`;
- explicit `false` remains `false`.

The safeguard reports `beverage_official_metadata_cap` in
`safeguardsApplied` when it caps the preliminary score.

### Coca-Cola before and after

| Product | Barcode | v1 score | v1.1 score | Confidence | Coverage | Before safeguard | Score cap | Safeguards | Interpretation |
|---|---|---:|---:|---|---:|---:|---:|---|---|
| Coca-Cola Original Taste | 5449000000996 | 27 | 27 | high | 100% | null | null | none | Complete official foundation unchanged. |
| Coca Cola OFF | 42105220 | 63 | 44 | low | 78% | 63 | 44 | coverage_cap, beverage_official_metadata_cap | High sugar/energy known; official beverage metadata incomplete. |
| Coca Cola OFF | 5449000000286 | 58 | 44 | low | 85% | 58 | 44 | beverage_official_metadata_cap | High sugar/energy known; official beverage metadata incomplete. |
| Coca-Cola Zero 500ml | 5449000131836 | 83 | 76 | low | 89% | 83 | 76 | beverage_official_metadata_cap | Not treated as sugary; reduced only because sweeteners are detected and FVL is missing. |

The 27 case remains unchanged. The two sugary OFF records no longer appear as
moderate/high partial-data beverages. Coca-Cola Zero remains clearly above
sugary cola because sugar and energy are genuinely low, but it no longer
appears near-perfect while official beverage metadata is incomplete.

### Effect on other validation products

Representative persisted non-beverage validation products were recalculated:

| Product | Barcode | Category | v1 score | v1.1 score | Safeguards |
|---|---|---|---:|---:|---|
| WOTO Drinking Water | 4870207510444 | water | 100 | 100 | none |
| Махеевъ Кетчуп Шашлычный | 4604248020767 | general_food | 74 | 74 | none |
| Bon Appetit Майонез Провансаль 67% | 4870144749266 | fats_oils_nuts_seeds | 24 | 24 | none |
| Томатный рай Томатная паста 25% | 4870144745152 | general_food | 28 | 28 | coverage_cap, missing_critical_negative_cap |
| Merci Milk Selection | 4014400901405 | general_food | 37 | 37 | none |
| MMMAX Oreo | 7622210750495 | general_food | 39 | 39 | none |

No unrelated category changed numerically in these representative checks. The
new cap is scoped to partial-data beverages only. Water remains on the official
water path.

### Decision

```text
GENERAL_FAILURE_MODE_REPRODUCED
SCORING_CHANGE_REQUIRED
ACTIVE_VERSION: taza-score-v1.1
```

The fix is generic, data-driven and uncertainty-based. It does not contain
Coca-Cola-specific logic and does not alter Official Nutri-Score, legacy
scoring, Prisma, Flutter/Admin UI or imported product data.
