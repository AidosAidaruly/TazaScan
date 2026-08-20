import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../generated/prisma/client';
import { repairOpenFoodFactsIngredients } from './open-food-facts-ingredients-repair';

const now = new Date('2026-08-17T00:00:00.000Z');

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    barcode: '4014400901405',
    name: 'Merci Milk Selection',
    brand: 'Merci',
    category: 'Chocolate',
    ingredients: ['Sugar', 'cocoa butter'],
    ingredientsTextOriginal: null,
    ingredientsTextOriginalLanguage: null,
    ingredientsTextRu: null,
    ingredientsTextTranslatedRu: null,
    ingredientsTranslationSource: null,
    ingredientsTranslatedAt: null,
    servingType: 'per100g',
    energyKcal: 560,
    protein: 7,
    carbohydrates: 52,
    sugars: 50,
    fat: 35,
    saturatedFat: 22,
    fiber: 2,
    salt: 0.25,
    officialNutriScoreCategory: 'general_food',
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
    dataStatus: 'community',
    source: 'Open Food Facts',
    lastVerifiedAt: null,
    canonicalProductFamilyId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('Open Food Facts ingredients repair', () => {
  it('repairs null Russian ingredients when OFF provides Russian text', async () => {
    const existing = product();
    const updateIngredientLanguageFields = vi.fn().mockResolvedValue(existing);
    const report = await repairOpenFoodFactsIngredients({
      repository: {
        findCandidates: vi.fn().mockResolvedValue([existing]),
        updateIngredientLanguageFields
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          ingredients_text: 'Sugar; cocoa butter',
          ingredients_text_en: 'Sugar; cocoa butter',
          ingredients_text_ru: 'Сахар; какао-масло'
        }
      })
    });

    expect(report.repaired).toBe(1);
    expect(report.items[0]?.status).toBe('repaired');
    expect(updateIngredientLanguageFields).toHaveBeenCalledWith(existing.id, {
      ingredientsTextOriginal: 'Sugar; cocoa butter',
      ingredientsTextOriginalLanguage: 'en',
      ingredientsTextRu: 'Сахар; какао-масло'
    });
  });

  it('dry-run performs no writes', async () => {
    const updateIngredientLanguageFields = vi.fn();
    const report = await repairOpenFoodFactsIngredients({
      dryRun: true,
      repository: {
        findCandidates: vi.fn().mockResolvedValue([product()]),
        updateIngredientLanguageFields
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          ingredients_text: 'Sugar',
          ingredients_text_ru: 'Сахар'
        }
      })
    });

    expect(report.items[0]?.status).toBe('would_repair');
    expect(updateIngredientLanguageFields).not.toHaveBeenCalled();
  });

  it('does not overwrite verified products', async () => {
    const updateIngredientLanguageFields = vi.fn();
    const fetchProduct = vi.fn();
    const report = await repairOpenFoodFactsIngredients({
      repository: {
        findCandidates: vi.fn().mockResolvedValue([product({ dataStatus: 'verified' })]),
        updateIngredientLanguageFields
      },
      fetchProduct
    });

    expect(report.items[0]?.status).toBe('skipped_verified');
    expect(fetchProduct).not.toHaveBeenCalled();
    expect(updateIngredientLanguageFields).not.toHaveBeenCalled();
  });

  it('does not erase existing ingredients when OFF has no Russian text', async () => {
    const updateIngredientLanguageFields = vi.fn();
    const report = await repairOpenFoodFactsIngredients({
      repository: {
        findCandidates: vi.fn().mockResolvedValue([product()]),
        updateIngredientLanguageFields
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          ingredients_text: ''
        }
      })
    });

    expect(report.items[0]?.status).toBe('no_russian_available');
    expect(updateIngredientLanguageFields).not.toHaveBeenCalled();
  });
});
