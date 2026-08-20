import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Product } from '../generated/prisma/client';
import { auditProductDuplicates } from './product-duplicate-audit';

const now = new Date('2026-08-17T00:00:00.000Z');

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: randomUUID(),
    barcode: '5449000000996',
    name: 'Coca-Cola Original Taste 500ml',
    brand: 'Coca-Cola',
    category: 'Soft Drinks',
    ingredients: ['Carbonated water', 'Sugar'],
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
    dataStatus: 'community',
    source: 'Open Food Facts',
    lastVerifiedAt: null,
    canonicalProductFamilyId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('product duplicate audit', () => {
  it('does not classify same brand/name with different nutrition as exact duplicate', () => {
    const report = auditProductDuplicates({
      products: [
        product({ id: 'a', barcode: '5449000000996', sugars: 10.6 }),
        product({ id: 'b', barcode: '5449000001009', sugars: 0 })
      ]
    });

    expect(report.groups[0]?.classification).toBe('recipe_or_market_variant');
    expect(report.groups[0]?.recommendedAction).toBe('keep separate');
  });

  it('classifies identical practical data with package-size hint as package variant', () => {
    const report = auditProductDuplicates({
      products: [
        product({ id: 'a', barcode: '5449000000996', name: 'Coca-Cola Original Taste 500ml' }),
        product({ id: 'b', barcode: '5449000001009', name: 'Coca-Cola Original Taste 1L' })
      ]
    });

    expect(report.groups[0]?.classification).toBe('package_variant');
    expect(report.groups[0]?.recommendedAction).toBe('link as package variants');
  });

  it('classifies identical product data without package hint as exact duplicate candidate', () => {
    const report = auditProductDuplicates({
      products: [
        product({ id: 'a', barcode: '1111111111111', name: 'Merci Milk Selection' }),
        product({ id: 'b', barcode: '2222222222222', name: 'Merci Milk Selection' })
      ]
    });

    expect(report.groups[0]?.classification).toBe('exact_duplicate');
    expect(report.groups[0]?.recommendedAction).toBe('safe merge candidate');
  });

  it('explains different TazaScore values through input differences', () => {
    const report = auditProductDuplicates({
      products: [
        product({ id: 'a', barcode: '5449000000996', sugars: 10.6 }),
        product({
          id: 'b',
          barcode: '5449000001009',
          sugars: 0,
          ingredients: ['Carbonated water', 'Aspartame'],
          containsNonSugarSweeteners: true
        })
      ]
    });
    const reasons = report.groups[0]?.items.flatMap((item) => item.scoreDifferenceReasons);

    expect(reasons).toContain('different nutrition values');
    expect(reasons).toContain('different ingredients');
  });

  it('never merges uncertain records destructively', () => {
    const report = auditProductDuplicates({
      products: [
        product({ id: 'a', barcode: '1111111111111', category: 'Soft Drinks' }),
        product({ id: 'b', barcode: '2222222222222', category: 'Cola' })
      ]
    });

    expect(report.groups[0]?.recommendedAction).not.toBe('safe merge candidate');
  });
});
