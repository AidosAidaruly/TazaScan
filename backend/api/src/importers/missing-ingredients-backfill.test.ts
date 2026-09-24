import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../generated/prisma/client';
import {
  backfillMissingIngredients,
  hasReliableIngredientSource
} from './missing-ingredients-backfill';

const now = new Date('2026-08-24T00:00:00.000Z');

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    barcode: '4870207313328',
    name: "Lay's Chips",
    brand: "Lay's",
    category: 'Snacks',
    ingredients: [],
    ingredientsTextOriginal: null,
    ingredientsTextOriginalLanguage: null,
    ingredientsTextRu: null,
    ingredientsTextTranslatedRu: null,
    ingredientsTranslationSource: null,
    ingredientsTranslatedAt: null,
    servingType: 'per100g',
    energyKcal: 520,
    protein: 6,
    carbohydrates: 52,
    sugars: 2,
    fat: 32,
    saturatedFat: 3,
    fiber: null,
    salt: 1.4,
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

describe('missing ingredient backfill', () => {
  it('marks missing ingredients with OFF ingredients as repair candidate', async () => {
    const existing = product();
    const updateIngredientProvenanceFields = vi.fn().mockResolvedValue(existing);

    const report = await backfillMissingIngredients({
      repository: {
        findProducts: vi.fn().mockResolvedValue([existing]),
        updateIngredientProvenanceFields
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          ingredients_text: 'Potatoes; sunflower oil; salt',
          ingredients_text_en: 'Potatoes; sunflower oil; salt'
        }
      })
    });

    expect(report.repaired).toBe(1);
    expect(report.items[0]?.action).toBe('repaired');
    expect(report.items[0]?.halalBefore).toBe('insufficient_data');
    expect(report.items[0]?.halalAfter).toBe('screening_clear');
    expect(updateIngredientProvenanceFields).toHaveBeenCalledWith(existing.id, {
      ingredientsTextOriginal: 'Potatoes; sunflower oil; salt',
      ingredientsTextOriginalLanguage: 'en',
      ingredientsTextRu: null
    });
  });

  it('preserves source original language and source Russian separately', async () => {
    const updateIngredientProvenanceFields = vi.fn();

    await backfillMissingIngredients({
      repository: {
        findProducts: vi.fn().mockResolvedValue([product()]),
        updateIngredientProvenanceFields
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

    expect(updateIngredientProvenanceFields).toHaveBeenCalledWith(
      expect.any(String),
      {
        ingredientsTextOriginal: 'Sugar; cocoa butter',
        ingredientsTextOriginalLanguage: 'en',
        ingredientsTextRu: 'Сахар; какао-масло'
      }
    );
  });

  it('does not overwrite existing curated or reliable ingredients', async () => {
    const existing = product({
      dataStatus: 'verified',
      ingredientsTextOriginal: 'Curated ingredients',
      ingredientsTextOriginalLanguage: 'en',
      ingredients: ['Curated ingredients']
    });
    const fetchProduct = vi.fn();
    const updateIngredientProvenanceFields = vi.fn();

    const report = await backfillMissingIngredients({
      repository: {
        findProducts: vi.fn().mockResolvedValue([existing]),
        updateIngredientProvenanceFields
      },
      fetchProduct
    });

    expect(report.items[0]?.action).toBe('already_has_ingredients');
    expect(fetchProduct).not.toHaveBeenCalled();
    expect(updateIngredientProvenanceFields).not.toHaveBeenCalled();
  });

  it('does not mutate when OFF has no ingredients or unusable placeholders', async () => {
    const updateIngredientProvenanceFields = vi.fn();
    const noIngredients = await backfillMissingIngredients({
      repository: {
        findProducts: vi.fn().mockResolvedValue([product()]),
        updateIngredientProvenanceFields
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          ingredients_text: ''
        }
      })
    });
    const unusable = await backfillMissingIngredients({
      repository: {
        findProducts: vi.fn().mockResolvedValue([product({ id: '22222222-2222-4222-8222-222222222222' })]),
        updateIngredientProvenanceFields
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          ingredients_text: 'unknown'
        }
      })
    });

    expect(noIngredients.items[0]?.action).toBe('off_no_ingredients');
    expect(unusable.items[0]?.action).toBe('source_data_unusable');
    expect(updateIngredientProvenanceFields).not.toHaveBeenCalled();
  });

  it('reports network failure safely', async () => {
    const updateIngredientProvenanceFields = vi.fn();
    const report = await backfillMissingIngredients({
      repository: {
        findProducts: vi.fn().mockResolvedValue([product()]),
        updateIngredientProvenanceFields
      },
      fetchProduct: vi.fn().mockRejectedValue(new Error('OFF 503'))
    });

    expect(report.items[0]?.action).toBe('failed');
    expect(report.items[0]?.error).toBe('OFF 503');
    expect(updateIngredientProvenanceFields).not.toHaveBeenCalled();
  });

  it('dry-run performs no writes and rerun after repair is idempotent', async () => {
    const updateIngredientProvenanceFields = vi.fn();
    const dryRun = await backfillMissingIngredients({
      dryRun: true,
      repository: {
        findProducts: vi.fn().mockResolvedValue([product()]),
        updateIngredientProvenanceFields
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          ingredients_text: 'Water; sugar',
          ingredients_text_en: 'Water; sugar'
        }
      })
    });
    const rerun = await backfillMissingIngredients({
      repository: {
        findProducts: vi.fn().mockResolvedValue([
          product({
            ingredientsTextOriginal: 'Water; sugar',
            ingredientsTextOriginalLanguage: 'en'
          })
        ]),
        updateIngredientProvenanceFields
      },
      fetchProduct: vi.fn()
    });

    expect(dryRun.items[0]?.action).toBe('would_repair');
    expect(rerun.items[0]?.action).toBe('already_has_ingredients');
    expect(updateIngredientProvenanceFields).not.toHaveBeenCalled();
  });

  it('generated translation does not count as reliable source by itself', () => {
    expect(
      hasReliableIngredientSource(
        product({
          ingredientsTextTranslatedRu: 'сахар; какао-масло'
        })
      )
    ).toBe(false);
  });

  it('clean source ingredients do not become halal confirmed without certification', async () => {
    const report = await backfillMissingIngredients({
      repository: {
        findProducts: vi.fn().mockResolvedValue([product()]),
        updateIngredientProvenanceFields: vi.fn()
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          ingredients_text: 'Water; sugar',
          ingredients_text_en: 'Water; sugar'
        }
      })
    });

    expect(report.items[0]?.halalAfter).toBe('screening_clear');
  });

  it('keeps TazaScore-relevant inputs unchanged in update payload', async () => {
    const updateIngredientProvenanceFields = vi.fn();

    await backfillMissingIngredients({
      repository: {
        findProducts: vi.fn().mockResolvedValue([product()]),
        updateIngredientProvenanceFields
      },
      fetchProduct: vi.fn().mockResolvedValue({
        status: 1,
        product: {
          ingredients_text: 'Potatoes; oil; salt',
          ingredients_text_en: 'Potatoes; oil; salt'
        }
      })
    });

    const update = updateIngredientProvenanceFields.mock.calls[0]?.[1];
    expect(update).not.toHaveProperty('ingredients');
    expect(update).not.toHaveProperty('energyKcal');
    expect(update).not.toHaveProperty('sugars');
    expect(update).not.toHaveProperty('scoreDetails');
  });
});
