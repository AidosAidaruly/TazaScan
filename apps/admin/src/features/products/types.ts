export type ServingType = 'per100g' | 'per100ml'
export type ProductDataStatus = 'unverified' | 'community' | 'verified'
export type ScoreStatus = 'calculated' | 'insufficient_data' | 'requires_review'
export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'E'
export type OfficialNutriScoreCategory =
  | 'general_food'
  | 'beverage'
  | 'water'
  | 'cheese'
  | 'fats_oils_nuts_seeds'
  | 'red_meat'

export type HalalCheckStatus =
  | 'halal_confirmed'
  | 'screening_clear'
  | 'non_halal'
  | 'review_required'
  | 'insufficient_data'

export type HalalIngredientScreeningStatus =
  | 'clear'
  | 'review_required'
  | 'non_halal_detected'
  | 'insufficient_data'

export type HalalCertificationStatus =
  | 'verified'
  | 'not_verified'
  | 'expired'
  | 'conflict'
  | 'unknown'

export type HalalCertificationRecordStatus =
  | 'verified'
  | 'unverified'
  | 'expired'

export type HalalMatchedSignalDto = {
  ruleId: string
  reasonCode: string
  severity: 'non_halal' | 'review_required' | 'informational'
  matchedText: string
  sourceKind: string
}

export type HalalCertificationRecordDto = {
  status: HalalCertificationRecordStatus
  issuer: string
  certificateNumber: string | null
  validUntil: string | null
  source: string | null
  evidenceUrl: string | null
  verifiedAt: string | null
}

export type HalalCheckDto = {
  status: HalalCheckStatus
  reasons: string[]
  matchedSignals: HalalMatchedSignalDto[]
  ingredientScreening: {
    status: HalalIngredientScreeningStatus
    reasons: string[]
    matchedSignals: HalalMatchedSignalDto[]
  }
  certification: {
    status: HalalCertificationStatus
    records: HalalCertificationRecordDto[]
  }
  dataCoverage: {
    ingredientsAvailable: boolean
    authoritativeIngredientSource: boolean
    generatedTranslationUsedOnlyAsAssistance: boolean
  }
  methodology: 'halal-check-v1.2'
}

export type NutritionFactsDto = {
  servingType: ServingType
  energyKcal: number | null
  protein: number | null
  carbohydrates: number | null
  sugars: number | null
  fat: number | null
  saturatedFat: number | null
  fiber: number | null
  salt: number | null
}

export type ProductDto = {
  id: string
  barcode: string
  name: string
  brand: string | null
  category: string
  ingredients: string[]
  nutritionFacts: NutritionFactsDto
  healthScore: number
  nutritionScore: {
    score: number | null
    grade: ScoreGrade | null
    status: ScoreStatus
    positiveReasons: string[]
    negativeReasons: string[]
    warnings: string[]
    missingFields: string[]
    algorithm: string
    algorithmVersion: string
    calculatedAt: string
  }
  tazaScore: TazaScorePreviewResponse['data'] | null
  halalCheck: HalalCheckDto
  scoreSource: 'product_record' | 'canonical_recipe'
  canonicalFamilyId: string | null
  canonicalProductId: string | null
  manualScoreOverride: number | null
  manualOverrideReason: string | null
  manualOverrideAt: string | null
  officialNutriScoreCategory: OfficialNutriScoreCategory | null
  fruitVegetableLegumePercent: number | null
  containsNonSugarSweeteners: boolean | null
  imageUrl: string | null
  dataStatus: ProductDataStatus
  source: string | null
  lastVerifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ProductListResponse = {
  data: ProductDto[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export type ProductResponse = {
  data: ProductDto
}

export type ProductPayload = {
  barcode: string
  name: string
  brand?: string | null
  category: string
  ingredients: string[]
  nutritionFacts: NutritionFactsDto
  manualScoreOverride?: number | null
  manualOverrideReason?: string | null
  officialNutriScoreCategory?: OfficialNutriScoreCategory | null
  fruitVegetableLegumePercent?: number | null
  containsNonSugarSweeteners?: boolean | null
  imageUrl?: string | null
  dataStatus: ProductDataStatus
  source?: string | null
  lastVerifiedAt?: string | null
}

export type HalalCertificationPayload = {
  status: HalalCertificationRecordStatus
  issuer: string
  certificateNumber?: string | null
  validUntil?: string | null
  source: string
  evidenceUrl?: string | null
  verifiedAt?: string | null
}

export type OfficialNutriScorePreviewResponse = {
  data: {
    rawScore: number | null
    grade: ScoreGrade | null
    status: ScoreStatus
    reasonCodes: string[]
    missingFields: string[]
    warnings: string[]
    algorithm: string
    algorithmVersion: string
    category: OfficialNutriScoreCategory | null
    componentPoints: Record<string, number> | null
    calculatedAt: string
  }
}

export type TazaScorePreviewResponse = {
  data: {
    score: number | null
    status: ScoreStatus
    nutritionComponent: {
      score: number | null
      maxScore: number
      status: ScoreStatus
      reasonCodes: string[]
      missingFields: string[]
      usedFields?: string[]
      nutritionCoverage?: number
    }
    ingredientComponent: {
      score: number | null
      maxScore: number
      status: ScoreStatus
      reasonCodes: string[]
      missingFields: string[]
      usedFields?: string[]
      nutritionCoverage?: number
      additiveCount: number | null
      knownRiskPenalty: number
    }
    confidence: {
      score: null
      maxScore: 0
      status: ScoreStatus
      reasonCodes: string[]
      missingFields: string[]
      usedFields?: string[]
      nutritionCoverage?: number
      level: 'high' | 'medium' | 'low'
      dataStatus: ProductDataStatus | null
    }
    reasonCodes: string[]
    positiveReasons: string[]
    negativeReasons: string[]
    missingFields: string[]
    usedFields: string[]
    nutritionCoverage: number
    missingCriticalFields: string[]
    scoreBeforeSafeguard: number | null
    scoreCap: number | null
    safeguardsApplied: string[]
    warnings: string[]
    methodology: 'TazaScore'
    methodologyVersion: string
    officialNutriScore: {
      status: ScoreStatus
      rawScore: number | null
      grade: ScoreGrade | null
    }
  }
}
