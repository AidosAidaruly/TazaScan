import { z } from 'zod';
import { isSupportedProductBarcode } from '../utils/barcode';

const nullableNumberSchema = z.coerce.number().finite().nonnegative().nullable().optional();
const optionalTextSchema = z.string().trim().min(1).nullable().optional();
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
    name: optionalTextSchema,
    brand: optionalTextSchema,
    category: optionalTextSchema,
    ingredients: z.array(z.string().trim().min(1)).default([]),
    servingType: z.enum(['per100g', 'per100ml']).nullable().optional(),
    energyKcal: nullableNumberSchema,
    protein: nullableNumberSchema,
    carbohydrates: nullableNumberSchema,
    sugars: nullableNumberSchema,
    fat: nullableNumberSchema,
    saturatedFat: nullableNumberSchema,
    fiber: nullableNumberSchema,
    salt: nullableNumberSchema,
    anonymousDeviceId: optionalTextSchema
  });

export const updateSubmissionStatusBodySchema = z.object({
  status: z.enum(['rejected', 'needs_correction']),
  moderationNote: z.string().trim().min(1)
});

export const approveSubmissionBodySchema = productSubmissionBodySchema.extend({
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  moderationNote: z.string().trim().min(1).nullable().optional()
});

export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
export type ProductSubmissionBody = z.infer<typeof productSubmissionBodySchema>;
export type UpdateSubmissionStatusBody = z.infer<typeof updateSubmissionStatusBodySchema>;
export type ApproveSubmissionBody = z.infer<typeof approveSubmissionBodySchema>;
