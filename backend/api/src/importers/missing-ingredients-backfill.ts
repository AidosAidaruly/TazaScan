import type { Product, ProductHalalCertification } from '../generated/prisma/client';
import { HalalCheckEngine } from '../halal/halal-check.engine';
import type { HalalCheckResult } from '../halal/types';
import {
  fetchOpenFoodFactsProduct,
  type OpenFoodFactsFetcher
} from './open-food-facts-validation-batch';
import {
  selectOpenFoodFactsIngredientTexts,
  splitIngredients
} from './open-food-facts-ingredients';

type BackfillProduct = Product & {
  halalCertifications?: ProductHalalCertification[];
};

export type IngredientCoverageSourceStatus =
  | 'authoritative'
  | 'generated_translation_only'
  | 'missing';

export type MissingIngredientsBackfillStatus =
  | 'repaired'
  | 'would_repair'
  | 'already_has_ingredients'
  | 'off_no_ingredients'
  | 'source_data_unusable'
  | 'skipped_verified'
  | 'not_found'
  | 'failed';

export type MissingIngredientsBackfillItem = {
  barcode: string;
  name: string;
  source: string | null;
  dataStatus: Product['dataStatus'];
  currentIngredientStatus: IngredientCoverageSourceStatus;
  ingredientsArrayCount: number;
  ingredientsTextOriginal: string | null;
  ingredientsTextOriginalLanguage: string | null;
  ingredientsTextRuAvailable: boolean;
  ingredientsTextTranslatedRuAvailable: boolean;
  resolvedConsumerIngredientsAvailable: boolean;
  halalBefore: HalalCheckResult['status'];
  halalIngredientScreeningBefore: HalalCheckResult['ingredientScreening']['status'];
  halalAfter: HalalCheckResult['status'] | null;
  halalIngredientScreeningAfter: HalalCheckResult['ingredientScreening']['status'] | null;
  sourceResult: 'open_food_facts' | 'local' | 'none';
  sourceLanguage: string | null;
  russianAvailable: boolean;
  action: MissingIngredientsBackfillStatus;
  error: string | null;
};

export type IngredientCoverageSummary = {
  totalProducts: number;
  reliableIngredientsAvailable: number;
  missingIngredients: number;
  sourceRussianAvailable: number;
  generatedRussianOnly: number;
  originalForeignAvailable: number;
};

export type MissingIngredientsBackfillReport = {
  dryRun: boolean;
  coverageBefore: IngredientCoverageSummary;
  coverageAfter: IngredientCoverageSummary;
  candidates: number;
  wouldRepair: number;
  repaired: number;
  alreadyHasIngredients: number;
  offNoIngredients: number;
  sourceDataUnusable: number;
  skipped: number;
  failed: number;
  items: MissingIngredientsBackfillItem[];
  halalBeforeDistribution: Record<HalalCheckResult['status'], number>;
  halalAfterDistribution: Record<HalalCheckResult['status'], number>;
};

export type MissingIngredientsBackfillRepository = {
  findProducts(): Promise<BackfillProduct[]>;
  updateIngredientProvenanceFields(
    id: string,
    data: {
      ingredientsTextOriginal?: string | null;
      ingredientsTextOriginalLanguage?: string | null;
      ingredientsTextRu?: string | null;
    }
  ): Promise<Product>;
};

const halalCheckEngine = new HalalCheckEngine();

export async function backfillMissingIngredients({
  repository,
  fetchProduct = fetchOpenFoodFactsProduct,
  dryRun = false,
  requestDelayMs = 0
}: {
  repository: MissingIngredientsBackfillRepository;
  fetchProduct?: OpenFoodFactsFetcher;
  dryRun?: boolean;
  requestDelayMs?: number;
}): Promise<MissingIngredientsBackfillReport> {
  const products = await repository.findProducts();
  const items: MissingIngredientsBackfillItem[] = [];
  let fetchedCount = 0;

  for (const product of products) {
    const shouldFetch =
      !hasReliableIngredientSource(product) && product.dataStatus !== 'verified';

    if (shouldFetch && fetchedCount > 0 && requestDelayMs > 0) {
      await delay(requestDelayMs);
    }

    if (shouldFetch) {
      fetchedCount += 1;
    }

    items.push(
      await backfillOneProduct({
        product,
        repository,
        fetchProduct,
        dryRun
      })
    );
  }

  return summarize(dryRun, products, items);
}

function auditHalal(product: BackfillProduct) {
  return halalCheckEngine.calculate({
    ingredients: product.ingredients,
    ingredientsTextOriginal: product.ingredientsTextOriginal,
    ingredientsTextOriginalLanguage: product.ingredientsTextOriginalLanguage,
    ingredientsTextRu: product.ingredientsTextRu,
    ingredientsTextTranslatedRu: product.ingredientsTextTranslatedRu,
    ingredientsTranslationSource: product.ingredientsTranslationSource,
    certifications: product.halalCertifications ?? []
  });
}

async function backfillOneProduct({
  product,
  repository,
  fetchProduct,
  dryRun
}: {
  product: BackfillProduct;
  repository: MissingIngredientsBackfillRepository;
  fetchProduct: OpenFoodFactsFetcher;
  dryRun: boolean;
}): Promise<MissingIngredientsBackfillItem> {
  const halalBefore = auditHalal(product);

  if (hasReliableIngredientSource(product)) {
    return reportItem(product, halalBefore, {
      action: 'already_has_ingredients',
      sourceResult: 'local'
    });
  }

  if (product.dataStatus === 'verified') {
    return reportItem(product, halalBefore, {
      action: 'skipped_verified',
      sourceResult: 'none'
    });
  }

  try {
    const offResponse = await fetchProduct(product.barcode);

    if (offResponse.status !== 1 || !offResponse.product) {
      return reportItem(product, halalBefore, {
        action: 'not_found',
        sourceResult: 'open_food_facts'
      });
    }

    const ingredientTexts = selectOpenFoodFactsIngredientTexts(offResponse.product);
    const originalText = ingredientTexts.originalText;

    if (!originalText) {
      return reportItem(product, halalBefore, {
        action: 'off_no_ingredients',
        sourceResult: 'open_food_facts',
        sourceLanguage: ingredientTexts.originalLanguage,
        russianAvailable: Boolean(ingredientTexts.russianText)
      });
    }

    if (!isUsableIngredientText(originalText)) {
      return reportItem(product, halalBefore, {
        action: 'source_data_unusable',
        sourceResult: 'open_food_facts',
        sourceLanguage: ingredientTexts.originalLanguage,
        russianAvailable: Boolean(ingredientTexts.russianText)
      });
    }

    const update = {
      ingredientsTextOriginal: originalText,
      ingredientsTextOriginalLanguage: ingredientTexts.originalLanguage ?? 'unknown',
      ingredientsTextRu: isUsableIngredientText(ingredientTexts.russianText)
        ? ingredientTexts.russianText
        : null
    };
    const repairedProduct = {
      ...product,
      ...update
    };
    const halalAfter = auditHalal(repairedProduct);

    if (!dryRun) {
      await repository.updateIngredientProvenanceFields(product.id, update);
    }

    return reportItem(repairedProduct, halalBefore, {
      halalAfter,
      action: dryRun ? 'would_repair' : 'repaired',
      sourceResult: 'open_food_facts',
      sourceLanguage: update.ingredientsTextOriginalLanguage,
      russianAvailable: Boolean(update.ingredientsTextRu)
    });
  } catch (error) {
    return reportItem(product, halalBefore, {
      action: 'failed',
      sourceResult: 'open_food_facts',
      error: error instanceof Error ? error.message : 'Unknown backfill failure'
    });
  }
}

function reportItem(
  product: BackfillProduct,
  halalBefore: HalalCheckResult,
  {
    halalAfter = null,
    action,
    sourceResult,
    sourceLanguage = product.ingredientsTextOriginalLanguage,
    russianAvailable = Boolean(product.ingredientsTextRu?.trim()),
    error = null
  }: {
    halalAfter?: HalalCheckResult | null;
    action: MissingIngredientsBackfillStatus;
    sourceResult: MissingIngredientsBackfillItem['sourceResult'];
    sourceLanguage?: string | null;
    russianAvailable?: boolean;
    error?: string | null;
  }
): MissingIngredientsBackfillItem {
  return {
    barcode: product.barcode,
    name: product.name,
    source: product.source,
    dataStatus: product.dataStatus,
    currentIngredientStatus: readIngredientStatus(product),
    ingredientsArrayCount: product.ingredients.length,
    ingredientsTextOriginal: product.ingredientsTextOriginal,
    ingredientsTextOriginalLanguage: product.ingredientsTextOriginalLanguage,
    ingredientsTextRuAvailable: Boolean(product.ingredientsTextRu?.trim()),
    ingredientsTextTranslatedRuAvailable: Boolean(product.ingredientsTextTranslatedRu?.trim()),
    resolvedConsumerIngredientsAvailable: hasConsumerIngredientDisplay(product),
    halalBefore: halalBefore.status,
    halalIngredientScreeningBefore: halalBefore.ingredientScreening.status,
    halalAfter: halalAfter?.status ?? null,
    halalIngredientScreeningAfter: halalAfter?.ingredientScreening.status ?? null,
    sourceResult,
    sourceLanguage,
    russianAvailable,
    action,
    error
  };
}

export function hasReliableIngredientSource(product: {
  ingredients: string[];
  ingredientsTextOriginal?: string | null;
  ingredientsTextRu?: string | null;
}) {
  return Boolean(
    product.ingredientsTextOriginal?.trim() ||
      product.ingredientsTextRu?.trim() ||
      product.ingredients.length > 0
  );
}

function hasConsumerIngredientDisplay(product: {
  ingredients: string[];
  ingredientsTextOriginal?: string | null;
  ingredientsTextRu?: string | null;
  ingredientsTextTranslatedRu?: string | null;
}) {
  return Boolean(
    product.ingredientsTextRu?.trim() ||
      product.ingredientsTextTranslatedRu?.trim() ||
      product.ingredientsTextOriginal?.trim() ||
      product.ingredients.length > 0
  );
}

function readIngredientStatus(product: BackfillProduct): IngredientCoverageSourceStatus {
  if (hasReliableIngredientSource(product)) {
    return 'authoritative';
  }

  if (product.ingredientsTextTranslatedRu?.trim()) {
    return 'generated_translation_only';
  }

  return 'missing';
}

function isUsableIngredientText(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return false;
  }

  if (trimmed.length < 3) {
    return false;
  }

  const normalized = trimmed.toLowerCase();
  const unusable = [
    'unknown',
    'not available',
    'n/a',
    'na',
    'ingredients',
    'no ingredients',
    'see packaging',
    'состав',
    'нет данных'
  ];

  if (unusable.includes(normalized)) {
    return false;
  }

  return splitIngredients(trimmed).length > 0;
}

function summarize(
  dryRun: boolean,
  products: BackfillProduct[],
  items: MissingIngredientsBackfillItem[]
): MissingIngredientsBackfillReport {
  return {
    dryRun,
    coverageBefore: summarizeCoverage(products),
    coverageAfter: summarizeCoverageAfter(products, items),
    candidates: items.filter((item) =>
      ['would_repair', 'repaired', 'off_no_ingredients', 'source_data_unusable', 'not_found', 'failed'].includes(
        item.action
      )
    ).length,
    wouldRepair: items.filter((item) => item.action === 'would_repair').length,
    repaired: items.filter((item) => item.action === 'repaired').length,
    alreadyHasIngredients: items.filter((item) => item.action === 'already_has_ingredients').length,
    offNoIngredients: items.filter((item) => item.action === 'off_no_ingredients').length,
    sourceDataUnusable: items.filter((item) => item.action === 'source_data_unusable').length,
    skipped: items.filter((item) =>
      ['skipped_verified', 'not_found'].includes(item.action)
    ).length,
    failed: items.filter((item) => item.action === 'failed').length,
    items,
    halalBeforeDistribution: distribute(
      items.map((item) => item.halalBefore)
    ),
    halalAfterDistribution: distribute(
      items.map((item) => item.halalAfter ?? item.halalBefore)
    )
  };
}

function summarizeCoverage(products: BackfillProduct[]): IngredientCoverageSummary {
  return {
    totalProducts: products.length,
    reliableIngredientsAvailable: products.filter(hasReliableIngredientSource).length,
    missingIngredients: products.filter((product) => !hasReliableIngredientSource(product)).length,
    sourceRussianAvailable: products.filter((product) => product.ingredientsTextRu?.trim()).length,
    generatedRussianOnly: products.filter(
      (product) =>
        !hasReliableIngredientSource(product) && Boolean(product.ingredientsTextTranslatedRu?.trim())
    ).length,
    originalForeignAvailable: products.filter(
      (product) =>
        product.ingredientsTextOriginal?.trim() &&
        product.ingredientsTextOriginalLanguage !== 'ru'
    ).length
  };
}

function summarizeCoverageAfter(
  products: BackfillProduct[],
  items: MissingIngredientsBackfillItem[]
) {
  const repairedByBarcode = new Map(
    items
      .filter((item) => item.action === 'repaired' || item.action === 'would_repair')
      .map((item) => [item.barcode, item])
  );
  const projected = products.map((product) => {
    const repaired = repairedByBarcode.get(product.barcode);
    if (!repaired) return product;

    return {
      ...product,
      ingredientsTextOriginal:
        repaired.ingredientsTextOriginal ?? product.ingredientsTextOriginal,
      ingredientsTextOriginalLanguage:
        repaired.sourceLanguage ?? product.ingredientsTextOriginalLanguage,
      ingredientsTextRu: repaired.russianAvailable
        ? product.ingredientsTextRu ?? 'source-russian-present'
        : product.ingredientsTextRu
    };
  });

  return summarizeCoverage(projected);
}

function distribute(values: Array<HalalCheckResult['status']>) {
  const distribution = {
    halal_confirmed: 0,
    screening_clear: 0,
    non_halal: 0,
    review_required: 0,
    insufficient_data: 0
  } satisfies Record<HalalCheckResult['status'], number>;

  for (const value of values) {
    distribution[value] += 1;
  }

  return distribution;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
