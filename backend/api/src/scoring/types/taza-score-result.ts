import type {
  OfficialNutriScoreInput,
  OfficialNutriScoreReasonCode,
  OfficialNutriScoreResult
} from './official-nutri-score-result';

export type TazaScoreStatus = 'calculated' | 'insufficient_data' | 'requires_review';
export type TazaScoreDataStatus = 'unverified' | 'community' | 'verified';
export type TazaScoreConfidenceLevel = 'high' | 'medium' | 'low';

export type TazaScoreReasonCode =
  | OfficialNutriScoreReasonCode
  | 'OFFICIAL_NUTRI_SCORE_FOUNDATION'
  | 'PARTIAL_NUTRITION_FOUNDATION'
  | 'LOW_FAVORABLE_NUTRITIONAL_COMPONENTS'
  | 'CONSERVATIVE_ADDITIVE_ASSESSMENT'
  | 'UNKNOWN_INGREDIENTS'
  | 'UNKNOWN_SWEETENER_STATUS'
  | 'VERIFIED_PRODUCT_DATA'
  | 'COMMUNITY_PRODUCT_DATA'
  | 'UNVERIFIED_PRODUCT_DATA'
  | 'MISSING_TAZASCORE_INPUT'
  | 'PARTIAL_DATA_CONFIDENCE_LIMIT'
  | 'LOW_NUTRITION_COVERAGE'
  | 'MISSING_CRITICAL_NEGATIVE_FIELD'
  | 'PARTIAL_SCORE_CAP_APPLIED';

export type TazaScoreInput = OfficialNutriScoreInput & {
  dataStatus?: TazaScoreDataStatus;
};

export type TazaScoreComponent = {
  score: number | null;
  maxScore: number;
  status: TazaScoreStatus;
  reasonCodes: TazaScoreReasonCode[];
  missingFields: string[];
  usedFields?: string[];
  nutritionCoverage?: number;
};

export type TazaScoreIngredientComponent = TazaScoreComponent & {
  additiveCount: number | null;
  knownRiskPenalty: number;
};

export type TazaScoreConfidenceComponent = TazaScoreComponent & {
  level: TazaScoreConfidenceLevel;
  dataStatus: TazaScoreDataStatus | null;
};

export type TazaScoreResult = {
  score: number | null;
  status: TazaScoreStatus;
  nutritionComponent: TazaScoreComponent;
  ingredientComponent: TazaScoreIngredientComponent;
  confidence: TazaScoreConfidenceComponent;
  officialNutriScore: OfficialNutriScoreResult;
  reasonCodes: TazaScoreReasonCode[];
  positiveReasons: string[];
  negativeReasons: string[];
  missingFields: string[];
  usedFields: string[];
  nutritionCoverage: number;
  missingCriticalFields: string[];
  scoreBeforeSafeguard: number | null;
  scoreCap: number | null;
  safeguardsApplied: string[];
  warnings: string[];
  methodology: 'TazaScore';
  methodologyVersion: 'taza-score-v1';
  calculatedAt: string;
};
