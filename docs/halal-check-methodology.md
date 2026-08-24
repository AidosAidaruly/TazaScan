# Halal Check v1.2 Methodology

Halal Check v1.2 is an informational ingredient and certification screening tool for TazaScan.

It is separate from TazaScore:

- TazaScore evaluates nutrition profile.
- Halal Check evaluates ingredient and certification signals.

Halal Check is not a religious ruling, not a formal certification authority, and not a replacement for checking product packaging or an official halal certificate.

## Methodology Version

```text
halal-check-v1.2
```

V1.2 expands high-value ingredient rule coverage and defines certification priority more explicitly. It does not change TazaScore.

## TazaScore Separation

Halal Check has zero numerical influence on:

- TazaScore
- OfficialNutriScoreEngine
- legacy production scoring
- nutrition score reasons
- nutrition safeguards

A product may have a high TazaScore and a `NON_HALAL` Halal Check result, or a low TazaScore and `HALAL_CONFIRMED` certification. These systems answer different questions.

## Result Dimensions

Halal Check v1.2 separates two dimensions:

- Ingredient screening: what the available ingredient data says under the covered rule set.
- Certification: whether TazaScan has trusted halal certification evidence for this exact product.

The derived top-level status is kept for compatibility and consumer presentation.

## Derived Status Priority

V1.2 derives the consumer status in this order:

1. verified certification plus explicit prohibited ingredient -> `review_required` with `CERTIFICATION_CONFLICT`
2. explicit prohibited ingredient without certification -> `non_halal`
3. verified certification without explicit prohibited conflict -> `halal_confirmed`
4. ambiguous/source-dependent ingredient without verified certification -> `review_required`
5. missing ingredients without verified certification -> `insufficient_data`
6. clean ingredient screening without verified certification -> `screening_clear`

## Statuses

### HALAL_CONFIRMED

Used only when strong evidence exists, preferably a verified halal certification record attached to the exact product.

Halal Check v1.2 does not classify a product as halal merely because no suspicious ingredient was detected.

If ingredients are missing but a trusted verified certificate is attached to the exact product, v1.2 returns `HALAL_CONFIRMED` while ingredient screening remains `insufficient_data`.

If a verified certification applies to this exact product and only source-dependent ambiguous ingredient signals are present, v1.2 returns `HALAL_CONFIRMED`. Ingredient screening still records the ambiguous signal as `review_required`, because certification is treated as evidence that may resolve source uncertainty.

### SCREENING_CLEAR

Used when ingredient data exists and no covered prohibited or ambiguous signal was detected.

This means only:

```text
No issue covered by Halal Check v1.2 rules was detected in the available ingredient data.
```

It does not mean:

```text
halal
certified halal
religiously guaranteed
```

### NON_HALAL

Used only for explicit high-confidence prohibited ingredient signals.

Examples:

- pork / porcine
- lard / pork fat / pig fat
- porcine gelatin
- explicit alcohol / ethanol as an ingredient
- blood / blood plasma as an ingredient

Every `NON_HALAL` result must include a structured reason code and matched signal.

### REVIEW_REQUIRED

Used when available data contains source-dependent or ambiguous ingredients.

Examples:

- generic gelatin without source
- bovine gelatin without certification/source qualification
- animal rennet with unknown source
- enzymes of animal origin
- E120/carmine/cochineal
- E471/E472 when source is unknown
- animal fat or animal shortening without species/source
- unverified or expired halal certification evidence

Clean ingredient lists without verified certification use `SCREENING_CLEAR`, not `REVIEW_REQUIRED`.

Generic flavouring is not automatically flagged. Only explicit alcohol-based flavouring or other documented risk wording is flagged.

### INSUFFICIENT_DATA

Used when ingredient data is missing or too incomplete to screen and no verified certification is attached.

Missing information does not imply halal compliance.

## Certification Policy

Halal confirmation requires strong certification evidence.

Supported certification states:

- `verified`
- `not_verified`
- `expired`
- `conflict`
- `unknown`

Only `verified` may produce `HALAL_CONFIRMED`.

No certification or unverified logo/text must not turn clean ingredient screening into `HALAL_CONFIRMED`.

Expired certification is not treated as current confirmation.

Consumer users cannot mark certification verified. Verification is an Admin/manual evidence process.

Certification belongs to the exact product/applicable product scope. It is not automatically copied to every product of the same brand, every canonical family member, or every package variant.

## Conflict Policy

If verified certification exists but an explicit high-confidence prohibited ingredient is detected, Halal Check v1.2 returns:

```text
REVIEW_REQUIRED
```

with:

```text
CERTIFICATION_CONFLICT
```

This is safer than blindly showing `HALAL_CONFIRMED`, because the conflict may mean stale data, incorrect ingredient source, outdated packaging, or certification mismatch.

## Ingredient Source Priority

Halal Check v1.2 uses ingredient source data conservatively.

Priority:

1. original/source ingredient text
2. source Russian ingredient text
3. OCR/admin-confirmed ingredient list
4. generated Russian translation only as matching assistance

Generated translation must not override original/source ingredient meaning.

If original/source text and generated translation conflict, original/source text wins.

## Covered Ingredient Signals

V1.2 includes a small, explicit rule database focused on high-value halal-related signals, not broad additive classification.

### Pork / Porcine

Explicit pork and porcine terms are high-confidence `NON_HALAL`, including pork extract, pork fat, lard, and reliable Russian/Kazakh aliases.

### Gelatin

- porcine/pork gelatin -> `NON_HALAL`
- generic gelatin with unknown source -> `REVIEW_REQUIRED`
- bovine gelatin -> `REVIEW_REQUIRED` unless verified certification applies
- fish gelatin and halal-certified gelatin are not flagged by the generic gelatin rule

V1.2 does not infer gelatin origin.

### Carmine / E120

`E120`, `carmine`, `cochineal`, `кармин`, and `кошениль` produce `REVIEW_REQUIRED`.

V1.2 does not claim universal religious consensus.

### Alcohol / Ethanol

Explicit ingredient terms such as alcohol, ethanol, ethyl alcohol, спирт, этанол, and этиловый спирт are high-confidence `NON_HALAL`.

Alcohol-based flavouring is `REVIEW_REQUIRED`.

Sugar alcohols, fatty alcohols, benzyl alcohol, cetyl alcohol, and stearyl alcohol are not treated as explicit ethanol by the generic alcohol rule.

### Rennet / Enzymes

- explicit porcine source -> handled by pork/porcine rules
- generic rennet or animal-origin enzymes -> `REVIEW_REQUIRED`
- microbial/vegetarian rennet is not flagged by the unknown animal rennet rule

### E471 / E472

E471 and E472 are source-dependent.

V1.2 returns `REVIEW_REQUIRED` only for configured source-dependent signals and does not label every E-number suspicious. E472 variants such as E472a-E472f are covered.

Explicit plant/vegetable source avoids the unknown-source flag.

### Animal Fat / Shortening

Animal fat or animal shortening with unknown species/source -> `REVIEW_REQUIRED`.

Pork fat/lard -> `NON_HALAL`.

Plant/vegetable fat or oil must not trigger.

### Blood / Blood-Derived Ingredients

Explicit blood or blood plasma ingredient terms are high-confidence `NON_HALAL`.

## Canonical Product Families

Halal Check v1.2 does not automatically inherit halal certification across canonical product families.

Ingredient-based screening may use the product ingredient data currently exposed for the consumer product. Certification should apply only to the specific product/packaging unless Admin evidence explicitly supports broader use.

## Admin Certification Workflow

Admin certification management is an operational evidence workflow, not a change to the Halal Check methodology:

```text
find product
-> inspect ingredient screening
-> inspect certification evidence
-> enter certification data
-> explicitly verify
-> backend recalculates derived Halal Check result
```

Certification verification means that TazaScan has reviewed the certification evidence for the specific product record. It is not set automatically because an issuer, evidence URL, product name, brand, or ingredient text mentions halal.

Certification is product-specific and is not automatically propagated to canonical family members or other barcodes. Certification does not affect TazaScore, legacy scoring, nutrition values, ingredients, OCR, image handling, or product ranking.

If a verified certification conflicts with a high-confidence prohibited ingredient signal, Halal Check returns a review-required conflict state. Admin must investigate the product data and certification manually; the system must not automatically delete certification or override ingredients.

## Limitations

- No automatic halal logo detection from images.
- No scraping of halal websites.
- No theological verdicts beyond the documented screening methodology.
- No numeric halal score.
- No effect on TazaScore or any nutrition score.
- No automatic filtering, hiding, ranking, or reordering products.
- No inference from brand, product name, country, or missing data.

## Real Data Validation

See `docs/halal-check-validation-report.md`.

Current local validation summary:

- total products: 29
- `halal_confirmed`: 0
- `non_halal`: 0
- `screening_clear`: 22
- `review_required`: 0
- `insufficient_data`: 7

No noisy ingredient-rule false positives were found in the current dataset. V1.2 reports products with available clean ingredient data as `screening_clear` while still showing certification separately as not verified.

Current validation gaps:

- the local database had not applied the `product_halal_certifications` migration at audit time
- no real certification rows were validated
- no real gelatin, E120, E471/E472, alcohol, blood, or rennet/enzyme products were present
- seven current products lacked reliable ingredient text
