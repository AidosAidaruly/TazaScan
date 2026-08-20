import type { Product } from '../generated/prisma/client';

export type ProductDataQualityStatus = 'ok' | 'review';

export type ProductDataQualityWarningCode =
  | 'MISSING_CRITICAL_NUTRITION'
  | 'SUSPICIOUS_EXTERNAL_ZERO_PATTERN';

export type ProductDataQualityWarning = {
  code: ProductDataQualityWarningCode;
  fields: string[];
  message: string;
};

export type ProductDataQualityResult = {
  status: ProductDataQualityStatus;
  warnings: ProductDataQualityWarning[];
};

export type ProductDataQualityInput = Pick<
  Product,
  | 'source'
  | 'dataStatus'
  | 'officialNutriScoreCategory'
  | 'energyKcal'
  | 'protein'
  | 'carbohydrates'
  | 'sugars'
  | 'fat'
  | 'saturatedFat'
  | 'fiber'
  | 'salt'
>;

const criticalNutritionFields = [
  'energyKcal',
  'sugars',
  'saturatedFat',
  'salt'
] as const satisfies readonly (keyof ProductDataQualityInput)[];

type CriticalNutritionField = (typeof criticalNutritionFields)[number];

export class ProductDataQualityEvaluator {
  evaluate(input: ProductDataQualityInput): ProductDataQualityResult {
    if (!this.shouldReviewExternalData(input)) {
      return this.ok();
    }

    const warnings: ProductDataQualityWarning[] = [];
    const missingCriticalFields = criticalNutritionFields.filter((field) => input[field] === null);

    if (missingCriticalFields.length > 0) {
      warnings.push({
        code: 'MISSING_CRITICAL_NUTRITION',
        fields: [...missingCriticalFields],
        message: 'Important nutrition fields are missing from external or community data.'
      });
    }

    const suspiciousZeroFields = this.suspiciousExternalZeroFields(input);

    if (suspiciousZeroFields.length >= 2) {
      warnings.push({
        code: 'SUSPICIOUS_EXTERNAL_ZERO_PATTERN',
        fields: suspiciousZeroFields,
        message:
          'External product data reports multiple important negative nutrients as explicit zeroes. Review against the package label before trusting the score.'
      });
    }

    return {
      status: warnings.length > 0 ? 'review' : 'ok',
      warnings
    };
  }

  private ok(): ProductDataQualityResult {
    return {
      status: 'ok',
      warnings: []
    };
  }

  private shouldReviewExternalData(input: ProductDataQualityInput) {
    if (input.dataStatus === 'verified') {
      return false;
    }

    return input.dataStatus === 'community' || this.isOpenFoodFactsSource(input.source);
  }

  private isOpenFoodFactsSource(source: string | null) {
    return source?.trim().toLowerCase() === 'open food facts';
  }

  private suspiciousExternalZeroFields(input: ProductDataQualityInput): CriticalNutritionField[] {
    if (input.officialNutriScoreCategory !== 'general_food') {
      return [];
    }

    if (input.energyKcal === null || input.energyKcal < 100) {
      return [];
    }

    const fields: CriticalNutritionField[] = [];

    if (input.sugars === 0 && input.carbohydrates !== null && input.carbohydrates >= 10) {
      fields.push('sugars');
    }

    if (input.saturatedFat === 0 && input.fat !== null && input.fat >= 5) {
      fields.push('saturatedFat');
    }

    if (input.salt === 0 && this.hasMacronutrientDensity(input)) {
      fields.push('salt');
    }

    return fields;
  }

  private hasMacronutrientDensity(input: ProductDataQualityInput) {
    return (
      (input.carbohydrates !== null && input.carbohydrates >= 10) ||
      (input.fat !== null && input.fat >= 5) ||
      (input.protein !== null && input.protein >= 5)
    );
  }
}
