import type { Product, ProductHalalCertification } from '../generated/prisma/client';
import { HalalCheckEngine } from '../halal/halal-check.engine';
import type {
  HalalCheckResult,
  HalalIngredientScreeningStatus,
  HalalReasonCode
} from '../halal/types';

type AuditedProduct = Product & {
  halalCertifications?: ProductHalalCertification[];
  canonicalProductFamily?: {
    id: string;
    canonicalProductId: string;
    canonicalProduct: Product;
  } | null;
};

export type HalalAuditQuality =
  | 'EXPECTED'
  | 'POSSIBLE_FALSE_POSITIVE'
  | 'POSSIBLE_FALSE_NEGATIVE'
  | 'DATA_LIMITATION'
  | 'NEEDS_MANUAL_REVIEW'
  | 'POTENTIAL_PROVENANCE_BUG';

export type HalalProductAuditRow = {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  source: string | null;
  dataStatus: Product['dataStatus'];
  ingredientSource: string;
  status: HalalCheckResult['status'];
  ingredientScreeningStatus: HalalIngredientScreeningStatus;
  certificationStatus: HalalCheckResult['certification']['status'];
  reasons: HalalReasonCode[];
  matchedSignals: string[];
  reviewNote: string;
  quality: HalalAuditQuality;
};

export type HalalCheckAuditReport = {
  totalProducts: number;
  statusDistribution: Record<HalalCheckResult['status'], number>;
  ingredientScreeningDistribution: Record<HalalIngredientScreeningStatus, number>;
  certificationDistribution: Record<HalalCheckResult['certification']['status'], number>;
  ruleDistribution: Partial<Record<HalalReasonCode, number>>;
  certificationSummary: {
    total: number;
    verified: number;
    unverified: number;
    expired: number;
    conflicts: number;
  };
  rows: HalalProductAuditRow[];
  eNumberMentions: Record<string, number>;
  ignoredENumberMentions: Record<string, number>;
  gelatinProducts: HalalProductAuditRow[];
  alcoholProducts: HalalProductAuditRow[];
  rennetOrEnzymeProducts: HalalProductAuditRow[];
  canonicalFamilyRows: HalalProductAuditRow[];
};

const engine = new HalalCheckEngine();

export function auditHalalCheckProducts(
  products: AuditedProduct[]
): HalalCheckAuditReport {
  const rows = products.map(auditProduct);
  const statusDistribution = {
    halal_confirmed: 0,
    screening_clear: 0,
    non_halal: 0,
    review_required: 0,
    insufficient_data: 0
  } satisfies Record<HalalCheckResult['status'], number>;
  const ingredientScreeningDistribution = {
    clear: 0,
    review_required: 0,
    non_halal_detected: 0,
    insufficient_data: 0
  } satisfies Record<HalalIngredientScreeningStatus, number>;
  const certificationDistribution = {
    verified: 0,
    not_verified: 0,
    expired: 0,
    conflict: 0,
    unknown: 0
  } satisfies Record<HalalCheckResult['certification']['status'], number>;
  const ruleDistribution: Partial<Record<HalalReasonCode, number>> = {};
  const eNumberMentions: Record<string, number> = {};
  const ignoredENumberMentions: Record<string, number> = {};
  const certificationSummary = {
    total: 0,
    verified: 0,
    unverified: 0,
    expired: 0,
    conflicts: 0
  };

  for (const product of products) {
    const row = rows.find((item) => item.id === product.id);
    if (!row) continue;

    statusDistribution[row.status] += 1;
    ingredientScreeningDistribution[row.ingredientScreeningStatus] += 1;
    certificationDistribution[row.certificationStatus] += 1;
    for (const reason of row.reasons) {
      ruleDistribution[reason] = (ruleDistribution[reason] ?? 0) + 1;
    }

    for (const certification of product.halalCertifications ?? []) {
      certificationSummary.total += 1;
      certificationSummary[certification.status] += 1;
    }
    if (row.reasons.includes('CERTIFICATION_CONFLICT')) {
      certificationSummary.conflicts += 1;
    }

    const sourceText = readAllIngredientText(product);
    for (const mention of sourceText.match(/\be[\s-]?\d{3,4}\b/gi) ?? []) {
      const normalized = mention.toLowerCase().replace(/[\s-]/g, '');
      eNumberMentions[normalized] = (eNumberMentions[normalized] ?? 0) + 1;
      if (!row.matchedSignals.some((signal) => signal.includes(normalized))) {
        ignoredENumberMentions[normalized] =
          (ignoredENumberMentions[normalized] ?? 0) + 1;
      }
    }
  }

  return {
    totalProducts: products.length,
    statusDistribution,
    ingredientScreeningDistribution,
    certificationDistribution,
    ruleDistribution,
    certificationSummary,
    rows,
    eNumberMentions,
    ignoredENumberMentions,
    gelatinProducts: rows.filter((row) =>
      row.reasons.some((reason) => reason.includes('GELATIN'))
    ),
    alcoholProducts: rows.filter((row) =>
      row.reasons.some((reason) => reason.includes('ALCOHOL'))
    ),
    rennetOrEnzymeProducts: rows.filter((row) =>
      row.reasons.some((reason) => reason.includes('RENNET') || reason.includes('ENZYME'))
    ),
    canonicalFamilyRows: rows.filter((row) =>
      products.some(
        (product) => product.id === row.id && product.canonicalProductFamilyId
      )
    )
  };
}

function auditProduct(product: AuditedProduct): HalalProductAuditRow {
  const result = engine.calculate({
    ingredients: product.ingredients,
    ingredientsTextOriginal: product.ingredientsTextOriginal,
    ingredientsTextOriginalLanguage: product.ingredientsTextOriginalLanguage,
    ingredientsTextRu: product.ingredientsTextRu,
    ingredientsTextTranslatedRu: product.ingredientsTextTranslatedRu,
    ingredientsTranslationSource: product.ingredientsTranslationSource,
    certifications: product.halalCertifications ?? []
  });
  const quality = classifyQuality(product, result);

  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    source: product.source,
    dataStatus: product.dataStatus,
    ingredientSource: describeIngredientSource(product),
    status: result.status,
    ingredientScreeningStatus: result.ingredientScreening.status,
    certificationStatus: result.certification.status,
    reasons: result.reasons,
    matchedSignals: result.matchedSignals.map(
      (signal) => `${signal.reasonCode}:${signal.matchedText}:${signal.sourceKind}`
    ),
    reviewNote: describeReviewNote(product, result, quality),
    quality
  };
}

function classifyQuality(
  product: AuditedProduct,
  result: HalalCheckResult
): HalalAuditQuality {
  if (result.status === 'insufficient_data') {
    return 'DATA_LIMITATION';
  }

  if (
    result.matchedSignals.some((signal) => signal.sourceKind === 'generated_translation') &&
    (product.ingredientsTextOriginal?.trim() || product.ingredientsTextRu?.trim())
  ) {
    return 'POTENTIAL_PROVENANCE_BUG';
  }

  if (result.status === 'non_halal') {
    return result.matchedSignals.every((signal) => signal.severity === 'non_halal')
      ? 'EXPECTED'
      : 'POSSIBLE_FALSE_POSITIVE';
  }

  if (result.status === 'screening_clear') {
    return 'EXPECTED';
  }

  if (result.status === 'review_required') {
    return 'NEEDS_MANUAL_REVIEW';
  }

  return 'EXPECTED';
}

function describeReviewNote(
  product: AuditedProduct,
  result: HalalCheckResult,
  quality: HalalAuditQuality
) {
  if (quality === 'DATA_LIMITATION') {
    return 'Missing reliable ingredient text';
  }
  if (quality === 'POTENTIAL_PROVENANCE_BUG') {
    return 'Generated translation produced a match while source text exists';
  }
  if (result.status === 'non_halal') {
    return 'Explicit high-confidence prohibited signal detected';
  }
  if (result.status === 'screening_clear') {
    return 'No covered issue detected in available ingredients; halal certification is not verified';
  }
  if (result.reasons.includes('CERTIFICATION_CONFLICT')) {
    return 'Verified certification conflicts with explicit ingredient signal';
  }
  if (product.canonicalProductFamilyId) {
    return 'Canonical family member; certification remains product-specific';
  }
  return 'Source-dependent ingredient or certification needs review';
}

function describeIngredientSource(product: AuditedProduct) {
  if (product.ingredientsTextOriginal?.trim()) {
    return `original:${product.ingredientsTextOriginalLanguage ?? 'unknown'}`;
  }
  if (product.ingredientsTextRu?.trim()) {
    return 'source_russian';
  }
  if (product.ingredients.length > 0) {
    return 'ingredient_list';
  }
  if (product.ingredientsTextTranslatedRu?.trim()) {
    return 'generated_translation_only';
  }
  return 'missing';
}

function readAllIngredientText(product: AuditedProduct) {
  return [
    product.ingredientsTextOriginal,
    product.ingredientsTextRu,
    product.ingredientsTextTranslatedRu,
    ...product.ingredients
  ]
    .filter(Boolean)
    .join(' ');
}
