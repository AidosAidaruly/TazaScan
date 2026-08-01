import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../prisma/client';
import type { ProductBody } from '../schemas/product.schema';
import type {
  ListSubmissionsQuery,
  ProductSubmissionBody,
  UpdateSubmissionStatusBody
} from '../schemas/product-submission.schema';
import type { ScoreResult } from '../scoring/types/score-result';

export type SubmissionImageUrls = {
  frontImageUrl: string | null;
  ingredientsImageUrl: string | null;
  nutritionImageUrl: string | null;
  barcodeImageUrl: string | null;
};

export class ProductSubmissionRepository {
  list(filters: ListSubmissionsQuery) {
    const where: Prisma.ProductSubmissionWhereInput = {
      ...(filters.status ? { status: filters.status } : {})
    };
    const skip = (filters.page - 1) * filters.pageSize;

    return prisma.$transaction([
      prisma.productSubmission.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: filters.pageSize,
        include: { createdProduct: true }
      }),
      prisma.productSubmission.count({ where })
    ]);
  }

  findById(id: string) {
    return prisma.productSubmission.findUnique({
      where: { id },
      include: { createdProduct: true }
    });
  }

  findPendingDuplicate(barcode?: string | null, anonymousDeviceId?: string | null) {
    if (!barcode && !anonymousDeviceId) {
      return Promise.resolve(null);
    }

    return prisma.productSubmission.findFirst({
      where: {
        status: 'pending',
        ...(barcode ? { barcode } : {}),
        ...(anonymousDeviceId ? { anonymousDeviceId } : {})
      }
    });
  }

  create(data: ProductSubmissionBody, images: SubmissionImageUrls) {
    return prisma.productSubmission.create({
      data: {
        ...this.toSubmissionData(data),
        ...images
      }
    });
  }

  updateStatus(id: string, data: UpdateSubmissionStatusBody, reviewedByUserId: string) {
    return prisma.productSubmission.update({
      where: { id },
      data: {
        status: data.status,
        moderationNote: data.moderationNote,
        reviewedAt: new Date(),
        reviewedByUserId
      }
    });
  }

  findProductByBarcode(barcode: string) {
    return prisma.product.findUnique({ where: { barcode } });
  }

  approve(
    submissionId: string,
    productData: ProductBody,
    scoreResult: ScoreResult,
    reviewedByUserId: string,
    moderationNote?: string | null
  ) {
    return prisma.$transaction(async (transaction) => {
      const product = await transaction.product.create({
        data: {
          ...this.toProductCreateData(productData),
          ...this.toScoreData(scoreResult)
        }
      });

      const submission = await transaction.productSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'approved',
          ...(moderationNote !== undefined ? { moderationNote } : {}),
          reviewedAt: new Date(),
          reviewedByUserId,
          createdProductId: product.id
        },
        include: { createdProduct: true }
      });

      return submission;
    });
  }

  private toSubmissionData(data: ProductSubmissionBody): Prisma.ProductSubmissionCreateInput {
    const submissionData: Prisma.ProductSubmissionCreateInput = {
      ingredients: data.ingredients
    };

    this.assignDefined(submissionData, 'barcode', data.barcode);
    this.assignDefined(submissionData, 'name', data.name);
    this.assignDefined(submissionData, 'brand', data.brand);
    this.assignDefined(submissionData, 'category', data.category);
    this.assignDefined(submissionData, 'servingType', data.servingType);
    this.assignDefined(submissionData, 'energyKcal', data.energyKcal);
    this.assignDefined(submissionData, 'protein', data.protein);
    this.assignDefined(submissionData, 'carbohydrates', data.carbohydrates);
    this.assignDefined(submissionData, 'sugars', data.sugars);
    this.assignDefined(submissionData, 'fat', data.fat);
    this.assignDefined(submissionData, 'saturatedFat', data.saturatedFat);
    this.assignDefined(submissionData, 'fiber', data.fiber);
    this.assignDefined(submissionData, 'salt', data.salt);
    this.assignDefined(submissionData, 'anonymousDeviceId', data.anonymousDeviceId);

    return submissionData;
  }

  private toProductCreateData(data: ProductBody): Prisma.ProductCreateInput {
    const productData: Prisma.ProductCreateInput = {
      barcode: data.barcode,
      name: data.name,
      category: data.category,
      ingredients: data.ingredients,
      servingType: data.nutritionFacts.servingType,
      dataStatus: 'community',
      imageUrl: null
    };

    this.assignDefined(productData, 'brand', data.brand);
    this.assignDefined(productData, 'energyKcal', data.nutritionFacts.energyKcal);
    this.assignDefined(productData, 'protein', data.nutritionFacts.protein);
    this.assignDefined(productData, 'carbohydrates', data.nutritionFacts.carbohydrates);
    this.assignDefined(productData, 'sugars', data.nutritionFacts.sugars);
    this.assignDefined(productData, 'fat', data.nutritionFacts.fat);
    this.assignDefined(productData, 'saturatedFat', data.nutritionFacts.saturatedFat);
    this.assignDefined(productData, 'fiber', data.nutritionFacts.fiber);
    this.assignDefined(productData, 'salt', data.nutritionFacts.salt);

    return productData;
  }

  private toScoreData(scoreResult: ScoreResult) {
    return {
      calculatedScore: scoreResult.score,
      calculatedGrade: scoreResult.grade,
      scoreStatus: scoreResult.status,
      scoreAlgorithm: scoreResult.algorithm,
      scoreVersion: scoreResult.algorithmVersion,
      scoreCalculatedAt: new Date(scoreResult.calculatedAt),
      scoreDetails: scoreResult,
      healthScore: scoreResult.score ?? 0
    };
  }

  private assignDefined<T extends object, K extends keyof T>(
    target: T,
    key: K,
    value: T[K] | undefined
  ) {
    if (value !== undefined) {
      target[key] = value;
    }
  }
}
