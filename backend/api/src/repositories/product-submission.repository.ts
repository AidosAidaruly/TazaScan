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

/**
 * Server-defined duplicate rule for pending submissions:
 * - with a barcode: any pending submission with the same barcode;
 * - without a barcode: a pending barcode-less submission with the same name and brand
 *   (case-insensitive; a missing brand matches only a missing brand).
 * Submissions with neither barcode nor name have no content to compare (null).
 */
export function pendingDuplicateKey(
  data: Pick<ProductSubmissionBody, 'barcode' | 'name' | 'brand'>
): { lockKey: string; where: Prisma.ProductSubmissionWhereInput } | null {
  if (data.barcode) {
    return {
      lockKey: `product-submission:barcode:${data.barcode}`,
      where: { barcode: data.barcode }
    };
  }

  if (data.name) {
    const brand = data.brand ?? null;
    return {
      // JSON keeps the pair unambiguous and escapes control characters (PostgreSQL text
      // cannot contain NUL).
      lockKey: `product-submission:name:${JSON.stringify([data.name.toLowerCase(), brand?.toLowerCase() ?? null])}`,
      where: {
        barcode: null,
        name: { equals: data.name, mode: 'insensitive' },
        brand: brand === null ? null : { equals: brand, mode: 'insensitive' }
      }
    };
  }

  return null;
}

export class ProductSubmissionRepository {
  transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(operation);
  }

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

  /**
   * Creates the submission unless a pending duplicate exists, atomically: a transaction-scoped
   * advisory lock on the duplicate key serializes concurrent identical submissions, so the
   * check and the insert cannot interleave. Returns null for a duplicate.
   *
   * The duplicate rule uses only submitted content, never the client-controlled
   * anonymousDeviceId (see pendingDuplicateKey).
   */
  createUnlessPendingDuplicate(data: ProductSubmissionBody, images: SubmissionImageUrls) {
    const duplicate = pendingDuplicateKey(data);
    if (!duplicate) {
      return this.create(data, images);
    }

    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${duplicate.lockKey}))`;

      const existing = await transaction.productSubmission.findFirst({
        where: { status: 'pending', ...duplicate.where },
        select: { id: true }
      });
      if (existing) {
        return null;
      }

      return transaction.productSubmission.create({
        data: {
          ...this.toSubmissionData(data),
          ...images
        }
      });
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

  /**
   * Approved is terminal: the write only matches non-approved rows, so a stale request
   * cannot overwrite an approval that committed after it was read. Returns null when
   * nothing was updated (missing or already approved).
   */
  async updateStatus(id: string, data: UpdateSubmissionStatusBody, reviewedByUserId: string) {
    const { count } = await prisma.productSubmission.updateMany({
      where: { id, status: { not: 'approved' } },
      data: {
        status: data.status,
        moderationNote: data.moderationNote,
        reviewedAt: new Date(),
        reviewedByUserId
      }
    });

    return count === 0 ? null : prisma.productSubmission.findUnique({ where: { id } });
  }

  findProductByBarcode(barcode: string) {
    return prisma.product.findUnique({ where: { barcode } });
  }

  markApproved(
    submissionId: string,
    createdProductId: string,
    reviewedByUserId: string,
    moderationNote?: string | null,
    transaction: Prisma.TransactionClient = prisma
  ) {
    return transaction.productSubmission.update({
      where: { id: submissionId, status: { not: 'approved' } },
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
