import type { ScoreEngine } from '../contracts/score-engine';
import { gradeBeverage, gradeFood, pointsFromThresholds } from '../rules/nutri-score-points';
import type { ScoreInput, ScoreResult } from '../types/score-result';
import { findMissingFields, findNutritionWarnings } from '../utils/nutrition-validation';

export class NutriScoreEngine implements ScoreEngine {
  private readonly algorithm = 'Nutri-Score nutritional foundation';
  private readonly algorithmVersion = 'nutri-score-foundation-2025-01';

  calculate(input: ScoreInput): ScoreResult {
    const calculatedAt = new Date().toISOString();
    const warnings = findNutritionWarnings(input);
    const missingFields = findMissingFields(input);

    if (warnings.length > 0) {
      return this.result(null, null, 'requires_review', input, warnings, missingFields, calculatedAt);
    }

    if (missingFields.length > 0) {
      return this.result(null, null, 'insufficient_data', input, warnings, missingFields, calculatedAt);
    }

    const rawScore = this.calculateRawNutriScore(input);
    const score = this.toConsumerScore(rawScore);
    const grade = this.isBeverage(input.category) ? gradeBeverage(rawScore) : gradeFood(rawScore);

    return this.result(score, grade, 'calculated', input, warnings, missingFields, calculatedAt);
  }

  private calculateRawNutriScore(input: ScoreInput): number {
    const energyKj = input.energyKcal! * 4.184;
    const sodiumMg = input.salt! * 400;
    const negativePoints =
      pointsFromThresholds(energyKj, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]) +
      pointsFromThresholds(input.sugars!, [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45]) +
      pointsFromThresholds(input.saturatedFat!, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) +
      pointsFromThresholds(sodiumMg, [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]);
    const fiberPoints = pointsFromThresholds(input.fiber!, [0.7, 1.4, 2.1, 2.8, 3.5]);
    const proteinPoints = pointsFromThresholds(input.protein!, [1.6, 3.2, 4.8, 6.4, 8]);

    return negativePoints >= 11
      ? negativePoints - fiberPoints
      : negativePoints - fiberPoints - proteinPoints;
  }

  private toConsumerScore(rawScore: number) {
    return Math.max(0, Math.min(100, Math.round(100 - ((rawScore + 15) / 55) * 100)));
  }

  private result(
    score: number | null,
    grade: ScoreResult['grade'],
    status: ScoreResult['status'],
    input: ScoreInput,
    warnings: string[],
    missingFields: string[],
    calculatedAt: string
  ): ScoreResult {
    return {
      score,
      grade,
      status,
      positiveReasons: this.positiveReasons(input),
      negativeReasons: this.negativeReasons(input),
      warnings,
      missingFields,
      algorithm: this.algorithm,
      algorithmVersion: this.algorithmVersion,
      calculatedAt
    };
  }

  private positiveReasons(input: ScoreInput): string[] {
    return [
      input.protein !== null && input.protein >= 8 ? 'High protein content.' : null,
      input.fiber !== null && input.fiber >= 3.5 ? 'Good fiber content.' : null,
      input.sugars !== null && input.sugars <= 4.5 ? 'Low sugar content.' : null
    ].filter((reason): reason is string => reason !== null);
  }

  private negativeReasons(input: ScoreInput): string[] {
    return [
      input.sugars !== null && input.sugars > 9 ? 'High sugar content.' : null,
      input.saturatedFat !== null && input.saturatedFat > 2 ? 'Elevated saturated fat.' : null,
      input.salt !== null && input.salt > 0.45 ? 'Elevated salt content.' : null
    ].filter((reason): reason is string => reason !== null);
  }

  private isBeverage(category: string) {
    return /drink|beverage|juice|water|soda|soft/i.test(category);
  }
}
