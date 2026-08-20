import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../generated/prisma/client';
import type { ProductBody } from '../schemas/product.schema';
import type { TazaScoreResult } from '../scoring/types/taza-score-result';
import {
  buildOpenFoodFactsValidationBatch2,
  type OpenFoodFactsSearchQuery
} from './open-food-facts-validation-batch-2';

const now = new Date('2026-08-13T00:00:00.000Z');

function createExistingProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    barcode: '4601787006450',
    name: 'Existing product',
    brand: 'Existing brand',
    category: 'Existing category',
    ingredients: ['Existing ingredient'],
    ingredientsTextOriginal: null,
    ingredientsTextOriginalLanguage: null,
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
    score: 78,
    status: 'calculated',
    nutritionComponent: {
      score: 68,
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
    usedFields: ['energyKcal', 'sugars', 'saturatedFat', 'salt'],
    nutritionCoverage: 0.85,
    missingCriticalFields: [],
    scoreBeforeSafeguard: 78,
    scoreCap: null,
    safeguardsApplied: [],
    warnings: [],
    methodology: 'TazaScore',
    methodologyVersion: 'taza-score-v1',
    calculatedAt: now.toISOString(),
    ...overrides
  };
}

const queries: OpenFoodFactsSearchQuery[] = [
  { label: 'chocolate', searchTerms: 'chocolate Kazakhstan' },
  { label: 'water', searchTerms: 'water Kazakhstan' }
];

describe('Open Food Facts validation batch 2', () => {
  it('discovers candidates and dry-runs without creating products', async () => {
    const create = vi.fn();
    const previewTazaScore = vi.fn().mockReturnValue(calculatedTazaScore());

    const report = await buildOpenFoodFactsValidationBatch2({
      dryRun: true,
      searchQueries: queries,
      searchFetcher: vi.fn().mockResolvedValueOnce({
        products: [
          {
            code: '4870036001205',
            product_name: 'Dark Chocolate',
            brands: 'Kazakhstan',
            categories_tags: ['en:chocolates'],
            image_front_url: 'https://images.openfoodfacts.org/chocolate.jpg',
            ingredients_text: 'Cocoa mass; sugar',
            nutriments: {
              'energy-kcal_100g': 532.74378585086,
              proteins_100g: 6.3,
              carbohydrates_100g: 52.7,
              sugars_100g: 0,
              fat_100g: 33.4,
              'saturated-fat_100g': 0,
              fiber_100g: 0,
              salt_100g: 0
            }
          }
        ]
      }).mockResolvedValueOnce({
        products: [
          {
            code: '4870207510444',
            product_name: 'Water',
            categories_tags: ['en:waters'],
            nutriments: {
              'energy-kcal_100g': 0,
              sugars_100g: 0,
              'saturated-fat_100g': 0,
              salt_100g: 0
            }
          }
        ]
      }),
      fetchProduct: vi.fn().mockResolvedValueOnce({
        status: 1,
        product: {
          product_name: 'Dark Chocolate',
          brands: 'Kazakhstan',
          categories_tags: ['en:chocolates'],
          image_front_url: 'https://images.openfoodfacts.org/chocolate.jpg',
          ingredients_text: 'Cocoa mass; sugar',
          nutriments: {
            'energy-kcal_100g': 532.74378585086,
            proteins_100g: 6.3,
            carbohydrates_100g: 52.7,
            sugars_100g: 0,
            fat_100g: 33.4,
            'saturated-fat_100g': 0,
            fiber_100g: 0,
            salt_100g: 0
          }
        }
      }).mockResolvedValueOnce({
        status: 1,
        product: {
          product_name: 'Water',
          categories_tags: ['en:waters'],
          nutriments: {
            'energy-kcal_100g': 0,
            sugars_100g: 0,
            'saturated-fat_100g': 0,
            salt_100g: 0
          }
        }
      }),
      repository: {
        findByBarcode: vi.fn().mockResolvedValue(null)
      },
      productService: {
        create
      },
      tazaScorePreviewer: {
        previewTazaScore
      }
    });

    expect(create).not.toHaveBeenCalled();
    expect(previewTazaScore).toHaveBeenCalledTimes(2);
    expect(report.dryRun).toBe(true);
    expect(report.productsSelected).toBe(2);
    expect(report.imported).toBe(2);
    expect(report.items[0]).toMatchObject({
      status: 'would_import',
      productName: 'Dark Chocolate',
      dataQualityStatus: 'review',
      dataQualityWarningCodes: ['SUSPICIOUS_EXTERNAL_ZERO_PATTERN'],
      dataQualityWarningFields: ['sugars', 'saturatedFat', 'salt']
    });
  });

  it('skips existing duplicate products and does not overwrite them', async () => {
    const create = vi.fn();

    const report = await buildOpenFoodFactsValidationBatch2({
      dryRun: false,
      searchQueries: [{ label: 'water', searchTerms: 'water' }],
      searchFetcher: vi.fn().mockResolvedValue({
        products: [{ code: '4601787006450', product_name: 'Existing product' }]
      }),
      fetchProduct: vi.fn(),
      repository: {
        findByBarcode: vi.fn().mockResolvedValue(createExistingProduct())
      },
      productService: {
        create
      },
      tazaScorePreviewer: {
        previewTazaScore: vi.fn()
      }
    });

    expect(create).not.toHaveBeenCalled();
    expect(report.items[0]).toMatchObject({
      status: 'already_exists',
      productName: 'Existing product'
    });
  });

  it('preserves missing nutrition as null and explicit zero as zero in imported payloads', async () => {
    const createdPayloads: ProductBody[] = [];

    const report = await buildOpenFoodFactsValidationBatch2({
      dryRun: false,
      searchQueries: [{ label: 'partial', searchTerms: 'partial product' }],
      searchFetcher: vi.fn().mockResolvedValue({
        products: [{ code: '4870112006902', product_name: 'Partial product' }]
      }),
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          product_name: 'Partial product',
          categories_tags: ['en:sauces'],
          nutriments: {
            'energy-kcal_100g': 80,
            sugars_100g: 0
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
            confidence: {
              ...calculatedTazaScore().confidence,
              level: 'low'
            },
            nutritionCoverage: 0.15
          })
        )
      }
    });

    expect(createdPayloads[0]?.nutritionFacts.energyKcal).toBe(80);
    expect(createdPayloads[0]?.nutritionFacts.sugars).toBe(0);
    expect(createdPayloads[0]?.nutritionFacts.saturatedFat).toBeNull();
    expect(createdPayloads[0]?.containsNonSugarSweeteners).toBeNull();
    expect(report.items[0]).toMatchObject({
      status: 'imported',
      confidence: 'low',
      coverage: 0.15
    });
  });
});
