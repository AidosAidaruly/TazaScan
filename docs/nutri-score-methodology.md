# Nutri-Score methodology foundation

This document describes the separate standards-based Nutri-Score engine added for validation.
It does not replace the legacy `NutriScoreEngine` and it does not update production product scores.

## Methodology/version

The new engine targets the revised Nutri-Score methodology adopted through the European
transnational Nutri-Score governance process:

- updated general-food algorithm described by the Scientific Committee in 2022;
- updated beverage algorithm adopted in 2023 and published by Sante publique France.

Implementation identifier:

```text
algorithm: Nutri-Score
algorithmVersion: nutri-score-v2-2023
```

This is a TazaScan implementation of the published methodology. It must not be described as
officially certified unless verified against the official calculator/reference examples.

## Reference sources

- Sante publique France, "The Nutri-Score calculation algorithm is evolving to promote healthier
  food choices", 24 April 2023:
  https://www.santepubliquefrance.fr/en/press/nutri-score-calculation-algorithm-evolving-promote-healthier-food-choices
- Sante publique France, "Update of the Nutri-Score algorithm for beverages. Second update report
  from the Scientific Committee of the Nutri-Score V2-2023", 24 April 2023:
  https://www.santepubliquefrance.fr/en/node/32929
- Dutch Government publication, "Changes to the Nutri-Score algorithm - update 2023":
  https://www.rijksoverheid.nl/documenten/2023/12/26/wijzigingen-in-algoritme-nutri-score-update-2023-engels
- Scientific literature describing the 2023 NS-NPM thresholds for beverages and general foods, used
  as a cross-check where official PDFs are not machine-readable in this repository:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12073336/
  https://pmc.ncbi.nlm.nih.gov/articles/PMC10975142/

## Output

The standards-based engine returns:

```text
rawScore
grade
algorithm
algorithmVersion
reasonCodes
missingFields
status
componentPoints
```

It does not convert the raw score to a 0-100 health percentage.

## Required inputs

Minimum official calculation inputs:

```text
servingType: per100g / per100ml
official Nutri-Score category
energyKJ or energyKcal
sugars
saturatedFat
salt
fiber
protein
fruitVegetableLegumePercent
ingredients
nonSugarSweeteners presence for beverages
fat for fats/oils/nuts/seeds category
```

The current TazaScan product model does not contain an official category field,
`fruitVegetableLegumePercent`, or a structured non-sugar-sweetener flag. The new engine therefore
supports an explicit input object and returns `insufficient_data` if official-required values are
missing.

## Categories

The engine uses typed internal categories:

```text
general_food
beverage
water
cheese
fats_oils_nuts_seeds
red_meat
```

Temporary mapping from existing `Product.category` is deterministic and limited. Unknown category
labels must not silently receive special-category scoring.

## General foods

General foods use negative points:

```text
energy:        0-10
sugars:        0-15
saturated fat: 0-10
salt:          0-20
```

Positive points:

```text
fruit/vegetable/legume percentage: 0/1/2/5
fiber: 0-5
protein: 0-7
```

Protein is not counted when negative points are high unless the category/specific rule allows it.
Red meat protein points are capped at 2.

Grade thresholds:

```text
A: raw <= 0
B: raw 1..2
C: raw 3..10
D: raw 11..18
E: raw >= 19
```

## Beverages

Beverages use beverage-specific components and thresholds. They must not use general-food sugar or
energy thresholds.

Negative points:

```text
energy: 0-10, beverage-specific scale
sugars: 0-10, beverage-specific scale
saturated fat: 0-10
salt: 0-20
non-sugar sweeteners: +4 if present
```

Positive points:

```text
fruit/vegetable/legume percentage: 0/2/4/6
fiber: 0-5
protein: 0-7, beverage-specific protein scale
```

Protein cap is removed for beverages.

Water is the only beverage eligible for grade A and is handled as a special case.

Grade thresholds:

```text
Water: A
Other beverages:
B: raw <= 2
C: raw 3..6
D: raw 7..9
E: raw >= 10
```

## Non-sugar sweeteners

For beverages, the official update adds 4 unfavorable points when non-nutritive/non-sugar sweeteners
are present.

The implementation supports deterministic ingredient detection for:

```text
aspartame
acesulfame-K / acesulfame potassium
sucralose
saccharin
cyclamate
steviol glycosides / stevia
neotame
advantame
thaumatin
Russian equivalents for common sweeteners where deterministic
```

Unknown ingredients do not automatically receive a sweetener penalty.

## Special categories

Fats/oils/nuts/seeds use saturated-fat energy for the energy component and the
saturated-fat-to-total-fat ratio for the saturated-fat component.
Cheese keeps protein counted under the category-specific rule.
Red meat caps protein points at 2.

## Missing data behavior

If official-required inputs are missing:

```text
status: insufficient_data
rawScore: null
grade: null
missingFields: [...]
```

If values are impossible or contradictory:

```text
status: requires_review
rawScore: null
grade: null
warnings: [...]
```

The engine does not assume missing official fields are zero.

## TazaScan implementation decisions

- A typed category adapter is used until the database has structured Nutri-Score category fields.
- Ingredient-based sweetener detection is deterministic and intentionally conservative.
- The implementation includes source-backed threshold tables, but still requires validation against
  the official calculator before claiming full equivalence.

## Known limitations

- Current Product data lacks `fruitVegetableLegumePercent`.
- Current Product data lacks structured `containsNonSugarSweeteners`.
- Current Product category is free text and not official-category-safe.
- Official examples/calculator fixtures are still needed for complete conformance validation.
