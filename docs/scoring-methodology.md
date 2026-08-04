# TazaScan Scoring Methodology

MVP draft. This methodology is informational and not medical advice.

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

The application depends on `ScoreEngine`, not directly on `NutriScoreEngine`. This allows replacing the MVP scoring engine with a future `TazaScoreEngine` without rewriting controllers, repositories, or mobile/admin DTOs.

## Missing Data

Unknown nutrition values remain `null`. TazaScan never converts unknown values to fake zero.

## Review Status

If required fields are missing, the score status is `insufficient_data`.

If contradictions are detected, such as sugars greater than carbohydrates, saturated fat greater than fat, negative nutrition values, or sugar ingredients with 0 g sugars, the score status is `requires_review`.

## Limitations

The MVP scoring engine does not represent final TazaScore. Some official Nutri-Score inputs are not fully modeled yet, including certain encouraged food group percentages and sweetener-specific beverage rules.
