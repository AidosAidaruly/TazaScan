import { describe, expect, it } from 'vitest';
import type { Product } from '../generated/prisma/client';
import {
  auditProductFamilies,
  classifyProductFamilyCandidates,
  normalizedFamilyKey
} from './product-family-audit';

const now = new Date('2026-08-20T00:00:00.000Z');

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    barcode: '5449000000996',
    name: 'Coca-Cola Original Taste 500ml',
    brand: 'Coca-Cola',
    category: 'Soft Drinks',
    ingredients: ['Carbonated water', 'Sugar', 'Caffeine'],
    ingredientsTextOriginal: null,
    ingredientsTextOriginalLanguage: null,
    ingredientsTextRu: null,
    ingredientsTextTranslatedRu: null,
    ingredientsTranslationSource: null,
    ingredientsTranslatedAt: null,
    servingType: 'per100ml',
    energyKcal: 42,
    protein: 0,
    carbohydrates: 10.6,
    sugars: 10.6,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    salt: 0,
    officialNutriScoreCategory: 'beverage',
    fruitVegetableLegumePercent: 0,
    containsNonSugarSweeteners: false,
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

describe('product family audit', () => {
  it('normalizes package size without removing variant identity', () => {
    expect(
      normalizedFamilyKey(product({ name: 'Coca-Cola Original Taste 500ml' }))
    ).toBe('coca cola');
    expect(
      normalizedFamilyKey(product({ name: 'Coca-Cola Zero 500ml' }))
    ).toBe('coca cola zero');
  });

  it('classifies verified identical recipe/package variants as same_recipe', () => {
    const result = classifyProductFamilyCandidates([
      product({ id: 'a', barcode: '1111111111111' }),
      product({ id: 'b', barcode: '2222222222222', name: 'Coca-Cola Original Taste 1L' })
    ]);

    expect(result.classification).toBe('same_recipe');
  });

  it('allows small nutrition rounding differences as likely same recipe', () => {
    const result = classifyProductFamilyCandidates([
      product({ id: 'a', barcode: '1111111111111', dataStatus: 'community' }),
      product({
        id: 'b',
        barcode: '2222222222222',
        dataStatus: 'community',
        energyKcal: 43,
        sugars: 10.8,
        ingredients: ['Carbonated water', 'Sugar']
      })
    ]);

    expect(result.classification).toBe('likely_same_recipe');
  });

  it('keeps materially different nutrition out of automatic families', () => {
    const result = classifyProductFamilyCandidates([
      product({ id: 'a', barcode: '1111111111111' }),
      product({
        id: 'b',
        barcode: '2222222222222',
        sugars: 0,
        energyKcal: 0.2,
        name: 'Coca-Cola Original Taste'
      })
    ]);

    expect(result.classification).toBe('different_recipe');
    expect(result.conflicts).toContain('material nutrition difference');
  });

  it('keeps Zero-like variants separate from Original', () => {
    const result = classifyProductFamilyCandidates([
      product({ id: 'a', barcode: '5449000000996' }),
      product({
        id: 'b',
        barcode: '5449000131836',
        name: 'Coca-Cola Zero 500ml',
        sugars: 0,
        energyKcal: 0.2,
        containsNonSugarSweeteners: null,
        ingredients: ['Carbonated water', 'Aspartame']
      })
    ]);

    expect(result.classification).toBe('different_variant');
    expect(result.conflicts).toContain('different variant marker');
  });

  it('does not use generated translation as authoritative matching data', () => {
    const result = classifyProductFamilyCandidates([
      product({ id: 'a', barcode: '1111111111111', ingredients: ['Carbonated water'] }),
      product({
        id: 'b',
        barcode: '2222222222222',
        ingredients: ['Water'],
        ingredientsTextTranslatedRu: 'газированная вода; сахар'
      })
    ]);

    expect(result.classification).toBe('likely_same_recipe');
  });

  it('reports likely Coca-Cola Original variants without forcing Zero into the group', () => {
    const report = auditProductFamilies({
      products: [
        product({ id: 'a', barcode: '5449000000996' }),
        product({
          id: 'b',
          barcode: '42105220',
          name: 'Coca Cola',
          dataStatus: 'community',
          source: 'Open Food Facts',
          fiber: null,
          fruitVegetableLegumePercent: null,
          containsNonSugarSweeteners: null,
          ingredients: ['water', 'sugar', 'e150d', 'e338']
        }),
        product({
          id: 'c',
          barcode: '5449000131836',
          name: 'Coca-Cola Zero 500ml',
          sugars: 0,
          energyKcal: 0.2,
          ingredients: ['water', 'aspartame']
        })
      ]
    });

    const originalGroup = report.groups.find((group) => group.normalizedFamilyKey === 'coca cola');

    expect(originalGroup?.classification).toBe('likely_same_recipe');
    expect(originalGroup?.items.map((item) => item.barcode)).toEqual(
      expect.arrayContaining(['5449000000996', '42105220'])
    );
    expect(originalGroup?.items.map((item) => item.barcode)).not.toContain('5449000131836');
  });
});
