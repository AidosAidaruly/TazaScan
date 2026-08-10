import type { Product } from '../generated/prisma/client';
import type { OfficialNutriScoreResult } from '../scoring/types/official-nutri-score-result';
import type { ScoreResult } from '../scoring/types/score-result';
import type { TazaScoreResult } from '../scoring/types/taza-score-result';

export type NutritionFactsDto = {
  servingType: Product['servingType'];
  energyKcal: number | null;
  protein: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  fat: number | null;
  saturatedFat: number | null;
  fiber: number | null;
  salt: number | null;
};

export type ProductDto = {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  category: string;
  ingredients: string[];
  nutritionFacts: NutritionFactsDto;
  healthScore: number;
  nutritionScore: ScoreResult;
  manualScoreOverride: number | null;
  manualOverrideReason: string | null;
  manualOverrideAt: string | null;
  officialNutriScoreCategory: Product['officialNutriScoreCategory'];
  fruitVegetableLegumePercent: number | null;
  containsNonSugarSweeteners: boolean | null;
  imageUrl: string | null;
  dataStatus: Product['dataStatus'];
  source: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfficialNutriScorePreviewDto = OfficialNutriScoreResult;

export type ProductScorePreviewDto = {
  tazaScore: TazaScoreResult;
  nutriScore: OfficialNutriScoreResult;
};

export function toProductDto(product: Product): ProductDto {
  const nutritionScore = readScoreResult(product);

  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    category: product.category,
    ingredients: product.ingredients,
    nutritionFacts: {
      servingType: product.servingType,
      energyKcal: product.energyKcal,
      protein: product.protein,
      carbohydrates: product.carbohydrates,
      sugars: product.sugars,
      fat: product.fat,
      saturatedFat: product.saturatedFat,
      fiber: product.fiber,
      salt: product.salt
    },
    healthScore: product.healthScore,
    nutritionScore,
    manualScoreOverride: product.manualScoreOverride,
    manualOverrideReason: product.manualOverrideReason,
    manualOverrideAt: product.manualOverrideAt?.toISOString() ?? null,
    officialNutriScoreCategory: product.officialNutriScoreCategory,
    fruitVegetableLegumePercent: product.fruitVegetableLegumePercent,
    containsNonSugarSweeteners: product.containsNonSugarSweeteners,
    imageUrl: product.imageUrl,
    dataStatus: product.dataStatus,
    source: product.source,
    lastVerifiedAt: product.lastVerifiedAt?.toISOString() ?? null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  };
}

function readScoreResult(product: Product): ScoreResult {
  if (isScoreResult(product.scoreDetails)) {
    return product.scoreDetails;
  }

  return {
    score: product.calculatedScore,
    grade: product.calculatedGrade,
    status: product.scoreStatus,
    positiveReasons: [],
    negativeReasons: [],
    warnings: [],
    missingFields: [],
    algorithm: product.scoreAlgorithm ?? 'unknown',
    algorithmVersion: product.scoreVersion ?? 'unknown',
    calculatedAt: product.scoreCalculatedAt?.toISOString() ?? product.updatedAt.toISOString()
  };
}

function isScoreResult(value: unknown): value is ScoreResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'algorithm' in value &&
    'algorithmVersion' in value
  );
}
