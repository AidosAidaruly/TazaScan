import type { Product } from '../generated/prisma/client';
import type { ProductDataQualityResult } from '../data-quality/product-data-quality.evaluator';
import { productImageQualityEvaluator } from '../data-quality/product-image-quality.evaluator';
import { HalalCheckEngine } from '../halal/halal-check.engine';
import type { HalalCheckResult } from '../halal/types';
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

/**
 * Full product shape for admin-only responses (product mutations, submission moderation).
 * Public consumer endpoints use `ProductDto`, which omits internal-only metadata.
 */
export type AdminProductDto = {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  category: string;
  ingredients: string[];
  ingredientsTextOriginal: string | null;
  ingredientsTextOriginalLanguage: string | null;
  ingredientsTextRu: string | null;
  ingredientsTextTranslatedRu: string | null;
  ingredientsTranslationSource: string | null;
  ingredientsTranslatedAt: string | null;
  ingredientsIsTranslated: boolean;
  nutritionFacts: NutritionFactsDto;
  healthScore: number;
  nutritionScore: ScoreResult;
  tazaScore: TazaScoreResult | null;
  halalCheck: HalalCheckResult;
  scoreSource: 'product_record' | 'canonical_recipe';
  canonicalFamilyId: string | null;
  canonicalProductId: string | null;
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

/** Admin-only fields that public consumer responses never include. */
const adminOnlyProductFields = ['manualOverrideReason'] as const;

/**
 * Public consumer product shape. `source` stays: the mobile app shows it as the
 * data-provenance label.
 */
export type ProductDto = Omit<AdminProductDto, (typeof adminOnlyProductFields)[number]>;

export type OfficialNutriScorePreviewDto = OfficialNutriScoreResult;

export type ProductScorePreviewDto = {
  tazaScore: TazaScoreResult;
  nutriScore: OfficialNutriScoreResult;
  dataQuality: ProductDataQualityResult;
};

export type ProductWithCanonicalFamily = Product & {
  canonicalProductFamily?: {
    id: string;
    canonicalProductId: string;
    canonicalProduct: Product;
  } | null;
  halalCertifications?: Array<{
    status: 'verified' | 'unverified' | 'expired';
    issuer: string;
    certificateNumber: string | null;
    validUntil: Date | null;
    source: string;
    evidenceUrl: string | null;
    verifiedAt: Date | null;
  }>;
};

const halalCheckEngine = new HalalCheckEngine();

/** Public consumer DTO: the admin DTO without admin-only metadata. */
export function toProductDto(
  product: ProductWithCanonicalFamily,
  tazaScore: TazaScoreResult | null = null
): ProductDto {
  const dto: Partial<AdminProductDto> = toAdminProductDto(product, tazaScore);
  for (const field of adminOnlyProductFields) {
    delete dto[field];
  }

  return dto as ProductDto;
}

export function toAdminProductDto(
  product: ProductWithCanonicalFamily,
  tazaScore: TazaScoreResult | null = null
): AdminProductDto {
  const nutritionScore = readScoreResult(product);
  const canonicalFamily = product.canonicalProductFamily ?? null;

  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    category: product.category,
    ingredients: readConsumerIngredients(product),
    ingredientsTextOriginal: product.ingredientsTextOriginal,
    ingredientsTextOriginalLanguage: product.ingredientsTextOriginalLanguage,
    ingredientsTextRu: product.ingredientsTextRu,
    ingredientsTextTranslatedRu: product.ingredientsTextTranslatedRu,
    ingredientsTranslationSource: product.ingredientsTranslationSource,
    ingredientsTranslatedAt: product.ingredientsTranslatedAt?.toISOString() ?? null,
    ingredientsIsTranslated: isConsumerIngredientsTranslated(product),
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
    tazaScore,
    halalCheck: halalCheckEngine.calculate({
      ingredients: product.ingredients,
      ingredientsTextOriginal: product.ingredientsTextOriginal,
      ingredientsTextOriginalLanguage: product.ingredientsTextOriginalLanguage,
      ingredientsTextRu: product.ingredientsTextRu,
      ingredientsTextTranslatedRu: product.ingredientsTextTranslatedRu,
      ingredientsTranslationSource: product.ingredientsTranslationSource,
      certifications: product.halalCertifications ?? []
    }),
    scoreSource: canonicalFamily ? 'canonical_recipe' : 'product_record',
    canonicalFamilyId: canonicalFamily?.id ?? null,
    canonicalProductId: canonicalFamily?.canonicalProductId ?? null,
    manualScoreOverride: product.manualScoreOverride,
    manualOverrideReason: product.manualOverrideReason,
    manualOverrideAt: product.manualOverrideAt?.toISOString() ?? null,
    officialNutriScoreCategory: product.officialNutriScoreCategory,
    fruitVegetableLegumePercent: product.fruitVegetableLegumePercent,
    containsNonSugarSweeteners: product.containsNonSugarSweeteners,
    imageUrl: productImageQualityEvaluator.selectPrimaryImageUrl(product),
    dataStatus: product.dataStatus,
    source: product.source,
    lastVerifiedAt: product.lastVerifiedAt?.toISOString() ?? null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  };
}

function readConsumerIngredients(product: Product) {
  if (product.ingredientsTextRu?.trim()) {
    return splitIngredientText(product.ingredientsTextRu);
  }

  if (product.ingredientsTextTranslatedRu?.trim()) {
    return splitIngredientText(product.ingredientsTextTranslatedRu);
  }

  if (product.ingredientsTextOriginal?.trim()) {
    return splitIngredientText(product.ingredientsTextOriginal);
  }

  return product.ingredients;
}

function isConsumerIngredientsTranslated(product: Product) {
  return !product.ingredientsTextRu?.trim() && Boolean(product.ingredientsTextTranslatedRu?.trim());
}

function splitIngredientText(text: string) {
  return text
    .split(/[;,]/)
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);
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
