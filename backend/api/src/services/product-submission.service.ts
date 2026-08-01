import type { ProductSubmission } from '../generated/prisma/client';
import type { PaginatedResponse } from '../types/pagination';
import type { ProductSubmissionDto } from '../types/product-submission';
import { toProductSubmissionDto } from '../types/product-submission';
import { HttpError } from '../utils/http-error';
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
import type { ScoreEngine } from '../scoring/contracts/score-engine';

type SubmissionRepositoryContract = Pick<
  ProductSubmissionRepository,
  | 'list'
  | 'findById'
  | 'findPendingDuplicate'
  | 'create'
  | 'updateStatus'
  | 'findProductByBarcode'
  | 'approve'
>;

export class ProductSubmissionService {
  constructor(
    private readonly submissionRepository: SubmissionRepositoryContract,
    private readonly scoreEngine: ScoreEngine
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

  async create(data: ProductSubmissionBody, images: SubmissionImageUrls) {
    this.ensureIdentifyingData(data, images);
    this.ensureNutritionConsistency(data);

    const duplicate = await this.submissionRepository.findPendingDuplicate(
      data.barcode,
      data.anonymousDeviceId
    );
    if (duplicate) {
      throw new HttpError(409, 'A similar pending submission already exists');
    }

    const submission = await this.submissionRepository.create(data, images);
    return toProductSubmissionDto(submission);
  }

  async updateStatus(
    id: string,
    data: UpdateSubmissionStatusBody,
    reviewedByUserId: string
  ) {
    await this.ensureExists(id);
    const submission = await this.submissionRepository.updateStatus(
      id,
      data,
      reviewedByUserId
    );

    return toProductSubmissionDto(submission);
  }

  async approve(id: string, data: ApproveSubmissionBody, reviewedByUserId: string) {
    const existingSubmission = await this.ensureExists(id);
    if (existingSubmission.status === 'approved') {
      throw new HttpError(409, 'Submission is already approved');
    }

    this.ensureNutritionConsistency(data);
    const productBody = this.toProductBody(data);
    const parsedProduct = productBodySchema.parse(productBody);
    const duplicateProduct = await this.submissionRepository.findProductByBarcode(
      parsedProduct.barcode
    );

    if (duplicateProduct) {
      throw new HttpError(409, 'Barcode already exists');
    }

    const scoreResult = this.scoreEngine.calculate({
      servingType: parsedProduct.nutritionFacts.servingType,
      energyKcal: parsedProduct.nutritionFacts.energyKcal ?? null,
      protein: parsedProduct.nutritionFacts.protein ?? null,
      carbohydrates: parsedProduct.nutritionFacts.carbohydrates ?? null,
      sugars: parsedProduct.nutritionFacts.sugars ?? null,
      fat: parsedProduct.nutritionFacts.fat ?? null,
      saturatedFat: parsedProduct.nutritionFacts.saturatedFat ?? null,
      fiber: parsedProduct.nutritionFacts.fiber ?? null,
      salt: parsedProduct.nutritionFacts.salt ?? null,
      category: parsedProduct.category,
      ingredients: parsedProduct.ingredients
    });
    const submission = await this.submissionRepository.approve(
      id,
      parsedProduct,
      scoreResult,
      reviewedByUserId,
      data.moderationNote
    );

    return toProductSubmissionDto(submission);
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
      dataStatus: 'community'
    };
  }
}
