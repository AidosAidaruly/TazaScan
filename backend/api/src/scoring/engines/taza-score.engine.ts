import { OfficialNutriScoreEngine } from './official-nutri-score.engine';
import type {
  OfficialNutriScoreCategory,
  OfficialNutriScoreGrade,
  OfficialNutriScoreResult
} from '../types/official-nutri-score-result';
import type {
  TazaScoreComponent,
  TazaScoreConfidenceComponent,
  TazaScoreIngredientComponent,
  TazaScoreInput,
  TazaScoreReasonCode,
  TazaScoreResult
} from '../types/taza-score-result';

const methodology = 'TazaScore';
const methodologyVersion = 'taza-score-v1';
const nutritionMaxScore = 90;
const ingredientMaxScore = 10;

type NutritionScoreBand = {
  rawMin: number;
  rawMax: number;
  pointsMin: number;
  pointsMax: number;
};

const nutritionPointBands: Record<
  OfficialNutriScoreGrade,
  Pick<NutritionScoreBand, 'pointsMin' | 'pointsMax'>
> = {
  A: { pointsMin: 76, pointsMax: 90 },
  B: { pointsMin: 63, pointsMax: 75 },
  C: { pointsMin: 45, pointsMax: 62 },
  D: { pointsMin: 25, pointsMax: 44 },
  E: { pointsMin: 0, pointsMax: 24 }
};

export class TazaScoreEngine {
  constructor(private readonly officialNutriScoreEngine = new OfficialNutriScoreEngine()) {}

  calculate(input: TazaScoreInput): TazaScoreResult {
    const officialNutriScore = this.officialNutriScoreEngine.calculate({
      ...input,
      energyKj: input.energyKj ?? null
    });
    const calculatedAt = new Date().toISOString();

    if (officialNutriScore.status !== 'calculated') {
      return this.incompleteResult(input, officialNutriScore, calculatedAt);
    }

    const nutritionComponent = this.nutritionComponent(officialNutriScore);
    const ingredientComponent = this.ingredientComponent(input);
    const confidence = this.confidenceComponent(
      input,
      'calculated',
      officialNutriScore.category
    );
    const score = nutritionComponent.score! + ingredientComponent.score!;
    const reasonCodes = this.unique([
      ...nutritionComponent.reasonCodes,
      ...ingredientComponent.reasonCodes,
      ...confidence.reasonCodes,
      ...officialNutriScore.reasonCodes
    ]);

    return {
      score: this.clamp(Math.round(score), 0, 100),
      status: 'calculated',
      nutritionComponent,
      ingredientComponent,
      confidence,
      officialNutriScore,
      reasonCodes,
      positiveReasons: this.positiveReasons(officialNutriScore, ingredientComponent, confidence),
      negativeReasons: this.negativeReasons(officialNutriScore, ingredientComponent, confidence),
      missingFields: [],
      warnings: officialNutriScore.warnings,
      methodology,
      methodologyVersion,
      calculatedAt
    };
  }

  private incompleteResult(
    input: TazaScoreInput,
    officialNutriScore: OfficialNutriScoreResult,
    calculatedAt: string
  ): TazaScoreResult {
    const missingFields = this.unique([
      ...officialNutriScore.missingFields,
      ...(input.ingredients.length === 0 ? ['ingredients'] : [])
    ]);
    const status = officialNutriScore.status;

    return {
      score: null,
      status,
      nutritionComponent: {
        score: null,
        maxScore: nutritionMaxScore,
        status,
        reasonCodes: ['MISSING_TAZASCORE_INPUT'],
        missingFields: officialNutriScore.missingFields
      },
      ingredientComponent: this.ingredientComponent(input, status),
      confidence: this.confidenceComponent(input, status, officialNutriScore.category),
      officialNutriScore,
      reasonCodes: this.unique([
        'MISSING_TAZASCORE_INPUT',
        ...officialNutriScore.reasonCodes
      ]),
      positiveReasons: [],
      negativeReasons: ['TazaScore cannot be calculated without complete official nutritional inputs.'],
      missingFields,
      warnings: officialNutriScore.warnings,
      methodology,
      methodologyVersion,
      calculatedAt
    };
  }

  private nutritionComponent(officialNutriScore: OfficialNutriScoreResult): TazaScoreComponent {
    const rawScore = officialNutriScore.rawScore!;
    const category = officialNutriScore.category!;
    const score = this.rawNutritionScoreToPoints(
      rawScore,
      category,
      officialNutriScore.grade!
    );
    const reasonCodes: TazaScoreReasonCode[] = ['OFFICIAL_NUTRI_SCORE_FOUNDATION'];

    if (officialNutriScore.componentPoints?.positiveTotal === 0) {
      reasonCodes.push('LOW_FAVORABLE_NUTRITIONAL_COMPONENTS');
    }

    return {
      score,
      maxScore: nutritionMaxScore,
      status: 'calculated',
      reasonCodes,
      missingFields: []
    };
  }

  private rawNutritionScoreToPoints(
    rawScore: number,
    category: OfficialNutriScoreCategory,
    grade: OfficialNutriScoreGrade
  ) {
    if (category === 'water') return nutritionMaxScore;

    const band = this.nutritionScoreBand(category, grade);
    if (band.rawMin === band.rawMax) return band.pointsMax;

    const position = this.clamp(
      (rawScore - band.rawMin) / (band.rawMax - band.rawMin),
      0,
      1
    );

    return Math.round(
      band.pointsMax - position * (band.pointsMax - band.pointsMin)
    );
  }

  private nutritionScoreBand(
    category: OfficialNutriScoreCategory,
    grade: OfficialNutriScoreGrade
  ): NutritionScoreBand {
    return {
      ...this.rawScoreBand(category, grade),
      ...nutritionPointBands[grade]
    };
  }

  private rawScoreBand(
    category: OfficialNutriScoreCategory,
    grade: OfficialNutriScoreGrade
  ): Pick<NutritionScoreBand, 'rawMin' | 'rawMax'> {
    if (category === 'beverage') {
      if (grade === 'B') return { rawMin: -15, rawMax: 2 };
      if (grade === 'C') return { rawMin: 3, rawMax: 6 };
      if (grade === 'D') return { rawMin: 7, rawMax: 9 };
      return { rawMin: 10, rawMax: 20 };
    }

    if (category === 'fats_oils_nuts_seeds') {
      if (grade === 'A') return { rawMin: -15, rawMax: -6 };
      if (grade === 'B') return { rawMin: -5, rawMax: 2 };
      if (grade === 'C') return { rawMin: 3, rawMax: 10 };
      if (grade === 'D') return { rawMin: 11, rawMax: 18 };
      return { rawMin: 19, rawMax: 40 };
    }

    if (grade === 'A') return { rawMin: -15, rawMax: 0 };
    if (grade === 'B') return { rawMin: 1, rawMax: 2 };
    if (grade === 'C') return { rawMin: 3, rawMax: 10 };
    if (grade === 'D') return { rawMin: 11, rawMax: 18 };
    return { rawMin: 19, rawMax: 40 };
  }

  private ingredientComponent(
    input: TazaScoreInput,
    status: TazaScoreComponent['status'] = 'calculated'
  ): TazaScoreIngredientComponent {
    const hasIngredients = input.ingredients.length > 0;
    const additiveCount = hasIngredients ? this.countAdditives(input.ingredients) : null;
    const reasonCodes: TazaScoreReasonCode[] = ['CONSERVATIVE_ADDITIVE_ASSESSMENT'];

    if (!hasIngredients) {
      reasonCodes.push('UNKNOWN_INGREDIENTS');
    }

    return {
      score: hasIngredients ? ingredientMaxScore : 8,
      maxScore: ingredientMaxScore,
      status,
      reasonCodes,
      missingFields: hasIngredients ? [] : ['ingredients'],
      additiveCount,
      knownRiskPenalty: 0
    };
  }

  private confidenceComponent(
    input: TazaScoreInput,
    status: TazaScoreComponent['status'] = 'calculated',
    officialCategory: OfficialNutriScoreCategory | null = null
  ): TazaScoreConfidenceComponent {
    let confidencePoints = this.dataStatusConfidence(input.dataStatus);
    const reasonCodes: TazaScoreReasonCode[] = [];
    const missingFields: string[] = [];

    if (input.dataStatus === 'verified') reasonCodes.push('VERIFIED_PRODUCT_DATA');
    if (input.dataStatus === 'community') reasonCodes.push('COMMUNITY_PRODUCT_DATA');
    if (input.dataStatus === 'unverified') reasonCodes.push('UNVERIFIED_PRODUCT_DATA');

    if (input.ingredients.length === 0) {
      confidencePoints -= 2;
      missingFields.push('ingredients');
      reasonCodes.push('UNKNOWN_INGREDIENTS');
    }

    if (
      officialCategory === 'beverage' &&
      (input.containsNonSugarSweeteners === null ||
        input.containsNonSugarSweeteners === undefined)
    ) {
      confidencePoints -= 2;
      missingFields.push('containsNonSugarSweeteners');
      reasonCodes.push('UNKNOWN_SWEETENER_STATUS');
    }

    confidencePoints = this.clamp(confidencePoints, 0, 10);

    return {
      score: null,
      maxScore: 0,
      status,
      reasonCodes,
      missingFields,
      level: this.confidenceLevel(confidencePoints),
      dataStatus: input.dataStatus ?? null
    };
  }

  private dataStatusConfidence(dataStatus: TazaScoreInput['dataStatus']) {
    if (dataStatus === 'verified') return 10;
    if (dataStatus === 'community') return 8;
    if (dataStatus === 'unverified') return 6;
    return 8;
  }

  private confidenceLevel(confidencePoints: number) {
    if (confidencePoints >= 9) return 'high';
    if (confidencePoints >= 6) return 'medium';
    return 'low';
  }

  private positiveReasons(
    officialNutriScore: OfficialNutriScoreResult,
    ingredientComponent: TazaScoreIngredientComponent,
    confidence: TazaScoreConfidenceComponent
  ) {
    return [
      officialNutriScore.grade === 'A' || officialNutriScore.grade === 'B'
        ? `Official Nutri-Score foundation is ${officialNutriScore.grade}.`
        : null,
      ingredientComponent.knownRiskPenalty === 0
        ? 'No additive penalty was applied without a structured risk source.'
        : null,
      confidence.level === 'high' ? 'Product data confidence is high.' : null
    ].filter((reason): reason is string => reason !== null);
  }

  private negativeReasons(
    officialNutriScore: OfficialNutriScoreResult,
    ingredientComponent: TazaScoreIngredientComponent,
    confidence: TazaScoreConfidenceComponent
  ) {
    const componentPoints = officialNutriScore.componentPoints;

    return [
      officialNutriScore.reasonCodes.includes('HIGH_SUGAR') ? 'High sugar according to the official nutritional foundation.' : null,
      !officialNutriScore.reasonCodes.includes('HIGH_SUGAR') &&
      componentPoints !== null &&
      componentPoints.sugars >= 3
        ? 'Sugar contributes to the nutritional score.'
        : null,
      officialNutriScore.reasonCodes.includes('HIGH_ENERGY') ? 'High energy density according to the official nutritional foundation.' : null,
      !officialNutriScore.reasonCodes.includes('HIGH_ENERGY') &&
      componentPoints !== null &&
      componentPoints.energy >= 3
        ? 'Energy contributes to the nutritional score.'
        : null,
      officialNutriScore.reasonCodes.includes('HIGH_SALT') ? 'High salt according to the official nutritional foundation.' : null,
      !officialNutriScore.reasonCodes.includes('HIGH_SALT') &&
      componentPoints !== null &&
      componentPoints.salt >= 3
        ? 'Salt contributes to the nutritional score.'
        : null,
      officialNutriScore.reasonCodes.includes('HIGH_SATURATED_FAT') ? 'High saturated fat according to the official nutritional foundation.' : null,
      !officialNutriScore.reasonCodes.includes('HIGH_SATURATED_FAT') &&
      componentPoints !== null &&
      componentPoints.saturatedFat >= 3
        ? 'Saturated fat contributes to the nutritional score.'
        : null,
      officialNutriScore.reasonCodes.includes('CONTAINS_NON_SUGAR_SWEETENERS')
        ? 'Contains non-sugar sweeteners considered by the beverage Nutri-Score method.'
        : null,
      officialNutriScore.componentPoints?.positiveTotal === 0
        ? 'Low favorable nutritional components in the official foundation.'
        : null,
      ingredientComponent.reasonCodes.includes('UNKNOWN_INGREDIENTS')
        ? 'Ingredient information is missing or unknown.'
        : null,
      confidence.reasonCodes.includes('UNKNOWN_SWEETENER_STATUS')
        ? 'Sweetener status is unknown for a beverage.'
        : null,
      confidence.level === 'low'
        ? 'Product data confidence is low.'
        : null
    ].filter((reason): reason is string => reason !== null);
  }

  private countAdditives(ingredients: string[]) {
    return ingredients.reduce((count, ingredient) => {
      const matches = ingredient.match(/\bE\s?\d{3,4}[a-z]?\b/gi);
      return count + (matches?.length ?? 0);
    }, 0);
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  private unique<T>(items: T[]) {
    return [...new Set(items)];
  }
}
