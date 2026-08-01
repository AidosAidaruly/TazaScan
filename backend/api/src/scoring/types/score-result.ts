export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'E';
export type ScoreStatus = 'calculated' | 'insufficient_data' | 'requires_review';

export type ScoreInput = {
  servingType: 'per100g' | 'per100ml';
  energyKcal: number | null;
  protein: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  fat: number | null;
  saturatedFat: number | null;
  fiber: number | null;
  salt: number | null;
  category: string;
  ingredients: string[];
};

export type ScoreResult = {
  score: number | null;
  grade: ScoreGrade | null;
  status: ScoreStatus;
  positiveReasons: string[];
  negativeReasons: string[];
  warnings: string[];
  missingFields: string[];
  algorithm: string;
  algorithmVersion: string;
  calculatedAt: string;
};
