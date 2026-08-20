import type { Product } from '../generated/prisma/client';
import { ProductDataQualityEvaluator } from '../data-quality/product-data-quality.evaluator';
import type {
  ListProductsQuery,
  OfficialNutriScorePreviewBody,
  ProductBody,
  TazaScorePreviewBody,
  UpdateProductBody
} from '../schemas/product.schema';
import type { ScoreEngine } from '../scoring/contracts/score-engine';
import { OfficialNutriScoreEngine } from '../scoring/engines/official-nutri-score.engine';
import { TazaScoreEngine } from '../scoring/engines/taza-score.engine';
import type { OfficialNutriScoreInput } from '../scoring/types/official-nutri-score-result';
import type { TazaScoreInput } from '../scoring/types/taza-score-result';
import type { ScoreInput } from '../scoring/types/score-result';
import type { PaginatedResponse } from '../types/pagination';
import type { ProductDto, ProductScorePreviewDto, ProductWithCanonicalFamily } from '../types/product';
import { toProductDto } from '../types/product';
import { HttpError } from '../utils/http-error';
import { ProductImageStorageService } from './product-image-storage.service';

type ProductRepositoryContract = {
  list(filters: ListProductsQuery): Promise<[ProductWithCanonicalFamily[], number]>;
  findById(id: string): Promise<ProductWithCanonicalFamily | null>;
  findByBarcode(barcode: string): Promise<ProductWithCanonicalFamily | null>;
  create(data: ProductBody, scoreResult: ReturnType<ScoreEngine['calculate']>): Promise<Product>;
  update(id: string, data: UpdateProductBody, scoreResult: ReturnType<ScoreEngine['calculate']>): Promise<Product>;
  updateImageUrl(id: string, imageUrl: string | null): Promise<Product>;
  delete(id: string): Promise<Product>;
};

type NumericNutritionField = Exclude<keyof ProductBody['nutritionFacts'], 'servingType'>;

export class ProductService {
  private readonly officialNutriScoreEngine = new OfficialNutriScoreEngine();
  private readonly tazaScoreEngine = new TazaScoreEngine();
  private readonly productDataQualityEvaluator = new ProductDataQualityEvaluator();

  constructor(
    private readonly productRepository: ProductRepositoryContract,
    private readonly scoreEngine: ScoreEngine,
    private readonly imageStorage = new ProductImageStorageService()
  ) {}

  async list(filters: ListProductsQuery): Promise<PaginatedResponse<ProductDto>> {
    const [products, total] = await this.productRepository.list(filters);

    return {
      items: products.map((product) => this.toProductDto(product)),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize)
      }
    };
  }

  async getById(id: string) {
    const product = await this.productRepository.findById(id);

    if (!product) {
      throw new HttpError(404, 'Product not found');
    }

    return this.toProductDto(product);
  }

  async getByBarcode(barcode: string) {
    const product = await this.productRepository.findByBarcode(barcode);

    if (!product) {
      throw new HttpError(404, 'Product not found');
    }

    return this.toProductDto(product);
  }

  async create(data: ProductBody) {
    await this.ensureBarcodeAvailable(data.barcode);
    const scoreResult = this.scoreEngine.calculate(this.toScoreInput(data));
    const product = await this.productRepository.create(data, scoreResult);

    return this.toProductDto(product);
  }

  previewOfficialNutriScore(data: OfficialNutriScorePreviewBody) {
    return this.officialNutriScoreEngine.calculate(this.toOfficialNutriScoreInput(data));
  }

  previewTazaScore(data: TazaScorePreviewBody) {
    return this.tazaScoreEngine.calculate(this.toTazaScoreInput(data));
  }

  async previewProductScore(id: string): Promise<ProductScorePreviewDto> {
    const product = await this.ensureExists(id);
    const tazaScore = this.tazaScoreEngine.calculate(this.productToTazaScoreInput(product));

    return {
      tazaScore,
      nutriScore: tazaScore.officialNutriScore,
      dataQuality: this.productDataQualityEvaluator.evaluate(product)
    };
  }

  async update(id: string, data: UpdateProductBody) {
    const existingProduct = await this.ensureExists(id);

    if (data.barcode) {
      await this.ensureBarcodeAvailable(data.barcode, id);
    }

    const scoreInput = this.toScoreInput({
      barcode: data.barcode ?? existingProduct.barcode,
      name: data.name ?? existingProduct.name,
      brand: data.brand ?? existingProduct.brand,
      category: data.category ?? existingProduct.category,
      ingredients: data.ingredients ?? existingProduct.ingredients,
      nutritionFacts: {
        servingType: data.nutritionFacts?.servingType ?? existingProduct.servingType,
        energyKcal: this.readNutritionValue(data, existingProduct, 'energyKcal'),
        protein: this.readNutritionValue(data, existingProduct, 'protein'),
        carbohydrates: this.readNutritionValue(data, existingProduct, 'carbohydrates'),
        sugars: this.readNutritionValue(data, existingProduct, 'sugars'),
        fat: this.readNutritionValue(data, existingProduct, 'fat'),
        saturatedFat: this.readNutritionValue(data, existingProduct, 'saturatedFat'),
        fiber: this.readNutritionValue(data, existingProduct, 'fiber'),
        salt: this.readNutritionValue(data, existingProduct, 'salt')
      },
      manualScoreOverride: data.manualScoreOverride,
      manualOverrideReason: data.manualOverrideReason,
      imageUrl: data.imageUrl,
      dataStatus: data.dataStatus ?? existingProduct.dataStatus,
      source: data.source,
      lastVerifiedAt: data.lastVerifiedAt
    });
    const scoreResult = this.scoreEngine.calculate(scoreInput);
    const product = await this.productRepository.update(id, data, scoreResult);

    return this.toProductDto(product);
  }

  async delete(id: string) {
    await this.ensureExists(id);
    await this.productRepository.delete(id);
  }

  async uploadImage(id: string, file: Express.Multer.File | undefined) {
    const existingProduct = await this.ensureExists(id);
    const storedImage = await this.imageStorage.store(file);

    try {
      const product = await this.productRepository.updateImageUrl(id, storedImage.imageUrl);
      await this.imageStorage.deleteLocalImage(existingProduct.imageUrl);

      return this.toProductDto(product);
    } catch (error) {
      await this.imageStorage.deleteLocalImage(storedImage.imageUrl);
      throw error;
    }
  }

  async removeImage(id: string) {
    const existingProduct = await this.ensureExists(id);
    const product = await this.productRepository.updateImageUrl(id, null);
    await this.imageStorage.deleteLocalImage(existingProduct.imageUrl);

    return this.toProductDto(product);
  }

  private toProductDto(product: ProductWithCanonicalFamily): ProductDto {
    const scoreProduct = product.canonicalProductFamily?.canonicalProduct ?? product;

    return toProductDto(
      product,
      this.tazaScoreEngine.calculate(this.productToTazaScoreInput(scoreProduct))
    );
  }

  private async ensureExists(id: string) {
    const product = await this.productRepository.findById(id);

    if (!product) {
      throw new HttpError(404, 'Product not found');
    }

    return product;
  }

  private async ensureBarcodeAvailable(barcode: string, currentProductId?: string) {
    const product = await this.productRepository.findByBarcode(barcode);

    if (product && product.id !== currentProductId) {
      throw new HttpError(409, 'Barcode already exists');
    }
  }

  private toScoreInput(data: ProductBody | (UpdateProductBody & ProductBody)): ScoreInput {
    return {
      servingType: data.nutritionFacts.servingType,
      energyKcal: data.nutritionFacts.energyKcal ?? null,
      protein: data.nutritionFacts.protein ?? null,
      carbohydrates: data.nutritionFacts.carbohydrates ?? null,
      sugars: data.nutritionFacts.sugars ?? null,
      fat: data.nutritionFacts.fat ?? null,
      saturatedFat: data.nutritionFacts.saturatedFat ?? null,
      fiber: data.nutritionFacts.fiber ?? null,
      salt: data.nutritionFacts.salt ?? null,
      category: data.category,
      ingredients: data.ingredients
    };
  }

  private toOfficialNutriScoreInput(data: OfficialNutriScorePreviewBody): OfficialNutriScoreInput {
    const input: OfficialNutriScoreInput = {
      servingType: data.nutritionFacts.servingType,
      energyKcal: data.nutritionFacts.energyKcal ?? null,
      energyKj: null,
      protein: data.nutritionFacts.protein ?? null,
      carbohydrates: data.nutritionFacts.carbohydrates ?? null,
      sugars: data.nutritionFacts.sugars ?? null,
      fat: data.nutritionFacts.fat ?? null,
      saturatedFat: data.nutritionFacts.saturatedFat ?? null,
      fiber: data.nutritionFacts.fiber ?? null,
      salt: data.nutritionFacts.salt ?? null,
      fruitVegetableLegumePercent: data.fruitVegetableLegumePercent ?? null,
      containsNonSugarSweeteners: data.containsNonSugarSweeteners ?? null,
      ingredients: data.ingredients
    };

    if (data.category) {
      input.legacyCategoryLabel = data.category;
    }

    if (data.officialNutriScoreCategory) {
      input.category = data.officialNutriScoreCategory;
    }

    return input;
  }

  private toTazaScoreInput(data: TazaScorePreviewBody): TazaScoreInput {
    return {
      ...this.toOfficialNutriScoreInput(data),
      dataStatus: data.dataStatus
    };
  }

  private productToTazaScoreInput(product: Product): TazaScoreInput {
    const input: TazaScoreInput = {
      servingType: product.servingType,
      energyKcal: product.energyKcal,
      energyKj: null,
      protein: product.protein,
      carbohydrates: product.carbohydrates,
      sugars: product.sugars,
      fat: product.fat,
      saturatedFat: product.saturatedFat,
      fiber: product.fiber,
      salt: product.salt,
      fruitVegetableLegumePercent: product.fruitVegetableLegumePercent,
      containsNonSugarSweeteners: product.containsNonSugarSweeteners,
      ingredients: product.ingredients,
      dataStatus: product.dataStatus
    };

    if (product.category) {
      input.legacyCategoryLabel = product.category;
    }

    if (product.officialNutriScoreCategory) {
      input.category = product.officialNutriScoreCategory;
    }

    return input;
  }

  private readNutritionValue(
    data: UpdateProductBody,
    existingProduct: Product,
    field: NumericNutritionField
  ) {
    if (data.nutritionFacts && field in data.nutritionFacts) {
      return data.nutritionFacts[field];
    }

    return existingProduct[field];
  }
}
