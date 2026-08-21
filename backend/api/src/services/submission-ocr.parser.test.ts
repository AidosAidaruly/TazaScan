import { describe, expect, it } from 'vitest';
import { SubmissionOcrParser } from './submission-ocr.parser';

const parser = new SubmissionOcrParser();

describe('SubmissionOcrParser', () => {
  it('parses Russian nutrition labels per 100 ml', () => {
    const result = parser.parseNutrition(`
      Пищевая ценность на 100 мл
      Энергетическая ценность 176 кДж / 42 ккал
      Белки 0 г
      Жиры 0 г
      Насыщенные жиры 0 г
      Углеводы 10,6 г
      Сахар 10,6 г
      Соль 0 г
    `);

    expect(result.detectedBasis).toBe('per100ml');
    expect(result.nutrition.energyKcal.value).toBe(42);
    expect(result.nutrition.protein.value).toBe(0);
    expect(result.nutrition.carbohydrates.value).toBe(10.6);
    expect(result.nutrition.sugars.value).toBe(10.6);
    expect(result.nutrition.salt.value).toBe(0);
  });

  it('parses English nutrition labels per 100 g', () => {
    const result = parser.parseNutrition(`
      Nutrition facts per 100 g
      Energy 210 kcal
      Protein 6.5 g
      Fat 9 g
      Saturated fat 3 g
      Carbohydrates 24 g
      Sugars 4.2 g
      Fibre 8 g
      Salt 1.1 g
    `);

    expect(result.detectedBasis).toBe('per100g');
    expect(result.nutrition.energyKcal.value).toBe(210);
    expect(result.nutrition.saturatedFat.value).toBe(3);
    expect(result.nutrition.fiber.value).toBe(8);
  });

  it('keeps missing nutrition fields null', () => {
    const result = parser.parseNutrition(`
      per 100 g
      Energy 100 kcal
      Protein 0 g
    `);

    expect(result.nutrition.protein.value).toBe(0);
    expect(result.nutrition.sugars.value).toBeNull();
    expect(result.nutrition.salt.value).toBeNull();
  });

  it('does not treat serving-only values as per100 values', () => {
    const result = parser.parseNutrition(`
      Amount per serving
      Energy 80 kcal
      Sugars 14 g
    `);

    expect(result.detectedBasis).toBe('serving');
    expect(result.nutrition.energyKcal.value).toBeNull();
    expect(result.nutrition.sugars.value).toBeNull();
    expect(result.warnings).toContain('serving_values_not_used');
  });

  it('converts kJ-only energy to kcal deterministically', () => {
    const result = parser.parseNutrition(`
      Nutrition per 100 ml
      Energy 176 kJ
    `);

    expect(result.nutrition.energyKcal.value).toBe(42.1);
  });

  it('preserves raw ingredient text after marker', () => {
    const result = parser.parseIngredients(
      'Состав: вода газированная, сахар, краситель E150d, кофеин.'
    );

    expect(result.ingredientsText.value).toBe(
      'вода газированная, сахар, краситель E150d, кофеин.'
    );
    expect(result.ingredientsText.detectedLanguage).toBe('ru');
  });

  it('uses readable ingredient text fallback without marker', () => {
    const result = parser.parseIngredients('Water, sugar, caffeine');

    expect(result.ingredientsText.value).toBe('Water, sugar, caffeine');
    expect(result.ingredientsText.detectedLanguage).toBe('en');
  });

  it('handles empty OCR result safely', () => {
    const nutrition = parser.parseNutrition('');
    const ingredients = parser.parseIngredients('');

    expect(nutrition.detectedBasis).toBe('unknown');
    expect(nutrition.nutrition.energyKcal.value).toBeNull();
    expect(ingredients.ingredientsText.value).toBeNull();
  });
});
