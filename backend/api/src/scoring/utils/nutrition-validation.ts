import type { ScoreInput } from '../types/score-result';

const requiredFields: (keyof ScoreInput)[] = [
  'servingType',
  'energyKcal',
  'sugars',
  'saturatedFat',
  'protein',
  'fiber',
  'salt'
];

const nutritionFields: (keyof ScoreInput)[] = [
  'energyKcal',
  'protein',
  'carbohydrates',
  'sugars',
  'fat',
  'saturatedFat',
  'fiber',
  'salt'
];

export function findMissingFields(input: ScoreInput): string[] {
  return requiredFields.filter((field) => input[field] === null || input[field] === undefined);
}

export function findNutritionWarnings(input: ScoreInput): string[] {
  const warnings: string[] = [];

  for (const field of nutritionFields) {
    const value = input[field];
    if (typeof value === 'number' && value < 0) {
      warnings.push(`${field} cannot be negative.`);
    }
  }

  if (input.sugars !== null && input.carbohydrates !== null && input.sugars > input.carbohydrates) {
    warnings.push('Sugars cannot be greater than carbohydrates.');
  }

  if (input.saturatedFat !== null && input.fat !== null && input.saturatedFat > input.fat) {
    warnings.push('Saturated fat cannot be greater than total fat.');
  }

  if (containsSugarIngredient(input.ingredients) && input.sugars === 0) {
    warnings.push('Ingredients mention sugar but nutrition facts report 0 g sugars.');
  }

  if (!input.servingType) {
    warnings.push('Serving type is missing.');
  }

  warnings.push(...findUnrealisticValues(input));

  return warnings;
}

function containsSugarIngredient(ingredients: string[]): boolean {
  return ingredients.some((ingredient) =>
    /\b(sugar|сахар|қант|glucose|fructose|syrup)\b/i.test(ingredient)
  );
}

function findUnrealisticValues(input: ScoreInput): string[] {
  const warnings: string[] = [];

  if (input.energyKcal !== null && input.energyKcal > 900) {
    warnings.push('Energy kcal looks unrealistically high per 100 g/ml.');
  }

  for (const field of ['protein', 'carbohydrates', 'sugars', 'fat', 'fiber'] as const) {
    const value = input[field];
    if (value !== null && value > 100) {
      warnings.push(`${field} looks unrealistically high per 100 g/ml.`);
    }
  }

  if (input.salt !== null && input.salt > 20) {
    warnings.push('Salt looks unrealistically high per 100 g/ml.');
  }

  return warnings;
}
