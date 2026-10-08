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

  it('uses the product-scoped copy of an approved user-submission photo as primary', () => {
    const result = productImageQualityEvaluator.evaluate({
      imageUrl: '/uploads/products/copied-front.jpg',
      source: 'user_submission',
      dataStatus: 'community'
    });

    expect(result).toMatchObject({
      status: 'usable_primary',
      usableAsPrimary: true
    });
  });

  it.each(['community', 'verified'] as const)(
    'never exposes admin-only submission evidence URLs publicly (%s)',
    (dataStatus) => {
      const input = {
        imageUrl: '/product-submissions/uploads/front.jpg',
        source: 'user_submission',
        dataStatus
      };

      expect(productImageQualityEvaluator.evaluate(input)).toMatchObject({
        status: 'unsuitable',
        usableAsPrimary: false,
        reasons: ['admin_only_submission_image']
      });
      expect(productImageQualityEvaluator.selectPrimaryImageUrl(input)).toBeNull();
    }
  );

  it('keeps the existing manual-upload rule for product images', () => {
    expect(
      productImageQualityEvaluator.selectPrimaryImageUrl({
        imageUrl: '/uploads/products/manual.jpg',
        source: 'test',
        dataStatus: 'unverified'
      })
    ).toBe('/uploads/products/manual.jpg');
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
