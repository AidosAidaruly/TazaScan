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
