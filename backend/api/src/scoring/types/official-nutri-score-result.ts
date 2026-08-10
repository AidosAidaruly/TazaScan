export type OfficialNutriScoreGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export type OfficialNutriScoreStatus =
  | 'calculated'
  | 'insufficient_data'
  | 'requires_review';

export type OfficialNutriScoreCategory =
  | 'general_food'
  | 'beverage'
  | 'water'
  | 'cheese'
  | 'fats_oils_nuts_seeds'
  | 'red_meat';

export type OfficialNutriScoreReasonCode =
  | 'PLAIN_WATER_SPECIAL_CASE'
  | 'HIGH_ENERGY'
  | 'HIGH_SUGAR'
  | 'HIGH_SALT'
  | 'HIGH_SATURATED_FAT'
  | 'CONTAINS_NON_SUGAR_SWEETENERS'
  | 'HIGH_FIBER'
  | 'HIGH_PROTEIN'
  | 'FRUIT_VEGETABLE_LEGUME_CONTENT'
  | 'MISSING_OFFICIAL_INPUT';

export type OfficialNutriScoreInput = {
  servingType: 'per100g' | 'per100ml';
  category?: OfficialNutriScoreCategory;
  legacyCategoryLabel?: string;
  energyKcal: number | null;
  energyKj?: number | null;
  protein: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  fat: number | null;
  saturatedFat: number | null;
  fiber: number | null;
  salt: number | null;
  fruitVegetableLegumePercent?: number | null;
  containsNonSugarSweeteners?: boolean | null;
  ingredients: string[];
};

export type OfficialNutriScoreComponentPoints = {
  energy: number;
  sugars: number;
  saturatedFat: number;
  salt: number;
  nonSugarSweeteners: number;
  fruitVegetableLegume: number;
  fiber: number;
  protein: number;
  negativeTotal: number;
  positiveTotal: number;
};

export type OfficialNutriScoreResult = {
  rawScore: number | null;
  grade: OfficialNutriScoreGrade | null;
  status: OfficialNutriScoreStatus;
  reasonCodes: OfficialNutriScoreReasonCode[];
  missingFields: string[];
  warnings: string[];
  algorithm: string;
  algorithmVersion: string;
  category: OfficialNutriScoreCategory | null;
  componentPoints: OfficialNutriScoreComponentPoints | null;
  calculatedAt: string;
};
