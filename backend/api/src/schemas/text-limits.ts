import { z } from 'zod';

/**
 * Maximum lengths (in characters, after trimming) for user-controlled text inputs.
 * Values are rejected, never truncated. Database columns are unbounded `text`, so these
 * are application limits chosen from real product data and client behavior.
 */
export const textLimits = {
  /** Product name; real data peaks around 60, long multilingual OFF names fit. */
  productName: 200,
  /** Single brand (OFF importer takes the first listed brand). */
  brand: 120,
  /** Single category label (OFF importer takes the first listed category). */
  category: 120,
  /** One ingredient entry; real data peaks around 130. */
  ingredient: 500,
  /** Ingredient entries per product; real data peaks around 25. */
  ingredientCount: 300,
  /** Full ingredient label text (original, Russian, translated). */
  ingredientsText: 10_000,
  /** BCP-47 language tag; RFC 5646 recommends supporting at least 35 characters. */
  languageTag: 35,
  /** Data source / provenance label (products, translations, halal certificates). */
  sourceLabel: 200,
  /** Admin justification for a manual score override. */
  overrideReason: 1_000,
  /** Moderator note on submissions. */
  moderationNote: 2_000,
  /** Image and evidence URLs; practical URL length limit. */
  url: 2_048,
  /** Free-text product search terms (q, name, brand filters). */
  searchTerm: 100,
  /** Partial barcode search; the longest supported barcode is EAN-13. */
  searchBarcode: 13,
  /** Client-generated anonymous device identifier (UUID or platform ID). */
  deviceId: 128,
  /** Halal certificate issuer organization name. */
  certificationIssuer: 200,
  /** Halal certificate number. */
  certificateNumber: 100,
  /** RFC 5321 maximum email address length. */
  email: 254,
  /** Well above bcrypt's 72-byte input, so no valid password is refused. */
  password: 1_024
} as const;

/** Trimmed, non-empty text of at most `max` characters. */
export function requiredText(max: number) {
  return z.string().trim().min(1).max(max);
}

/** Like `requiredText`, but also accepts null or an omitted value. */
export function optionalText(max: number) {
  return requiredText(max).nullable().optional();
}

/** Ingredient list: bounded entry length and entry count. */
export function ingredientListSchema() {
  return z
    .array(requiredText(textLimits.ingredient))
    .max(textLimits.ingredientCount)
    .default([]);
}

/** Absolute URL of at most `textLimits.url` characters. */
export function optionalUrl() {
  return z.string().max(textLimits.url).url().nullable().optional();
}
