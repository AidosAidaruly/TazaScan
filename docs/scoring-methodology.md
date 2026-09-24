# TazaScan Scoring Methodology

Legacy scoring reference. This methodology is informational and not medical advice. The consumer app now uses [TazaScore v1.1](taza-score-methodology.md); the details below concern legacy compatibility fields, not the primary consumer score.

## Current Engine

The current backend uses a modular `ScoreEngine` interface and a `NutriScoreEngine` implementation as a nutritional foundation.

The app stores:

- calculated score
- grade
- status
- positive reasons
- negative reasons
- warnings
- missing fields
- algorithm name
- algorithm version
- calculation timestamp

## Why The Interface Exists

Legacy writes depend on `ScoreEngine`. `TazaScoreEngine` already exists and is calculated separately for consumer DTOs and score previews, using `OfficialNutriScoreEngine` for its nutrition foundation.

## Missing Data

Unknown nutrition values remain `null`. TazaScan never converts unknown values to fake zero.

## Review Status

If required fields are missing, the score status is `insufficient_data`.

If contradictions are detected, such as sugars greater than carbohydrates, saturated fat greater than fat, negative nutrition values, or sugar ingredients with 0 g sugars, the score status is `requires_review`.

## Limitations

The legacy engine does not represent consumer TazaScore. Official category, encouraged food group percentage and sweetener inputs now exist in the schema; availability varies by product.
