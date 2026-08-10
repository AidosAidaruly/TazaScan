import {
  beverageEnergyPoints,
  beverageFruitVegetableLegumePoints,
  beverageProteinPoints,
  beverageSugarPoints,
  fatsOilsSaturatedFatRatioPoints,
  fatsOilsEnergyPoints,
  fiberPoints,
  generalEnergyPoints,
  generalFruitVegetableLegumePoints,
  generalProteinPoints,
  generalSugarPoints,
  gradeOfficialNutriScore,
  saltPoints,
  saturatedFatPoints
} from '../rules/official-nutri-score-points';
import type {
  OfficialNutriScoreCategory,
  OfficialNutriScoreComponentPoints,
  OfficialNutriScoreInput,
  OfficialNutriScoreReasonCode,
  OfficialNutriScoreResult
} from '../types/official-nutri-score-result';
import { detectNonSugarSweeteners } from '../utils/non-sugar-sweeteners';
import { classifyOfficialNutriScoreCategory } from '../utils/official-nutri-score-category';

export class OfficialNutriScoreEngine {
  private readonly algorithm = 'Nutri-Score';
  private readonly algorithmVersion = 'nutri-score-v2-2023';

  calculate(input: OfficialNutriScoreInput): OfficialNutriScoreResult {
    const calculatedAt = new Date().toISOString();
    const category = classifyOfficialNutriScoreCategory(input.category, input.legacyCategoryLabel);
    const warnings = this.findWarnings(input);

    if (warnings.length > 0) {
      return this.result(null, null, 'requires_review', category, null, ['MISSING_OFFICIAL_INPUT'], [], warnings, calculatedAt);
    }

    if (category === 'water') {
      return this.result(
        0,
        'A',
        'calculated',
        category,
        this.emptyComponents(),
        ['PLAIN_WATER_SPECIAL_CASE'],
        [],
        warnings,
        calculatedAt
      );
    }

    const missingFields = this.findMissingFields(input, category);
    if (missingFields.length > 0 || category === null) {
      return this.result(
        null,
        null,
        'insufficient_data',
        category,
        null,
        ['MISSING_OFFICIAL_INPUT'],
        category === null ? ['officialNutriScoreCategory', ...missingFields] : missingFields,
        warnings,
        calculatedAt
      );
    }

    const componentPoints = this.componentPoints(input, category);
    const rawScore = componentPoints.negativeTotal - componentPoints.positiveTotal;
    const grade = gradeOfficialNutriScore(category, rawScore);
    const reasonCodes = this.reasonCodes(input, componentPoints, category);

    return this.result(
      rawScore,
      grade,
      'calculated',
      category,
      componentPoints,
      reasonCodes,
      [],
      warnings,
      calculatedAt
    );
  }

  private componentPoints(
    input: OfficialNutriScoreInput,
    category: OfficialNutriScoreCategory
  ): OfficialNutriScoreComponentPoints {
    const energyKj = this.energyKj(input);
    const containsNonSugarSweeteners = this.containsNonSugarSweeteners(input);
    const isBeverage = category === 'beverage';
    const energy =
      category === 'fats_oils_nuts_seeds'
        ? fatsOilsEnergyPoints(input.saturatedFat!)
        : isBeverage
          ? beverageEnergyPoints(energyKj)
          : generalEnergyPoints(energyKj);
    const sugars = isBeverage ? beverageSugarPoints(input.sugars!) : generalSugarPoints(input.sugars!);
    const saturatedFat =
      category === 'fats_oils_nuts_seeds'
        ? fatsOilsSaturatedFatRatioPoints(input.saturatedFat!, input.fat!)
        : saturatedFatPoints(input.saturatedFat!);
    const salt = saltPoints(input.salt!);
    const nonSugarSweeteners = isBeverage && containsNonSugarSweeteners ? 4 : 0;
    const fruitVegetableLegume = isBeverage
      ? beverageFruitVegetableLegumePoints(input.fruitVegetableLegumePercent!)
      : generalFruitVegetableLegumePoints(input.fruitVegetableLegumePercent!);
    const fiber = fiberPoints(input.fiber!);
    const rawProtein = isBeverage ? beverageProteinPoints(input.protein!) : generalProteinPoints(input.protein!);
    const protein = category === 'red_meat' ? Math.min(rawProtein, 2) : rawProtein;
    const negativeTotal = energy + sugars + saturatedFat + salt + nonSugarSweeteners;
    const countProtein =
      isBeverage ||
      category === 'cheese' ||
      category === 'fats_oils_nuts_seeds' ||
      negativeTotal < 7 ||
      fruitVegetableLegume === 5;
    const positiveTotal = fruitVegetableLegume + fiber + (countProtein ? protein : 0);

    return {
      energy,
      sugars,
      saturatedFat,
      salt,
      nonSugarSweeteners,
      fruitVegetableLegume,
      fiber,
      protein: countProtein ? protein : 0,
      negativeTotal,
      positiveTotal
    };
  }

  private findMissingFields(input: OfficialNutriScoreInput, category: OfficialNutriScoreCategory | null) {
    const fields: string[] = [];
    if (category === null) return fields;
    if (input.energyKcal === null && input.energyKj === null) fields.push('energyKcalOrEnergyKj');
    if (input.sugars === null) fields.push('sugars');
    if (input.saturatedFat === null) fields.push('saturatedFat');
    if (input.salt === null) fields.push('salt');
    if (input.fiber === null) fields.push('fiber');
    if (input.protein === null) fields.push('protein');
    if (input.fruitVegetableLegumePercent === null || input.fruitVegetableLegumePercent === undefined) {
      fields.push('fruitVegetableLegumePercent');
    }
    if (category === 'fats_oils_nuts_seeds' && input.fat === null) fields.push('fat');

    return fields;
  }

  private findWarnings(input: OfficialNutriScoreInput) {
    const warnings: string[] = [];
    for (const field of ['energyKcal', 'energyKj', 'protein', 'carbohydrates', 'sugars', 'fat', 'saturatedFat', 'fiber', 'salt'] as const) {
      const value = input[field];
      if (typeof value === 'number' && value < 0) warnings.push(`${field} cannot be negative.`);
    }
    if (input.carbohydrates !== null && input.sugars !== null && input.sugars > input.carbohydrates) {
      warnings.push('Sugars cannot be greater than carbohydrates.');
    }
    if (input.fat !== null && input.saturatedFat !== null && input.saturatedFat > input.fat) {
      warnings.push('Saturated fat cannot be greater than total fat.');
    }
    const fvl = input.fruitVegetableLegumePercent;
    if (typeof fvl === 'number' && (fvl < 0 || fvl > 100)) {
      warnings.push('fruitVegetableLegumePercent must be between 0 and 100.');
    }
    return warnings;
  }

  private reasonCodes(
    input: OfficialNutriScoreInput,
    componentPoints: OfficialNutriScoreComponentPoints,
    category: OfficialNutriScoreCategory
  ): OfficialNutriScoreReasonCode[] {
    return [
      componentPoints.energy >= 5 ? 'HIGH_ENERGY' : null,
      componentPoints.sugars >= (category === 'beverage' ? 5 : 7) ? 'HIGH_SUGAR' : null,
      componentPoints.salt >= 5 ? 'HIGH_SALT' : null,
      componentPoints.saturatedFat >= 5 ? 'HIGH_SATURATED_FAT' : null,
      componentPoints.nonSugarSweeteners > 0 ? 'CONTAINS_NON_SUGAR_SWEETENERS' : null,
      componentPoints.fiber >= 3 ? 'HIGH_FIBER' : null,
      componentPoints.protein >= 3 ? 'HIGH_PROTEIN' : null,
      input.fruitVegetableLegumePercent !== null &&
      input.fruitVegetableLegumePercent !== undefined &&
      input.fruitVegetableLegumePercent > 40
        ? 'FRUIT_VEGETABLE_LEGUME_CONTENT'
        : null
    ].filter((reason): reason is OfficialNutriScoreReasonCode => reason !== null);
  }

  private energyKj(input: OfficialNutriScoreInput) {
    return input.energyKj ?? input.energyKcal! * 4.184;
  }

  private containsNonSugarSweeteners(input: OfficialNutriScoreInput) {
    return input.containsNonSugarSweeteners ?? detectNonSugarSweeteners(input.ingredients);
  }

  private emptyComponents(): OfficialNutriScoreComponentPoints {
    return {
      energy: 0,
      sugars: 0,
      saturatedFat: 0,
      salt: 0,
      nonSugarSweeteners: 0,
      fruitVegetableLegume: 0,
      fiber: 0,
      protein: 0,
      negativeTotal: 0,
      positiveTotal: 0
    };
  }

  private result(
    rawScore: number | null,
    grade: OfficialNutriScoreResult['grade'],
    status: OfficialNutriScoreResult['status'],
    category: OfficialNutriScoreCategory | null,
    componentPoints: OfficialNutriScoreComponentPoints | null,
    reasonCodes: OfficialNutriScoreReasonCode[],
    missingFields: string[],
    warnings: string[],
    calculatedAt: string
  ): OfficialNutriScoreResult {
    return {
      rawScore,
      grade,
      status,
      reasonCodes,
      missingFields,
      warnings,
      algorithm: this.algorithm,
      algorithmVersion: this.algorithmVersion,
      category,
      componentPoints,
      calculatedAt
    };
  }
}
