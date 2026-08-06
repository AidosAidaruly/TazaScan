import { z } from 'zod';
import { isSupportedProductBarcode } from '../utils/barcode';

const nullableNumberSchema = z.number().finite().nullable().optional();

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
  q: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  brand: z.string().trim().min(1).optional(),
  barcode: z.string().trim().min(1).optional()
});

export const productBodySchema = z.object({
  barcode: z.string().refine(isSupportedProductBarcode, {
    message: 'Barcode must be EAN-8, EAN-13, or UPC-A digits.'
  }),
  name: z.string().trim().min(1),
  brand: z.string().trim().min(1).nullable().optional(),
  category: z.string().trim().min(1),
  ingredients: z.array(z.string().trim().min(1)).default([]),
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
  manualOverrideReason: z.string().trim().min(1).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  dataStatus: z.enum(['unverified', 'community', 'verified']).default('unverified'),
  source: z.string().trim().min(1).nullable().optional(),
  lastVerifiedAt: z.string().datetime().nullable().optional()
});

export const updateProductBodySchema = productBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: 'At least one field must be provided.'
  }
);

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type ProductBody = z.infer<typeof productBodySchema>;
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
