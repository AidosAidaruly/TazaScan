import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Product, ProductSubmission } from '../generated/prisma/client';
import type { ProductBody } from '../schemas/product.schema';
import {
  approveSubmissionBodySchema,
  productSubmissionBodySchema
} from '../schemas/product-submission.schema';
import { NutriScoreEngine } from '../scoring/engines/nutri-score.engine';
import { ProductSubmissionService } from './product-submission.service';
import { ProductService } from './product.service';

// Approval -> stored product -> TazaScore, using the real submission service, product
// service and scoring engines. Only persistence is replaced by in-memory fakes.

const now = new Date('2026-08-01T00:00:00.000Z');
const submissionId = '11111111-1111-4111-8111-111111111111';

// Per 100 g, as entered on a package label: no fruit/vegetable/legume percentage.
const labelNutrition = {
  servingType: 'per100g' as const,
  energyKcal: 520,
  protein: 6.5,
  carbohydrates: 58,
  sugars: 48,
  fat: 28,
  saturatedFat: 17,
  fiber: 2.4,
  salt: 0.25
};

function approveBody(overrides: Record<string, unknown> = {}) {
  // Parsed exactly like the controller does, so the schema is part of every test.
  return approveSubmissionBodySchema.parse({
    barcode: '4870200000011',
    name: 'Шоколадный батончик',
    category: 'Шоколад',
    ingredients: ['сахар', 'какао-масло', 'молоко сухое'],
    ...labelNutrition,
    ...overrides
  });
}

describe('submission approval: Nutri-Score category and TazaScore', () => {
  it('stores the admin-selected category and gives the product a numeric TazaScore', async () => {
    const { approveAndRead, storedProduct } = createServices();

    const product = await approveAndRead(approveBody({ officialNutriScoreCategory: 'general_food' }));

    expect(storedProduct().officialNutriScoreCategory).toBe('general_food');
    expect(product.officialNutriScoreCategory).toBe('general_food');
    expect(product.tazaScore.status).toBe('calculated');
    expect(product.tazaScore.score).toEqual(expect.any(Number));
    expect(product.tazaScore.officialNutriScore.category).toBe('general_food');
  });

  it('scores the stored product exactly like the product editor preview of the same data', async () => {
    const { approveAndRead, productService } = createServices();

    const product = await approveAndRead(approveBody({ officialNutriScoreCategory: 'general_food' }));
    const preview = productService.previewTazaScore({
      category: 'Шоколад',
      ingredients: ['сахар', 'какао-масло', 'молоко сухое'],
      nutritionFacts: labelNutrition,
      officialNutriScoreCategory: 'general_food',
      dataStatus: 'community'
    });

    expect(product.tazaScore.score).toBe(preview.score);
    expect(product.tazaScore.status).toBe(preview.status);
  });

  it('uses the selected category over the free-text category label', async () => {
    const { approveAndRead } = createServices();

    // "Juice" alone would map to beverage; the admin's explicit choice wins.
    const product = await approveAndRead(
      approveBody({ category: 'Juice', officialNutriScoreCategory: 'general_food' })
    );

    expect(product.officialNutriScoreCategory).toBe('general_food');
    expect(product.tazaScore.officialNutriScore.category).toBe('general_food');
  });

  it('applies the water special case when the admin selects water', async () => {
    const { approveAndRead } = createServices();

    const product = await approveAndRead(
      approveBody({
        name: 'Питьевая вода',
        category: 'Вода',
        ingredients: ['вода'],
        servingType: 'per100ml',
        energyKcal: 0,
        protein: 0,
        carbohydrates: 0,
        sugars: 0,
        fat: 0,
        saturatedFat: 0,
        fiber: 0,
        salt: 0,
        officialNutriScoreCategory: 'water'
      })
    );

    expect(product.officialNutriScoreCategory).toBe('water');
    expect(product.tazaScore.officialNutriScore.grade).toBe('A');
  });

  it('still approves without a category, keeping it unknown and the score insufficient', async () => {
    const { approveAndRead, storedProduct } = createServices();

    const product = await approveAndRead(approveBody());

    expect(storedProduct().officialNutriScoreCategory).toBeNull();
    expect(product.tazaScore.status).toBe('insufficient_data');
    expect(product.tazaScore.score).toBeNull();
    expect(product.tazaScore.missingFields).toContain('officialNutriScoreCategory');
  });

  it('treats an explicit null category like an omitted one', async () => {
    const { approveAndRead, storedProduct } = createServices();

    const product = await approveAndRead(approveBody({ officialNutriScoreCategory: null }));

    expect(storedProduct().officialNutriScoreCategory).toBeNull();
    expect(product.tazaScore.score).toBeNull();
  });

  it('keeps the existing category-label fallback when no category is selected', async () => {
    const { approveAndRead, storedProduct } = createServices();

    const product = await approveAndRead(approveBody({ category: 'Snacks' }));

    // Nothing is invented in storage; the engine maps the known label at read time.
    expect(storedProduct().officialNutriScoreCategory).toBeNull();
    expect(product.tazaScore.officialNutriScore.category).toBe('general_food');
    expect(product.tazaScore.score).toEqual(expect.any(Number));
  });

  it('does not produce a score from a category alone when nutrition is missing', async () => {
    const { approveAndRead, storedProduct } = createServices();

    const product = await approveAndRead(
      approveBody({
        energyKcal: null,
        protein: null,
        carbohydrates: null,
        sugars: null,
        fat: null,
        saturatedFat: null,
        fiber: null,
        salt: null,
        officialNutriScoreCategory: 'general_food'
      })
    );

    expect(storedProduct().officialNutriScoreCategory).toBe('general_food');
    expect(product.tazaScore.status).toBe('insufficient_data');
    expect(product.tazaScore.score).toBeNull();
  });

  it('approves with some optional nutrition missing and keeps those values unknown', async () => {
    const { approveAndRead, storedProduct } = createServices();

    const product = await approveAndRead(
      approveBody({ fiber: null, protein: null, officialNutriScoreCategory: 'general_food' })
    );

    expect(storedProduct()).toMatchObject({ fiber: null, protein: null });
    expect(product.nutritionFacts).toMatchObject({ fiber: null, protein: null });
    // Never filled in: fruit/vegetable/legume share and sweeteners are not on the form.
    expect(storedProduct()).toMatchObject({
      fruitVegetableLegumePercent: null,
      containsNonSugarSweeteners: null
    });
    expect(product.tazaScore.missingFields).toEqual(
      expect.arrayContaining(['fiber', 'protein', 'fruitVegetableLegumePercent'])
    );
  });

  it('still rejects inconsistent nutrition before creating a product', async () => {
    const { submissionService, products } = createServices();

    await expect(
      submissionService.approve(
        submissionId,
        approveBody({ sugars: 70, carbohydrates: 58, officialNutriScoreCategory: 'general_food' }),
        'admin-id'
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(products.size).toBe(0);
  });
});

describe('approval body: officialNutriScoreCategory validation', () => {
  it.each(['general_food', 'beverage', 'water', 'cheese', 'fats_oils_nuts_seeds', 'red_meat'])(
    'accepts %s',
    (category) => {
      expect(approveBody({ officialNutriScoreCategory: category }).officialNutriScoreCategory).toBe(
        category
      );
    }
  );

  it('accepts null and an omitted category', () => {
    expect(approveBody({ officialNutriScoreCategory: null }).officialNutriScoreCategory).toBeNull();
    expect(approveBody().officialNutriScoreCategory).toBeUndefined();
  });

  it.each([
    ['an unknown category', 'snacks'],
    ['a differently cased value', 'General_Food'],
    ['the empty string', ''],
    ['a number', 1],
    ['a grade instead of a category', 'A']
  ])('rejects %s with a field error', (_kind, value) => {
    const result = approveSubmissionBodySchema.safeParse({
      barcode: '4870200000011',
      name: 'Шоколадный батончик',
      category: 'Шоколад',
      ingredients: [],
      officialNutriScoreCategory: value
    });

    expect(result.success).toBe(false);
    expect(Object.keys(result.error!.flatten().fieldErrors)).toEqual(['officialNutriScoreCategory']);
  });

  it('is not accepted from user submissions: the public schema drops it', () => {
    const parsed = productSubmissionBodySchema.parse({
      barcode: '4870200000011',
      name: 'Шоколадный батончик',
      officialNutriScoreCategory: 'water'
    });

    expect(parsed).not.toHaveProperty('officialNutriScoreCategory');
  });
});

function createServices() {
  const products = new Map<string, Product>();
  let submission: ProductSubmission = createSubmission();

  const submissionRepository = {
    transaction: <T>(operation: (transaction: never) => Promise<T>) => operation(undefined as never),
    findById: async (id: string) => (id === submission.id ? { ...submission, createdProduct: null } : null),
    findProductByBarcode: async (barcode: string) =>
      [...products.values()].find((product) => product.barcode === barcode) ?? null,
    markApproved: async (id: string, createdProductId: string, reviewedByUserId: string) => {
      submission = { ...submission, id, status: 'approved', createdProductId, reviewedByUserId, reviewedAt: now };
      return { ...submission, createdProduct: null };
    }
  };

  const productRepository = {
    findById: async (id: string) => products.get(id) ?? null,
    findByBarcode: async (barcode: string) =>
      [...products.values()].find((product) => product.barcode === barcode) ?? null,
    // Mirrors ProductRepository.create: fields not given are stored as null.
    create: async (data: ProductBody) => {
      const product = createProduct(data);
      products.set(product.id, product);
      return product;
    }
  };

  const productImages = {
    copySubmissionImage: async () => null,
    deleteImage: async () => undefined
  };

  const productService = new ProductService(
    productRepository as never,
    new NutriScoreEngine(),
    productImages as never
  );
  const submissionService = new ProductSubmissionService(
    submissionRepository as never,
    productService,
    productImages as never
  );

  async function approveAndRead(body: ReturnType<typeof approveBody>) {
    const approved = await submissionService.approve(submissionId, body, 'admin-id');
    expect(approved.status).toBe('approved');
    // The public read path the mobile app uses.
    const product = await productService.getById(approved.createdProductId!);
    expect(product.tazaScore).not.toBeNull();
    return { ...product, tazaScore: product.tazaScore! };
  }

  function storedProduct() {
    const all = [...products.values()];
    expect(all).toHaveLength(1);
    return all[0]!;
  }

  return { submissionService, productService, approveAndRead, storedProduct, products };
}

function createSubmission(): ProductSubmission {
  return {
    id: submissionId,
    barcode: '4870200000011',
    name: 'Шоколадный батончик',
    brand: null,
    category: 'Шоколад',
    ingredients: ['сахар', 'какао-масло', 'молоко сухое'],
    ...labelNutrition,
    frontImageUrl: null,
    ingredientsImageUrl: null,
    nutritionImageUrl: null,
    barcodeImageUrl: null,
    status: 'pending',
    moderationNote: null,
    submittedAt: now,
    reviewedAt: null,
    reviewedByUserId: null,
    createdProductId: null,
    anonymousDeviceId: null
  };
}

function createProduct(data: ProductBody): Product {
  const nutrition = data.nutritionFacts;
  return {
    id: randomUUID(),
    barcode: data.barcode,
    name: data.name,
    brand: data.brand ?? null,
    category: data.category,
    ingredients: data.ingredients,
    ingredientsTextOriginal: null,
    ingredientsTextOriginalLanguage: null,
    ingredientsTextRu: null,
    ingredientsTextTranslatedRu: null,
    ingredientsTranslationSource: null,
    ingredientsTranslatedAt: null,
    servingType: nutrition.servingType,
    energyKcal: nutrition.energyKcal ?? null,
    protein: nutrition.protein ?? null,
    carbohydrates: nutrition.carbohydrates ?? null,
    sugars: nutrition.sugars ?? null,
    fat: nutrition.fat ?? null,
    saturatedFat: nutrition.saturatedFat ?? null,
    fiber: nutrition.fiber ?? null,
    salt: nutrition.salt ?? null,
    officialNutriScoreCategory: data.officialNutriScoreCategory ?? null,
    fruitVegetableLegumePercent: data.fruitVegetableLegumePercent ?? null,
    containsNonSugarSweeteners: data.containsNonSugarSweeteners ?? null,
    // Legacy stored score column; TazaScore is computed from the fields above on read.
    healthScore: 0,
    calculatedScore: null,
    calculatedGrade: null,
    scoreStatus: 'insufficient_data',
    scoreAlgorithm: 'test',
    scoreVersion: 'test-1',
    scoreCalculatedAt: now,
    scoreDetails: {},
    manualScoreOverride: null,
    manualOverrideReason: null,
    manualOverrideAt: null,
    imageUrl: data.imageUrl ?? null,
    dataStatus: data.dataStatus,
    source: data.source ?? null,
    lastVerifiedAt: null,
    canonicalProductFamilyId: null,
    createdAt: now,
    updatedAt: now
  };
}
