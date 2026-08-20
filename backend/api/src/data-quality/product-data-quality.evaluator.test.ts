import { describe, expect, it } from 'vitest';
import type { ProductDataQualityInput } from './product-data-quality.evaluator';
import { ProductDataQualityEvaluator } from './product-data-quality.evaluator';
import { TazaScoreEngine } from '../scoring/engines/taza-score.engine';
import type { TazaScoreInput } from '../scoring/types/taza-score-result';

const evaluator = new ProductDataQualityEvaluator();

function dataQualityInput(
  overrides: Partial<ProductDataQualityInput> = {}
): ProductDataQualityInput {
  return {
    source: 'Open Food Facts',
    dataStatus: 'community',
    officialNutriScoreCategory: 'general_food',
    energyKcal: 200,
    protein: 5,
    carbohydrates: 20,
    sugars: 5,
    fat: 10,
    saturatedFat: 2,
    fiber: null,
    salt: 0.3,
    ...overrides
  };
}

function tazaScoreInput(overrides: Partial<TazaScoreInput> = {}): TazaScoreInput {
  return {
    servingType: 'per100g',
    category: 'general_food',
    energyKcal: 532.74378585086,
    protein: 6.3,
    carbohydrates: 52.7,
    sugars: 0,
    fat: 33.4,
    saturatedFat: 0,
    fiber: 0,
    salt: 0,
    fruitVegetableLegumePercent: null,
    containsNonSugarSweeteners: null,
    ingredients: ['Cocoa mass', 'Sugar', 'Cocoa butter'],
    dataStatus: 'community',
    ...overrides
  };
}

describe('ProductDataQualityEvaluator', () => {
  it('flags suspicious explicit zero patterns for external chocolate-like data', () => {
    const result = evaluator.evaluate(
      dataQualityInput({
        energyKcal: 532.74378585086,
        protein: 6.3,
        carbohydrates: 52.7,
        sugars: 0,
        fat: 33.4,
        saturatedFat: 0,
        fiber: 0,
        salt: 0
      })
    );

    expect(result.status).toBe('review');
    expect(result.warnings).toContainEqual({
      code: 'SUSPICIOUS_EXTERNAL_ZERO_PATTERN',
      fields: ['sugars', 'saturatedFat', 'salt'],
      message:
        'External product data reports multiple important negative nutrients as explicit zeroes. Review against the package label before trusting the score.'
    });
  });

  it('does not flag legitimate zeroes for water', () => {
    const result = evaluator.evaluate(
      dataQualityInput({
        officialNutriScoreCategory: 'water',
        energyKcal: 0,
        protein: 0,
        carbohydrates: 0,
        sugars: 0,
        fat: 0,
        saturatedFat: 0,
        fiber: 0,
        salt: 0
      })
    );

    expect(result).toEqual({
      status: 'ok',
      warnings: []
    });
  });

  it('reports missing critical nutrition without converting null values to zero', () => {
    const input = dataQualityInput({
      sugars: null,
      saturatedFat: null,
      salt: 0
    });
    const before = structuredClone(input);

    const result = evaluator.evaluate(input);

    expect(input).toEqual(before);
    expect(input.sugars).toBeNull();
    expect(input.saturatedFat).toBeNull();
    expect(input.salt).toBe(0);
    expect(result.status).toBe('review');
    expect(result.warnings).toContainEqual({
      code: 'MISSING_CRITICAL_NUTRITION',
      fields: ['sugars', 'saturatedFat'],
      message: 'Important nutrition fields are missing from external or community data.'
    });
  });

  it('does not downgrade or mutate verified manually reviewed products', () => {
    const input = dataQualityInput({
      source: 'Manual label review',
      dataStatus: 'verified',
      energyKcal: 532.74378585086,
      carbohydrates: 52.7,
      sugars: 0,
      fat: 33.4,
      saturatedFat: 0,
      salt: 0
    });
    const before = structuredClone(input);

    const result = evaluator.evaluate(input);

    expect(input).toEqual(before);
    expect(result).toEqual({
      status: 'ok',
      warnings: []
    });
  });

  it('does not modify TazaScore inputs or results', () => {
    const engine = new TazaScoreEngine();
    const scoreInput = tazaScoreInput();
    const scoreResult = engine.calculate(scoreInput);
    const scoreInputBefore = structuredClone(scoreInput);
    const scoreResultBefore = structuredClone(scoreResult);

    evaluator.evaluate(
      dataQualityInput({
        energyKcal: scoreInput.energyKcal,
        protein: scoreInput.protein,
        carbohydrates: scoreInput.carbohydrates,
        sugars: scoreInput.sugars,
        fat: scoreInput.fat,
        saturatedFat: scoreInput.saturatedFat,
        fiber: scoreInput.fiber,
        salt: scoreInput.salt
      })
    );

    expect(scoreInput).toEqual(scoreInputBefore);
    expect(scoreResult).toEqual(scoreResultBefore);
  });

  it('handles incomplete external products without crashing', () => {
    const result = evaluator.evaluate(
      dataQualityInput({
        energyKcal: null,
        protein: null,
        carbohydrates: null,
        sugars: null,
        fat: null,
        saturatedFat: null,
        fiber: null,
        salt: null
      })
    );

    expect(result.status).toBe('review');
    expect(result.warnings[0]?.code).toBe('MISSING_CRITICAL_NUTRITION');
  });
});
