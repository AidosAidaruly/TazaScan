import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../generated/prisma/client';
import {
  repairOpenFoodFactsCategories
} from './open-food-facts-category-repair';
import { readOfficialCategoryFromOffTags } from './open-food-facts-validation-batch';

const now = new Date('2026-08-13T00:00:00.000Z');

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    barcode: '4014400901405',
    name: 'Merci Milk Selection',
    brand: 'Merci',
    category: 'Chocolate candies',
    ingredients: ['Sugar', 'Cocoa butter', 'Milk powder'],
    ingredientsTextOriginal: null,
    ingredientsTextOriginalLanguage: null,
    ingredientsTextRu: null,
    ingredientsTextTranslatedRu: null,
    ingredientsTranslationSource: null,
    ingredientsTranslatedAt: null,
    servingType: 'per100g',
    energyKcal: 579,
    protein: 8.1,
    carbohydrates: 50.1,
    sugars: 48.3,
    fat: 37.8,
    saturatedFat: 20.4,
    fiber: 0,
    salt: 0.21,
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
    imageUrl: 'https://images.openfoodfacts.org/front.jpg',
    dataStatus: 'community',
    source: 'Open Food Facts',
    lastVerifiedAt: null,
    canonicalProductFamilyId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('Open Food Facts category repair', () => {
  it('repairs a null category when OFF tags map to a compatible category', async () => {
    const updateOfficialCategory = vi.fn().mockImplementation(
      async (_id: string, category: Product['officialNutriScoreCategory']) =>
        product({ officialNutriScoreCategory: category })
    );

    const report = await repairOpenFoodFactsCategories({
      repository: {
        findCandidates: vi.fn().mockResolvedValue([product()]),
        updateOfficialCategory
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          categories: 'Chocolate candies, Milk chocolates',
          categories_tags: ['en:snacks', 'en:chocolates', 'en:milk-chocolates']
        }
      })
    });

    expect(updateOfficialCategory).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'general_food'
    );
    expect(report.items[0]).toMatchObject({
      barcode: '4014400901405',
      status: 'repaired',
      currentCategory: 'Chocolate candies',
      currentOfficialCategory: 'general_food',
      derivedCategory: 'general_food',
      tazaScore: expect.any(Number)
    });
    expect(report.items[0]?.nutritionCoverage).toBeGreaterThan(0);
  });

  it('leaves category null when OFF has no compatible tags', async () => {
    const updateOfficialCategory = vi.fn();
    const report = await repairOpenFoodFactsCategories({
      repository: {
        findCandidates: vi.fn().mockResolvedValue([product()]),
        updateOfficialCategory
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          categories: '',
          categories_tags: []
        }
      })
    });

    expect(updateOfficialCategory).not.toHaveBeenCalled();
    expect(report.items[0]).toMatchObject({
      status: 'unresolved',
      currentOfficialCategory: null,
      derivedCategory: null,
      tazaScore: null,
      nutritionCoverage: 0
    });
  });

  it('does not overwrite manually verified products', async () => {
    const updateOfficialCategory = vi.fn();
    const fetchProduct = vi.fn();
    const report = await repairOpenFoodFactsCategories({
      repository: {
        findCandidates: vi
          .fn()
          .mockResolvedValue([product({ dataStatus: 'verified' })]),
        updateOfficialCategory
      },
      fetchProduct
    });

    expect(fetchProduct).not.toHaveBeenCalled();
    expect(updateOfficialCategory).not.toHaveBeenCalled();
    expect(report.items[0]).toMatchObject({
      status: 'skipped_verified',
      currentOfficialCategory: null
    });
  });

  it('updates only officialNutriScoreCategory', async () => {
    const original = product();
    const updateOfficialCategory = vi.fn().mockImplementation(
      async (_id: string, category: Product['officialNutriScoreCategory']) => ({
        ...original,
        officialNutriScoreCategory: category
      })
    );

    await repairOpenFoodFactsCategories({
      repository: {
        findCandidates: vi.fn().mockResolvedValue([original]),
        updateOfficialCategory
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          categories_tags: ['en:snacks']
        }
      })
    });

    expect(updateOfficialCategory).toHaveBeenCalledTimes(1);
    expect(updateOfficialCategory.mock.calls[0]).toEqual([
      original.id,
      'general_food'
    ]);
  });

  it('uses the shared OFF category mapper', async () => {
    const tags = ['en:snacks', 'en:chocolates'];
    const mappedCategory = readOfficialCategoryFromOffTags(tags);
    const updateOfficialCategory = vi.fn().mockImplementation(
      async (_id: string, category: Product['officialNutriScoreCategory']) =>
        product({ officialNutriScoreCategory: category })
    );

    const report = await repairOpenFoodFactsCategories({
      repository: {
        findCandidates: vi.fn().mockResolvedValue([product()]),
        updateOfficialCategory
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: { categories_tags: tags }
      })
    });

    expect(mappedCategory).toBe('general_food');
    expect(report.items[0]?.derivedCategory).toBe(mappedCategory);
  });

  it('dry-run reports would_repair and performs no writes', async () => {
    const updateOfficialCategory = vi.fn();

    const report = await repairOpenFoodFactsCategories({
      dryRun: true,
      repository: {
        findCandidates: vi.fn().mockResolvedValue([product()]),
        updateOfficialCategory
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          categories: 'Chocolate candies',
          categories_tags: ['en:snacks']
        }
      })
    });

    expect(updateOfficialCategory).not.toHaveBeenCalled();
    expect(report.items[0]).toMatchObject({
      status: 'would_repair',
      derivedCategory: 'general_food',
      currentOfficialCategory: null,
      tazaScore: expect.any(Number)
    });
  });
});
