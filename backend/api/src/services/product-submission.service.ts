import type { Prisma, ProductSubmission } from '../generated/prisma/client';
import type { PaginatedResponse } from '../types/pagination';
import type { ProductSubmissionDto } from '../types/product-submission';
import { toProductSubmissionDto } from '../types/product-submission';
import { HttpError } from '../utils/http-error';
import { prismaErrorCode } from '../utils/prisma-errors';
import type {
  SubmissionImageUrls,
  ProductSubmissionRepository
} from '../repositories/product-submission.repository';
import type {
  ApproveSubmissionBody,
  ListSubmissionsQuery,
  ProductSubmissionBody,
  UpdateSubmissionStatusBody
} from '../schemas/product-submission.schema';
import { productBodySchema, type ProductBody } from '../schemas/product.schema';
import { ProductImageStorageService } from './product-image-storage.service';

type SubmissionRepositoryContract = Pick<
  ProductSubmissionRepository,
  | 'list'
  | 'findById'
  | 'findPendingDuplicate'
  | 'create'
  | 'updateStatus'
  | 'findProductByBarcode'
  | 'markApproved'
  | 'transaction'
>;

type ProductCreatorContract = {
  create(data: ProductBody, transaction?: Prisma.TransactionClient): Promise<{ id: string }>;
};

type ProductImageCopierContract = Pick<
  ProductImageStorageService,
  'copySubmissionImage' | 'deleteImage'
>;

const approvedStatusLockedMessage = 'Approved submissions cannot change moderation status';

export class ProductSubmissionService {
  constructor(
    private readonly submissionRepository: SubmissionRepositoryContract,
    private readonly productCreator: ProductCreatorContract,
    private readonly productImages: ProductImageCopierContract = new ProductImageStorageService()
  ) {}

  async list(filters: ListSubmissionsQuery): Promise<PaginatedResponse<ProductSubmissionDto>> {
    const [submissions, total] = await this.submissionRepository.list(filters);

    return {
      items: submissions.map(toProductSubmissionDto),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize)
      }
    };
  }

  async getById(id: string) {
    const submission = await this.submissionRepository.findById(id);
    if (!submission) {
      throw new HttpError(404, 'Product submission not found');
    }

    return toProductSubmissionDto(submission);
  }

  /**
   * `discardUploads` removes the files uploaded by this request. It runs when the
   * submission is not created; once `repository.create` resolves, the files are the
   * submission's evidence and are kept.
   */
  async create(
    data: ProductSubmissionBody,
    images: SubmissionImageUrls,
    discardUploads: () => Promise<void> = async () => undefined
  ) {
    let submission: ProductSubmission;

    try {
      this.ensureIdentifyingData(data, images);
      await this.ensureUnknownBarcodeCanBeSubmitted(data, images);
      this.ensureNutritionConsistency(data);

      const duplicate = await this.submissionRepository.findPendingDuplicate(
        data.barcode,
        data.anonymousDeviceId
      );
      if (duplicate) {
        throw new HttpError(409, 'A similar pending submission already exists');
      }

      submission = await this.submissionRepository.create(data, images);
    } catch (error) {
      await discardUploads();
      throw error;
    }

    return toProductSubmissionDto(submission);
  }

  async updateStatus(
    id: string,
    data: UpdateSubmissionStatusBody,
    reviewedByUserId: string
  ) {
    const existingSubmission = await this.ensureExists(id);
    if (existingSubmission.status === 'approved') {
      throw new HttpError(409, approvedStatusLockedMessage);
    }

    const submission = await this.submissionRepository.updateStatus(
      id,
      data,
      reviewedByUserId
    );

    if (!submission) {
      // The guarded write matched nothing: approved (or removed) after the read above.
      await this.ensureExists(id);
      throw new HttpError(409, approvedStatusLockedMessage);
    }

    return toProductSubmissionDto(submission);
  }

  async approve(id: string, data: ApproveSubmissionBody, reviewedByUserId: string) {
    const existingSubmission = await this.ensureExists(id);
    if (existingSubmission.status === 'approved') {
      throw new HttpError(409, 'Submission is already approved');
    }

    this.ensureNutritionConsistency(data);
    const productBody = this.toProductBody(data);
    const parsedProduct = productBodySchema.parse({
      ...productBody,
      imageUrl: undefined
    });
    const duplicateProduct = await this.submissionRepository.findProductByBarcode(
      parsedProduct.barcode
    );

    if (duplicateProduct) {
      throw new HttpError(409, 'Barcode already exists');
    }

    // The product gets its own public, product-scoped copy; the submission file stays
    // admin-only evidence and is never referenced by the product.
    const productImageUrl = await this.copyFrontImageForProduct(existingSubmission);

    try {
      const submission = await this.submissionRepository.transaction(async (transaction) => {
        const product = await this.productCreator.create({
          ...parsedProduct,
          imageUrl: productImageUrl,
          dataStatus: 'community',
          source: 'user_submission',
          lastVerifiedAt: null
        }, transaction);

        return this.submissionRepository.markApproved(
          id,
          product.id,
          reviewedByUserId,
          data.moderationNote,
          transaction
        );
      });

      return toProductSubmissionDto(submission);
    } catch (error) {
      await this.discardCopiedImage(productImageUrl);
      throw await this.toApprovalConflict(id, error);
    }
  }

  /**
   * A concurrent approval of the same submission can win between our checks and our
   * transaction: the loser then hits the product barcode unique constraint (P2002) or
   * the guarded markApproved matches no row (P2025). The transaction has rolled back,
   * so report the same clean responses as the up-front checks.
   */
  private async toApprovalConflict(id: string, error: unknown): Promise<unknown> {
    const code = prismaErrorCode(error);
    if (code !== 'P2002' && code !== 'P2025') {
      return error;
    }

    let current: ProductSubmission | null;
    try {
      current = await this.submissionRepository.findById(id);
    } catch {
      return error;
    }

    if (!current) {
      return new HttpError(404, 'Product submission not found');
    }
    if (current.status === 'approved') {
      return new HttpError(409, 'Submission is already approved');
    }
    if (code === 'P2002') {
      return new HttpError(409, 'Barcode already exists');
    }

    return error;
  }

  private async copyFrontImageForProduct(submission: ProductSubmission) {
    if (!submission.frontImageUrl) {
      return null;
    }

    const productImageUrl = await this.productImages.copySubmissionImage(submission.frontImageUrl);
    if (!productImageUrl) {
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'submission_image_unavailable',
        submissionId: submission.id
      }));
    }

    return productImageUrl;
  }

  private async discardCopiedImage(productImageUrl: string | null) {
    if (!productImageUrl) {
      return;
    }

    try {
      await this.productImages.deleteImage(productImageUrl);
    } catch {
      console.error(JSON.stringify({
        level: 'error',
        event: 'orphaned_product_image_cleanup_failed',
        imageUrl: productImageUrl
      }));
    }
  }

  private async ensureExists(id: string): Promise<ProductSubmission> {
    const submission = await this.submissionRepository.findById(id);
    if (!submission) {
      throw new HttpError(404, 'Product submission not found');
    }

    return submission;
  }

  private ensureIdentifyingData(data: ProductSubmissionBody, images: SubmissionImageUrls) {
    if (!data.barcode && !data.name && !images.frontImageUrl) {
      throw new HttpError(400, 'Barcode, name, or front image is required');
    }
  }

  private async ensureUnknownBarcodeCanBeSubmitted(
    data: ProductSubmissionBody,
    images: SubmissionImageUrls
  ) {
    if (!data.barcode) {
      return;
    }

    const existingProduct = await this.submissionRepository.findProductByBarcode(data.barcode);
    if (existingProduct) {
      throw new HttpError(409, 'Product already exists for this barcode', {
        code: 'product_exists',
        productId: existingProduct.id,
        barcode: data.barcode
      });
    }

    if (!images.frontImageUrl) {
      throw new HttpError(400, 'Front package photo is required for barcode submissions', {
        code: 'front_image_required',
        barcode: data.barcode
      });
    }
  }

  private ensureNutritionConsistency(data: ProductSubmissionBody | ApproveSubmissionBody) {
    if (
      data.sugars !== null &&
      data.sugars !== undefined &&
      data.carbohydrates !== null &&
      data.carbohydrates !== undefined &&
      data.sugars > data.carbohydrates
    ) {
      throw new HttpError(400, 'Sugars cannot be greater than carbohydrates');
    }

    if (
      data.saturatedFat !== null &&
      data.saturatedFat !== undefined &&
      data.fat !== null &&
      data.fat !== undefined &&
      data.saturatedFat > data.fat
    ) {
      throw new HttpError(400, 'Saturated fat cannot be greater than fat');
    }
  }

  private toProductBody(data: ApproveSubmissionBody): ProductBody {
    return {
      barcode: data.barcode ?? '',
      name: data.name,
      brand: data.brand,
      category: data.category,
      ingredients: data.ingredients,
      nutritionFacts: {
        servingType: data.servingType ?? 'per100g',
        energyKcal: data.energyKcal,
        protein: data.protein,
        carbohydrates: data.carbohydrates,
        sugars: data.sugars,
        fat: data.fat,
        saturatedFat: data.saturatedFat,
        fiber: data.fiber,
        salt: data.salt
      },
      imageUrl: null,
      dataStatus: 'community',
      source: 'user_submission',
      lastVerifiedAt: null
    };
  }
}
