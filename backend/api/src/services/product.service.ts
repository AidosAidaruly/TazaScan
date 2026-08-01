import type { Product } from '../generated/prisma/client';
import type { ListProductsQuery, ProductBody, UpdateProductBody } from '../schemas/product.schema';
import type { ScoreEngine } from '../scoring/contracts/score-engine';
import type { ScoreInput } from '../scoring/types/score-result';
import type { PaginatedResponse } from '../types/pagination';
import type { ProductDto } from '../types/product';
import { toProductDto } from '../types/product';
import { HttpError } from '../utils/http-error';

type ProductRepositoryContract = {
  list(filters: ListProductsQuery): Promise<[Product[], number]>;
  findById(id: string): Promise<Product | null>;
  findByBarcode(barcode: string): Promise<Product | null>;
  create(data: ProductBody, scoreResult: ReturnType<ScoreEngine['calculate']>): Promise<Product>;
  update(id: string, data: UpdateProductBody, scoreResult: ReturnType<ScoreEngine['calculate']>): Promise<Product>;
  delete(id: string): Promise<Product>;
};

type NumericNutritionField = Exclude<keyof ProductBody['nutritionFacts'], 'servingType'>;

export class ProductService {
  constructor(
    private readonly productRepository: ProductRepositoryContract,
    private readonly scoreEngine: ScoreEngine
  ) {}

  async list(filters: ListProductsQuery): Promise<PaginatedResponse<ProductDto>> {
    const [products, total] = await this.productRepository.list(filters);

    return {
      items: products.map(toProductDto),
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

    return toProductDto(product);
  }

  async getByBarcode(barcode: string) {
    const product = await this.productRepository.findByBarcode(barcode);

    if (!product) {
      throw new HttpError(404, 'Product not found');
    }

    return toProductDto(product);
  }

  async create(data: ProductBody) {
    await this.ensureBarcodeAvailable(data.barcode);
    const scoreResult = this.scoreEngine.calculate(this.toScoreInput(data));
    const product = await this.productRepository.create(data, scoreResult);

    return toProductDto(product);
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

    return toProductDto(product);
  }

  async delete(id: string) {
    await this.ensureExists(id);
    await this.productRepository.delete(id);
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
