import type { Product } from '../generated/prisma/client';
import { TazaScoreEngine } from '../scoring/engines/taza-score.engine';
import type { TazaScoreInput } from '../scoring/types/taza-score-result';
import {
  fetchOpenFoodFactsProduct,
  readOfficialCategoryFromOffTags,
  type OpenFoodFactsFetcher
} from './open-food-facts-validation-batch';

export type OpenFoodFactsCategoryRepairStatus =
  | 'repaired'
  | 'would_repair'
  | 'already_has_category'
  | 'unresolved'
  | 'skipped_verified'
  | 'not_found'
  | 'failed';

export type OpenFoodFactsCategoryRepairItem = {
  barcode: string;
  productName: string;
  currentCategory: string;
  currentOfficialCategory: Product['officialNutriScoreCategory'];
  derivedCategory: Product['officialNutriScoreCategory'];
  offCategories: string | null;
  offCategoryTags: string[];
  status: OpenFoodFactsCategoryRepairStatus;
  tazaScore: number | null;
  confidence: string | null;
  nutritionCoverage: number | null;
  missingCriticalFields: string[];
  safeguardsApplied: string[];
  error: string | null;
};

export type OpenFoodFactsCategoryRepairReport = {
  dryRun: boolean;
  candidates: number;
  repaired: number;
  unresolved: number;
  skipped: number;
  failed: number;
  items: OpenFoodFactsCategoryRepairItem[];
};

export type OpenFoodFactsCategoryRepairRepository = {
  findCandidates(): Promise<Product[]>;
  updateOfficialCategory(
    id: string,
    category: NonNullable<Product['officialNutriScoreCategory']>
  ): Promise<Product>;
};

export async function repairOpenFoodFactsCategories({
  repository,
  fetchProduct = fetchOpenFoodFactsProduct,
  dryRun = false,
  requestDelayMs = 0,
  tazaScoreEngine = new TazaScoreEngine()
}: {
  repository: OpenFoodFactsCategoryRepairRepository;
  fetchProduct?: OpenFoodFactsFetcher;
  dryRun?: boolean;
  requestDelayMs?: number;
  tazaScoreEngine?: TazaScoreEngine;
}): Promise<OpenFoodFactsCategoryRepairReport> {
  const candidates = await repository.findCandidates();
  const items: OpenFoodFactsCategoryRepairItem[] = [];

  for (const [index, product] of candidates.entries()) {
    if (index > 0 && requestDelayMs > 0) {
      await delay(requestDelayMs);
    }

    items.push(
      await repairOneProduct({
        product,
        repository,
        fetchProduct,
        dryRun,
        tazaScoreEngine
      })
    );
  }

  return summarize(dryRun, candidates.length, items);
}

async function repairOneProduct({
  product,
  repository,
  fetchProduct,
  dryRun,
  tazaScoreEngine
}: {
  product: Product;
  repository: OpenFoodFactsCategoryRepairRepository;
  fetchProduct: OpenFoodFactsFetcher;
  dryRun: boolean;
  tazaScoreEngine: TazaScoreEngine;
}): Promise<OpenFoodFactsCategoryRepairItem> {
  try {
    if (product.officialNutriScoreCategory !== null) {
      return reportItem(product, {
        status: 'already_has_category',
        tazaScoreEngine
      });
    }

    if (product.dataStatus === 'verified') {
      return reportItem(product, {
        status: 'skipped_verified',
        tazaScoreEngine
      });
    }

    const offResponse = await fetchProduct(product.barcode);

    if (offResponse.status !== 1 || !offResponse.product) {
      return reportItem(product, {
        status: 'not_found',
        tazaScoreEngine
      });
    }

    const offCategoryTags = readOffCategoryTags(offResponse.product.categories_tags);
    const derivedCategory = readOfficialCategoryFromOffTags(
      offResponse.product.categories_tags
    ) as Product['officialNutriScoreCategory'];
    const offCategories = readText(offResponse.product.categories);

    if (derivedCategory === null) {
      return reportItem(product, {
        status: 'unresolved',
        derivedCategory,
        offCategories,
        offCategoryTags,
        tazaScoreEngine
      });
    }

    const scoreProduct = { ...product, officialNutriScoreCategory: derivedCategory };
    const repairedProduct = dryRun
      ? product
      : await repository.updateOfficialCategory(product.id, derivedCategory);

    return reportItem(repairedProduct, {
      status: dryRun ? 'would_repair' : 'repaired',
      derivedCategory,
      offCategories,
      offCategoryTags,
      tazaScoreEngine,
      scoreProduct
    });
  } catch (error) {
    return reportItem(product, {
      status: 'failed',
      tazaScoreEngine,
      error: error instanceof Error ? error.message : 'Unknown repair failure'
    });
  }
}

function reportItem(
  product: Product,
  {
    status,
    derivedCategory = null,
    offCategories = null,
    offCategoryTags = [],
    tazaScoreEngine,
    scoreProduct = product,
    error = null
  }: {
    status: OpenFoodFactsCategoryRepairStatus;
    derivedCategory?: Product['officialNutriScoreCategory'];
    offCategories?: string | null;
    offCategoryTags?: string[];
    tazaScoreEngine: TazaScoreEngine;
    scoreProduct?: Product;
    error?: string | null;
  }
): OpenFoodFactsCategoryRepairItem {
  const tazaScore = tazaScoreEngine.calculate(productToTazaScoreInput(scoreProduct));

  return {
    barcode: product.barcode,
    productName: product.name,
    currentCategory: product.category,
    currentOfficialCategory: product.officialNutriScoreCategory,
    derivedCategory,
    offCategories,
    offCategoryTags,
    status,
    tazaScore: tazaScore.score,
    confidence: tazaScore.confidence.level,
    nutritionCoverage: tazaScore.nutritionCoverage,
    missingCriticalFields: tazaScore.missingCriticalFields,
    safeguardsApplied: tazaScore.safeguardsApplied,
    error
  };
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

function summarize(
  dryRun: boolean,
  candidates: number,
  items: OpenFoodFactsCategoryRepairItem[]
): OpenFoodFactsCategoryRepairReport {
  return {
    dryRun,
    candidates,
    repaired: items.filter(
      (item) => item.status === 'repaired' || item.status === 'would_repair'
    ).length,
    unresolved: items.filter((item) => item.status === 'unresolved').length,
    skipped: items.filter(
      (item) =>
        item.status === 'already_has_category' ||
        item.status === 'skipped_verified' ||
        item.status === 'not_found'
    ).length,
    failed: items.filter((item) => item.status === 'failed').length,
    items
  };
}

function readOffCategoryTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function readText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
