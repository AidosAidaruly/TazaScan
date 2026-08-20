import type { Product } from '../generated/prisma/client';
import {
  fetchOpenFoodFactsProduct,
  type OpenFoodFactsFetcher
} from './open-food-facts-validation-batch';
import {
  readText,
  selectOpenFoodFactsIngredientTexts
} from './open-food-facts-ingredients';

export type OpenFoodFactsIngredientsRepairStatus =
  | 'repaired'
  | 'would_repair'
  | 'already_russian'
  | 'no_russian_available'
  | 'skipped_verified'
  | 'not_found'
  | 'failed';

export type OpenFoodFactsIngredientsRepairItem = {
  barcode: string;
  productName: string;
  source: string | null;
  originalIngredientsLanguage: string | null;
  russianIngredientsAvailable: boolean;
  currentConsumerIngredientsLanguage: string | null;
  proposedConsumerIngredientsLanguage: string | null;
  status: OpenFoodFactsIngredientsRepairStatus;
  error: string | null;
};

export type OpenFoodFactsIngredientsRepairReport = {
  dryRun: boolean;
  candidates: number;
  repaired: number;
  alreadyRussian: number;
  withoutRussian: number;
  skipped: number;
  failed: number;
  items: OpenFoodFactsIngredientsRepairItem[];
};

export type OpenFoodFactsIngredientsRepairRepository = {
  findCandidates(): Promise<Product[]>;
  updateIngredientLanguageFields(
    id: string,
    data: {
      ingredientsTextOriginal?: string | null;
      ingredientsTextOriginalLanguage?: string | null;
      ingredientsTextRu?: string | null;
    }
  ): Promise<Product>;
};

export async function repairOpenFoodFactsIngredients({
  repository,
  fetchProduct = fetchOpenFoodFactsProduct,
  dryRun = false,
  requestDelayMs = 0
}: {
  repository: OpenFoodFactsIngredientsRepairRepository;
  fetchProduct?: OpenFoodFactsFetcher;
  dryRun?: boolean;
  requestDelayMs?: number;
}): Promise<OpenFoodFactsIngredientsRepairReport> {
  const candidates = await repository.findCandidates();
  const items: OpenFoodFactsIngredientsRepairItem[] = [];

  for (const [index, product] of candidates.entries()) {
    if (index > 0 && requestDelayMs > 0) {
      await delay(requestDelayMs);
    }

    items.push(
      await repairOneProduct({
        product,
        repository,
        fetchProduct,
        dryRun
      })
    );
  }

  return summarize(dryRun, candidates.length, items);
}

async function repairOneProduct({
  product,
  repository,
  fetchProduct,
  dryRun
}: {
  product: Product;
  repository: OpenFoodFactsIngredientsRepairRepository;
  fetchProduct: OpenFoodFactsFetcher;
  dryRun: boolean;
}): Promise<OpenFoodFactsIngredientsRepairItem> {
  try {
    if (product.dataStatus === 'verified') {
      return reportItem(product, { status: 'skipped_verified' });
    }

    if (product.ingredientsTextRu?.trim()) {
      return reportItem(product, { status: 'already_russian' });
    }

    const offResponse = await fetchProduct(product.barcode);

    if (offResponse.status !== 1 || !offResponse.product) {
      return reportItem(product, { status: 'not_found' });
    }

    const ingredientTexts = selectOpenFoodFactsIngredientTexts(offResponse.product);

    if (!ingredientTexts.russianText) {
      return reportItem(product, {
        status: 'no_russian_available',
        originalIngredientsLanguage:
          ingredientTexts.originalLanguage ?? product.ingredientsTextOriginalLanguage,
        proposedConsumerIngredientsLanguage: ingredientTexts.consumerLanguage
      });
    }

    const originalText =
      ingredientTexts.originalText ??
      product.ingredientsTextOriginal ??
      currentIngredientText(product);
    const originalLanguage =
      ingredientTexts.originalLanguage ??
      product.ingredientsTextOriginalLanguage ??
      inferCurrentIngredientLanguage(product);
    const update = {
      ingredientsTextOriginal: originalText,
      ingredientsTextOriginalLanguage: originalLanguage,
      ingredientsTextRu: ingredientTexts.russianText
    };

    if (!dryRun) {
      await repository.updateIngredientLanguageFields(product.id, update);
    }

    return reportItem(
      {
        ...product,
        ...update
      },
      {
        status: dryRun ? 'would_repair' : 'repaired',
        originalIngredientsLanguage: originalLanguage,
        proposedConsumerIngredientsLanguage: 'ru'
      }
    );
  } catch (error) {
    return reportItem(product, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown repair failure'
    });
  }
}

function reportItem(
  product: Product,
  {
    status,
    originalIngredientsLanguage = product.ingredientsTextOriginalLanguage,
    proposedConsumerIngredientsLanguage = product.ingredientsTextRu
      ? 'ru'
      : inferCurrentIngredientLanguage(product),
    error = null
  }: {
    status: OpenFoodFactsIngredientsRepairStatus;
    originalIngredientsLanguage?: string | null;
    proposedConsumerIngredientsLanguage?: string | null;
    error?: string | null;
  }
): OpenFoodFactsIngredientsRepairItem {
  return {
    barcode: product.barcode,
    productName: product.name,
    source: product.source,
    originalIngredientsLanguage,
    russianIngredientsAvailable: Boolean(product.ingredientsTextRu?.trim()),
    currentConsumerIngredientsLanguage: product.ingredientsTextRu
      ? 'ru'
      : inferCurrentIngredientLanguage(product),
    proposedConsumerIngredientsLanguage,
    status,
    error
  };
}

function currentIngredientText(product: Product) {
  return product.ingredientsTextOriginal ?? readText(product.ingredients.join('; '));
}

function inferCurrentIngredientLanguage(product: Product) {
  if (product.ingredientsTextRu?.trim()) return 'ru';
  if (product.ingredientsTextOriginalLanguage) {
    return product.ingredientsTextOriginalLanguage;
  }

  const text = readText(product.ingredients.join('; '));
  if (!text) return null;
  if (/[а-яё]/i.test(text)) return 'ru';
  if (/[әғқңөұүһі]/i.test(text)) return 'kk';

  return 'unknown';
}

function summarize(
  dryRun: boolean,
  candidates: number,
  items: OpenFoodFactsIngredientsRepairItem[]
): OpenFoodFactsIngredientsRepairReport {
  return {
    dryRun,
    candidates,
    repaired: items.filter(
      (item) => item.status === 'repaired' || item.status === 'would_repair'
    ).length,
    alreadyRussian: items.filter((item) => item.status === 'already_russian').length,
    withoutRussian: items.filter((item) => item.status === 'no_russian_available').length,
    skipped: items.filter(
      (item) => item.status === 'skipped_verified' || item.status === 'not_found'
    ).length,
    failed: items.filter((item) => item.status === 'failed').length,
    items
  };
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
