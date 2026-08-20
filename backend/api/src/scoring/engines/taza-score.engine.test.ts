import { describe, expect, it } from 'vitest';
import type { TazaScoreInput } from '../types/taza-score-result';
import type { OfficialNutriScoreResult } from '../types/official-nutri-score-result';
import { NutriScoreEngine } from './nutri-score.engine';
import { OfficialNutriScoreEngine } from './official-nutri-score.engine';
import { TazaScoreEngine } from './taza-score.engine';

const engine = new TazaScoreEngine();

function input(overrides: Partial<TazaScoreInput> = {}): TazaScoreInput {
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
    ingredients: ['Product ingredient'],
    dataStatus: 'verified',
    ...overrides
  };
}

const sugaryCola = input({
  servingType: 'per100ml',
  category: 'beverage',
  legacyCategoryLabel: 'Soft Drinks',
  energyKcal: 42,
  sugars: 10.6,
  carbohydrates: 10.6,
  fat: 0,
  saturatedFat: 0,
  protein: 0,
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
  ]
});

describe('TazaScoreEngine', () => {
  it('scores plain water substantially better than sugary cola', () => {
    const water = engine.calculate(
      input({
        servingType: 'per100ml',
        category: 'water',
        energyKcal: null,
        sugars: null,
        carbohydrates: null,
        fat: null,
        saturatedFat: null,
        protein: null,
        fiber: null,
        salt: null,
        fruitVegetableLegumePercent: null,
        ingredients: ['Water']
      })
    );
    const cola = engine.calculate(sugaryCola);

    expect(water.status).toBe('calculated');
    expect(water.score).toBe(100);
    expect(cola.score).toBe(27);
    expect(water.score! - cola.score!).toBeGreaterThan(40);
  });

  it('scores sugary cola from official beverage nutrition without forcing a target value', () => {
    const result = engine.calculate(sugaryCola);

    expect(result.status).toBe('calculated');
    expect(result.score).toBe(27);
    expect(result.officialNutriScore.grade).toBe('E');
    expect(result.nutritionComponent).toMatchObject({
      score: 17,
      maxScore: 90,
      status: 'calculated'
    });
    expect(result.ingredientComponent).toMatchObject({
      score: 10,
      maxScore: 10,
      additiveCount: 1,
      knownRiskPenalty: 0
    });
    expect(result.confidence).toMatchObject({
      score: null,
      maxScore: 0,
      level: 'high',
      dataStatus: 'verified'
    });
    expect(result.negativeReasons).toContain(
      'High sugar according to the official nutritional foundation.'
    );
    expect(result.negativeReasons).toContain(
      'Low favorable nutritional components in the official foundation.'
    );
  });

  it('scores zero-sugar cola using the official sweetener beverage penalty', () => {
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
        containsNonSugarSweeteners: true,
        ingredients: ['Carbonated water', 'Aspartame', 'Acesulfame-K']
      })
    );

    expect(result.score).toBe(66);
    expect(result.officialNutriScore.grade).toBe('C');
    expect(result.reasonCodes).toContain('CONTAINS_NON_SUGAR_SWEETENERS');
  });

  it('scores 100 percent fruit juice separately from sugary soda', () => {
    const juice = engine.calculate(
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

    expect(juice.score).toBe(61);
    expect(juice.officialNutriScore.grade).toBe('C');
    expect(juice.score!).toBeGreaterThan(engine.calculate(sugaryCola).score!);
  });

  it('scores plain milk better than a sweetened milk drink', () => {
    const plainMilk = engine.calculate(
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
    const sweetMilk = engine.calculate(
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

    expect(plainMilk.score).toBe(66);
    expect(sweetMilk.score).toBe(27);
    expect(plainMilk.score!).toBeGreaterThan(sweetMilk.score!);
  });

  it('scores plain yogurt better than otherwise similar sweetened yogurt', () => {
    const plainYogurt = engine.calculate(
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
        ingredients: ['Milk', 'Starter cultures']
      })
    );
    const sweetYogurt = engine.calculate(
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
        ingredients: ['Milk', 'Sugar', 'Starter cultures']
      })
    );

    expect(plainYogurt.score).toBe(85);
    expect(sweetYogurt.score).toBe(70);
    expect(plainYogurt.score!).toBeGreaterThan(sweetYogurt.score!);
  });

  it('scores oats and whole-grain bread using official nutrition components', () => {
    const oats = engine.calculate(
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
        ingredients: ['Whole oats']
      })
    );
    const bread = engine.calculate(
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
        ingredients: ['Whole-grain wheat flour', 'Water', 'Salt', 'Yeast']
      })
    );

    expect(oats.score).toBe(92);
    expect(bread.score).toBe(67);
    expect(oats.score!).toBeGreaterThan(bread.score!);
  });

  it('supports cheese and olive oil without treating them as general foods', () => {
    const cheese = engine.calculate(
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
        ingredients: ['Milk', 'Salt', 'Starter cultures']
      })
    );
    const oliveOil = engine.calculate(
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
        fruitVegetableLegumePercent: 100,
        ingredients: ['Extra virgin olive oil']
      })
    );

    expect(cheese.score).toBe(43);
    expect(cheese.officialNutriScore.grade).toBe('D');
    expect(oliveOil.score).toBe(76);
    expect(oliveOil.officialNutriScore.grade).toBe('B');
  });

  it('does not produce an excellent score when required nutrition data is incomplete', () => {
    const result = engine.calculate(
      input({
        energyKcal: null,
        sugars: null,
        saturatedFat: null,
        protein: null,
        fiber: null,
        salt: null,
        fruitVegetableLegumePercent: null
      })
    );

    expect(result.status).toBe('insufficient_data');
    expect(result.score).toBeNull();
    expect(result.missingFields).toContain('energyKcalOrEnergyKj');
  });

  it('calculates TazaScore from partial nutrition data without treating unknown as zero', () => {
    const result = engine.calculate(
      input({
        category: 'general_food',
        energyKcal: 85,
        protein: 1.4,
        carbohydrates: 19.9,
        sugars: 17.5,
        fat: 0,
        saturatedFat: 0,
        fiber: null,
        salt: 2,
        fruitVegetableLegumePercent: null,
        ingredients: ['Water', 'Tomato paste', 'Sugar', 'Salt']
      })
    );

    expect(result.officialNutriScore.status).toBe('insufficient_data');
    expect(result.status).toBe('calculated');
    expect(result.score).not.toBeNull();
    expect(result.reasonCodes).toContain('PARTIAL_NUTRITION_FOUNDATION');
    expect(result.usedFields).toEqual(
      expect.arrayContaining(['energyKcal', 'sugars', 'saturatedFat', 'salt', 'protein'])
    );
    expect(result.missingFields).toContain('fiber');
    expect(result.missingFields).toContain('fruitVegetableLegumePercent');
    expect(result.confidence.level).toBe('medium');
  });

  it('keeps confidence separate and lower when nutrition coverage is limited', () => {
    const result = engine.calculate(
      input({
        category: 'fats_oils_nuts_seeds',
        energyKcal: 619,
        protein: 1.1,
        carbohydrates: 3,
        sugars: null,
        fat: 67,
        saturatedFat: null,
        fiber: null,
        salt: null,
        fruitVegetableLegumePercent: null,
        ingredients: ['Sunflower oil', 'Water', 'Sugar', 'Salt']
      })
    );

    expect(result.status).toBe('calculated');
    expect(result.score).not.toBeNull();
    expect(result.usedFields).toEqual(expect.arrayContaining(['energyKcal', 'fat', 'protein']));
    expect(result.missingFields).toEqual(
      expect.arrayContaining(['sugars', 'saturatedFat', 'salt', 'fiber'])
    );
    expect(result.confidence.score).toBeNull();
    expect(result.confidence.level).toBe('low');
  });

  it('does not calculate TazaScore when only calories are known', () => {
    const result = engine.calculate(
      input({
        energyKcal: 120,
        protein: null,
        carbohydrates: null,
        sugars: null,
        fat: null,
        saturatedFat: null,
        fiber: null,
        salt: null,
        fruitVegetableLegumePercent: null,
        ingredients: ['Product ingredient']
      })
    );

    expect(result.status).toBe('insufficient_data');
    expect(result.score).toBeNull();
    expect(result.usedFields).toEqual(['energyKcal']);
    expect(result.nutritionCoverage).toBeGreaterThan(0);
  });

  it('does not score a low-calorie product when sugar and salt are unknown and evidence is too thin', () => {
    const result = engine.calculate(
      input({
        energyKcal: 20,
        protein: 0,
        carbohydrates: null,
        sugars: null,
        fat: null,
        saturatedFat: null,
        fiber: null,
        salt: null,
        fruitVegetableLegumePercent: null
      })
    );

    expect(result.status).toBe('insufficient_data');
    expect(result.score).toBeNull();
    expect(result.missingCriticalFields).toEqual(
      expect.arrayContaining(['sugars', 'salt', 'saturatedFat'])
    );
  });

  it('caps partial scores when energy and sugar are known but salt and saturated fat are unknown', () => {
    const result = engine.calculate(
      input({
        energyKcal: 80,
        sugars: 2,
        protein: 1,
        saturatedFat: null,
        fat: null,
        salt: null,
        fiber: null,
        fruitVegetableLegumePercent: null
      })
    );

    expect(result.status).toBe('calculated');
    expect(result.scoreBeforeSafeguard).not.toBeNull();
    expect(result.scoreCap).not.toBeNull();
    expect(result.score).toBeLessThan(result.scoreBeforeSafeguard!);
    expect(result.safeguardsApplied).toContain('missing_critical_negative_cap');
    expect(result.missingCriticalFields).toEqual(
      expect.arrayContaining(['salt', 'saturatedFat'])
    );
  });

  it('allows all negative fields known with positive fields missing without a critical cap', () => {
    const result = engine.calculate(
      input({
        energyKcal: 120,
        sugars: 3,
        saturatedFat: 0.5,
        salt: 0.2,
        protein: null,
        fiber: null,
        fruitVegetableLegumePercent: null
      })
    );

    expect(result.status).toBe('calculated');
    expect(result.missingCriticalFields).toEqual([]);
    expect(result.safeguardsApplied).not.toContain('missing_critical_negative_cap');
    expect(result.missingFields).toEqual(
      expect.arrayContaining(['protein', 'fiber', 'fruitVegetableLegumePercent'])
    );
  });

  it('does not cap most-fields-known partial products unless the score exceeds the generic cap', () => {
    const result = engine.calculate(
      input({
        energyKcal: 140,
        sugars: 5,
        saturatedFat: 1,
        salt: 0.4,
        protein: 3,
        fiber: 2,
        fruitVegetableLegumePercent: null
      })
    );

    expect(result.status).toBe('calculated');
    expect(result.nutritionCoverage).toBeGreaterThan(0.75);
    expect(result.missingCriticalFields).toEqual([]);
  });

  it('does not calculate when only positive fields are known', () => {
    const result = engine.calculate(
      input({
        energyKcal: null,
        sugars: null,
        saturatedFat: null,
        fat: null,
        salt: null,
        protein: 12,
        fiber: 8,
        fruitVegetableLegumePercent: 80
      })
    );

    expect(result.status).toBe('insufficient_data');
    expect(result.score).toBeNull();
    expect(result.usedFields).toEqual(
      expect.arrayContaining(['protein', 'fiber', 'fruitVegetableLegumePercent'])
    );
  });

  it('keeps unknown ingredients/additives conservative rather than inventing a risk penalty', () => {
    const result = engine.calculate(
      input({
        ingredients: [],
        dataStatus: 'unverified'
      })
    );

    expect(result.status).toBe('calculated');
    expect(result.ingredientComponent).toMatchObject({
      score: 8,
      additiveCount: null,
      knownRiskPenalty: 0
    });
    expect(result.confidence).toMatchObject({
      score: null,
      maxScore: 0,
      level: 'low'
    });
    expect(result.reasonCodes).toContain('UNKNOWN_INGREDIENTS');
  });

  it('reports legacy, official and TazaScore results for the Coca-Cola fixture separately', () => {
    const legacy = new NutriScoreEngine().calculate({
      servingType: sugaryCola.servingType,
      category: 'Soft Drinks',
      energyKcal: sugaryCola.energyKcal,
      protein: sugaryCola.protein,
      carbohydrates: sugaryCola.carbohydrates,
      sugars: sugaryCola.sugars,
      fat: sugaryCola.fat,
      saturatedFat: sugaryCola.saturatedFat,
      fiber: sugaryCola.fiber,
      salt: sugaryCola.salt,
      ingredients: sugaryCola.ingredients
    });
    const official = new OfficialNutriScoreEngine().calculate(sugaryCola);
    const tazaScore = engine.calculate(sugaryCola);

    expect(legacy).toMatchObject({ score: 69, grade: 'C' });
    expect(official).toMatchObject({
      rawScore: 13,
      grade: 'E',
      status: 'calculated'
    });
    expect(tazaScore).toMatchObject({
      score: 27,
      status: 'calculated',
      nutritionComponent: { score: 17 },
      ingredientComponent: { score: 10 },
      confidence: { score: null, level: 'high' }
    });
  });

  it('maps official grade boundaries into stable TazaScore nutrition bands', () => {
    const cases = [
      ['strongest A', -15, 'A', 100],
      ['weakest A', 0, 'A', 86],
      ['strongest B', 1, 'B', 85],
      ['weakest B', 2, 'B', 73],
      ['strongest C', 3, 'C', 72],
      ['weakest C', 10, 'C', 55],
      ['strongest D', 11, 'D', 54],
      ['weakest D', 18, 'D', 35],
      ['strongest E', 19, 'E', 34],
      ['weakest E', 40, 'E', 10]
    ] as const;

    for (const [label, rawScore, grade, expectedScore] of cases) {
      const fakeOfficialEngine = {
        calculate: () => officialResult(rawScore, grade)
      } as unknown as OfficialNutriScoreEngine;
      const result = new TazaScoreEngine(fakeOfficialEngine).calculate(input());

      expect(result.score, label).toBe(expectedScore);
    }
  });

  it('keeps better raw nutrition results ordered above worse results within adjacent grade boundaries', () => {
    const cases = [
      [-15, 'A'],
      [0, 'A'],
      [1, 'B'],
      [2, 'B'],
      [3, 'C'],
      [10, 'C'],
      [11, 'D'],
      [18, 'D'],
      [19, 'E'],
      [40, 'E']
    ] as const;
    const scores = cases.map(([rawScore, grade]) => {
      const fakeOfficialEngine = {
        calculate: () => officialResult(rawScore, grade)
      } as unknown as OfficialNutriScoreEngine;
      return new TazaScoreEngine(fakeOfficialEngine).calculate(input()).score!;
    });

    for (let index = 1; index < scores.length; index += 1) {
      expect(scores[index - 1]).toBeGreaterThan(scores[index]!);
    }
  });

  it('keeps E-number-only and unknown additive risk neutral', () => {
    const withENumber = engine.calculate(
      input({
        ingredients: ['Water', 'Acidity regulator E330']
      })
    );
    const withoutENumber = engine.calculate(
      input({
        ingredients: ['Water', 'Citric acid']
      })
    );

    expect(withENumber.ingredientComponent).toMatchObject({
      score: 10,
      additiveCount: 1,
      knownRiskPenalty: 0
    });
    expect(withoutENumber.ingredientComponent).toMatchObject({
      score: 10,
      additiveCount: 0,
      knownRiskPenalty: 0
    });
    expect(withENumber.score).toBe(withoutENumber.score);
  });

  describe('partial-data beverage metadata safeguard', () => {
    const beverageBase = input({
      servingType: 'per100ml',
      category: 'beverage',
      legacyCategoryLabel: 'Soft Drinks',
      energyKcal: 42,
      sugars: 10.6,
      carbohydrates: 10.6,
      fat: 0,
      saturatedFat: 0,
      protein: 0,
      fiber: 0,
      salt: 0,
      fruitVegetableLegumePercent: 0,
      containsNonSugarSweeteners: false,
      ingredients: ['Water', 'Sugar'],
      dataStatus: 'verified'
    });

    it('keeps complete high-sugar beverage on the official foundation', () => {
      const result = engine.calculate(beverageBase);

      expect(result.score).toBe(27);
      expect(result.officialNutriScore).toMatchObject({
        status: 'calculated',
        grade: 'E',
        rawScore: 13
      });
      expect(result.usedFields).toEqual(['officialNutriScore']);
      expect(result.safeguardsApplied).toEqual([]);
      expect(result.methodologyVersion).toBe('taza-score-v1.1');
    });

    it('caps the same high-sugar beverage when FVL metadata is missing', () => {
      const result = engine.calculate({
        ...beverageBase,
        fruitVegetableLegumePercent: null
      });

      expect(result.officialNutriScore.status).toBe('insufficient_data');
      expect(result.scoreBeforeSafeguard).toBe(60);
      expect(result.score).toBe(44);
      expect(result.scoreCap).toBe(44);
      expect(result.safeguardsApplied).toContain('beverage_official_metadata_cap');
      expect(result.missingFields).toContain('fruitVegetableLegumePercent');
      expect(result.usedFields).toContain('containsNonSugarSweeteners');
    });

    it('caps the same high-sugar beverage when FVL and sweetener metadata are missing', () => {
      const result = engine.calculate({
        ...beverageBase,
        fruitVegetableLegumePercent: null,
        containsNonSugarSweeteners: null
      });

      expect(result.scoreBeforeSafeguard).toBe(58);
      expect(result.score).toBe(44);
      expect(result.scoreCap).toBe(44);
      expect(result.safeguardsApplied).toContain('beverage_official_metadata_cap');
      expect(result.missingFields).toEqual(
        expect.arrayContaining([
          'fruitVegetableLegumePercent',
          'containsNonSugarSweeteners'
        ])
      );
      expect(result.usedFields).not.toContain('containsNonSugarSweeteners');
    });

    it('does not treat a zero-sugar beverage as sugary', () => {
      const result = engine.calculate({
        ...beverageBase,
        energyKcal: 0.2,
        carbohydrates: 0,
        sugars: 0,
        salt: 0.05,
        fruitVegetableLegumePercent: null,
        containsNonSugarSweeteners: null,
        ingredients: ['Water', 'Aspartame']
      });

      expect(result.reasonCodes).not.toContain('HIGH_SUGAR');
      expect(result.scoreBeforeSafeguard).toBe(83);
      expect(result.score).toBe(76);
      expect(result.scoreCap).toBe(76);
      expect(result.safeguardsApplied).toContain('beverage_official_metadata_cap');
      expect(result.reasonCodes).toContain('CONTAINS_NON_SUGAR_SWEETENERS');
    });

    it('leaves legitimate water behavior unchanged', () => {
      const result = engine.calculate({
        ...beverageBase,
        category: 'water',
        energyKcal: null,
        carbohydrates: null,
        sugars: null,
        fat: null,
        saturatedFat: null,
        protein: null,
        fiber: null,
        salt: null,
        fruitVegetableLegumePercent: null,
        containsNonSugarSweeteners: false,
        ingredients: ['Water']
      });

      expect(result.score).toBe(100);
      expect(result.usedFields).toEqual(['officialNutriScore']);
      expect(result.safeguardsApplied).toEqual([]);
    });

    it('caps a moderate-sugar partial beverage without matching the complete control', () => {
      const partial = engine.calculate({
        ...beverageBase,
        energyKcal: 25,
        carbohydrates: 6,
        sugars: 6,
        fruitVegetableLegumePercent: null,
        containsNonSugarSweeteners: null
      });
      const complete = engine.calculate({
        ...beverageBase,
        energyKcal: 25,
        carbohydrates: 6,
        sugars: 6,
        fruitVegetableLegumePercent: 0,
        containsNonSugarSweeteners: false
      });

      expect(partial.scoreBeforeSafeguard).toBe(72);
      expect(partial.score).toBe(62);
      expect(partial.safeguardsApplied).toContain('beverage_official_metadata_cap');
      expect(complete.score).toBe(54);
      expect(complete.usedFields).toEqual(['officialNutriScore']);
    });

    it('preserves explicit zero and false values as complete metadata', () => {
      const result = engine.calculate({
        ...beverageBase,
        fruitVegetableLegumePercent: 0,
        containsNonSugarSweeteners: false
      });

      expect(result.missingFields).not.toContain('fruitVegetableLegumePercent');
      expect(result.missingFields).not.toContain('containsNonSugarSweeteners');
      expect(result.officialNutriScore.status).toBe('calculated');
      expect(result.safeguardsApplied).toEqual([]);
    });

    it('keeps unrelated general-food partial scores unchanged', () => {
      const result = engine.calculate({
        category: 'general_food',
        servingType: 'per100g',
        energyKcal: 85,
        protein: 1.4,
        carbohydrates: 19.9,
        sugars: 17.5,
        fat: 0,
        saturatedFat: 0,
        fiber: null,
        salt: 2,
        fruitVegetableLegumePercent: null,
        containsNonSugarSweeteners: null,
        ingredients: ['Water', 'Tomato paste', 'Sugar', 'Salt'],
        dataStatus: 'verified'
      });

      expect(result.score).toBe(74);
      expect(result.safeguardsApplied).not.toContain('beverage_official_metadata_cap');
    });
  });
});

function officialResult(
  rawScore: number,
  grade: OfficialNutriScoreResult['grade']
): OfficialNutriScoreResult {
  return {
    rawScore,
    grade,
    status: 'calculated',
    reasonCodes: [],
    missingFields: [],
    warnings: [],
    algorithm: 'Nutri-Score',
    algorithmVersion: 'test',
    category: 'general_food',
    componentPoints: {
      energy: 0,
      sugars: 0,
      saturatedFat: 0,
      salt: 0,
      nonSugarSweeteners: 0,
      fruitVegetableLegume: 0,
      fiber: 0,
      protein: 0,
      negativeTotal: 0,
      positiveTotal: 1
    },
    calculatedAt: '2026-01-01T00:00:00.000Z'
  };
}
