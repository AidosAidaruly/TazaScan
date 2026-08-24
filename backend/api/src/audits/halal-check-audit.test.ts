import { describe, expect, it } from 'vitest';
import { auditHalalCheckProducts } from './halal-check-audit';

const now = new Date('2026-08-22T00:00:00.000Z');

function product(overrides = {}) {
  return {
    id: 'product-1',
    barcode: '5449000000996',
    name: 'Test Product',
    brand: null,
    category: 'Test',
    ingredients: ['water', 'sugar'],
    ingredientsTextOriginal: null,
    ingredientsTextOriginalLanguage: null,
    ingredientsTextRu: null,
    ingredientsTextTranslatedRu: null,
    ingredientsTranslationSource: null,
    ingredientsTranslatedAt: null,
    servingType: 'per100g',
    energyKcal: null,
    protein: null,
    carbohydrates: null,
    sugars: null,
    fat: null,
    saturatedFat: null,
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
    dataStatus: 'community',
    source: 'fixture',
    lastVerifiedAt: null,
    canonicalProductFamilyId: null,
    createdAt: now,
    updatedAt: now,
    halalCertifications: [],
    canonicalProductFamily: null,
    ...overrides
  } as never;
}

describe('Halal Check audit', () => {
  it('aggregates statuses and rule hits without mutating products', () => {
    const report = auditHalalCheckProducts([
      product({ id: '1', ingredients: ['water', 'pork'] }),
      product({ id: '2', ingredients: [] }),
      product({ id: '3', ingredients: ['water', 'gelatin'] })
    ]);

    expect(report.totalProducts).toBe(3);
    expect(report.statusDistribution.non_halal).toBe(1);
    expect(report.statusDistribution.insufficient_data).toBe(1);
    expect(report.statusDistribution.review_required).toBe(1);
    expect(report.ingredientScreeningDistribution.non_halal_detected).toBe(1);
    expect(report.ingredientScreeningDistribution.insufficient_data).toBe(1);
    expect(report.ingredientScreeningDistribution.review_required).toBe(1);
    expect(report.ruleDistribution.PORK_DETECTED).toBe(1);
    expect(report.ruleDistribution.GELATIN_SOURCE_UNKNOWN).toBe(1);
  });

  it('flags generated-translation-only matches only when source evidence exists', () => {
    const report = auditHalalCheckProducts([
      product({
        ingredients: [],
        ingredientsTextOriginal: 'water; sugar',
        ingredientsTextTranslatedRu: 'свинина'
      })
    ]);

    expect(report.rows[0]?.quality).not.toBe('POTENTIAL_PROVENANCE_BUG');
    expect(report.rows[0]?.status).toBe('screening_clear');
    expect(report.rows[0]?.ingredientScreeningStatus).toBe('clear');
    expect(report.rows[0]?.certificationStatus).toBe('not_verified');
  });

  it('reports clean screening separately from unverified certification', () => {
    const report = auditHalalCheckProducts([
      product({ ingredients: ['water', 'sugar'] })
    ]);

    expect(report.statusDistribution.screening_clear).toBe(1);
    expect(report.ingredientScreeningDistribution.clear).toBe(1);
    expect(report.certificationDistribution.not_verified).toBe(1);
    expect(report.rows[0]?.reviewNote).toContain('halal certification is not verified');
  });
});
