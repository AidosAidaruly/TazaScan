import { describe, expect, it } from 'vitest';
import type { Product } from '../generated/prisma/client';
import type { ListProductsQuery, ProductBody, UpdateProductBody } from '../schemas/product.schema';
import {
  officialNutriScorePreviewBodySchema,
  productBodySchema,
  tazaScorePreviewBodySchema
} from '../schemas/product.schema';
import type { ScoreEngine } from '../scoring/contracts/score-engine';
import type { ScoreInput, ScoreResult } from '../scoring/types/score-result';
import { ProductService } from './product.service';

const now = new Date('2026-07-31T00:00:00.000Z');

function createProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    barcode: '5449000000996',
    name: 'Coca-Cola Original Taste',
    brand: 'Coca-Cola',
    category: 'Soft Drinks',
    ingredients: ['Carbonated water', 'Sugar'],
    servingType: 'per100ml',
    energyKcal: 42,
    protein: 0,
    carbohydrates: 10.6,
    sugars: 10.6,
    fat: 0,
    saturatedFat: 0,
    fiber: null,
    salt: 0,
    officialNutriScoreCategory: null,
    fruitVegetableLegumePercent: null,
    containsNonSugarSweeteners: null,
    healthScore: 65,
    calculatedScore: 65,
    calculatedGrade: 'D',
    scoreStatus: 'calculated',
    scoreAlgorithm: 'test',
    scoreVersion: 'test-1',
    scoreCalculatedAt: now,
    scoreDetails: {
      score: 65,
      grade: 'D',
      status: 'calculated',
      positiveReasons: [],
      negativeReasons: [],
      warnings: [],
      missingFields: [],
      algorithm: 'test',
      algorithmVersion: 'test-1',
      calculatedAt: now.toISOString()
    },
    manualScoreOverride: null,
    manualOverrideReason: null,
    manualOverrideAt: null,
    imageUrl: null,
    dataStatus: 'verified',
    source: 'test',
    lastVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createProductBody(overrides = {}) {
  return {
    barcode: '5449000000996',
    name: 'Coca-Cola Original Taste',
    brand: 'Coca-Cola',
    category: 'Soft Drinks',
    ingredients: ['Carbonated water', 'Sugar'],
    nutritionFacts: {
      servingType: 'per100ml',
      energyKcal: 42,
      protein: 0,
      carbohydrates: 10.6,
      sugars: 10.6,
      fat: 0,
      saturatedFat: 0,
      fiber: 0,
      salt: 0
    },
    dataStatus: 'verified',
    ...overrides
  };
}

class FakeScoreEngine implements ScoreEngine {
  inputs: ScoreInput[] = [];

  calculate(input: ScoreInput): ScoreResult {
    this.inputs.push(input);

    return {
      score: 65,
      grade: 'D',
      status: 'calculated',
      positiveReasons: [],
      negativeReasons: ['High sugar content.'],
      warnings: [],
      missingFields: [],
      algorithm: 'test',
      algorithmVersion: 'test-1',
      calculatedAt: now.toISOString()
    };
  }
}

class FakeProductRepository {
  products: Product[] = [];
  deletedIds: string[] = [];
  lastListFilters: unknown;
  lastCreateData: ProductBody | null = null;
  lastUpdateData: UpdateProductBody | null = null;
  lastScoreResult: ScoreResult | null = null;
  failImageUpdate = false;

  list(filters: ListProductsQuery) {
    this.lastListFilters = filters;
    const filteredProducts = this.products.filter((product) => {
      const matchesName =
        !filters.name ||
        product.name.toLowerCase().includes(filters.name.toLowerCase());
      const matchesBrand =
        !filters.brand ||
        product.brand?.toLowerCase().includes(filters.brand.toLowerCase());
      const matchesBarcode =
        !filters.barcode || product.barcode.includes(filters.barcode);

      return matchesName && matchesBrand && matchesBarcode;
    });
    const start = (filters.page - 1) * filters.pageSize;
    const items = filteredProducts.slice(start, start + filters.pageSize);

    return Promise.resolve<[Product[], number]>([items, filteredProducts.length]);
  }

  findById(id: string) {
    return Promise.resolve(this.products.find((product) => product.id === id) ?? null);
  }

  findByBarcode(barcode: string) {
    return Promise.resolve(
      this.products.find((product) => product.barcode === barcode) ?? null
    );
  }

  create(data: ProductBody, scoreResult: ScoreResult) {
    this.lastCreateData = data;
    this.lastScoreResult = scoreResult;
    const product = createProduct({
      officialNutriScoreCategory: data.officialNutriScoreCategory ?? null,
      fruitVegetableLegumePercent: data.fruitVegetableLegumePercent ?? null,
      containsNonSugarSweeteners: data.containsNonSugarSweeteners ?? null
    });
    this.products.push(product);
    return Promise.resolve(product);
  }

  update(id: string, data: UpdateProductBody, scoreResult: ScoreResult) {
    this.lastUpdateData = data;
    this.lastScoreResult = scoreResult;
    const existing = this.products.find((item) => item.id === id);
    const product = createProduct({
      ...existing,
      id,
      name: data.name ?? 'Updated product',
      officialNutriScoreCategory:
        data.officialNutriScoreCategory ?? existing?.officialNutriScoreCategory ?? null,
      fruitVegetableLegumePercent:
        data.fruitVegetableLegumePercent ?? existing?.fruitVegetableLegumePercent ?? null,
      containsNonSugarSweeteners:
        data.containsNonSugarSweeteners ?? existing?.containsNonSugarSweeteners ?? null
    });
    this.products = this.products.map((item) => (item.id === id ? product : item));
    return Promise.resolve(product);
  }

  updateImageUrl(id: string, imageUrl: string | null) {
    if (this.failImageUpdate) {
      return Promise.reject(new Error('DB failure'));
    }

    const existing = this.products.find((product) => product.id === id);
    const product = createProduct({ ...existing, id, imageUrl });
    this.products = this.products.map((item) => (item.id === id ? product : item));
    return Promise.resolve(product);
  }

  delete(id: string) {
    this.deletedIds.push(id);
    this.products = this.products.filter((product) => product.id !== id);
    return Promise.resolve(createProduct({ id }));
  }
}

function createService(repository = new FakeProductRepository()) {
  const scoreEngine = new FakeScoreEngine();
  const imageStorage = new FakeProductImageStorage();

  return {
    repository,
    imageStorage,
    scoreEngine,
    service: new ProductService(repository, scoreEngine, imageStorage)
  };
}

class FakeProductImageStorage {
  deletedImages: Array<string | null | undefined> = [];
  storedUrl = '/uploads/products/new-image.webp';

  store() {
    return Promise.resolve({
      imageUrl: this.storedUrl,
      absolutePath: 'unused'
    });
  }

  deleteLocalImage(imageUrl: string | null | undefined) {
    this.deletedImages.push(imageUrl);
    return Promise.resolve();
  }
}

describe('ProductService', () => {
  it('creates a product', async () => {
    const { service } = createService();

    const product = await service.create(productBodySchema.parse(createProductBody()));

    expect(product.barcode).toBe('5449000000996');
    expect(product.nutritionFacts.sugars).toBe(10.6);
    expect(product.nutritionScore.status).toBe('calculated');
  });

  it('keeps existing products valid when official Nutri-Score fields are null', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct()];
    const { service } = createService(repository);

    const product = await service.getById('11111111-1111-4111-8111-111111111111');

    expect(product.officialNutriScoreCategory).toBeNull();
    expect(product.fruitVegetableLegumePercent).toBeNull();
    expect(product.containsNonSugarSweeteners).toBeNull();
  });

  it('returns 409 for duplicate barcode', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct()];
    const { service } = createService(repository);

    await expect(
      service.create(productBodySchema.parse(createProductBody()))
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Barcode already exists'
    });
  });

  it('rejects invalid barcode through schema validation', () => {
    const result = productBodySchema.safeParse(
      createProductBody({ barcode: 'invalid-barcode' })
    );

    expect(result.success).toBe(false);
  });

  it('rejects invalid official Nutri-Score percentage', () => {
    const result = productBodySchema.safeParse(
      createProductBody({ fruitVegetableLegumePercent: 101 })
    );

    expect(result.success).toBe(false);
  });

  it('rejects unsupported official Nutri-Score category', () => {
    const result = productBodySchema.safeParse(
      createProductBody({ officialNutriScoreCategory: 'dessert' })
    );

    expect(result.success).toBe(false);
  });

  it('preserves 0 percent FVL and false sweetener flag in parsed payload', () => {
    const result = productBodySchema.parse(
      createProductBody({
        officialNutriScoreCategory: 'beverage',
        fruitVegetableLegumePercent: 0,
        containsNonSugarSweeteners: false
      })
    );

    expect(result.fruitVegetableLegumePercent).toBe(0);
    expect(result.containsNonSugarSweeteners).toBe(false);
  });

  it('creates a product with structured official Nutri-Score data', async () => {
    const repository = new FakeProductRepository();
    const { service } = createService(repository);

    const product = await service.create(
      productBodySchema.parse(
        createProductBody({
          officialNutriScoreCategory: 'beverage',
          fruitVegetableLegumePercent: 0,
          containsNonSugarSweeteners: false
        })
      )
    );

    expect(repository.lastCreateData).toMatchObject({
      officialNutriScoreCategory: 'beverage',
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false
    });
    expect(product.officialNutriScoreCategory).toBe('beverage');
    expect(product.fruitVegetableLegumePercent).toBe(0);
    expect(product.containsNonSugarSweeteners).toBe(false);
  });

  it('finds a product by ID', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct()];
    const { service } = createService(repository);

    const product = await service.getById('11111111-1111-4111-8111-111111111111');

    expect(product.name).toBe('Coca-Cola Original Taste');
  });

  it('updates a product', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct()];
    const { scoreEngine, service } = createService(repository);

    const product = await service.update('11111111-1111-4111-8111-111111111111', {
      name: 'Updated product'
    });

    expect(product.name).toBe('Updated product');
    expect(scoreEngine.inputs[0]?.category).toBe('Soft Drinks');
  });

  it('previews official Nutri-Score without modifying legacy calculated score', () => {
    const repository = new FakeProductRepository();
    const { service } = createService(repository);

    const preview = service.previewOfficialNutriScore(
      productBodySchema.parse(
        createProductBody({
          officialNutriScoreCategory: 'beverage',
          fruitVegetableLegumePercent: 0,
          containsNonSugarSweeteners: false
        })
      )
    );

    expect(preview.status).toBe('calculated');
    expect(preview.rawScore).toBe(13);
    expect(preview.grade).toBe('E');
    expect(repository.lastScoreResult).toBeNull();
  });

  it('accepts preview validation with beverage, 0 percent FVL, and false sweetener flag', () => {
    const { service } = createService();
    const previewBody = officialNutriScorePreviewBodySchema.parse({
      category: '',
      ingredients: ['Carbonated water', 'Sugar'],
      nutritionFacts: {
        servingType: 'per100ml',
        energyKcal: 42,
        protein: 0,
        carbohydrates: 10.6,
        sugars: 10.6,
        fat: 0,
        saturatedFat: 0,
        fiber: 0,
        salt: 0
      },
      officialNutriScoreCategory: 'beverage',
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false
    });

    const preview = service.previewOfficialNutriScore(previewBody);

    expect(preview.status).toBe('calculated');
    expect(preview.rawScore).toBe(13);
    expect(preview.grade).toBe('E');
  });

  it('previews missing official Nutri-Score data without guessing values', () => {
    const { service } = createService();

    const preview = service.previewOfficialNutriScore(
      officialNutriScorePreviewBodySchema.parse({
        officialNutriScoreCategory: 'beverage',
        fruitVegetableLegumePercent: 0,
        containsNonSugarSweeteners: false
      })
    );

    expect(preview.status).toBe('insufficient_data');
    expect(preview.rawScore).toBeNull();
    expect(preview.missingFields).toContain('energyKcalOrEnergyKj');
    expect(preview.missingFields).toContain('sugars');
  });

  it('previews TazaScore without persisting or triggering legacy scoring', () => {
    const repository = new FakeProductRepository();
    const { service } = createService(repository);

    const preview = service.previewTazaScore(
      tazaScorePreviewBodySchema.parse({
        category: 'Soft Drinks',
        ingredients: [
          'Carbonated water',
          'Sugar',
          'Colour caramel E150d',
          'Phosphoric acid',
          'Natural flavourings',
          'Caffeine'
        ],
        nutritionFacts: {
          servingType: 'per100ml',
          energyKcal: 42,
          protein: 0,
          carbohydrates: 10.6,
          sugars: 10.6,
          fat: 0,
          saturatedFat: 0,
          fiber: 0,
          salt: 0
        },
        officialNutriScoreCategory: 'beverage',
        fruitVegetableLegumePercent: 0,
        containsNonSugarSweeteners: false,
        dataStatus: 'verified'
      })
    );

    expect(preview.status).toBe('calculated');
    expect(preview.score).toBe(27);
    expect(preview.nutritionComponent.score).toBe(17);
    expect(preview.ingredientComponent.score).toBe(10);
    expect(preview.confidence.level).toBe('high');
    expect(preview.officialNutriScore).toMatchObject({
      status: 'calculated',
      rawScore: 13,
      grade: 'E'
    });
    expect(repository.lastScoreResult).toBeNull();
    expect(repository.lastCreateData).toBeNull();
    expect(repository.lastUpdateData).toBeNull();
  });

  it('previews stored product score without persisting legacy fields', async () => {
    const repository = new FakeProductRepository();
    repository.products = [
      createProduct({
        officialNutriScoreCategory: 'beverage',
        fruitVegetableLegumePercent: 0,
        containsNonSugarSweeteners: false,
        fiber: 0,
        calculatedScore: 69,
        calculatedGrade: 'C',
        healthScore: 69
      })
    ];
    const { service } = createService(repository);

    const preview = await service.previewProductScore(
      '11111111-1111-4111-8111-111111111111'
    );

    expect(preview.tazaScore.status).toBe('calculated');
    expect(preview.tazaScore.score).toBe(27);
    expect(preview.tazaScore.nutritionComponent.score).toBe(17);
    expect(preview.tazaScore.ingredientComponent.score).toBe(10);
    expect(preview.tazaScore.confidence.level).toBe('high');
    expect(preview.nutriScore).toMatchObject({
      status: 'calculated',
      rawScore: 13,
      grade: 'E'
    });
    expect(repository.products[0].calculatedScore).toBe(69);
    expect(repository.products[0].calculatedGrade).toBe('C');
    expect(repository.lastScoreResult).toBeNull();
    expect(repository.lastCreateData).toBeNull();
    expect(repository.lastUpdateData).toBeNull();
  });

  it('calculates stored product TazaScore from partial data when official Nutri-Score is unavailable', async () => {
    const repository = new FakeProductRepository();
    repository.products = [
      createProduct({
        officialNutriScoreCategory: 'beverage',
        energyKcal: null,
        sugars: null,
        fiber: null
      })
    ];
    const { service } = createService(repository);

    const preview = await service.previewProductScore(
      '11111111-1111-4111-8111-111111111111'
    );

    expect(preview.tazaScore.status).toBe('calculated');
    expect(preview.tazaScore.score).not.toBeNull();
    expect(preview.tazaScore.missingFields).toContain('energyKcalOrEnergyKj');
    expect(preview.tazaScore.missingFields).toContain('sugars');
    expect(preview.tazaScore.usedFields).toEqual(
      expect.arrayContaining(['saturatedFat', 'salt', 'protein'])
    );
    expect(preview.nutriScore.status).toBe('insufficient_data');
    expect(repository.lastScoreResult).toBeNull();
  });

  it('returns insufficient data when stored product has too little evidence for TazaScore', async () => {
    const repository = new FakeProductRepository();
    repository.products = [
      createProduct({
        officialNutriScoreCategory: 'general_food',
        energyKcal: 100,
        protein: null,
        carbohydrates: null,
        sugars: null,
        fat: null,
        saturatedFat: null,
        fiber: null,
        salt: null,
        fruitVegetableLegumePercent: null
      })
    ];
    const { service } = createService(repository);

    const preview = await service.previewProductScore(
      '11111111-1111-4111-8111-111111111111'
    );

    expect(preview.tazaScore.status).toBe('insufficient_data');
    expect(preview.tazaScore.score).toBeNull();
    expect(preview.tazaScore.usedFields).toEqual(['energyKcal']);
    expect(preview.tazaScore.reasonCodes).toContain('MISSING_TAZASCORE_INPUT');
    expect(preview.nutriScore.status).toBe('insufficient_data');
  });

  it('preserves zero fruit percentage and false sweetener flag in TazaScore preview', () => {
    const body = tazaScorePreviewBodySchema.parse({
      officialNutriScoreCategory: 'beverage',
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false,
      nutritionFacts: {
        servingType: 'per100ml',
        energyKcal: 42,
        protein: 0,
        carbohydrates: 10.6,
        sugars: 10.6,
        fat: 0,
        saturatedFat: 0,
        fiber: 0,
        salt: 0
      }
    });

    expect(body.fruitVegetableLegumePercent).toBe(0);
    expect(body.containsNonSugarSweeteners).toBe(false);
  });

  it('returns insufficient data for TazaScore preview when critical nutrition is missing', () => {
    const { service } = createService();

    const preview = service.previewTazaScore(
      tazaScorePreviewBodySchema.parse({
        officialNutriScoreCategory: 'beverage',
        fruitVegetableLegumePercent: 0,
        containsNonSugarSweeteners: false
      })
    );

    expect(preview.status).toBe('insufficient_data');
    expect(preview.score).toBeNull();
    expect(preview.missingFields).toContain('energyKcalOrEnergyKj');
    expect(preview.missingFields).toContain('sugars');
  });

  it('automatically recalculates after update', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct()];
    const { service } = createService(repository);

    await service.update('11111111-1111-4111-8111-111111111111', {
      nutritionFacts: { servingType: 'per100ml', sugars: 0 }
    });

    expect(repository.lastScoreResult?.algorithm).toBe('test');
    expect(repository.lastScoreResult?.status).toBe('calculated');
  });

  it('keeps legacy scoring unchanged when structured Nutri-Score fields are saved', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct()];
    const { service } = createService(repository);

    await service.update('11111111-1111-4111-8111-111111111111', {
      officialNutriScoreCategory: 'beverage',
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false
    });

    expect(repository.lastUpdateData).toMatchObject({
      officialNutriScoreCategory: 'beverage',
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false
    });
    expect(repository.lastScoreResult?.algorithm).toBe('test');
    expect(repository.lastScoreResult?.score).toBe(65);
    expect(repository.lastScoreResult?.grade).toBe('D');
  });

  it('deletes a product', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct()];
    const { service } = createService(repository);

    await service.delete('11111111-1111-4111-8111-111111111111');

    expect(repository.deletedIds).toContain('11111111-1111-4111-8111-111111111111');
  });

  it('uploads a product image and deletes old local image after DB update', async () => {
    const repository = new FakeProductRepository();
    repository.products = [
      createProduct({ imageUrl: '/uploads/products/old-image.webp' })
    ];
    const { imageStorage, service } = createService(repository);

    const product = await service.uploadImage(
      '11111111-1111-4111-8111-111111111111',
      undefined
    );

    expect(product.imageUrl).toBe('/uploads/products/new-image.webp');
    expect(imageStorage.deletedImages).toEqual(['/uploads/products/old-image.webp']);
  });

  it('removes product image', async () => {
    const repository = new FakeProductRepository();
    repository.products = [
      createProduct({ imageUrl: '/uploads/products/old-image.webp' })
    ];
    const { imageStorage, service } = createService(repository);

    const product = await service.removeImage('11111111-1111-4111-8111-111111111111');

    expect(product.imageUrl).toBeNull();
    expect(imageStorage.deletedImages).toEqual(['/uploads/products/old-image.webp']);
  });

  it('deletes newly stored image if DB image update fails', async () => {
    const repository = new FakeProductRepository();
    repository.failImageUpdate = true;
    repository.products = [
      createProduct({ imageUrl: '/uploads/products/old-image.webp' })
    ];
    const { imageStorage, service } = createService(repository);

    await expect(
      service.uploadImage('11111111-1111-4111-8111-111111111111', undefined)
    ).rejects.toThrow('DB failure');

    expect(imageStorage.deletedImages).toEqual(['/uploads/products/new-image.webp']);
    expect(repository.products[0]?.imageUrl).toBe('/uploads/products/old-image.webp');
  });

  it('returns pagination metadata', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct(), createProduct({ id: '22222222-2222-4222-8222-222222222222' })];
    const { service } = createService(repository);

    const result = await service.list({ page: 1, pageSize: 1 });

    expect(result.pagination.total).toBe(2);
    expect(result.pagination.totalPages).toBe(2);
  });

  it('searches products', async () => {
    const repository = new FakeProductRepository();
    repository.products = [
      createProduct(),
      createProduct({
        id: '22222222-2222-4222-8222-222222222222',
        barcode: '5901234123457',
        name: 'Plain Yogurt',
        brand: 'Dairy Co',
        category: 'Dairy'
      })
    ];
    const { service } = createService(repository);

    const result = await service.list({
      page: 1,
      pageSize: 20,
      name: 'cola',
      brand: 'coca'
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.barcode).toBe('5449000000996');
    expect(repository.lastListFilters).toMatchObject({
      name: 'cola',
      brand: 'coca'
    });
  });

  it('returns 404 for missing products', async () => {
    const { service } = createService();

    await expect(
      service.getById('11111111-1111-4111-8111-111111111111')
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Product not found'
    });
  });

  it('returns 404 when updating a missing product', async () => {
    const { service } = createService();

    await expect(
      service.update('11111111-1111-4111-8111-111111111111', {
        name: 'Updated product'
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Product not found'
    });
  });
});
