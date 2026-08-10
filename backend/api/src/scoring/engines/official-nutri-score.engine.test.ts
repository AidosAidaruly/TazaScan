import { describe, expect, it } from 'vitest';
import type { OfficialNutriScoreInput } from '../types/official-nutri-score-result';
import { NutriScoreEngine } from './nutri-score.engine';
import { OfficialNutriScoreEngine } from './official-nutri-score.engine';

const engine = new OfficialNutriScoreEngine();

function input(overrides: Partial<OfficialNutriScoreInput> = {}): OfficialNutriScoreInput {
  return {
    servingType: 'per100g',
    category: 'general_food',
    energyKcal: 100,
    protein: 4,
    carbohydrates: 15,
    sugars: 5,
    fat: 3,
    saturatedFat: 1,
    fiber: 3,
    salt: 0.2,
    fruitVegetableLegumePercent: 0,
    containsNonSugarSweeteners: false,
    ingredients: [],
    ...overrides
  };
}

describe('OfficialNutriScoreEngine', () => {
  it('classifies plain water with the official special A treatment', () => {
    const result = engine.calculate(
      input({
        servingType: 'per100ml',
        category: 'water',
        energyKcal: null,
        sugars: null,
        saturatedFat: null,
        salt: null,
        fiber: null,
        protein: null,
        carbohydrates: null,
        fat: null,
        fruitVegetableLegumePercent: null
      })
    );

    expect(result.status).toBe('calculated');
    expect(result.rawScore).toBe(0);
    expect(result.grade).toBe('A');
    expect(result.reasonCodes).toContain('PLAIN_WATER_SPECIAL_CASE');
  });

  it('scores a sugary cola around 10-11 g sugars per 100 ml using beverage rules', () => {
    const result = engine.calculate(
      input({
        servingType: 'per100ml',
        category: 'beverage',
        energyKcal: 42,
        sugars: 10.6,
        carbohydrates: 10.6,
        fat: 0,
        saturatedFat: 0,
        protein: 0,
        fiber: 0,
        salt: 0,
        fruitVegetableLegumePercent: 0,
        ingredients: ['Carbonated water', 'Sugar']
      })
    );

    expect(result.componentPoints).toMatchObject({
      energy: 3,
      sugars: 10,
      nonSugarSweeteners: 0,
      negativeTotal: 13,
      positiveTotal: 0
    });
    expect(result.rawScore).toBe(13);
    expect(result.grade).toBe('E');
    expect(result.reasonCodes).toContain('HIGH_SUGAR');
  });

  it('penalizes zero-sugar cola with recognized non-sugar sweeteners', () => {
    const result = engine.calculate(
      input({
        servingType: 'per100ml',
        category: 'beverage',
        energyKcal: 1,
        sugars: 0,
        carbohydrates: 0,
        fat: 0,
        saturatedFat: 0,
        protein: 0,
        fiber: 0,
        salt: 0,
        fruitVegetableLegumePercent: 0,
        containsNonSugarSweeteners: null,
        ingredients: ['Carbonated water', 'Aspartame', 'Acesulfame-K']
      })
    );

    expect(result.componentPoints?.nonSugarSweeteners).toBe(4);
    expect(result.rawScore).toBe(4);
    expect(result.grade).toBe('C');
    expect(result.reasonCodes).toContain('CONTAINS_NON_SUGAR_SWEETENERS');
  });

  it('scores 100 percent fruit juice with beverage sugar and FVL components', () => {
    const result = engine.calculate(
      input({
        servingType: 'per100ml',
        category: 'beverage',
        energyKcal: 45,
        sugars: 9,
        carbohydrates: 10,
        fat: 0,
        saturatedFat: 0,
        protein: 0.7,
        fiber: 0.2,
        salt: 0,
        fruitVegetableLegumePercent: 100,
        ingredients: ['Orange juice']
      })
    );

    expect(result.componentPoints).toMatchObject({
      energy: 3,
      sugars: 8,
      fruitVegetableLegume: 6
    });
    expect(result.rawScore).toBe(5);
    expect(result.grade).toBe('C');
  });

  it('scores plain milk as a beverage category product', () => {
    const result = engine.calculate(
      input({
        servingType: 'per100ml',
        category: 'beverage',
        energyKcal: 64,
        sugars: 4.7,
        carbohydrates: 4.7,
        fat: 3.5,
        saturatedFat: 2.3,
        protein: 3.3,
        fiber: 0,
        salt: 0.1,
        fruitVegetableLegumePercent: 0,
        ingredients: ['Milk']
      })
    );

    expect(result.rawScore).toBe(4);
    expect(result.grade).toBe('C');
  });

  it('scores a sweetened milk drink as a beverage and captures high sugar', () => {
    const result = engine.calculate(
      input({
        servingType: 'per100ml',
        category: 'beverage',
        energyKcal: 90,
        sugars: 12,
        carbohydrates: 14,
        fat: 2,
        saturatedFat: 1.5,
        protein: 3.2,
        fiber: 0,
        salt: 0.15,
        fruitVegetableLegumePercent: 0,
        ingredients: ['Milk', 'Sugar']
      })
    );

    expect(result.rawScore).toBe(13);
    expect(result.grade).toBe('E');
    expect(result.reasonCodes).toContain('HIGH_SUGAR');
  });

  it('scores plain yogurt with general-food rules', () => {
    const result = engine.calculate(
      input({
        category: 'general_food',
        energyKcal: 61,
        sugars: 4.7,
        carbohydrates: 4.7,
        fat: 3.3,
        saturatedFat: 1.5,
        protein: 3.5,
        fiber: 0,
        salt: 0.1,
        fruitVegetableLegumePercent: 0
      })
    );

    expect(result.rawScore).toBe(1);
    expect(result.grade).toBe('B');
  });

  it('scores sweet yogurt with sugar points but does not use beverage rules', () => {
    const result = engine.calculate(
      input({
        category: 'general_food',
        energyKcal: 100,
        sugars: 13,
        carbohydrates: 16,
        fat: 3,
        saturatedFat: 1.5,
        protein: 4,
        fiber: 0,
        salt: 0.1,
        fruitVegetableLegumePercent: 0
      })
    );

    expect(result.rawScore).toBe(4);
    expect(result.grade).toBe('C');
  });

  it('scores plain oats as a high-fiber general food', () => {
    const result = engine.calculate(
      input({
        category: 'general_food',
        energyKcal: 389,
        sugars: 1,
        carbohydrates: 66,
        fat: 7,
        saturatedFat: 1.2,
        protein: 16,
        fiber: 10,
        salt: 0,
        fruitVegetableLegumePercent: 0
      })
    );

    expect(result.rawScore).toBe(-6);
    expect(result.grade).toBe('A');
    expect(result.reasonCodes).toContain('HIGH_FIBER');
  });

  it('scores bread using salt, fiber and protein-cap rules', () => {
    const result = engine.calculate(
      input({
        category: 'general_food',
        energyKcal: 250,
        sugars: 5,
        carbohydrates: 45,
        fat: 3,
        saturatedFat: 0.5,
        protein: 9,
        fiber: 6,
        salt: 1,
        fruitVegetableLegumePercent: 0
      })
    );

    expect(result.rawScore).toBe(5);
    expect(result.grade).toBe('C');
  });

  it('scores cheese with protein counted under the special cheese rule', () => {
    const result = engine.calculate(
      input({
        category: 'cheese',
        energyKcal: 400,
        sugars: 0,
        carbohydrates: 1,
        fat: 33,
        saturatedFat: 18,
        protein: 25,
        fiber: 0,
        salt: 1.8,
        fruitVegetableLegumePercent: 0
      })
    );

    expect(result.rawScore).toBe(15);
    expect(result.grade).toBe('D');
  });

  it('scores fats and oils using saturated-fat energy and SFA-to-fat ratio', () => {
    const result = engine.calculate(
      input({
        category: 'fats_oils_nuts_seeds',
        energyKcal: 884,
        sugars: 0,
        carbohydrates: 0,
        fat: 100,
        saturatedFat: 14,
        protein: 0,
        fiber: 0,
        salt: 0,
        fruitVegetableLegumePercent: 100
      })
    );

    expect(result.componentPoints).toMatchObject({
      energy: 4,
      saturatedFat: 1,
      fruitVegetableLegume: 5
    });
    expect(result.rawScore).toBe(0);
    expect(result.grade).toBe('B');
  });

  it('returns insufficient data instead of assuming missing official inputs are zero', () => {
    const result = engine.calculate(
      {
        servingType: 'per100ml',
        legacyCategoryLabel: 'Soft Drinks',
        energyKcal: 42,
        sugars: 10.6,
        carbohydrates: 10.6,
        fat: 0,
        saturatedFat: 0,
        protein: 0,
        fiber: 0,
        salt: 0,
        fruitVegetableLegumePercent: null,
        containsNonSugarSweeteners: null,
        ingredients: ['Carbonated water', 'Sugar']
      }
    );

    expect(result.status).toBe('insufficient_data');
    expect(result.rawScore).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.missingFields).toContain('fruitVegetableLegumePercent');
  });

  it('keeps legacy NutriScoreEngine behavior available for Coca-Cola validation', () => {
    const legacy = new NutriScoreEngine();
    const result = legacy.calculate({
      servingType: 'per100ml',
      category: 'Soft Drinks',
      energyKcal: 42,
      sugars: 10.6,
      carbohydrates: 10.6,
      protein: 0,
      fiber: 0,
      fat: 0,
      saturatedFat: 0,
      salt: 0,
      ingredients: ['Carbonated water', 'Sugar']
    });

    expect(result.score).toBe(69);
    expect(result.grade).toBe('C');
  });
});
