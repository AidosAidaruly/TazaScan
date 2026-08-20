import type { Product } from '../generated/prisma/client';
import { ProductDataQualityEvaluator } from '../data-quality/product-data-quality.evaluator';
import { TazaScoreEngine } from '../scoring/engines/taza-score.engine';
import type { TazaScoreInput, TazaScoreResult } from '../scoring/types/taza-score-result';

export type DuplicateClassification =
  | 'exact_duplicate'
  | 'package_variant'
  | 'recipe_or_market_variant'
  | 'uncertain';

export type DuplicateAuditItem = {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  source: string | null;
  category: string;
  nutrition: Record<string, number | null>;
  ingredients: string[];
  tazaScore: number | null;
  confidence: string;
  coverage: number;
  dataQualityWarnings: string[];
  scoreDifferenceReasons: string[];
};

export type DuplicateAuditGroup = {
  groupId: string;
  normalizedIdentity: string;
  classification: DuplicateClassification;
  reason: string;
  recommendedAction: 'keep separate' | 'link as package variants' | 'review manually' | 'safe merge candidate';
  items: DuplicateAuditItem[];
};

export type DuplicateAuditReport = {
  groups: DuplicateAuditGroup[];
  counts: Record<DuplicateClassification, number>;
  cocaColaGroups: DuplicateAuditGroup[];
};

const nutritionFields = [
  'energyKcal',
  'protein',
  'carbohydrates',
  'sugars',
  'fat',
  'saturatedFat',
  'fiber',
  'salt'
] as const;

const dataQualityEvaluator = new ProductDataQualityEvaluator();

export function auditProductDuplicates({
  products,
  tazaScoreEngine = new TazaScoreEngine()
}: {
  products: Product[];
  tazaScoreEngine?: TazaScoreEngine;
}): DuplicateAuditReport {
  const likelyGroups = groupLikelyDuplicates(products);
  const groups = [...likelyGroups.entries()]
    .filter(([, groupProducts]) => groupProducts.length > 1)
    .map(([normalizedIdentity, groupProducts], index) =>
      buildGroup(`duplicate-group-${index + 1}`, normalizedIdentity, groupProducts, tazaScoreEngine)
    );

  return {
    groups,
    counts: {
      exact_duplicate: groups.filter((group) => group.classification === 'exact_duplicate').length,
      package_variant: groups.filter((group) => group.classification === 'package_variant').length,
      recipe_or_market_variant: groups.filter(
        (group) => group.classification === 'recipe_or_market_variant'
      ).length,
      uncertain: groups.filter((group) => group.classification === 'uncertain').length
    },
    cocaColaGroups: groups.filter((group) => group.normalizedIdentity.includes('coca cola'))
  };
}

function groupLikelyDuplicates(products: Product[]) {
  const groups = new Map<string, Product[]>();

  for (const product of products) {
    const key = normalizedIdentity(product);
    if (!key) continue;

    const group = groups.get(key) ?? [];
    group.push(product);
    groups.set(key, group);
  }

  return groups;
}

function buildGroup(
  groupId: string,
  normalizedIdentity: string,
  products: Product[],
  tazaScoreEngine: TazaScoreEngine
): DuplicateAuditGroup {
  const scoreResults = new Map(
    products.map((product) => [product.id, tazaScoreEngine.calculate(productToTazaScoreInput(product))])
  );
  const classification = classifyGroup(products);
  const items = products.map((product) =>
    auditItem(product, scoreResults.get(product.id)!, products, scoreResults)
  );

  return {
    groupId,
    normalizedIdentity,
    classification,
    reason: groupReason(classification, products),
    recommendedAction: recommendedAction(classification),
    items
  };
}

function classifyGroup(products: Product[]): DuplicateClassification {
  const sameNutrition = allSame(products.map(nutritionSignature));
  const sameIngredients = allSame(products.map((product) => ingredientSignature(product.ingredients)));
  const sameCategory = allSame(products.map((product) => normalizeText(product.category)));

  if (sameNutrition && sameIngredients && sameCategory) {
    return hasPackageHint(products) ? 'package_variant' : 'exact_duplicate';
  }

  if (!sameNutrition || !sameIngredients) {
    return 'recipe_or_market_variant';
  }

  return 'uncertain';
}

function auditItem(
  product: Product,
  tazaScore: TazaScoreResult,
  groupProducts: Product[],
  scoreResults: Map<string, TazaScoreResult>
): DuplicateAuditItem {
  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    source: product.source,
    category: product.category,
    nutrition: nutritionObject(product),
    ingredients: product.ingredients,
    tazaScore: tazaScore.score,
    confidence: tazaScore.confidence.level,
    coverage: tazaScore.nutritionCoverage,
    dataQualityWarnings: dataQualityEvaluator
      .evaluate(product)
      .warnings.map((warning) => warning.code),
    scoreDifferenceReasons: scoreDifferenceReasons(product, tazaScore, groupProducts, scoreResults)
  };
}

function scoreDifferenceReasons(
  product: Product,
  tazaScore: TazaScoreResult,
  groupProducts: Product[],
  scoreResults: Map<string, TazaScoreResult>
) {
  const reasons = new Set<string>();

  for (const other of groupProducts) {
    if (other.id === product.id) continue;

    const otherScore = scoreResults.get(other.id);
    if (!otherScore || otherScore.score === tazaScore.score) continue;

    if (nutritionSignature(product) !== nutritionSignature(other)) {
      reasons.add('different nutrition values');
    }
    if (ingredientSignature(product.ingredients) !== ingredientSignature(other.ingredients)) {
      reasons.add('different ingredients');
    }
    if (product.officialNutriScoreCategory !== other.officialNutriScoreCategory) {
      reasons.add('official Nutri-Score category mismatch');
    }
    if (tazaScore.missingCriticalFields.join(',') !== otherScore.missingCriticalFields.join(',')) {
      reasons.add('different missing critical fields');
    }
    if (tazaScore.safeguardsApplied.join(',') !== otherScore.safeguardsApplied.join(',')) {
      reasons.add('different safeguards');
    }
  }

  return [...reasons];
}

function normalizedIdentity(product: Product) {
  const brand = normalizeText(product.brand ?? '');
  const name = normalizeText(removePackageSize(product.name));

  if (!brand || name.startsWith(brand)) {
    return name;
  }

  return `${brand} ${name}`.trim();
}

function removePackageSize(value: string) {
  return value.replace(/\b\d+([.,]\d+)?\s?(ml|мл|l|л|g|г|kg|кг)\b/gi, '').trim();
}

function hasPackageHint(products: Product[]) {
  return products.some((product) => /\b\d+([.,]\d+)?\s?(ml|мл|l|л|g|г|kg|кг)\b/i.test(product.name));
}

function nutritionSignature(product: Product) {
  return nutritionFields.map((field) => `${field}:${product[field] ?? 'null'}`).join('|');
}

function nutritionObject(product: Product) {
  return Object.fromEntries(nutritionFields.map((field) => [field, product[field]]));
}

function ingredientSignature(ingredients: string[]) {
  return ingredients.map(normalizeText).filter(Boolean).join('|');
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function allSame(values: string[]) {
  return new Set(values).size <= 1;
}

function groupReason(classification: DuplicateClassification, products: Product[]) {
  return {
    exact_duplicate: 'Normalized identity, category, nutrition values, and ingredients match.',
    package_variant:
      'Normalized identity and product data match, with package-size wording in the product name.',
    recipe_or_market_variant:
      'Products look similar by name/brand but nutrition or ingredients differ.',
    uncertain: `Likely identity match across ${products.length} records, but available data is not enough for a safe decision.`
  }[classification];
}

function recommendedAction(classification: DuplicateClassification): DuplicateAuditGroup['recommendedAction'] {
  const actions: Record<DuplicateClassification, DuplicateAuditGroup['recommendedAction']> = {
    exact_duplicate: 'safe merge candidate',
    package_variant: 'link as package variants',
    recipe_or_market_variant: 'keep separate',
    uncertain: 'review manually'
  };

  return actions[classification];
}

function productToTazaScoreInput(product: Product): TazaScoreInput {
  const input: TazaScoreInput = {
    servingType: product.servingType,
    energyKcal: product.energyKcal,
    energyKj: null,
    protein: product.protein,
    carbohydrates: product.carbohydrates,
    sugars: product.sugars,
    fat: product.fat,
    saturatedFat: product.saturatedFat,
    fiber: product.fiber,
    salt: product.salt,
    fruitVegetableLegumePercent: product.fruitVegetableLegumePercent,
    containsNonSugarSweeteners: product.containsNonSugarSweeteners,
    ingredients: product.ingredients,
    legacyCategoryLabel: product.category,
    dataStatus: product.dataStatus
  };

  if (product.officialNutriScoreCategory) {
    input.category = product.officialNutriScoreCategory;
  }

  return input;
}
