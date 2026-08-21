import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../utils/http-error';
import { SubmissionOcrService } from './submission-ocr.service';

describe('SubmissionOcrService', () => {
  it('returns nutrition OCR candidate without persistence side effects', async () => {
    const extractText = vi.fn().mockResolvedValue(`
      per 100 ml
      Energy 42 kcal
      Sugars 10.6 g
      Salt 0 g
    `);
    const service = new SubmissionOcrService({ extractText });

    const result = await service.recognizeNutrition(Buffer.from('image'));

    expect(extractText).toHaveBeenCalledWith(Buffer.from('image'));
    expect(result.nutrition.energyKcal.value).toBe(42);
    expect(result.nutrition.sugars.value).toBe(10.6);
    expect(result.nutrition.salt.value).toBe(0);
  });

  it('returns ingredients OCR candidate as raw user-review text', async () => {
    const service = new SubmissionOcrService({
      extractText: vi.fn().mockResolvedValue('Ingredients: water, sugar')
    });

    const result = await service.recognizeIngredients(Buffer.from('image'));

    expect(result.ingredientsText.value).toBe('water, sugar');
    expect(result.ingredientsText.confidence).toBe('detected');
  });

  it('propagates OCR failures as safe errors', async () => {
    const service = new SubmissionOcrService({
      extractText: vi.fn().mockRejectedValue(new HttpError(422, 'OCR failed'))
    });

    await expect(service.recognizeNutrition(Buffer.from('image'))).rejects.toMatchObject({
      statusCode: 422,
      message: 'OCR failed'
    });
  });
});
