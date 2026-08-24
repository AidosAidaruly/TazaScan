# Consumer Localization Policy

Supported consumer locales:

- `ru` — Russian, default
- `kk` — Kazakh

The mobile app uses a lightweight Flutter localization layer in
`TazaStrings`. Russian remains the safe fallback for unknown or missing stored
locale values.

Language selection is available in the consumer Profile screen and is persisted
locally with `shared_preferences`. No backend account or API support is
required.

Consumer UI must not display backend enum values or technical identifiers
directly. Values such as `community`, `canonical_recipe`, `insufficient_data`,
`coverage_cap`, and `missing_critical_negative_cap` must be mapped through the
presentation/localization layer before rendering.

`TazaScore`, `Nutri-Score`, and `TazaScan` are product/brand names and stay
unchanged across supported locales.
