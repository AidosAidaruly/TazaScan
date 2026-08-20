import { describe, expect, it } from 'vitest';
import { productImageQualityEvaluator } from './product-image-quality.evaluator';

describe('ProductImageQualityEvaluator', () => {
  it('keeps verified/manual image as primary', () => {
    const result = productImageQualityEvaluator.evaluate({
      imageUrl: 'https://example.com/user-uploaded-photo.jpg',
      source: 'Manual label review',
      dataStatus: 'verified'
    });

    expect(result).toMatchObject({
      status: 'usable_primary',
      usableAsPrimary: true,
      reasons: ['manual_or_verified_image']
    });
  });

  it('accepts good Open Food Facts front packshot candidates', () => {
    const result = productImageQualityEvaluator.evaluate({
      imageUrl:
        'https://images.openfoodfacts.org/images/products/544/900/013/1836/front_en.42.400.jpg',
      source: 'Open Food Facts',
      dataStatus: 'community'
    });

    expect(result).toMatchObject({
      status: 'usable_primary',
      usableAsPrimary: true,
      reasons: ['open_food_facts_front_image']
    });
  });

  it('uses approved user-submission front photos as primary community images', () => {
    const result = productImageQualityEvaluator.evaluate({
      imageUrl: '/product-submissions/uploads/front.jpg',
      source: 'user_submission',
      dataStatus: 'community'
    });

    expect(result).toMatchObject({
      status: 'usable_primary',
      usableAsPrimary: true,
      reasons: ['approved_user_submission_front_image']
    });
  });

  it('rejects low-quality community image candidates as primary', () => {
    const result = productImageQualityEvaluator.evaluate({
      imageUrl:
        'https://images.openfoodfacts.org/images/products/544/900/013/1836/ingredients_en.12.200.jpg',
      source: 'Open Food Facts',
      dataStatus: 'community'
    });

    expect(result.usableAsPrimary).toBe(false);
    expect(result.status).toBe('review_needed');
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'not_front_packshot_candidate',
        'insufficient_resolution_hint'
      ])
    );
  });

  it('falls back when no acceptable image exists', () => {
    expect(
      productImageQualityEvaluator.selectPrimaryImageUrl({
        imageUrl:
          'https://images.openfoodfacts.org/images/products/544/900/013/1836/nutrition_en.12.200.jpg',
        source: 'Open Food Facts',
        dataStatus: 'community'
      })
    ).toBeNull();
  });
});
