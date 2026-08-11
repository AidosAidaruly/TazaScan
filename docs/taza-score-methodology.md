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

## Inputs

TazaScore v1 can consume the complete standards-based input set used by
`OfficialNutriScoreEngine`, but it can also calculate from partial product-label
data when enough evidence is available:

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

If the official nutritional foundation can be calculated, TazaScore uses the
grade-aware official foundation described below.

If the official nutritional foundation cannot be calculated, TazaScore attempts
a partial-data calculation from known fields only. Official Nutri-Score remains
strict and may still return `insufficient_data`.

Data confidence is returned separately as metadata. It does not add or subtract
score points because a product is not nutritionally better or worse because its
data is more complete.

## Component weights

### 1. Nutritional quality: 90 points

Nutrition is the foundation. When official inputs are complete, TazaScore runs
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

#### Partial-data nutrition fallback

When Official Nutri-Score is unavailable because required fields are missing,
TazaScore uses only known nutritional fields and normalizes the known weighted
components back to 0-90.

Unknown values do not contribute positive or negative points. They are reported
in `missingFields` and reduce confidence only.

Partial component weights:

```text
energy:                    18
sugars:                    24
saturated fat:             18
total fat fallback:        10
salt:                      20
non-sugar sweeteners:       4
fiber:                      8
protein:                    6
fruit/vegetable/legume:    12
```

Negative components such as energy, sugar, saturated fat and salt use the
existing official point functions where possible:

```text
componentScore = weight * (1 - officialPoints / maxOfficialPoints)
```

Favorable components such as fiber, protein and fruit/vegetable/legume content
use:

```text
componentScore = weight * (officialPoints / maxOfficialPoints)
```

If saturated fat is unknown but total fat is known, TazaScore may use a lower
weight total-fat fallback. This is intentionally weaker than saturated fat and
is flagged through lower confidence.

The partial nutrition score is:

```text
partialNutrition = round(sum(componentScore) / sum(knownWeights) * 90)
```

### Missing-data safeguard

Partial normalization can otherwise inflate scores: if a high-risk nutrient is
missing, the score would be normalized over only the known fields and the
unknown risk would disappear. TazaScore v1 therefore applies a generic maximum
score cap for partial calculations.

This cap is not a direct confidence bonus or penalty. It is an uncertainty
safeguard that prevents low-coverage products from looking nearly perfect when
critical negative nutrients are missing.

Coverage cap:

```text
nutritionCoverage >= 0.85 -> max 100
nutritionCoverage >= 0.75 -> max 90
nutritionCoverage >= 0.55 -> max 78
nutritionCoverage >= 0.35 -> max 65
nutritionCoverage <  0.35 -> max 55
```

Missing critical negative nutrient cap adjustments:

```text
missing sugars:        -12
missing salt:          -10
missing saturated fat: -10
saturated fat missing but total fat known: -5
```

The cap is clamped to a minimum of 25. It is only applied when the preliminary
partial score exceeds the cap.

Result metadata exposes:

```json
{
  "scoreBeforeSafeguard": 89,
  "scoreCap": 28,
  "safeguardsApplied": ["coverage_cap", "missing_critical_negative_cap"],
  "missingCriticalFields": ["sugars", "salt", "saturatedFatApproximation"]
}
```

Minimum evidence threshold:

```text
nutritionCoverage >= 0.25
at least 3 scored core nutrition fields
at least 2 known negative nutrition fields
```

This prevents products with only a name or only calories from receiving a
TazaScore. A product with energy plus several known nutrients can still be
scored with medium or low confidence.

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
official Nutri-Score unavailable / partial calculation: -2
nutrition coverage below 75%: -2
nutrition coverage below 55%: -3
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

If too little nutrition evidence is available, TazaScore returns:

```json
{
  "score": null,
  "status": "insufficient_data",
  "missingFields": [...]
}
```

Unknown nutrition values are never converted to zero. This prevents incomplete
products from receiving artificially excellent scores. Missing fields are
reported separately:

```json
{
  "status": "calculated",
  "score": 74,
  "confidence": { "level": "medium" },
  "usedFields": ["energyKcal", "sugars", "saturatedFat", "salt", "protein"],
  "missingFields": ["fiber", "fruitVegetableLegumePercent"],
  "nutritionCoverage": 0.78
}
```

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
- TazaScore v1 can calculate with partial data, but low coverage can produce a
  score that must be interpreted together with confidence and missing fields.
- Category selection is important. Incorrect product category can change the
  official foundation and therefore TazaScore.
