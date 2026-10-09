import type { ProductSubmission } from '../generated/prisma/client';
import type { AdminProductDto } from './product';
import { toAdminProductDto } from './product';

export type ProductSubmissionDto = {
  id: string;
  barcode: string | null;
  name: string | null;
  brand: string | null;
  category: string | null;
  ingredients: string[];
  nutritionFacts: {
    servingType: ProductSubmission['servingType'];
    energyKcal: number | null;
    protein: number | null;
    carbohydrates: number | null;
    sugars: number | null;
    fat: number | null;
    saturatedFat: number | null;
    fiber: number | null;
    salt: number | null;
  };
  images: {
    frontImageUrl: string | null;
    ingredientsImageUrl: string | null;
    nutritionImageUrl: string | null;
    barcodeImageUrl: string | null;
  };
  status: ProductSubmission['status'];
  moderationNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  createdProductId: string | null;
  anonymousDeviceId: string | null;
  createdProduct?: AdminProductDto | null;
};

export function toProductSubmissionDto(
  submission: ProductSubmission & { createdProduct?: Parameters<typeof toAdminProductDto>[0] | null }
): ProductSubmissionDto {
  return {
    id: submission.id,
    barcode: submission.barcode,
    name: submission.name,
    brand: submission.brand,
    category: submission.category,
    ingredients: submission.ingredients,
    nutritionFacts: {
      servingType: submission.servingType,
      energyKcal: submission.energyKcal,
      protein: submission.protein,
      carbohydrates: submission.carbohydrates,
      sugars: submission.sugars,
      fat: submission.fat,
      saturatedFat: submission.saturatedFat,
      fiber: submission.fiber,
      salt: submission.salt
    },
    images: {
      frontImageUrl: submission.frontImageUrl,
      ingredientsImageUrl: submission.ingredientsImageUrl,
      nutritionImageUrl: submission.nutritionImageUrl,
      barcodeImageUrl: submission.barcodeImageUrl
    },
    status: submission.status,
    moderationNote: submission.moderationNote,
    submittedAt: submission.submittedAt.toISOString(),
    reviewedAt: submission.reviewedAt?.toISOString() ?? null,
    reviewedByUserId: submission.reviewedByUserId,
    createdProductId: submission.createdProductId,
    anonymousDeviceId: submission.anonymousDeviceId,
    // Submission responses are admin-only (moderation), so they carry the admin DTO.
    createdProduct: submission.createdProduct ? toAdminProductDto(submission.createdProduct) : null
  };
}
