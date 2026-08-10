# TazaScore v1 methodology

TazaScore is a TazaScan-specific consumer score from 0 to 100. It is not an
official Nutri-Score value, not a percentage of healthiness, and not medical
advice. Official Nutri-Score A-E remains a separate standards-based indicator.

## Version

- Methodology: `TazaScore`
- Version: `taza-score-v1`
- Status: experimental, not active in production scoring

Scores produced by this version must carry the methodology version so future
versions can be recalculated and compared safely.

## Required inputs

TazaScore v1 consumes the same nutrition foundation used by
`OfficialNutriScoreEngine`:

- serving type: per 100 g or per 100 ml
- official Nutri-Score category: general food, beverage, water, cheese,
  fats/oils/nuts/seeds, or red meat
- energy kcal or kJ
- sugars
- saturated fat
- salt
- fiber
- protein
- fruit / vegetable / legume percentage
- fat for fats/oils/nuts/seeds
- non-sugar sweetener status for beverages
- ingredients where available
- optional product data status: verified, community, or unverified

Null and zero are different. Unknown values must stay null and must not be
converted into zero.

## Formula

TazaScore v1 has two scoring components:

```text
TazaScore = nutritionComponent + ingredientComponent
```

The score is rounded to the nearest integer and clamped to 0-100.

If the official nutritional foundation cannot be calculated, TazaScore returns
`status = insufficient_data` or `requires_review` and `score = null`.

Data confidence is returned separately as metadata. It does not add or subtract
score points because a product is not nutritionally better or worse because its
data is more complete.

## Component weights

### 1. Nutritional quality: 90 points

Nutrition is the foundation because the strongest structured data currently
available in the Product model is the official Nutri-Score V2-2023 input set.
TazaScore does not duplicate the Nutri-Score algorithm. It runs
`OfficialNutriScoreEngine` and converts its raw score into a consumer-facing
0-90 component. The conversion is grade-aware: each official A-E grade maps to a
TazaScore nutrition band, and the raw score positions the product inside that
band.

Conversion:

```text
Official A -> 76-90 nutrition points
Official B -> 63-75 nutrition points
Official C -> 45-62 nutrition points
Official D -> 25-44 nutrition points
Official E ->  0-24 nutrition points
```

Within a grade band:

```text
position = clamp((rawScore - gradeRawMin) / (gradeRawMax - gradeRawMin), 0, 1)
nutrition = round(pointsMax - position * (pointsMax - pointsMin))
```

Water is the official special case and receives 90 nutrition points.

Rationale:

- official grades should remain visible in the 0-100 presentation layer, so a C
  product cannot receive an A-like TazaScore nutrition component;
- beverages, fats/oils/nuts/seeds and general foods still use their own raw
  grade thresholds from `OfficialNutriScoreEngine`;
- raw scores still differentiate stronger and weaker products within the same
  official grade;
- nutrition carries 90% of the score because it is the only standards-based
  component in v1.

### 2. Ingredient and additive assessment: 10 points

This component is conservative in v1.

```text
ingredients present:
  ingredientComponent = 10

ingredients missing/unknown:
  ingredientComponent = 8
```

Additives are counted when they appear as E-numbers, but no penalty is applied
without a structured, reliable risk source.

```text
knownRiskPenalty = 0
```

Rationale:

- TazaScan should not label additives as dangerous simply because they have an
  E-number;
- sugar is already handled by the nutrition foundation, so added sugar is not
  penalized again in this component;
- non-sugar sweeteners for beverages are already handled by
  `OfficialNutriScoreEngine`, so they are not double-penalized here.

### 3. Data confidence metadata

Confidence represents how much trust the app can place in the available product
data. It is not part of the 0-100 score.

Internal confidence points are converted to a label:

```text
high:   9-10 internal confidence points
medium: 6-8 internal confidence points
low:    0-5 internal confidence points
```

Internal confidence points start from:

```text
verified:   10
community:   8
unverified:  6
unknown:     8
```

Internal confidence reductions:

```text
ingredients missing: -2
beverage sweetener status unknown: -2
```

The internal confidence value is clamped to 0-10 and exposed as `high`,
`medium`, or `low`.

Rationale:

- missing data should not silently look excellent, but it also should not be
  confused with nutritional quality;
- verified data gets full confidence, while community and unverified data remain
  usable but clearly less certain.

## Product-type handling

Sugary drinks:

- handled through official beverage energy and sugar points;
- high sugar appears as a reason from the official foundation;
- added sugar is not double-penalized in the ingredient component.

Zero-sugar drinks:

- handled through official beverage rules;
- non-sugar sweeteners add official beverage points when present;
- no additional additive penalty is applied without a structured evidence
  source.

Dairy:

- milk drinks can use the beverage category when appropriate;
- yogurt uses general-food rules unless a later data model distinguishes special
  dairy subtypes.

Snacks, sweets, bread/cereals and general foods:

- use the general food foundation unless a specific official category applies;
- high sugar, saturated fat, salt, fiber and protein all come from the official
  component calculation.

Cheese:

- uses the official cheese category so protein counting follows the official
  special rule.

Fats/oils/nuts/seeds:

- use the official category-specific saturated-fat and energy treatment.

## Kazakhstan-specific properties outside the score

The following must not affect TazaScore:

- halal status
- GOST / ST RK certification
- made in Kazakhstan
- organic certification
- marketing claims

These may later be displayed as separate product badges or attributes.

## Missing-data behavior

If required official nutrition inputs are missing, TazaScore returns:

```json
{
  "score": null,
  "status": "insufficient_data",
  "missingFields": [...]
}
```

Unknown nutrition values are never converted to zero. This prevents incomplete
products from receiving artificially excellent scores.

## Example: Coca-Cola Original Taste

Input per 100 ml:

- energy: 42 kcal
- sugars: 10.6 g
- saturated fat: 0 g
- salt: 0 g
- fiber: 0 g
- protein: 0 g
- fruit / vegetable / legume percentage: 0
- non-sugar sweeteners: false
- category: beverage
- data status: verified

Official Nutri-Score foundation:

- energy points: 3
- sugar points: 10
- saturated fat points: 0
- salt points: 0
- sweetener points: 0
- favorable points: 0
- raw score: 13
- official grade: E

Old TazaScore v1 draft:

- nutrition component: 28 / 80
- ingredient component: 10
- confidence component: 10
- total: 48 / 100

Revised TazaScore v1:

- nutrition component: 17 / 90, because raw score 13 is an official beverage E
  and maps inside the E nutrition band
- ingredient component: 10
- confidence: high
- total: 27 / 100

This means "27 according to TazaScore v1 methodology"; it does not mean
"27% healthy".

## Limitations

- Ingredient/additive assessment is intentionally neutral until a structured
  evidence source is added.
- Processing level is not scored in v1; there is no NOVA field in the current
  Product model.
- TazaScore v1 depends on the quality and completeness of official Nutri-Score
  inputs.
- Category selection is important. Incorrect product category can change the
  official foundation and therefore TazaScore.
