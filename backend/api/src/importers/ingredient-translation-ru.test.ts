import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../generated/prisma/client';
import { TazaScoreEngine } from '../scoring/engines/taza-score.engine';
import {
  GlossaryIngredientTranslationProvider,
  translateIngredientsToRussian
} from './ingredient-translation-ru';

const now = new Date('2026-08-20T00:00:00.000Z');

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    barcode: '4014400901405',
    name: 'Merci Milk Selection',
    brand: 'Merci',
    category: 'Chocolate',
    ingredients: ['Sugar', 'cocoa butter'],
    ingredientsTextOriginal: 'Sugar; cocoa butter',
    ingredientsTextOriginalLanguage: 'en',
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

describe('ingredient Russian translation fallback', () => {
  it('translates only known ingredient segments with a local provider', () => {
    const provider = new GlossaryIngredientTranslationProvider();

    expect(provider.translateToRussian('Sugar; cocoa butter', 'en')).toBe(
      'сахар; какао-масло'
    );
    expect(provider.translateToRussian('unknown ingredient', 'en')).toBeNull();
  });

  it('dry-run reports would_translate and performs no writes', async () => {
    const updateIngredientTranslationFields = vi.fn();
    const report = await translateIngredientsToRussian({
      dryRun: true,
      repository: {
        findCandidates: vi.fn().mockResolvedValue([product()]),
        updateIngredientTranslationFields
      }
    });

    expect(report.wouldTranslate).toBe(1);
    expect(report.items[0]?.action).toBe('would_translate');
    expect(updateIngredientTranslationFields).not.toHaveBeenCalled();
  });

  it('writes generated translation without overwriting original or source Russian fields', async () => {
    const existing = product();
    const updateIngredientTranslationFields = vi.fn().mockResolvedValue(existing);

    const report = await translateIngredientsToRussian({
      repository: {
        findCandidates: vi.fn().mockResolvedValue([existing]),
        updateIngredientTranslationFields
      }
    });

    expect(report.translated).toBe(1);
    expect(updateIngredientTranslationFields).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({
        ingredientsTextTranslatedRu: 'сахар; какао-масло',
        ingredientsTranslationSource: 'local_glossary_v1'
      })
    );
    expect(updateIngredientTranslationFields.mock.calls[0]?.[1]).not.toHaveProperty(
      'ingredientsTextOriginal'
    );
    expect(updateIngredientTranslationFields.mock.calls[0]?.[1]).not.toHaveProperty(
      'ingredientsTextRu'
    );
  });

  it('does not overwrite source Russian ingredients', async () => {
    const updateIngredientTranslationFields = vi.fn();
    const report = await translateIngredientsToRussian({
      repository: {
        findCandidates: vi.fn().mockResolvedValue([
          product({
            ingredientsTextRu: 'Сахар; какао-масло'
          })
        ]),
        updateIngredientTranslationFields
      }
    });

    expect(report.sourceRussian).toBe(1);
    expect(report.items[0]?.action).toBe('source_russian_available');
    expect(updateIngredientTranslationFields).not.toHaveBeenCalled();
  });

  it('is idempotent when a generated translation already exists', async () => {
    const updateIngredientTranslationFields = vi.fn();
    const report = await translateIngredientsToRussian({
      repository: {
        findCandidates: vi.fn().mockResolvedValue([
          product({
            ingredientsTextTranslatedRu: 'сахар; какао-масло',
            ingredientsTranslationSource: 'local_glossary_v1',
            ingredientsTranslatedAt: now
          })
        ]),
        updateIngredientTranslationFields
      }
    });

    expect(report.alreadyTranslated).toBe(1);
    expect(updateIngredientTranslationFields).not.toHaveBeenCalled();
  });

  it('does not translate verified or already-Russian original products', async () => {
    const updateIngredientTranslationFields = vi.fn();
    const report = await translateIngredientsToRussian({
      repository: {
        findCandidates: vi.fn().mockResolvedValue([
          product({ dataStatus: 'verified' }),
          product({
            id: '22222222-2222-4222-8222-222222222222',
            barcode: '4600000000000',
            ingredients: ['Сахар'],
            ingredientsTextOriginal: 'Сахар',
            ingredientsTextOriginalLanguage: 'ru'
          })
        ]),
        updateIngredientTranslationFields
      }
    });

    expect(report.items.map((item) => item.action)).toEqual([
      'skipped_verified',
      'already_russian_original'
    ]);
    expect(updateIngredientTranslationFields).not.toHaveBeenCalled();
  });

  it('does not invent ingredients when no ingredient text exists', async () => {
    const updateIngredientTranslationFields = vi.fn();
    const report = await translateIngredientsToRussian({
      repository: {
        findCandidates: vi.fn().mockResolvedValue([
          product({
            ingredients: [],
            ingredientsTextOriginal: null,
            ingredientsTextOriginalLanguage: null
          })
        ]),
        updateIngredientTranslationFields
      }
    });

    expect(report.noIngredients).toBe(1);
    expect(report.items[0]?.action).toBe('no_ingredients');
    expect(updateIngredientTranslationFields).not.toHaveBeenCalled();
  });

  it('keeps scoring identical before and after generated translation metadata', () => {
    const engine = new TazaScoreEngine();
    const before = engine.calculate({
      servingType: 'per100g',
      category: 'general_food',
      energyKcal: 560,
      protein: 7,
      carbohydrates: 52,
      sugars: 50,
      fat: 35,
      saturatedFat: 22,
      fiber: 2,
      salt: 0.25,
      fruitVegetableLegumePercent: null,
      containsNonSugarSweeteners: null,
      ingredients: ['Sugar', 'cocoa butter'],
      dataStatus: 'community'
    });
    const after = engine.calculate({
      servingType: 'per100g',
      category: 'general_food',
      energyKcal: 560,
      protein: 7,
      carbohydrates: 52,
      sugars: 50,
      fat: 35,
      saturatedFat: 22,
      fiber: 2,
      salt: 0.25,
      fruitVegetableLegumePercent: null,
      containsNonSugarSweeteners: null,
      ingredients: ['Sugar', 'cocoa butter'],
      dataStatus: 'community'
    });

    expect(after.score).toBe(before.score);
    expect(after.ingredientComponent).toEqual(before.ingredientComponent);
  });
});
