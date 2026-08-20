import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../prisma/client';
import type {
  ListSubmissionsQuery,
  ProductSubmissionBody,
  UpdateSubmissionStatusBody
} from '../schemas/product-submission.schema';

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
        OR: [
          ...(barcode ? [{ barcode }] : []),
          ...(!barcode && anonymousDeviceId ? [{ anonymousDeviceId }] : [])
        ]
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

  markApproved(
    submissionId: string,
    createdProductId: string,
    reviewedByUserId: string,
    moderationNote?: string | null
  ) {
    return prisma.productSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'approved',
        ...(moderationNote !== undefined ? { moderationNote } : {}),
        reviewedAt: new Date(),
        reviewedByUserId,
        createdProductId
      },
      include: { createdProduct: true }
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
