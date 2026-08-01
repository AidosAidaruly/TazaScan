import { describe, expect, it } from 'vitest';
import type { ScoreInput } from '../types/score-result';
import { NutriScoreEngine } from './nutri-score.engine';

const engine = new NutriScoreEngine();

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    servingType: 'per100g',
    energyKcal: 120,
    protein: 4,
    carbohydrates: 20,
    sugars: 5,
    fat: 3,
    saturatedFat: 1,
    fiber: 2,
    salt: 0.2,
    category: 'Food',
    ingredients: ['Water'],
    ...overrides
  };
}

describe('NutriScoreEngine', () => {
  it('scores a high sugar soft drink poorly', () => {
    const result = engine.calculate(
      input({
        servingType: 'per100ml',
        category: 'Soft Drinks',
        energyKcal: 42,
        sugars: 10.6,
        carbohydrates: 10.6,
        protein: 0,
        fiber: 0,
        fat: 0,
        saturatedFat: 0,
        salt: 0
      })
    );

    expect(result.status).toBe('calculated');
    expect(result.grade).toBe('C');
    expect(result.negativeReasons).toContain('High sugar content.');
  });

  it('scores a zero sugar drink better', () => {
    const result = engine.calculate(
      input({
        servingType: 'per100ml',
        category: 'Soft Drinks',
        energyKcal: 1,
        sugars: 0,
        carbohydrates: 0,
        protein: 0,
        fiber: 0,
        fat: 0,
        saturatedFat: 0,
        salt: 0
      })
    );

    expect(result.status).toBe('calculated');
    expect(result.grade).toBe('B');
    expect(result.positiveReasons).toContain('Low sugar content.');
  });

  it('rewards protein rich food', () => {
    const result = engine.calculate(
      input({
        category: 'Dairy',
        protein: 12,
        fiber: 1,
        sugars: 3,
        carbohydrates: 4
      })
    );

    expect(result.status).toBe('calculated');
    expect(result.positiveReasons).toContain('High protein content.');
  });

  it('returns insufficient data when required nutrition is missing', () => {
    const result = engine.calculate(input({ fiber: null }));

    expect(result.status).toBe('insufficient_data');
    expect(result.missingFields).toContain('fiber');
    expect(result.score).toBeNull();
  });

  it('requires review for negative values', () => {
    const result = engine.calculate(input({ sugars: -1 }));

    expect(result.status).toBe('requires_review');
    expect(result.warnings.join(' ')).toContain('sugars cannot be negative');
  });

  it('requires review when sugars are greater than carbohydrates', () => {
    const result = engine.calculate(input({ sugars: 12, carbohydrates: 10 }));

    expect(result.status).toBe('requires_review');
    expect(result.warnings).toContain('Sugars cannot be greater than carbohydrates.');
  });

  it('requires review when saturated fat is greater than fat', () => {
    const result = engine.calculate(input({ saturatedFat: 5, fat: 2 }));

    expect(result.status).toBe('requires_review');
    expect(result.warnings).toContain('Saturated fat cannot be greater than total fat.');
  });

  it('requires review for ingredient contradiction', () => {
    const result = engine.calculate(
      input({ ingredients: ['Water', 'Sugar'], sugars: 0, carbohydrates: 10 })
    );

    expect(result.status).toBe('requires_review');
    expect(result.warnings).toContain(
      'Ingredients mention sugar but nutrition facts report 0 g sugars.'
    );
  });

  it('is deterministic for the same nutrition input except calculatedAt', () => {
    const first = engine.calculate(input());
    const second = engine.calculate(input());

    expect({ ...first, calculatedAt: 'fixed' }).toEqual({
      ...second,
      calculatedAt: 'fixed'
    });
  });
});
