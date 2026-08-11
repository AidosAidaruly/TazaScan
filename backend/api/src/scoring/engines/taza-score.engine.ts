import { OfficialNutriScoreEngine } from './official-nutri-score.engine';
import {
  beverageEnergyPoints,
  beverageFruitVegetableLegumePoints,
  beverageProteinPoints,
  beverageSugarPoints,
  fatsOilsEnergyPoints,
  fatsOilsSaturatedFatRatioPoints,
  fiberPoints,
  generalEnergyPoints,
  generalFruitVegetableLegumePoints,
  generalProteinPoints,
  generalSugarPoints,
  saltPoints,
  saturatedFatPoints
} from '../rules/official-nutri-score-points';
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

const partialNutritionWeights = {
  energy: 18,
  sugars: 24,
  saturatedFat: 18,
  totalFatFallback: 10,
  salt: 20,
  nonSugarSweeteners: 4,
  fiber: 8,
  protein: 6,
  fruitVegetableLegume: 12
} as const;

const totalPartialNutritionWeight =
  partialNutritionWeights.energy +
  partialNutritionWeights.sugars +
  partialNutritionWeights.saturatedFat +
  partialNutritionWeights.salt +
  partialNutritionWeights.nonSugarSweeteners +
  partialNutritionWeights.fiber +
  partialNutritionWeights.protein +
  partialNutritionWeights.fruitVegetableLegume;

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

type PartialNutritionValue = {
  field: string;
  score: number;
  weight: number;
  reasonCodes: TazaScoreReasonCode[];
};

type ScoreSafeguard = {
  score: number;
  scoreCap: number | null;
  safeguardsApplied: string[];
};

export class TazaScoreEngine {
  constructor(private readonly officialNutriScoreEngine = new OfficialNutriScoreEngine()) {}

  calculate(input: TazaScoreInput): TazaScoreResult {
    const officialNutriScore = this.officialNutriScoreEngine.calculate({
      ...input,
      energyKj: input.energyKj ?? null
    });
    const calculatedAt = new Date().toISOString();

    if (officialNutriScore.status === 'calculated') {
      return this.completeResult(input, officialNutriScore, calculatedAt);
    }

    const nutritionComponent = this.partialNutritionComponent(input, officialNutriScore);
    if (nutritionComponent.status !== 'calculated') {
      return this.incompleteResult(input, officialNutriScore, calculatedAt, nutritionComponent);
    }

    return this.partialResult(input, officialNutriScore, calculatedAt, nutritionComponent);
  }

  private completeResult(
    input: TazaScoreInput,
    officialNutriScore: OfficialNutriScoreResult,
    calculatedAt: string
  ): TazaScoreResult {
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
      usedFields: nutritionComponent.usedFields ?? [],
      nutritionCoverage: nutritionComponent.nutritionCoverage ?? 1,
      missingCriticalFields: [],
      scoreBeforeSafeguard: null,
      scoreCap: null,
      safeguardsApplied: [],
      warnings: officialNutriScore.warnings,
      methodology,
      methodologyVersion,
      calculatedAt
    };
  }

  private partialResult(
    input: TazaScoreInput,
    officialNutriScore: OfficialNutriScoreResult,
    calculatedAt: string,
    nutritionComponent: TazaScoreComponent
  ): TazaScoreResult {
    const ingredientComponent = this.ingredientComponent(input);
    const confidence = this.confidenceComponent(
      input,
      'calculated',
      officialNutriScore.category,
      nutritionComponent.nutritionCoverage ?? 0,
      officialNutriScore.status
    );
    const scoreBeforeSafeguard = this.clamp(
      Math.round(nutritionComponent.score! + ingredientComponent.score!),
      0,
      100
    );
    const missingCriticalFields = this.missingCriticalNegativeFields(
      nutritionComponent.missingFields,
      nutritionComponent.usedFields ?? []
    );
    const safeguard = this.applyPartialScoreSafeguard(
      scoreBeforeSafeguard,
      nutritionComponent.nutritionCoverage ?? 0,
      missingCriticalFields
    );
    const reasonCodes = this.unique([
      ...nutritionComponent.reasonCodes,
      ...ingredientComponent.reasonCodes,
      ...confidence.reasonCodes,
      ...officialNutriScore.reasonCodes,
      ...(missingCriticalFields.length > 0 ? ['MISSING_CRITICAL_NEGATIVE_FIELD' as const] : []),
      ...(safeguard.scoreCap !== null ? ['PARTIAL_SCORE_CAP_APPLIED' as const] : [])
    ]);

    return {
      score: safeguard.score,
      status: 'calculated',
      nutritionComponent,
      ingredientComponent,
      confidence,
      officialNutriScore,
      reasonCodes,
      positiveReasons: this.positiveReasons(officialNutriScore, ingredientComponent, confidence),
      negativeReasons: this.negativeReasons(officialNutriScore, ingredientComponent, confidence),
      missingFields: nutritionComponent.missingFields,
      usedFields: nutritionComponent.usedFields ?? [],
      nutritionCoverage: nutritionComponent.nutritionCoverage ?? 0,
      missingCriticalFields,
      scoreBeforeSafeguard,
      scoreCap: safeguard.scoreCap,
      safeguardsApplied: safeguard.safeguardsApplied,
      warnings: officialNutriScore.warnings,
      methodology,
      methodologyVersion,
      calculatedAt
    };
  }

  private incompleteResult(
    input: TazaScoreInput,
    officialNutriScore: OfficialNutriScoreResult,
    calculatedAt: string,
    nutritionComponent: TazaScoreComponent
  ): TazaScoreResult {
    const missingFields = this.unique([
      ...officialNutriScore.missingFields,
      ...nutritionComponent.missingFields,
      ...(input.ingredients.length === 0 ? ['ingredients'] : [])
    ]);
    const status = officialNutriScore.status;

    return {
      score: null,
      status,
      nutritionComponent,
      ingredientComponent: this.ingredientComponent(input, status),
      confidence: this.confidenceComponent(
        input,
        status,
        officialNutriScore.category,
        nutritionComponent.nutritionCoverage ?? 0,
        officialNutriScore.status
      ),
      officialNutriScore,
      reasonCodes: this.unique([
        'MISSING_TAZASCORE_INPUT',
        ...nutritionComponent.reasonCodes,
        ...officialNutriScore.reasonCodes
      ]),
      positiveReasons: [],
      negativeReasons: ['TazaScore cannot be calculated without enough known nutritional evidence.'],
      missingFields,
      usedFields: nutritionComponent.usedFields ?? [],
      nutritionCoverage: nutritionComponent.nutritionCoverage ?? 0,
      missingCriticalFields: this.missingCriticalNegativeFields(
        nutritionComponent.missingFields,
        nutritionComponent.usedFields ?? []
      ),
      scoreBeforeSafeguard: null,
      scoreCap: null,
      safeguardsApplied: [],
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
      missingFields: [],
      usedFields: ['officialNutriScore'],
      nutritionCoverage: 1
    };
  }

  private partialNutritionComponent(
    input: TazaScoreInput,
    officialNutriScore: OfficialNutriScoreResult
  ): TazaScoreComponent {
    const category = officialNutriScore.category;
    if (category === null || officialNutriScore.status === 'requires_review') {
      return this.insufficientPartialNutrition(officialNutriScore.missingFields);
    }

    const values: PartialNutritionValue[] = [];
    const isBeverage = category === 'beverage';
    const energyKj = this.energyKj(input);

    if (energyKj !== null) {
      const energyPoints =
        category === 'fats_oils_nuts_seeds' && input.saturatedFat !== null
          ? fatsOilsEnergyPoints(input.saturatedFat)
          : isBeverage
            ? beverageEnergyPoints(energyKj)
            : generalEnergyPoints(energyKj);
      this.addNegative(values, input.energyKj != null ? 'energyKj' : 'energyKcal', energyPoints, 10, partialNutritionWeights.energy, 'HIGH_ENERGY');
    }

    if (input.sugars !== null) {
      this.addNegative(
        values,
        'sugars',
        isBeverage ? beverageSugarPoints(input.sugars) : generalSugarPoints(input.sugars),
        isBeverage ? 10 : 15,
        partialNutritionWeights.sugars,
        'HIGH_SUGAR'
      );
    }

    if (input.saturatedFat !== null) {
      const saturatedFat =
        category === 'fats_oils_nuts_seeds' && input.fat !== null
          ? fatsOilsSaturatedFatRatioPoints(input.saturatedFat, input.fat)
          : saturatedFatPoints(input.saturatedFat);
      this.addNegative(values, 'saturatedFat', saturatedFat, 10, partialNutritionWeights.saturatedFat, 'HIGH_SATURATED_FAT');
    } else if (input.fat !== null) {
      this.addNegative(values, 'fat', this.totalFatFallbackPoints(input.fat), 10, partialNutritionWeights.totalFatFallback, 'HIGH_SATURATED_FAT');
    }

    if (input.salt !== null) {
      this.addNegative(values, 'salt', saltPoints(input.salt), 20, partialNutritionWeights.salt, 'HIGH_SALT');
    }

    if (isBeverage) {
      const containsNonSugarSweeteners = this.knownSweetenerStatus(input);
      if (containsNonSugarSweeteners !== null) {
        values.push({
          field: 'containsNonSugarSweeteners',
          score: containsNonSugarSweeteners ? 0 : partialNutritionWeights.nonSugarSweeteners,
          weight: partialNutritionWeights.nonSugarSweeteners,
          reasonCodes: containsNonSugarSweeteners ? ['CONTAINS_NON_SUGAR_SWEETENERS'] : []
        });
      }
    }

    if (input.fiber !== null) {
      this.addPositive(values, 'fiber', fiberPoints(input.fiber), 5, partialNutritionWeights.fiber, 'HIGH_FIBER');
    }

    if (input.protein !== null) {
      this.addPositive(
        values,
        'protein',
        isBeverage ? beverageProteinPoints(input.protein) : generalProteinPoints(input.protein),
        7,
        partialNutritionWeights.protein,
        'HIGH_PROTEIN'
      );
    }

    if (
      input.fruitVegetableLegumePercent !== null &&
      input.fruitVegetableLegumePercent !== undefined
    ) {
      this.addPositive(
        values,
        'fruitVegetableLegumePercent',
        isBeverage
          ? beverageFruitVegetableLegumePoints(input.fruitVegetableLegumePercent)
          : generalFruitVegetableLegumePoints(input.fruitVegetableLegumePercent),
        isBeverage ? 6 : 5,
        partialNutritionWeights.fruitVegetableLegume,
        'FRUIT_VEGETABLE_LEGUME_CONTENT'
      );
    }

    const usedFields = values.map(({ field }) => field);
    const missingFields = this.partialMissingFields(input, category, usedFields);
    const usedWeight = values.reduce((sum, value) => sum + value.weight, 0);
    const nutritionCoverage = this.clamp(usedWeight / totalPartialNutritionWeight, 0, 1);

    if (!this.hasMinimumPartialEvidence(usedFields, nutritionCoverage)) {
      return {
        score: null,
        maxScore: nutritionMaxScore,
        status: 'insufficient_data',
        reasonCodes: ['MISSING_TAZASCORE_INPUT', 'LOW_NUTRITION_COVERAGE'],
        missingFields,
        usedFields,
        nutritionCoverage
      };
    }

    const rawPartialPoints = values.reduce((sum, value) => sum + value.score, 0);
    const score = Math.round((rawPartialPoints / usedWeight) * nutritionMaxScore);
    const reasonCodes = this.unique<TazaScoreReasonCode>([
      'PARTIAL_NUTRITION_FOUNDATION',
      ...(nutritionCoverage < 0.75 ? ['PARTIAL_DATA_CONFIDENCE_LIMIT' as const] : []),
      ...values.flatMap((value) => value.reasonCodes)
    ]);

    if (!usedFields.includes('fiber') || !usedFields.includes('fruitVegetableLegumePercent')) {
      reasonCodes.push('LOW_FAVORABLE_NUTRITIONAL_COMPONENTS');
    }

    return {
      score: this.clamp(score, 0, nutritionMaxScore),
      maxScore: nutritionMaxScore,
      status: 'calculated',
      reasonCodes,
      missingFields,
      usedFields,
      nutritionCoverage
    };
  }

  private addNegative(
    values: PartialNutritionValue[],
    field: string,
    points: number,
    maxPoints: number,
    weight: number,
    highReason: TazaScoreReasonCode
  ) {
    values.push({
      field,
      score: weight * (1 - this.clamp(points / maxPoints, 0, 1)),
      weight,
      reasonCodes: points >= Math.ceil(maxPoints / 2) ? [highReason] : []
    });
  }

  private addPositive(
    values: PartialNutritionValue[],
    field: string,
    points: number,
    maxPoints: number,
    weight: number,
    highReason: TazaScoreReasonCode
  ) {
    values.push({
      field,
      score: weight * this.clamp(points / maxPoints, 0, 1),
      weight,
      reasonCodes: points >= Math.ceil(maxPoints / 2) ? [highReason] : []
    });
  }

  private insufficientPartialNutrition(missingFields: string[]): TazaScoreComponent {
    return {
      score: null,
      maxScore: nutritionMaxScore,
      status: 'insufficient_data',
      reasonCodes: ['MISSING_TAZASCORE_INPUT'],
      missingFields,
      usedFields: [],
      nutritionCoverage: 0
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
    officialCategory: OfficialNutriScoreCategory | null = null,
    nutritionCoverage = 1,
    officialStatus: OfficialNutriScoreResult['status'] = 'calculated'
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

    if (officialStatus !== 'calculated') {
      confidencePoints -= 2;
      reasonCodes.push('PARTIAL_DATA_CONFIDENCE_LIMIT');
    }

    if (nutritionCoverage < 0.55) {
      confidencePoints -= 3;
      reasonCodes.push('LOW_NUTRITION_COVERAGE');
    } else if (nutritionCoverage < 0.75) {
      confidencePoints -= 2;
      reasonCodes.push('LOW_NUTRITION_COVERAGE');
    }

    confidencePoints = this.clamp(confidencePoints, 0, 10);

    return {
      score: null,
      maxScore: 0,
      status,
      reasonCodes: this.unique(reasonCodes),
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
      confidence.reasonCodes.includes('PARTIAL_DATA_CONFIDENCE_LIMIT')
        ? 'TazaScore was calculated from partial product data.'
        : null,
      confidence.reasonCodes.includes('LOW_NUTRITION_COVERAGE')
        ? 'Nutrition coverage is limited.'
        : null,
      confidence.level !== 'high' &&
      officialNutriScore.status !== 'calculated'
        ? 'Important missing data may limit the maximum displayed TazaScore.'
        : null,
      confidence.level === 'low'
        ? 'Product data confidence is low.'
        : null
    ].filter((reason): reason is string => reason !== null);
  }

  private energyKj(input: TazaScoreInput) {
    if (input.energyKj !== null && input.energyKj !== undefined) return input.energyKj;
    if (input.energyKcal !== null) return input.energyKcal * 4.184;
    return null;
  }

  private knownSweetenerStatus(input: TazaScoreInput) {
    if (input.containsNonSugarSweeteners === true) return true;
    if (input.containsNonSugarSweeteners === false) return false;
    return this.detectedSweeteners(input.ingredients);
  }

  private detectedSweeteners(ingredients: string[]) {
    const text = ingredients.join(' ').toLowerCase();
    if (/(aspartame|acesulfame|sucralose|saccharin|stevia|cyclamate|аспартам|ацесульфам|сукралоз|сахарин|стеви)/i.test(text)) {
      return true;
    }

    return null;
  }

  private totalFatFallbackPoints(fat: number) {
    return this.clamp(
      [3, 10, 17, 24, 31, 38, 45, 52, 59, 66].reduce(
        (points, threshold) => (fat > threshold ? points + 1 : points),
        0
      ),
      0,
      10
    );
  }

  private partialMissingFields(
    input: TazaScoreInput,
    category: OfficialNutriScoreCategory,
    usedFields: string[]
  ) {
    const fields = [
      input.energyKcal === null && (input.energyKj === null || input.energyKj === undefined) ? 'energyKcalOrEnergyKj' : null,
      input.sugars === null ? 'sugars' : null,
      input.saturatedFat === null ? 'saturatedFat' : null,
      input.salt === null ? 'salt' : null,
      input.fiber === null ? 'fiber' : null,
      input.protein === null ? 'protein' : null,
      input.fruitVegetableLegumePercent === null || input.fruitVegetableLegumePercent === undefined
        ? 'fruitVegetableLegumePercent'
        : null,
      category === 'fats_oils_nuts_seeds' && input.fat === null ? 'fat' : null,
      category === 'beverage' &&
      (input.containsNonSugarSweeteners === null || input.containsNonSugarSweeteners === undefined) &&
      !usedFields.includes('containsNonSugarSweeteners')
        ? 'containsNonSugarSweeteners'
        : null
    ].filter((field): field is string => field !== null);

    return this.unique(fields);
  }

  private missingCriticalNegativeFields(missingFields: string[], usedFields: string[]) {
    return [
      missingFields.includes('sugars') ? 'sugars' : null,
      missingFields.includes('salt') ? 'salt' : null,
      missingFields.includes('saturatedFat') && !usedFields.includes('fat') ? 'saturatedFat' : null,
      missingFields.includes('saturatedFat') && usedFields.includes('fat') ? 'saturatedFatApproximation' : null
    ].filter((field): field is string => field !== null);
  }

  private applyPartialScoreSafeguard(
    score: number,
    nutritionCoverage: number,
    missingCriticalFields: string[]
  ): ScoreSafeguard {
    const coverageCap = this.partialCoverageCap(nutritionCoverage);
    const criticalPenalty = missingCriticalFields.reduce((penalty, field) => {
      if (field === 'sugars') return penalty + 12;
      if (field === 'salt') return penalty + 10;
      if (field === 'saturatedFat') return penalty + 10;
      if (field === 'saturatedFatApproximation') return penalty + 5;
      return penalty;
    }, 0);
    const cap = this.clamp(coverageCap - criticalPenalty, 25, 100);
    const cappedScore = Math.min(score, cap);
    const safeguardsApplied = [
      nutritionCoverage < 0.85 ? 'coverage_cap' : null,
      criticalPenalty > 0 ? 'missing_critical_negative_cap' : null
    ].filter((item): item is string => item !== null);

    return {
      score: cappedScore,
      scoreCap: cappedScore < score ? cap : null,
      safeguardsApplied: cappedScore < score ? safeguardsApplied : []
    };
  }

  private partialCoverageCap(nutritionCoverage: number) {
    if (nutritionCoverage >= 0.85) return 100;
    if (nutritionCoverage >= 0.75) return 90;
    if (nutritionCoverage >= 0.55) return 78;
    if (nutritionCoverage >= 0.35) return 65;
    return 55;
  }

  private hasMinimumPartialEvidence(usedFields: string[], nutritionCoverage: number) {
    const knownCoreFields = usedFields.filter((field) =>
      ['energyKcal', 'energyKj', 'sugars', 'saturatedFat', 'fat', 'salt', 'protein', 'fiber'].includes(field)
    );
    const knownNegativeFields = usedFields.filter((field) =>
      ['energyKcal', 'energyKj', 'sugars', 'saturatedFat', 'fat', 'salt'].includes(field)
    );

    return (
      nutritionCoverage >= 0.25 &&
      knownCoreFields.length >= 3 &&
      knownNegativeFields.length >= 2
    );
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
