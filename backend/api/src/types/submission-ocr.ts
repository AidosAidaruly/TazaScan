export type OcrCandidateConfidence = 'detected' | 'not_detected';

export type OcrNumericFieldCandidate = {
  value: number | null;
  confidence: OcrCandidateConfidence;
};

export type SubmissionNutritionOcrCandidate = {
  nutrition: {
    energyKcal: OcrNumericFieldCandidate;
    protein: OcrNumericFieldCandidate;
    carbohydrates: OcrNumericFieldCandidate;
    sugars: OcrNumericFieldCandidate;
    fat: OcrNumericFieldCandidate;
    saturatedFat: OcrNumericFieldCandidate;
    fiber: OcrNumericFieldCandidate;
    salt: OcrNumericFieldCandidate;
  };
  detectedBasis: 'per100g' | 'per100ml' | 'serving' | 'unknown';
  rawText: string;
  warnings: string[];
};

export type SubmissionIngredientsOcrCandidate = {
  ingredientsText: {
    value: string | null;
    confidence: OcrCandidateConfidence;
    detectedLanguage: 'ru' | 'kk' | 'en' | 'unknown';
  };
  rawText: string;
  warnings: string[];
};
