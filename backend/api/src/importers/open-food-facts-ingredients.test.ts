import { describe, expect, it } from 'vitest';
import {
  selectOpenFoodFactsIngredientTexts,
  splitIngredients
} from './open-food-facts-ingredients';

describe('Open Food Facts ingredient language selection', () => {
  it('prefers Russian ingredients for consumer text when available', () => {
    const result = selectOpenFoodFactsIngredientTexts({
      ingredients_text: 'Sugar; cocoa butter',
      ingredients_text_ru: 'Сахар; какао-масло',
      ingredients_text_en: 'Sugar; cocoa butter'
    });

    expect(result.consumerText).toBe('Сахар; какао-масло');
    expect(result.consumerLanguage).toBe('ru');
    expect(result.originalText).toBe('Sugar; cocoa butter');
    expect(result.originalLanguage).toBe('en');
    expect(result.russianText).toBe('Сахар; какао-масло');
  });

  it('keeps original visible when Russian ingredients are unavailable', () => {
    const result = selectOpenFoodFactsIngredientTexts({
      ingredients_text: 'Sugar; cocoa butter',
      ingredients_text_en: 'Sugar; cocoa butter'
    });

    expect(result.consumerText).toBe('Sugar; cocoa butter');
    expect(result.consumerLanguage).toBe('en');
    expect(result.russianText).toBeNull();
  });

  it('splits ingredients without inventing values', () => {
    expect(splitIngredients('Sugar; cocoa butter, milk')).toEqual([
      'Sugar',
      'cocoa butter',
      'milk'
    ]);
  });
});
