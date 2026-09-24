# Halal Check v1.2 Real Data Validation Report

Current-state note (2026-09-18): all 10 local Prisma migrations, including halal certifications, are applied. Missing-table statements below describe the original audit and are historical. See [AITU demo verification](aitu-demo-readiness.md) for current checks. Original audit results and later ingredient-backfill notes are preserved.

Validation date: 2026-08-22

Command:

```bash
cd backend/api
npm run audit:halal-check
```

This audit is read-only. It does not mutate product data, certification data, scoring data, or imports.

## Dataset

Current local product dataset:

- total products: 29
- certification table available in the local database: no
- certification rows validated: 0

The codebase contains the `product_halal_certifications` migration, but the current local database used for this audit had not applied it yet. The audit continued in ingredient-only mode.

## Status Distribution

| Status | Count | Percent |
| --- | ---: | ---: |
| `halal_confirmed` | 0 | 0% |
| `screening_clear` | 22 | 76% |
| `non_halal` | 0 | 0% |
| `review_required` | 0 | 0% |
| `insufficient_data` | 7 | 24% |

V1.2 separates ingredient screening from certification. Products with available clean ingredient data use `screening_clear`, while certification remains separately reported as not verified.

## Ingredient Screening Distribution

| Ingredient screening | Count | Percent |
| --- | ---: | ---: |
| `clear` | 22 | 76% |
| `review_required` | 0 | 0% |
| `non_halal_detected` | 0 | 0% |
| `insufficient_data` | 7 | 24% |

## Certification Distribution

| Certification | Count | Percent |
| --- | ---: | ---: |
| `verified` | 0 | 0% |
| `not_verified` | 29 | 100% |
| `expired` | 0 | 0% |
| `conflict` | 0 | 0% |
| `unknown` | 0 | 0% |

## Rule Hit Distribution

| Reason | Count |
| --- | ---: |
| `NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED` | 22 |
| `INGREDIENTS_MISSING` | 7 |

No real product in the current dataset triggered:

- `PORK_DETECTED`
- `PORK_FAT_DETECTED`
- `PORCINE_GELATIN_DETECTED`
- `GELATIN_SOURCE_UNKNOWN`
- `CARMINE_E120_DETECTED`
- `ALCOHOL_DETECTED`
- `ALCOHOL_BASED_FLAVOURING_DETECTED`
- `ANIMAL_RENNET_SOURCE_UNKNOWN`
- `ANIMAL_ENZYMES_SOURCE_UNKNOWN`
- `E471_SOURCE_UNKNOWN`
- `E472_SOURCE_UNKNOWN`
- `CERTIFICATION_VERIFIED`
- `CERTIFICATION_CONFLICT`

## Product-Level Findings

Representative current rows:

| Product | Barcode | Status | Ingredient source | Audit quality | Note |
| --- | --- | --- | --- | --- | --- |
| Coca-Cola Original Taste | `5449000000996` | `review_required` | ingredient list | `NEEDS_MANUAL_REVIEW` | No configured issue detected, but no verified halal certification. |
| Coca Cola | `42105220` | `review_required` | ingredient list | `NEEDS_MANUAL_REVIEW` | No configured issue detected, but no verified halal certification. |
| Coca Cola | `5449000000286` | `review_required` | ingredient list | `NEEDS_MANUAL_REVIEW` | No configured issue detected, but no verified halal certification. |
| Coca-Cola Zero 500ml | `5449000131836` | `review_required` | ingredient list | `NEEDS_MANUAL_REVIEW` | No configured issue detected, but no verified halal certification. |
| Merci Milk Selection | `4014400901405` | `review_required` | ingredient list | `NEEDS_MANUAL_REVIEW` | No configured issue detected, but no verified halal certification. |
| MMMAX Oreo | `7622210750495` | `review_required` | original source text | `NEEDS_MANUAL_REVIEW` | No configured issue detected, but no verified halal certification. |
| Barni | `4600375913798` | `review_required` | source Russian text | `NEEDS_MANUAL_REVIEW` | No configured issue detected, but no verified halal certification. |
| Halley Ulker | `4870112006902` | `insufficient_data` | missing | `DATA_LIMITATION` | Missing reliable ingredient text. |
| Dark Chocolate | `4870036001205` | `review_required` | ingredient list | `NEEDS_MANUAL_REVIEW` | No configured issue detected, but no verified halal certification. |
| Greek yogurt | `4870207313328` | `review_required` | source Russian text | `NEEDS_MANUAL_REVIEW` | No configured issue detected, but no verified halal certification. |
| творог 9% | `4600605029329` | `review_required` | source Russian text | `NEEDS_MANUAL_REVIEW` | No configured issue detected, but no verified halal certification. |
| Yashkino / ChocoStix | `4630026561825` | `review_required` | source Russian text | `NEEDS_MANUAL_REVIEW` | No configured issue detected, but no verified halal certification. |
| Lay's Maxx Double Hamburger | `4690388121419` | `insufficient_data` | missing | `DATA_LIMITATION` | Missing reliable ingredient text. |
| Lay's steak ribeye sauce | `4690388123635` | `insufficient_data` | missing | `DATA_LIMITATION` | Missing reliable ingredient text. |
| WOTO Drinking Water | `4870207510444` | `review_required` | ingredient list | `NEEDS_MANUAL_REVIEW` | No configured issue detected, but no verified halal certification. |

## Coca-Cola Findings

Under v1.1, ordinary Coca-Cola and Coca-Cola Zero should be presented as:

- ingredient screening: `clear`
- certification: `not_verified`
- derived consumer status: `screening_clear`

Consumer copy should say that no covered issue was detected in the available ingredient data and that halal certification is not verified. It must not say `halal_confirmed`, and it must not show `review_required` unless an actual ambiguous ingredient signal appears.

Current Coca-Cola-like rows:

- `42105220`
- `5449000000996`
- `5449000000286`
- `5449000131836`

Findings:

- ingredient source used: ingredient list
- alcohol-related rules triggered: no
- generic flavouring triggered incorrectly: no
- ordinary Coca-Cola status: `review_required`
- Coca-Cola Zero status: `review_required`
- difference between original and Zero: no Halal Check status difference in current data

This behavior matches methodology. The products are not confirmed halal because no verified certification exists, and they are not non-halal because no explicit prohibited ingredient signal was detected.

## E-Number Audit

Detected E-number mentions:

| E-number | Count | Rule result |
| --- | ---: | --- |
| `e338` | 4 | ignored |
| `e450` | 1 | ignored |
| `e306` | 1 | ignored |
| `e1422` | 1 | ignored |

No `E120`, `E471`, or `E472` matches were found in current real rows.

This confirms v1 does not label every E-number as review-required.

Regression tests also confirm:

- `E1200` does not trigger `E120`
- `E4710` does not trigger `E471`

## Gelatin Audit

No current real product triggered gelatin-related rules.

Validation gap:

- no real current product validates generic gelatin behavior
- no real current product validates porcine gelatin behavior
- no real current product validates explicit fish/bovine gelatin source handling

These behaviors are covered by engine tests, but not by real product data yet.

## Alcohol Audit

No current real product triggered alcohol-related rules.

Findings:

- explicit alcohol ingredient path is not validated by real current data
- generic flavouring did not create alcohol false positives
- no translated text produced an alcohol match

Engine tests cover explicit ethanol and alcohol-based flavouring.

## Rennet / Enzyme Audit

No current real product triggered rennet or enzyme rules.

Validation gap:

- no real current product validates rennet/animal enzyme review behavior
- no real current product validates microbial/vegetarian rennet exclusion

## Ingredient Provenance Findings

The audit reported source types:

- ingredient list
- original source text
- source Russian text
- missing

No current product was classified from generated translation as the sole stronger source while authoritative source text existed.

No `POTENTIAL_PROVENANCE_BUG` was found.

## Missing Ingredients

Seven products returned `insufficient_data` because no reliable ingredient text was available.

Examples:

- Halley Ulker
- Lay's Maxx Double Hamburger
- Lay's steak ribeye sauce
- Chio Rio bar
- царь 5 злаков
- Kascha
- Chips sour cream/greens row

This is correct behavior. Nutrition values and TazaScore fields had no effect on Halal Check.

### Ingredient Coverage Backfill

The missing-ingredient limitation is handled by a controlled source backfill,
not by changing Halal Check rules.

Commands:

```bash
cd backend/api
npm run repair:missing-ingredients -- --dry-run
npm run repair:missing-ingredients
npm run audit:halal-check
```

The backfill:

- audits every product for reliable ingredient availability;
- attempts Open Food Facts lookup by barcode only for products missing reliable
  ingredient source text;
- writes only `ingredientsTextOriginal`,
  `ingredientsTextOriginalLanguage`, and `ingredientsTextRu`;
- does not write generated translation as authoritative source text;
- does not change nutrition, TazaScore, legacy score fields, image, name,
  brand, verification status, or halal certification records;
- leaves products as `insufficient_data` when no real ingredient evidence is
  available.

Certification remains separate. A product may move from `insufficient_data` to
`screening_clear` after real source ingredients are recovered, but it must not
become `halal_confirmed` unless verified certification data exists.

Current local run on 2026-08-24:

| Metric | Count |
| --- | ---: |
| Total products | 29 |
| Reliable ingredients before | 22 |
| Missing ingredients before | 7 |
| Source Russian available | 6 |
| Generated Russian only | 0 |
| Original foreign available | 1 |
| Backfill candidates | 7 |
| Repaired | 0 |
| OFF no ingredients | 7 |
| Failed | 0 |

The real run made no database changes because Open Food Facts did not provide
usable ingredient text for the seven missing rows. Halal Check distribution
therefore remained:

| Status | Before | After |
| --- | ---: | ---: |
| `halal_confirmed` | 0 | 0 |
| `screening_clear` | 22 | 22 |
| `non_halal` | 0 | 0 |
| `review_required` | 0 | 0 |
| `insufficient_data` | 7 | 7 |

Still unresolved after the backfill attempt:

- `4690388110277` Чипсы (Сметана и зелень)
- `4607109843741` Батончик Чио Рио
- `4690388121419` Lay's Maxx Двойной Гамбургер
- `4690388123635` Lay's стейк рибай с соусом
- `4602481106309` царь 5 злаков
- `4607016243160` Kascha
- `4870112006902` Halley ulker

## Certification Findings

Current local certification table: unavailable.

Certification rows validated: 0.

Therefore:

```text
HALAL_CONFIRMED real-world path is not yet validated.
```

Before public beta, apply the halal certification migration and enter at least a small set of verified/unverified/expired certification records for validation.

## Canonical Family Findings

Canonical family rows: 3.

Current behavior:

- ingredient analysis uses the product's own ingredient fields passed to Halal Check
- halal certification is product-specific
- certification is not inherited across canonical product family members

This matches documented v1 methodology.

## False Positives

No real-data false positives were found.

Targeted regression tests cover:

- pork substring in unrelated words
- `E120` inside `E1200`
- `E471` inside `E4710`
- generic flavouring not being flagged automatically
- generated translation not overriding source text

## Potential False Negatives

Potential false negatives are data-quality driven:

- some products have no ingredient text
- some ingredient lists may be simplified legacy arrays instead of full label text
- no real gelatin/alcohol/rennet cases exist in current dataset
- no certification records exist in the audited DB

No methodology false negative was proven from the current product rows.

## Review Required Quality

`review_required` rate:

```text
22 / 29 = 76%
```

Quality classification:

- dominant cause: clean ingredient screening without verified certification
- category: `LEGITIMATE_AMBIGUITY`
- not caused by noisy E-number, flavouring, gelatin, alcohol, or rennet rules

This is acceptable for beta if the UI explains that Halal Check is a screening tool and that missing certification means "requires review", not "not halal".

## Decision

```text
READY_WITH_KNOWN_LIMITATIONS
```

Known limitations before stronger beta claims:

- apply the halal certification migration to the target database
- validate real verified/unverified/expired certification records
- add real products containing gelatin, E120, E471/E472, alcohol-based flavouring, and rennet/enzyme cases
- improve missing ingredient data for the seven insufficient-data products
