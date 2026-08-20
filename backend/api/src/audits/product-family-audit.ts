import type { Product } from '../generated/prisma/client';
import { TazaScoreEngine } from '../scoring/engines/taza-score.engine';
import type { TazaScoreInput } from '../scoring/types/taza-score-result';

export type ProductFamilyClassification =
  | 'same_recipe'
  | 'likely_same_recipe'
  | 'different_variant'
  | 'different_recipe'
  | 'uncertain';

export type ProductFamilyAuditItem = {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  source: string | null;
  dataStatus: Product['dataStatus'];
  nutrition: Record<NutritionField, number | null>;
  tazaScore: number | null;
  confidence: string;
};

export type ProductFamilyAuditGroup = {
  groupId: string;
  normalizedFamilyKey: string;
  classification: ProductFamilyClassification;
  matchingReason: string;
  conflicts: string[];
  recommendedAction: 'auto-link candidate' | 'manual review' | 'keep separate';
  items: ProductFamilyAuditItem[];
};

export type ProductFamilyAuditReport = {
  groups: ProductFamilyAuditGroup[];
  counts: Record<ProductFamilyClassification, number>;
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

type NutritionField = (typeof nutritionFields)[number];

export const nutritionTolerances: Record<NutritionField, number> = {
  energyKcal: 2,
  protein: 0.3,
  carbohydrates: 0.5,
  sugars: 0.5,
  fat: 0.5,
  saturatedFat: 0.3,
  fiber: 0.5,
  salt: 0.05
};

const variantTokens = new Set([
  'zero',
  'light',
  'diet',
  'max',
  'vanilla',
  'cherry',
  'lemon',
  'lime',
  'без сахара',
  'без сахар'
]);

const nonVariantDescriptors = /\b(original|taste|classic|500ml|1l|ml|l|g|kg)\b/gi;

export function auditProductFamilies({
  products,
  tazaScoreEngine = new TazaScoreEngine()
}: {
  products: Product[];
  tazaScoreEngine?: TazaScoreEngine;
}): ProductFamilyAuditReport {
  const groups = [...groupByFamilyKey(products).entries()]
    .filter(([, groupProducts]) => groupProducts.length > 1)
    .map(([key, groupProducts], index) =>
      buildGroup(`family-candidate-${index + 1}`, key, groupProducts, tazaScoreEngine)
    );

  return {
    groups,
    counts: {
      same_recipe: groups.filter((group) => group.classification === 'same_recipe').length,
      likely_same_recipe: groups.filter((group) => group.classification === 'likely_same_recipe').length,
      different_variant: groups.filter((group) => group.classification === 'different_variant').length,
      different_recipe: groups.filter((group) => group.classification === 'different_recipe').length,
      uncertain: groups.filter((group) => group.classification === 'uncertain').length
    }
  };
}

export function classifyProductFamilyCandidates(products: Product[]): {
  classification: ProductFamilyClassification;
  matchingReason: string;
  conflicts: string[];
} {
  if (products.length < 2) {
    return {
      classification: 'uncertain',
      matchingReason: 'At least two products are required for family classification.',
      conflicts: []
    };
  }

  const conflicts = familyConflicts(products);
  if (conflicts.includes('different variant marker')) {
    return {
      classification: 'different_variant',
      matchingReason: 'Product names contain different variant markers.',
      conflicts
    };
  }

  if (conflicts.includes('material nutrition difference')) {
    return {
      classification: 'different_recipe',
      matchingReason: 'Nutrition per 100g/ml differs beyond conservative tolerances.',
      conflicts
    };
  }

  if (conflicts.includes('serving type mismatch')) {
    return {
      classification: 'different_recipe',
      matchingReason: 'Products use different per-100 serving bases.',
      conflicts
    };
  }

  const ingredientSignatures = products.map((product) => ingredientSignature(product.ingredients));
  const allIngredientsKnown = ingredientSignatures.every(Boolean);
  const sameIngredients = new Set(ingredientSignatures).size === 1;
  const allVerified = products.every((product) => product.dataStatus === 'verified');

  if (sameIngredients && allIngredientsKnown && allVerified) {
    return {
      classification: 'same_recipe',
      matchingReason:
        'Brand, normalized family name, variant, nutrition and original ingredients match.',
      conflicts
    };
  }

  if (allNutritionWithinTolerance(products)) {
    return {
      classification: 'likely_same_recipe',
      matchingReason:
        'Brand, normalized family name and nutrition are compatible, but source or ingredient evidence still needs manual review.',
      conflicts
    };
  }

  return {
    classification: 'uncertain',
    matchingReason: 'Available evidence is not enough for safe family assignment.',
    conflicts
  };
}

export function normalizedFamilyKey(product: Product) {
  const brand = normalizeText(product.brand ?? '');
  const familyName = normalizeFamilyName(product.name);

  if (!brand && !familyName) return '';
  if (!brand || familyName.startsWith(brand)) return familyName;
  return `${brand} ${familyName}`.trim();
}

function groupByFamilyKey(products: Product[]) {
  const groups = new Map<string, Product[]>();

  for (const product of products) {
    const key = normalizedFamilyKey(product);
    if (!key) continue;

    const group = groups.get(key) ?? [];
    group.push(product);
    groups.set(key, group);
  }

  return groups;
}

function buildGroup(
  groupId: string,
  key: string,
  products: Product[],
  tazaScoreEngine: TazaScoreEngine
): ProductFamilyAuditGroup {
  const classification = classifyProductFamilyCandidates(products);

  return {
    groupId,
    normalizedFamilyKey: key,
    classification: classification.classification,
    matchingReason: classification.matchingReason,
    conflicts: classification.conflicts,
    recommendedAction: recommendedAction(classification.classification),
    items: products.map((product) => auditItem(product, tazaScoreEngine))
  };
}

function auditItem(product: Product, tazaScoreEngine: TazaScoreEngine): ProductFamilyAuditItem {
  const tazaScore = tazaScoreEngine.calculate(productToTazaScoreInput(product));

  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    source: product.source,
    dataStatus: product.dataStatus,
    nutrition: nutritionObject(product),
    tazaScore: tazaScore.score,
    confidence: tazaScore.confidence.level
  };
}

function recommendedAction(classification: ProductFamilyClassification) {
  return {
    same_recipe: 'auto-link candidate',
    likely_same_recipe: 'manual review',
    different_variant: 'keep separate',
    different_recipe: 'keep separate',
    uncertain: 'manual review'
  }[classification] as ProductFamilyAuditGroup['recommendedAction'];
}

function familyConflicts(products: Product[]) {
  const conflicts = new Set<string>();
  const variants = new Set(products.map(variantSignature));
  const servingTypes = new Set(products.map((product) => product.servingType));

  if (variants.size > 1) conflicts.add('different variant marker');
  if (servingTypes.size > 1) conflicts.add('serving type mismatch');
  if (!allNutritionWithinTolerance(products)) conflicts.add('material nutrition difference');

  return [...conflicts];
}

function allNutritionWithinTolerance(products: Product[]) {
  for (let index = 0; index < products.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < products.length; otherIndex += 1) {
      if (!nutritionWithinTolerance(products[index]!, products[otherIndex]!)) return false;
    }
  }

  return true;
}

function nutritionWithinTolerance(left: Product, right: Product) {
  return nutritionFields.every((field) => {
    const leftValue = left[field];
    const rightValue = right[field];
    if (leftValue === null || rightValue === null) return true;
    return Math.abs(leftValue - rightValue) <= nutritionTolerances[field];
  });
}

function normalizeFamilyName(value: string) {
  return normalizeText(removePackageSize(value).replace(nonVariantDescriptors, ''));
}

function removePackageSize(value: string) {
  return value.replace(/\b\d+([.,]\d+)?\s?(ml|мл|l|л|g|г|kg|кг)\b/gi, '').trim();
}

function variantSignature(product: Product) {
  const value = normalizeText(product.name);
  return [...variantTokens].filter((token) => value.includes(token)).sort().join('|');
}

function nutritionObject(product: Product) {
  return Object.fromEntries(nutritionFields.map((field) => [field, product[field]])) as Record<
    NutritionField,
    number | null
  >;
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
