import { describe, expect, it } from 'vitest';
import type { Product } from '../generated/prisma/client';
import type { TazaScoreResult } from '../scoring/types/taza-score-result';
import { PhotoSearchService } from '../services/photo-search.service';
import { toAdminProductDto, toProductDto } from './product';
import { toProductSubmissionDto } from './product-submission';

const now = new Date('2026-08-16T00:00:00.000Z');

function createProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    barcode: '5449000131836',
    name: 'Coca-Cola Zero 500ml',
    brand: 'Coca-Cola',
    category: 'Diet cola soft drink',
    ingredients: ['Carbonated water'],
    ingredientsTextOriginal: null,
    ingredientsTextOriginalLanguage: null,
    ingredientsTextRu: null,
    ingredientsTextTranslatedRu: null,
    ingredientsTranslationSource: null,
    ingredientsTranslatedAt: null,
    servingType: 'per100ml',
    energyKcal: 0.2,
    protein: 0,
    carbohydrates: 0,
    sugars: 0,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    salt: 0.05,
    officialNutriScoreCategory: 'beverage',
    fruitVegetableLegumePercent: null,
    containsNonSugarSweeteners: null,
    healthScore: 0,
    calculatedScore: 83,
    calculatedGrade: 'B',
    scoreStatus: 'calculated',
    scoreAlgorithm: 'test',
    scoreVersion: 'test-1',
    scoreCalculatedAt: now,
    scoreDetails: {
      score: 83,
      grade: 'B',
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
    dataStatus: 'community',
    source: 'Open Food Facts',
    lastVerifiedAt: null,
    canonicalProductFamilyId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('toProductDto image suitability', () => {
  it('includes computed TazaScore separately from legacy nutrition score', () => {
    const tazaScore: TazaScoreResult = {
      score: 27,
      status: 'calculated',
      nutritionComponent: {
        score: 17,
        maxScore: 90,
        status: 'calculated',
        reasonCodes: ['HIGH_SUGAR'],
        missingFields: []
      },
      ingredientComponent: {
        score: 10,
        maxScore: 10,
        status: 'calculated',
        reasonCodes: [],
        missingFields: [],
        additiveCount: null,
        knownRiskPenalty: 0
      },
      confidence: {
        score: null,
        maxScore: 0,
        status: 'calculated',
        reasonCodes: [],
        missingFields: [],
        level: 'high',
        dataStatus: 'community'
      },
      officialNutriScore: {
        status: 'calculated',
        rawScore: 10,
        grade: 'E',
        reasonCodes: ['HIGH_SUGAR'],
        missingFields: [],
        warnings: [],
        algorithm: 'Official Nutri-Score',
        algorithmVersion: 'v2-2023',
        category: 'beverage',
        componentPoints: {
          energy: 1,
          sugars: 9,
          saturatedFat: 0,
          salt: 0,
          nonSugarSweeteners: 0,
          fruitVegetableLegume: 0,
          fiber: 0,
          protein: 0,
          negativeTotal: 10,
          positiveTotal: 0
        },
        calculatedAt: now.toISOString()
      },
      reasonCodes: ['HIGH_SUGAR'],
      positiveReasons: [],
      negativeReasons: ['High sugar content.'],
      missingFields: [],
      usedFields: ['sugars'],
      nutritionCoverage: 1,
      missingCriticalFields: [],
      scoreBeforeSafeguard: 27,
      scoreCap: null,
      safeguardsApplied: [],
      warnings: [],
      methodology: 'TazaScore',
      methodologyVersion: 'taza-score-v1.1',
      calculatedAt: now.toISOString()
    };

    const dto = toProductDto(createProduct(), tazaScore);

    expect(dto.tazaScore).toBe(tazaScore);
    expect(dto.nutritionScore.score).toBe(83);
    expect(dto.nutritionScore.grade).toBe('B');
    expect(dto.scoreSource).toBe('product_record');
    expect(dto.canonicalFamilyId).toBeNull();
    expect(dto.canonicalProductId).toBeNull();
  });

  it('uses placeholder fallback for unsuitable community images without changing scoring', () => {
    const dto = toProductDto(
      createProduct({
        imageUrl:
          'https://images.openfoodfacts.org/images/products/544/900/013/1836/ingredients_en.12.200.jpg'
      })
    );

    expect(dto.imageUrl).toBeNull();
    expect(dto.nutritionScore.score).toBe(83);
    expect(dto.nutritionScore.grade).toBe('B');
  });

  it('keeps Halal Check classification separate from TazaScore', () => {
    const tazaScore = {
      score: 90,
      status: 'calculated',
      methodology: 'TazaScore',
      methodologyVersion: 'taza-score-v1.1'
    } as TazaScoreResult;

    const dto = toProductDto(
      createProduct({
        ingredients: ['pork'],
        calculatedScore: 90,
        calculatedGrade: 'A'
      }),
      tazaScore
    );

    expect(dto.tazaScore).toBe(tazaScore);
    expect(dto.tazaScore?.score).toBe(90);
    expect(dto.nutritionScore.score).toBe(83);
    expect(dto.halalCheck.status).toBe('non_halal');
    expect(dto.halalCheck.reasons).toContain('PORK_DETECTED');
  });

  it('keeps verified manual images visible', () => {
    const dto = toProductDto(
      createProduct({
        imageUrl: '/uploads/products/manual.webp',
        dataStatus: 'verified',
        source: 'Manual label review'
      })
    );

    expect(dto.imageUrl).toBe('/uploads/products/manual.webp');
  });

  it('uses Russian ingredient text for consumer DTO when available', () => {
    const dto = toProductDto(
      createProduct({
        ingredients: ['Sugar', 'cocoa butter'],
        ingredientsTextOriginal: 'Sugar; cocoa butter',
        ingredientsTextOriginalLanguage: 'en',
        ingredientsTextRu: 'Сахар; какао-масло'
      })
    );

    expect(dto.ingredients).toEqual(['Сахар', 'какао-масло']);
    expect(dto.ingredientsTextOriginal).toBe('Sugar; cocoa butter');
    expect(dto.ingredientsTextOriginalLanguage).toBe('en');
    expect(dto.ingredientsTextRu).toBe('Сахар; какао-масло');
    expect(dto.ingredientsIsTranslated).toBe(false);
  });

  it('uses generated Russian translation when source Russian text is unavailable', () => {
    const dto = toProductDto(
      createProduct({
        ingredients: ['Sugar', 'cocoa butter'],
        ingredientsTextOriginal: 'Sugar; cocoa butter',
        ingredientsTextOriginalLanguage: 'en',
        ingredientsTextTranslatedRu: 'Сахар; какао-масло',
        ingredientsTranslationSource: 'local_glossary_v1',
        ingredientsTranslatedAt: now
      })
    );

    expect(dto.ingredients).toEqual(['Сахар', 'какао-масло']);
    expect(dto.ingredientsTextTranslatedRu).toBe('Сахар; какао-масло');
    expect(dto.ingredientsTranslationSource).toBe('local_glossary_v1');
    expect(dto.ingredientsTranslatedAt).toBe(now.toISOString());
    expect(dto.ingredientsIsTranslated).toBe(true);
  });

  it('prefers source Russian over generated translation', () => {
    const dto = toProductDto(
      createProduct({
        ingredients: ['Sugar'],
        ingredientsTextOriginal: 'Sugar',
        ingredientsTextOriginalLanguage: 'en',
        ingredientsTextRu: 'Сахар из источника',
        ingredientsTextTranslatedRu: 'Сахар машинный'
      })
    );

    expect(dto.ingredients).toEqual(['Сахар из источника']);
    expect(dto.ingredientsIsTranslated).toBe(false);
  });

  it('falls back to original text before legacy ingredient array', () => {
    const dto = toProductDto(
      createProduct({
        ingredients: ['legacy sugar'],
        ingredientsTextOriginal: 'Sugar; cocoa butter',
        ingredientsTextOriginalLanguage: 'en'
      })
    );

    expect(dto.ingredients).toEqual(['Sugar', 'cocoa butter']);
    expect(dto.ingredientsIsTranslated).toBe(false);
  });

  it('uses legacy ingredients when no text fields are available', () => {
    const dto = toProductDto(
      createProduct({
        ingredients: ['Carbonated water', 'Sugar']
      })
    );

    expect(dto.ingredients).toEqual(['Carbonated water', 'Sugar']);
    expect(dto.ingredientsIsTranslated).toBe(false);
  });

  it('exposes canonical score metadata when product belongs to a family', () => {
    const canonicalProduct = createProduct({
      id: '22222222-2222-4222-8222-222222222222',
      barcode: '5449000000996',
      name: 'Coca-Cola Original Taste',
      sugars: 10.6,
      energyKcal: 42
    });
    const dto = toProductDto(
      {
        ...createProduct({
          canonicalProductFamilyId: 'family-1'
        }),
        canonicalProductFamily: {
          id: 'family-1',
          canonicalProductId: canonicalProduct.id,
          canonicalProduct
        }
      },
      null
    );

    expect(dto.scoreSource).toBe('canonical_recipe');
    expect(dto.canonicalFamilyId).toBe('family-1');
    expect(dto.canonicalProductId).toBe(canonicalProduct.id);
  });
});

describe('public vs admin product DTO', () => {
  const reason = 'Internal moderation note: score override approved by QA';
  const product = () =>
    createProduct({ manualScoreOverride: 55, manualOverrideReason: reason, source: 'manual' });

  it('public DTO omits manualOverrideReason but keeps source and score fields', () => {
    const dto = toProductDto(product());

    expect(dto).not.toHaveProperty('manualOverrideReason');
    expect(JSON.stringify(dto)).not.toContain(reason);
    expect(dto).toMatchObject({ source: 'manual', manualScoreOverride: 55 });
  });

  it('admin DTO keeps manualOverrideReason', () => {
    expect(toAdminProductDto(product())).toMatchObject({ manualOverrideReason: reason });
  });

  it('public photo-search matches omit manualOverrideReason', async () => {
    const service = new PhotoSearchService(
      { extractText: async () => 'Coca-Cola Original Taste' },
      { searchByNameOrBrand: async () => [product()] }
    );

    const result = await service.search(Buffer.from('image'));

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).not.toHaveProperty('manualOverrideReason');
    expect(JSON.stringify(result)).not.toContain(reason);
    expect(result.matches[0]).toHaveProperty('source', 'manual');
  });

  it('admin-only submission responses embed the admin product DTO', () => {
    const dto = toProductSubmissionDto({
      id: '11111111-1111-4111-8111-111111111111',
      barcode: '5449000000996',
      name: 'Cola',
      brand: null,
      category: 'Soft Drinks',
      ingredients: [],
      servingType: 'per100ml',
      energyKcal: null,
      protein: null,
      carbohydrates: null,
      sugars: null,
      fat: null,
      saturatedFat: null,
      fiber: null,
      salt: null,
      frontImageUrl: null,
      ingredientsImageUrl: null,
      nutritionImageUrl: null,
      barcodeImageUrl: null,
      status: 'approved',
      moderationNote: null,
      submittedAt: now,
      reviewedAt: now,
      reviewedByUserId: 'admin-id',
      createdProductId: 'product-id',
      anonymousDeviceId: null,
      createdProduct: product()
    });

    expect(dto.createdProduct).toMatchObject({ manualOverrideReason: reason });
  });
});
