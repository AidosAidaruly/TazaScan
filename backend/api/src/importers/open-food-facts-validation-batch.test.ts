import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../generated/prisma/client';
import type { ProductBody } from '../schemas/product.schema';
import { TazaScoreEngine } from '../scoring/engines/taza-score.engine';
import type { TazaScoreResult } from '../scoring/types/taza-score-result';
import {
  importOpenFoodFactsValidationBatch,
  mapOpenFoodFactsProduct,
  selectOpenFoodFactsPrimaryImageUrl
} from './open-food-facts-validation-batch';

const now = new Date('2026-08-13T00:00:00.000Z');

function createExistingProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    barcode: '4601787006450',
    name: 'Existing product',
    brand: 'Existing brand',
    category: 'Existing category',
    ingredients: ['Existing ingredient'],
    ingredientsTextOriginal: 'Potatoes; oil; salt',
    ingredientsTextOriginalLanguage: 'unknown',
    ingredientsTextRu: null,
    ingredientsTextTranslatedRu: null,
    ingredientsTranslationSource: null,
    ingredientsTranslatedAt: null,
    servingType: 'per100g',
    energyKcal: 10,
    protein: 0,
    carbohydrates: 0,
    sugars: 0,
    fat: 0,
    saturatedFat: 0,
    fiber: null,
    salt: null,
    officialNutriScoreCategory: null,
    fruitVegetableLegumePercent: null,
    containsNonSugarSweeteners: null,
    healthScore: 0,
    calculatedScore: null,
    calculatedGrade: null,
    scoreStatus: 'insufficient_data',
    scoreAlgorithm: null,
    scoreVersion: null,
    scoreCalculatedAt: null,
    scoreDetails: null,
    manualScoreOverride: null,
    manualOverrideReason: null,
    manualOverrideAt: null,
    imageUrl: null,
    dataStatus: 'verified',
    source: 'manual label review',
    lastVerifiedAt: now,
    canonicalProductFamilyId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function calculatedTazaScore(overrides: Partial<TazaScoreResult> = {}): TazaScoreResult {
  return {
    score: 74,
    status: 'calculated',
    nutritionComponent: {
      score: 64,
      maxScore: 90,
      status: 'calculated',
      reasonCodes: [],
      missingFields: []
    },
    ingredientComponent: {
      score: 10,
      maxScore: 10,
      status: 'calculated',
      reasonCodes: [],
      missingFields: [],
      additiveCount: 0,
      knownRiskPenalty: 0
    },
    confidence: {
      score: null,
      maxScore: 0,
      status: 'calculated',
      reasonCodes: [],
      missingFields: [],
      level: 'medium',
      dataStatus: 'community'
    },
    officialNutriScore: {
      status: 'insufficient_data',
      rawScore: null,
      grade: null,
      reasonCodes: [],
      missingFields: [],
      warnings: [],
      algorithm: 'Nutri-Score',
      algorithmVersion: 'nutri-score-v2-2023',
      category: null,
      componentPoints: null,
      calculatedAt: now.toISOString()
    },
    reasonCodes: [],
    positiveReasons: [],
    negativeReasons: [],
    missingFields: [],
    usedFields: ['energyKcal', 'sugars', 'salt'],
    nutritionCoverage: 0.78,
    missingCriticalFields: [],
    scoreBeforeSafeguard: null,
    scoreCap: null,
    safeguardsApplied: [],
    warnings: [],
    methodology: 'TazaScore',
    methodologyVersion: 'taza-score-v1',
    calculatedAt: now.toISOString(),
    ...overrides
  };
}

describe('Open Food Facts validation batch importer', () => {
  it('maps available Open Food Facts nutrition fields without inferring missing values', () => {
    const product = mapOpenFoodFactsProduct('4601787006450', {
      product_name: 'Test Product',
      brands: 'Brand One, Brand Two',
      categories: 'Snacks, Chips',
      image_front_url: 'https://images.openfoodfacts.org/front.jpg',
      ingredients_text: 'Potatoes; oil; salt',
      nutrition_data_per: '100ml',
      nutriments: {
        'energy-kcal_100g': 532,
        proteins_100g: 6.1,
        carbohydrates_100g: 53,
        sugars_100g: 0,
        fat_100g: 32,
        'saturated-fat_100g': 3.1,
        fiber_100g: 4,
        salt_100g: 1.2,
        sodium_100g: 0.48
      }
    });

    expect(product).toMatchObject({
      barcode: '4601787006450',
      name: 'Test Product',
      brand: 'Brand One',
      category: 'Snacks',
      ingredients: ['Potatoes', 'oil', 'salt'],
      ingredientsTextOriginal: 'Potatoes; oil; salt',
      ingredientsTextOriginalLanguage: 'unknown',
      ingredientsTextRu: null,
    ingredientsTextTranslatedRu: null,
    ingredientsTranslationSource: null,
    ingredientsTranslatedAt: null,
      imageUrl: 'https://images.openfoodfacts.org/front.jpg',
      dataStatus: 'community',
      source: 'Open Food Facts',
      lastVerifiedAt: null,
      officialNutriScoreCategory: null,
      fruitVegetableLegumePercent: null,
      containsNonSugarSweeteners: null
    });
    expect(product?.nutritionFacts).toMatchObject({
      servingType: 'per100ml',
      energyKcal: 532,
      protein: 6.1,
      carbohydrates: 53,
      sugars: 0,
      fat: 32,
      saturatedFat: 3.1,
      fiber: 4,
      salt: 1.2
    });
  });

  it('stores Russian OFF ingredients separately while preserving original ingredients', () => {
    const product = mapOpenFoodFactsProduct('4601787006450', {
      product_name: 'Test Product',
      ingredients_text: 'Sugar; cocoa butter',
      ingredients_text_en: 'Sugar; cocoa butter',
      ingredients_text_ru: 'Сахар; какао-масло',
      nutrition_data_per: '100g',
      nutriments: {}
    });

    expect(product).toMatchObject({
      ingredients: ['Sugar', 'cocoa butter'],
      ingredientsTextOriginal: 'Sugar; cocoa butter',
      ingredientsTextOriginalLanguage: 'en',
      ingredientsTextRu: 'Сахар; какао-масло'
    });
  });

  it('prefers selected front packshot image over a generic OFF image', () => {
    const imageUrl = selectOpenFoodFactsPrimaryImageUrl({
      image_url:
        'https://images.openfoodfacts.org/images/products/544/900/013/1836/ingredients_en.12.200.jpg',
      selected_images: {
        front: {
          display: {
            en: 'https://images.openfoodfacts.org/images/products/544/900/013/1836/front_en.42.400.jpg'
          }
        }
      }
    });

    expect(imageUrl).toBe(
      'https://images.openfoodfacts.org/images/products/544/900/013/1836/front_en.42.400.jpg'
    );
  });

  it('does not import generic low-quality OFF image as primary image', () => {
    const product = mapOpenFoodFactsProduct('4601787006450', {
      product_name: 'Snapshot Product',
      image_url:
        'https://images.openfoodfacts.org/images/products/544/900/013/1836/nutrition_en.12.200.jpg'
    });

    expect(product?.imageUrl).toBeNull();
  });

  it('keeps missing Open Food Facts fields null and preserves explicit zero', () => {
    const product = mapOpenFoodFactsProduct('4014400901405', {
      product_name: 'Incomplete Product',
      nutriments: {
        'energy-kcal_100g': 0,
        carbohydrates_100g: 12,
        sodium_100g: 0.9
      }
    });

    expect(product?.nutritionFacts.energyKcal).toBe(0);
    expect(product?.nutritionFacts.carbohydrates).toBe(12);
    expect(product?.nutritionFacts.sugars).toBeNull();
    expect(product?.nutritionFacts.saturatedFat).toBeNull();
    expect(product?.nutritionFacts.salt).toBeNull();
    expect(product?.containsNonSugarSweeteners).toBeNull();
  });

  it('maps OFF category tags into compatible official category without inventing other inputs', () => {
    const product = mapOpenFoodFactsProduct('4014400901405', {
      product_name: 'Merci Milk Selection',
      categories_tags: ['en:snacks', 'en:chocolates', 'en:milk-chocolates'],
      nutriments: {
        'energy-kcal_100g': 579,
        proteins_100g: 8.1,
        carbohydrates_100g: 50.1,
        sugars_100g: 48.3,
        fat_100g: 37.8,
        'saturated-fat_100g': 20.4,
        fiber_100g: 0,
        salt_100g: 0.21
      }
    });

    expect(product?.officialNutriScoreCategory).toBe('general_food');
    expect(product?.fruitVegetableLegumePercent).toBeNull();
    expect(product?.containsNonSugarSweeteners).toBeNull();
    expect(product?.nutritionFacts.fiber).toBe(0);
  });

  it('skips duplicate barcodes without overwriting existing products', async () => {
    const create = vi.fn();
    const fetchProduct = vi.fn();

    const report = await importOpenFoodFactsValidationBatch({
      barcodes: ['4601787006450'],
      fetchProduct,
      repository: {
        findByBarcode: vi.fn().mockResolvedValue(createExistingProduct())
      },
      productService: { create },
      tazaScorePreviewer: {
        previewTazaScore: vi.fn()
      }
    });

    expect(fetchProduct).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(report.items[0]).toMatchObject({
      barcode: '4601787006450',
      status: 'already_exists',
      productName: 'Existing product',
      brand: 'Existing brand'
    });
  });

  it('reports Open Food Facts products that are not found', async () => {
    const report = await importOpenFoodFactsValidationBatch({
      barcodes: ['7622210750495'],
      fetchProduct: vi.fn().mockResolvedValue({ status: 0 }),
      repository: {
        findByBarcode: vi.fn().mockResolvedValue(null)
      },
      productService: {
        create: vi.fn()
      },
      tazaScorePreviewer: {
        previewTazaScore: vi.fn()
      }
    });

    expect(report.items[0]).toMatchObject({
      barcode: '7622210750495',
      status: 'not_found',
      productName: null
    });
    expect(report.notFound).toBe(1);
  });

  it('imports incomplete nutrition with nulls and Open Food Facts provenance', async () => {
    const createdPayloads: ProductBody[] = [];

    const report = await importOpenFoodFactsValidationBatch({
      barcodes: ['4870112006902'],
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          product_name: 'Partial Product',
          brands: 'OFF Brand',
          nutriments: {
            'energy-kcal_100g': 80,
            sugars_100g: 5,
            salt_100g: 0
          }
        }
      }),
      repository: {
        findByBarcode: vi.fn().mockResolvedValue(null)
      },
      productService: {
        async create(data) {
          createdPayloads.push(data);
        }
      },
      tazaScorePreviewer: {
        previewTazaScore: vi.fn().mockReturnValue(
          calculatedTazaScore({
            score: null,
            status: 'insufficient_data',
            nutritionCoverage: 0.38,
            confidence: {
              ...calculatedTazaScore().confidence,
              level: 'low',
              status: 'insufficient_data'
            }
          })
        )
      }
    });

    const created = createdPayloads[0];

    if (!created) {
      throw new Error('Expected importer to create a product payload.');
    }

    expect(created).toMatchObject({
      barcode: '4870112006902',
      name: 'Partial Product',
      brand: 'OFF Brand',
      category: 'Open Food Facts',
      ingredients: [],
    ingredientsTextOriginal: null,
    ingredientsTextOriginalLanguage: null,
    ingredientsTextRu: null,
    ingredientsTextTranslatedRu: null,
    ingredientsTranslationSource: null,
    ingredientsTranslatedAt: null,
      dataStatus: 'community',
      source: 'Open Food Facts',
      lastVerifiedAt: null
    });
    expect(created.nutritionFacts).toMatchObject({
      energyKcal: 80,
      sugars: 5,
      salt: 0,
      protein: null,
      carbohydrates: null,
      fat: null,
      saturatedFat: null,
      fiber: null
    });
    expect(report.items[0]).toMatchObject({
      status: 'imported',
      ingredientsAvailable: false,
      imageAvailable: false,
      tazaScore: null,
      confidence: 'low',
      coverage: 0.38
    });
    expect(report.items[0]?.availableNutritionFields).toEqual([
      'energyKcal',
      'sugars',
      'salt'
    ]);
    expect(report.items[0]?.missingRelevantFields).toEqual(
      expect.arrayContaining(['protein', 'saturatedFat', 'fiber'])
    );
  });

  it('passes complete OFF nutrition into TazaScore with non-zero coverage', async () => {
    const createdPayloads: ProductBody[] = [];
    const engine = new TazaScoreEngine();

    const report = await importOpenFoodFactsValidationBatch({
      barcodes: ['4014400901405'],
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          product_name: 'Merci Milk Selection',
          brands: 'Merci, Storck',
          categories: 'Chocolate candies, Milk chocolates',
          categories_tags: ['en:snacks', 'en:chocolates', 'en:milk-chocolates'],
          ingredients_text: 'Sugar; cocoa butter; milk powder',
          nutrition_data_per: '100g',
          nutriments: {
            'energy-kcal_100g': 579,
            proteins_100g: 8.1,
            carbohydrates_100g: 50.1,
            sugars_100g: 48.3,
            fat_100g: 37.8,
            'saturated-fat_100g': 20.4,
            fiber_100g: 0,
            salt_100g: 0.21
          }
        }
      }),
      repository: {
        findByBarcode: vi.fn().mockResolvedValue(null)
      },
      productService: {
        async create(data) {
          createdPayloads.push(data);
        }
      },
      tazaScorePreviewer: {
        previewTazaScore(data) {
          const input = {
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
            fruitVegetableLegumePercent:
              data.fruitVegetableLegumePercent ?? null,
            containsNonSugarSweeteners:
              data.containsNonSugarSweeteners ?? null,
            ingredients: data.ingredients,
            legacyCategoryLabel: data.category,
            dataStatus: data.dataStatus
          };

          return engine.calculate(
            data.officialNutriScoreCategory
              ? { ...input, category: data.officialNutriScoreCategory }
              : input
          );
        }
      }
    });

    const created = createdPayloads[0];

    if (!created) {
      throw new Error('Expected importer to create a product payload.');
    }

    expect(created.nutritionFacts).toMatchObject({
      servingType: 'per100g',
      energyKcal: 579,
      protein: 8.1,
      carbohydrates: 50.1,
      sugars: 48.3,
      fat: 37.8,
      saturatedFat: 20.4,
      fiber: 0,
      salt: 0.21
    });
    expect(created.officialNutriScoreCategory).toBe('general_food');
    expect(created.fruitVegetableLegumePercent).toBeNull();
    expect(created.containsNonSugarSweeteners).toBeNull();
    expect(report.items[0]).toMatchObject({
      status: 'imported',
      tazaScore: expect.any(Number),
      confidence: 'medium'
    });
    expect(report.items[0]?.coverage).toBeGreaterThan(0);
  });

  it('reports failed requests without stopping the batch', async () => {
    const report = await importOpenFoodFactsValidationBatch({
      barcodes: ['4870036001205', '4870132003653'],
      fetchProduct: vi
        .fn()
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce({
          status: 1,
          product: {
            product_name: 'Second Product',
            nutriments: {
              'energy-kcal_100g': 100,
              proteins_100g: 1,
              sugars_100g: 2,
              salt_100g: 0.1
            }
          }
        }),
      repository: {
        findByBarcode: vi.fn().mockResolvedValue(null)
      },
      productService: {
        create: vi.fn()
      },
      tazaScorePreviewer: {
        previewTazaScore: vi.fn().mockReturnValue(calculatedTazaScore())
      }
    });

    expect(report.failed).toBe(1);
    expect(report.imported).toBe(1);
    expect(report.items[0]).toMatchObject({
      status: 'failed',
      error: 'network down'
    });
    expect(report.items[1]).toMatchObject({
      status: 'imported',
      productName: 'Second Product'
    });
  });
});
