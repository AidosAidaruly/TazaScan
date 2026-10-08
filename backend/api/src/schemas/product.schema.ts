import { z } from 'zod';
import { isSupportedProductBarcode } from '../utils/barcode';
import {
  ingredientListSchema,
  optionalText,
  optionalUrl,
  requiredText,
  textLimits
} from './text-limits';

const nullableNumberSchema = z.number().finite().nullable().optional();
const officialNutriScoreCategorySchema = z
  .enum(['general_food', 'beverage', 'water', 'cheese', 'fats_oils_nuts_seeds', 'red_meat'])
  .nullable()
  .optional();
const fruitVegetableLegumePercentSchema = z.number().finite().min(0).max(100).nullable().optional();
const containsNonSugarSweetenersSchema = z.boolean().nullable().optional();
const optionalPreviewCategorySchema = z
  .string()
  .trim()
  .max(textLimits.category)
  .transform((value) => (value === '' ? undefined : value))
  .nullable()
  .optional();

export const productIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const barcodeParamsSchema = z.object({
  barcode: z.string().refine(isSupportedProductBarcode, {
    message: 'Barcode must be EAN-8, EAN-13, or UPC-A digits.'
  })
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  q: requiredText(textLimits.searchTerm).optional(),
  name: requiredText(textLimits.searchTerm).optional(),
  brand: requiredText(textLimits.searchTerm).optional(),
  barcode: requiredText(textLimits.searchBarcode).optional()
});

export const productBodySchema = z.object({
  barcode: z.string().refine(isSupportedProductBarcode, {
    message: 'Barcode must be EAN-8, EAN-13, or UPC-A digits.'
  }),
  name: requiredText(textLimits.productName),
  brand: optionalText(textLimits.brand),
  category: requiredText(textLimits.category),
  ingredients: ingredientListSchema(),
  ingredientsTextOriginal: optionalText(textLimits.ingredientsText),
  ingredientsTextOriginalLanguage: optionalText(textLimits.languageTag),
  ingredientsTextRu: optionalText(textLimits.ingredientsText),
  ingredientsTextTranslatedRu: optionalText(textLimits.ingredientsText),
  ingredientsTranslationSource: optionalText(textLimits.sourceLabel),
  ingredientsTranslatedAt: z.string().datetime().nullable().optional(),
  nutritionFacts: z.object({
    servingType: z.enum(['per100g', 'per100ml']),
    energyKcal: nullableNumberSchema,
    protein: nullableNumberSchema,
    carbohydrates: nullableNumberSchema,
    sugars: nullableNumberSchema,
    fat: nullableNumberSchema,
    saturatedFat: nullableNumberSchema,
    fiber: nullableNumberSchema,
    salt: nullableNumberSchema
  }),
  manualScoreOverride: z.number().int().min(0).max(100).nullable().optional(),
  manualOverrideReason: optionalText(textLimits.overrideReason),
  officialNutriScoreCategory: officialNutriScoreCategorySchema,
  fruitVegetableLegumePercent: fruitVegetableLegumePercentSchema,
  containsNonSugarSweeteners: containsNonSugarSweetenersSchema,
  imageUrl: optionalUrl(),
  dataStatus: z.enum(['unverified', 'community', 'verified']).default('unverified'),
  source: optionalText(textLimits.sourceLabel),
  lastVerifiedAt: z.string().datetime().nullable().optional()
});

export const updateProductBodySchema = productBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: 'At least one field must be provided.'
  }
);

export const officialNutriScorePreviewBodySchema = z.object({
  category: optionalPreviewCategorySchema,
  ingredients: ingredientListSchema(),
  nutritionFacts: z
    .object({
      servingType: z.enum(['per100g', 'per100ml']).default('per100g'),
      energyKcal: nullableNumberSchema,
      protein: nullableNumberSchema,
      carbohydrates: nullableNumberSchema,
      sugars: nullableNumberSchema,
      fat: nullableNumberSchema,
      saturatedFat: nullableNumberSchema,
      fiber: nullableNumberSchema,
      salt: nullableNumberSchema
    })
    .default({ servingType: 'per100g' }),
  officialNutriScoreCategory: officialNutriScoreCategorySchema,
  fruitVegetableLegumePercent: fruitVegetableLegumePercentSchema,
  containsNonSugarSweeteners: containsNonSugarSweetenersSchema
});

export const tazaScorePreviewBodySchema = officialNutriScorePreviewBodySchema.extend({
  dataStatus: z.enum(['unverified', 'community', 'verified']).default('unverified')
});

export const halalCertificationBodySchema = z.object({
  status: z.enum(['verified', 'unverified', 'expired']),
  issuer: requiredText(textLimits.certificationIssuer),
  certificateNumber: optionalText(textLimits.certificateNumber),
  validUntil: z.string().datetime().nullable().optional(),
  source: requiredText(textLimits.sourceLabel),
  evidenceUrl: optionalUrl(),
  verifiedAt: z.string().datetime().nullable().optional()
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type ProductBody = z.infer<typeof productBodySchema>;
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
export type OfficialNutriScorePreviewBody = z.infer<typeof officialNutriScorePreviewBodySchema>;
export type TazaScorePreviewBody = z.infer<typeof tazaScorePreviewBodySchema>;
export type HalalCertificationBody = z.infer<typeof halalCertificationBodySchema>;
