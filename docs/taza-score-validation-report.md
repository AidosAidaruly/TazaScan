# TazaScore validation report

This report validates the current `OfficialNutriScoreEngine` and revised
`TazaScoreEngine` on isolated fixtures. No validation products were persisted.

TazaScore is a TazaScan consumer-facing score whose nutritional foundation is
based on Nutri-Score V2-2023. It is not an official Nutri-Score value and not a
scientifically validated health score.

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
