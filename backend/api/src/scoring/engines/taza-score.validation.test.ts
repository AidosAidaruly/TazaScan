import { describe, expect, it } from 'vitest';
import type { TazaScoreInput } from '../types/taza-score-result';
import { OfficialNutriScoreEngine } from './official-nutri-score.engine';
import { TazaScoreEngine } from './taza-score.engine';

type ValidationFixture = {
  name: string;
  input: TazaScoreInput;
  expected: {
    rawScore: number;
    grade: string;
    tazaScore: number;
    nutrition: number;
    ingredient: number;
    confidence: 'high' | 'medium' | 'low';
  };
};

const fixtures: ValidationFixture[] = [
  {
    name: 'Plain water',
    input: {
      servingType: 'per100ml',
      category: 'water',
      energyKcal: null,
      protein: null,
      carbohydrates: null,
      sugars: null,
      fat: null,
      saturatedFat: null,
      fiber: null,
      salt: null,
      fruitVegetableLegumePercent: null,
      containsNonSugarSweeteners: false,
      ingredients: ['Water'],
      dataStatus: 'verified'
    },
    expected: {
      rawScore: 0,
      grade: 'A',
      tazaScore: 100,
      nutrition: 90,
      ingredient: 10,
      confidence: 'high'
    }
  },
  {
    name: 'Sugary cola',
    input: {
      servingType: 'per100ml',
      category: 'beverage',
      energyKcal: 42,
      protein: 0,
      carbohydrates: 10.6,
      sugars: 10.6,
      fat: 0,
      saturatedFat: 0,
      fiber: 0,
      salt: 0,
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false,
      ingredients: [
        'Carbonated water',
        'Sugar',
        'Colour caramel E150d',
        'Phosphoric acid',
        'Natural flavourings',
        'Caffeine'
      ],
      dataStatus: 'verified'
    },
    expected: {
      rawScore: 13,
      grade: 'E',
      tazaScore: 27,
      nutrition: 17,
      ingredient: 10,
      confidence: 'high'
    }
  },
  {
    name: 'Zero-sugar cola with non-sugar sweeteners',
    input: {
      servingType: 'per100ml',
      category: 'beverage',
      energyKcal: 1,
      protein: 0,
      carbohydrates: 0,
      sugars: 0,
      fat: 0,
      saturatedFat: 0,
      fiber: 0,
      salt: 0,
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: true,
      ingredients: ['Carbonated water', 'Aspartame', 'Acesulfame-K', 'Caffeine'],
      dataStatus: 'verified'
    },
    expected: {
      rawScore: 4,
      grade: 'C',
      tazaScore: 66,
      nutrition: 56,
      ingredient: 10,
      confidence: 'high'
    }
  },
  {
    name: 'Plain milk',
    input: {
      servingType: 'per100ml',
      category: 'beverage',
      energyKcal: 64,
      protein: 3.3,
      carbohydrates: 4.7,
      sugars: 4.7,
      fat: 3.5,
      saturatedFat: 2.3,
      fiber: 0,
      salt: 0.1,
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false,
      ingredients: ['Milk'],
      dataStatus: 'verified'
    },
    expected: {
      rawScore: 4,
      grade: 'C',
      tazaScore: 66,
      nutrition: 56,
      ingredient: 10,
      confidence: 'high'
    }
  },
  {
    name: 'Sweetened yogurt',
    input: {
      servingType: 'per100g',
      category: 'general_food',
      energyKcal: 100,
      protein: 4,
      carbohydrates: 16,
      sugars: 13,
      fat: 3,
      saturatedFat: 1.5,
      fiber: 0,
      salt: 0.1,
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false,
      ingredients: ['Milk', 'Sugar', 'Starter cultures'],
      dataStatus: 'verified'
    },
    expected: {
      rawScore: 4,
      grade: 'C',
      tazaScore: 70,
      nutrition: 60,
      ingredient: 10,
      confidence: 'high'
    }
  },
  {
    name: 'Potato chips',
    input: {
      servingType: 'per100g',
      category: 'general_food',
      energyKcal: 536,
      protein: 6,
      carbohydrates: 50,
      sugars: 1,
      fat: 35,
      saturatedFat: 3.2,
      fiber: 4,
      salt: 1.3,
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false,
      ingredients: ['Potatoes', 'Sunflower oil', 'Salt'],
      dataStatus: 'verified'
    },
    expected: {
      rawScore: 14,
      grade: 'D',
      tazaScore: 46,
      nutrition: 36,
      ingredient: 10,
      confidence: 'high'
    }
  },
  {
    name: 'Plain oats',
    input: {
      servingType: 'per100g',
      category: 'general_food',
      energyKcal: 389,
      protein: 16,
      carbohydrates: 66,
      sugars: 1,
      fat: 7,
      saturatedFat: 1.2,
      fiber: 10,
      salt: 0,
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false,
      ingredients: ['Whole oats'],
      dataStatus: 'verified'
    },
    expected: {
      rawScore: -6,
      grade: 'A',
      tazaScore: 92,
      nutrition: 82,
      ingredient: 10,
      confidence: 'high'
    }
  },
  {
    name: 'Whole-grain bread',
    input: {
      servingType: 'per100g',
      category: 'general_food',
      energyKcal: 250,
      protein: 9,
      carbohydrates: 45,
      sugars: 5,
      fat: 3,
      saturatedFat: 0.5,
      fiber: 6,
      salt: 1,
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false,
      ingredients: ['Whole-grain wheat flour', 'Water', 'Salt', 'Yeast'],
      dataStatus: 'verified'
    },
    expected: {
      rawScore: 5,
      grade: 'C',
      tazaScore: 67,
      nutrition: 57,
      ingredient: 10,
      confidence: 'high'
    }
  },
  {
    name: 'Chocolate',
    input: {
      servingType: 'per100g',
      category: 'general_food',
      energyKcal: 546,
      protein: 7,
      carbohydrates: 58,
      sugars: 54,
      fat: 31,
      saturatedFat: 19,
      fiber: 7,
      salt: 0.02,
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false,
      ingredients: ['Sugar', 'Cocoa mass', 'Cocoa butter', 'Milk powder'],
      dataStatus: 'verified'
    },
    expected: {
      rawScore: 27,
      grade: 'E',
      tazaScore: 25,
      nutrition: 15,
      ingredient: 10,
      confidence: 'high'
    }
  },
  {
    name: '100% orange juice',
    input: {
      servingType: 'per100ml',
      category: 'beverage',
      energyKcal: 45,
      protein: 0.7,
      carbohydrates: 10,
      sugars: 9,
      fat: 0,
      saturatedFat: 0,
      fiber: 0.2,
      salt: 0,
      fruitVegetableLegumePercent: 100,
      containsNonSugarSweeteners: false,
      ingredients: ['Orange juice'],
      dataStatus: 'verified'
    },
    expected: {
      rawScore: 5,
      grade: 'C',
      tazaScore: 61,
      nutrition: 51,
      ingredient: 10,
      confidence: 'high'
    }
  }
];

describe('TazaScore validation dataset', () => {
  const officialEngine = new OfficialNutriScoreEngine();
  const tazaScoreEngine = new TazaScoreEngine();

  it.each(fixtures)('keeps regression output stable for $name', (fixture) => {
    const official = officialEngine.calculate({
      ...fixture.input,
      energyKj: fixture.input.energyKj ?? null
    });
    const tazaScore = tazaScoreEngine.calculate(fixture.input);

    expect(official.rawScore).toBe(fixture.expected.rawScore);
    expect(official.grade).toBe(fixture.expected.grade);
    expect(tazaScore.score).toBe(fixture.expected.tazaScore);
    expect(tazaScore.nutritionComponent.score).toBe(fixture.expected.nutrition);
    expect(tazaScore.ingredientComponent.score).toBe(fixture.expected.ingredient);
    expect(tazaScore.confidence.level).toBe(fixture.expected.confidence);
  });

  it('keeps intuitive broad ordering for the fixture set', () => {
    const scores = Object.fromEntries(
      fixtures.map((fixture) => [
        fixture.name,
        tazaScoreEngine.calculate(fixture.input).score
      ])
    );

    expect(scores['Plain water']).toBeGreaterThan(scores['Sugary cola']!);
    expect(scores['Plain oats']).toBeGreaterThan(scores['Chocolate']!);
    expect(scores['Whole-grain bread']).toBeGreaterThan(scores['Potato chips']!);
    expect(scores['Sweetened yogurt']).toBeGreaterThan(scores['Sugary cola']!);
    expect(scores['Potato chips']).toBeGreaterThan(scores['Chocolate']!);
  });

  it('captures known review candidates without changing the formula silently', () => {
    const scores = Object.fromEntries(
      fixtures.map((fixture) => [
        fixture.name,
        tazaScoreEngine.calculate(fixture.input).score
      ])
    );

    expect(scores['Zero-sugar cola with non-sugar sweeteners']).toBe(66);
    expect(scores['100% orange juice']).toBe(61);
    expect(scores['Sweetened yogurt']).toBe(70);
  });
});
