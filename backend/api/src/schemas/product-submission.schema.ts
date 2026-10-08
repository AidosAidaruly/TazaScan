import { z } from 'zod';
import { isSupportedProductBarcode } from '../utils/barcode';
import { ingredientListSchema, optionalText, requiredText, textLimits } from './text-limits';

const nullableNumberSchema = z.coerce.number().finite().nonnegative().nullable().optional();
const statusSchema = z.enum(['pending', 'approved', 'rejected', 'needs_correction']);

export const submissionIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const listSubmissionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: statusSchema.optional()
});

export const productSubmissionBodySchema = z.object({
    barcode: z
      .string()
      .trim()
      .refine(isSupportedProductBarcode, {
        message: 'Barcode must be EAN-8, EAN-13, or UPC-A digits.'
      })
      .nullable()
      .optional(),
    name: optionalText(textLimits.productName),
    brand: optionalText(textLimits.brand),
    category: optionalText(textLimits.category),
    ingredients: ingredientListSchema(),
    servingType: z.enum(['per100g', 'per100ml']).nullable().optional(),
    energyKcal: nullableNumberSchema,
    protein: nullableNumberSchema,
    carbohydrates: nullableNumberSchema,
    sugars: nullableNumberSchema,
    fat: nullableNumberSchema,
    saturatedFat: nullableNumberSchema,
    fiber: nullableNumberSchema,
    salt: nullableNumberSchema,
    anonymousDeviceId: optionalText(textLimits.deviceId)
  });

export const updateSubmissionStatusBodySchema = z.object({
  status: z.enum(['rejected', 'needs_correction']),
  moderationNote: requiredText(textLimits.moderationNote)
});

export const approveSubmissionBodySchema = productSubmissionBodySchema.extend({
  name: requiredText(textLimits.productName),
  category: requiredText(textLimits.category),
  moderationNote: optionalText(textLimits.moderationNote)
});

export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
export type ProductSubmissionBody = z.infer<typeof productSubmissionBodySchema>;
export type UpdateSubmissionStatusBody = z.infer<typeof updateSubmissionStatusBodySchema>;
export type ApproveSubmissionBody = z.infer<typeof approveSubmissionBodySchema>;
