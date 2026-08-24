export type HalalCheckStatus =
  | 'halal_confirmed'
  | 'screening_clear'
  | 'non_halal'
  | 'review_required'
  | 'insufficient_data';

export type HalalIngredientScreeningStatus =
  | 'clear'
  | 'review_required'
  | 'non_halal_detected'
  | 'insufficient_data';

export type HalalReasonCode =
  | 'PORK_DETECTED'
  | 'PORK_FAT_DETECTED'
  | 'PORCINE_GELATIN_DETECTED'
  | 'GELATIN_SOURCE_UNKNOWN'
  | 'CARMINE_E120_DETECTED'
  | 'ALCOHOL_DETECTED'
  | 'ALCOHOL_BASED_FLAVOURING_DETECTED'
  | 'ANIMAL_RENNET_SOURCE_UNKNOWN'
  | 'ANIMAL_ENZYMES_SOURCE_UNKNOWN'
  | 'E471_SOURCE_UNKNOWN'
  | 'E472_SOURCE_UNKNOWN'
  | 'ANIMAL_FAT_SOURCE_UNKNOWN'
  | 'BLOOD_DETECTED'
  | 'INGREDIENTS_MISSING'
  | 'CERTIFICATION_VERIFIED'
  | 'CERTIFICATION_UNVERIFIED'
  | 'CERTIFICATION_EXPIRED'
  | 'CERTIFICATION_CONFLICT'
  | 'NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED';

export type HalalRuleSeverity = 'non_halal' | 'review_required' | 'informational';

export type HalalIngredientRule = {
  id: string;
  aliases: string[];
  severity: HalalRuleSeverity;
  reasonCode: HalalReasonCode;
  category?: string;
  sourceDependency?: 'explicit_prohibited' | 'source_dependent' | 'none';
  consumerReasonKey?: string;
  explanationKey?: string;
  notes?: string;
  excludedAliases?: string[];
};

export type HalalCertificationInput = {
  status: 'verified' | 'unverified' | 'expired';
  issuer: string;
  certificateNumber?: string | null;
  validUntil?: Date | string | null;
  source?: string | null;
  evidenceUrl?: string | null;
  verifiedAt?: Date | string | null;
};

export type HalalIngredientSource = {
  kind:
    | 'original'
    | 'source_russian'
    | 'ocr_confirmed'
    | 'ingredient_list'
    | 'generated_translation';
  text: string;
  authoritative: boolean;
};

export type HalalCheckInput = {
  ingredients: string[];
  ingredientsTextOriginal?: string | null;
  ingredientsTextOriginalLanguage?: string | null;
  ingredientsTextRu?: string | null;
  ingredientsTextTranslatedRu?: string | null;
  ingredientsTranslationSource?: string | null;
  certifications?: HalalCertificationInput[];
};

export type HalalMatchedSignal = {
  ruleId: string;
  reasonCode: HalalReasonCode;
  severity: HalalRuleSeverity;
  matchedText: string;
  sourceKind: HalalIngredientSource['kind'];
};

export type HalalCertificationSummary = {
  status: HalalCertificationInput['status'];
  issuer: string;
  certificateNumber: string | null;
  validUntil: string | null;
  source: string | null;
  evidenceUrl: string | null;
  verifiedAt: string | null;
};

export type HalalCheckResult = {
  status: HalalCheckStatus;
  reasons: HalalReasonCode[];
  matchedSignals: HalalMatchedSignal[];
  ingredientScreening: {
    status: HalalIngredientScreeningStatus;
    reasons: HalalReasonCode[];
    matchedSignals: HalalMatchedSignal[];
  };
  certification: {
    status: 'verified' | 'not_verified' | 'expired' | 'conflict' | 'unknown';
    records: HalalCertificationSummary[];
  };
  dataCoverage: {
    ingredientsAvailable: boolean;
    authoritativeIngredientSource: boolean;
    generatedTranslationUsedOnlyAsAssistance: boolean;
  };
  methodology: 'halal-check-v1.2';
};
