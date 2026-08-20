import type { Product } from '../generated/prisma/client';
import { productImageQualityEvaluator } from '../data-quality/product-image-quality.evaluator';
import type { ProductBody } from '../schemas/product.schema';
import { productBodySchema } from '../schemas/product.schema';
import type { TazaScoreResult } from '../scoring/types/taza-score-result';
import {
  readText,
  selectOpenFoodFactsIngredientTexts,
  splitIngredients
} from './open-food-facts-ingredients';

export const openFoodFactsValidationBarcodes = [
  '4601787006450',
  '4014400901405',
  '7622210750495',
  '4600375913798',
  '4870112006902',
  '4870036001205',
  '4870132003653',
  '4870144749303',
  '4870132003684',
  '4870206411742',
  '4870207313328',
  '4870207310563',
  '4600605029329',
  '4870207314011',
  '4607168783088',
  '4607037120594',
  '4607016243160',
  '4602481106309',
  '4600680029542',
  '4870238601753'
] as const;

export type OpenFoodFactsValidationBarcode =
  (typeof openFoodFactsValidationBarcodes)[number];

export type OpenFoodFactsProductResponse = {
  status?: number;
  product?: OpenFoodFactsProduct;
};

export type OpenFoodFactsProduct = {
  code?: string;
  product_name?: unknown;
  product_name_en?: unknown;
  product_name_ru?: unknown;
  brands?: unknown;
  categories?: unknown;
  categories_tags?: unknown;
  image_url?: unknown;
  image_front_url?: unknown;
  selected_images?: unknown;
  ingredients_text?: unknown;
  ingredients_text_en?: unknown;
  ingredients_text_ru?: unknown;
  ingredients_text_kk?: unknown;
  nutrition_data_per?: unknown;
  nutriments?: Record<string, unknown>;
  countries_tags?: unknown;
};

export type OpenFoodFactsFetcher = (
  barcode: string
) => Promise<OpenFoodFactsProductResponse>;

export type ImportProductRepository = {
  findByBarcode(barcode: string): Promise<Product | null>;
};

export type ImportProductService = {
  create(data: ProductBody): Promise<unknown>;
};

export type TazaScorePreviewer = {
  previewTazaScore(data: ProductBody): TazaScoreResult;
};

export type OpenFoodFactsImportStatus =
  | 'imported'
  | 'already_exists'
  | 'not_found'
  | 'failed'
  | 'skipped_incompatible';

export type OpenFoodFactsImportReportItem = {
  barcode: string;
  status: OpenFoodFactsImportStatus;
  productName: string | null;
  brand: string | null;
  availableNutritionFields: string[];
  missingRelevantFields: string[];
  ingredientsAvailable: boolean;
  imageAvailable: boolean;
  tazaScore: number | null;
  confidence: string | null;
  coverage: number | null;
  safeguardsApplied: string[];
  error: string | null;
};

export type OpenFoodFactsImportReport = {
  requested: number;
  found: number;
  imported: number;
  skipped: number;
  notFound: number;
  failed: number;
  items: OpenFoodFactsImportReportItem[];
};

const nutritionFieldNames = [
  'energyKcal',
  'protein',
  'carbohydrates',
  'sugars',
  'fat',
  'saturatedFat',
  'fiber',
  'salt'
] as const;

export async function fetchOpenFoodFactsProduct(
  barcode: string
): Promise<OpenFoodFactsProductResponse> {
  const url = new URL(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
  );
  url.searchParams.set(
    'fields',
    [
      'code',
      'product_name',
      'product_name_en',
      'product_name_ru',
      'brands',
      'categories',
      'categories_tags',
      'selected_images',
      'image_url',
      'image_front_url',
      'ingredients_text',
      'ingredients_text_en',
      'ingredients_text_ru',
      'ingredients_text_kk',
      'nutrition_data_per',
      'nutriments'
    ].join(',')
  );

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'TazaScan validation importer - contact: local-development'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { status: 0 };
    }

    throw new Error(`Open Food Facts request failed with ${response.status}`);
  }

  return (await response.json()) as OpenFoodFactsProductResponse;
}

export function mapOpenFoodFactsProduct(
  barcode: string,
  product: OpenFoodFactsProduct
): ProductBody | null {
  const name =
    readText(product.product_name) ??
    readText(product.product_name_ru) ??
    readText(product.product_name_en);

  if (!name) {
    return null;
  }

  const brand = readFirstListValue(product.brands);
  const category =
    readFirstListValue(product.categories) ??
    readCategoryFromTags(product.categories_tags) ??
    'Open Food Facts';
  const officialNutriScoreCategory = readOfficialCategoryFromOffTags(
    product.categories_tags
  );
  const ingredientTexts = selectOpenFoodFactsIngredientTexts(product);
  const nutritionFacts = readNutritionFacts(
    product.nutriments ?? {},
    product.nutrition_data_per
  );
  const imageUrl = selectOpenFoodFactsPrimaryImageUrl(product);

  return productBodySchema.parse({
    barcode,
    name,
    brand,
    category,
    ingredients: ingredientTexts.originalText
      ? splitIngredients(ingredientTexts.originalText)
      : [],
    ingredientsTextOriginal: ingredientTexts.originalText,
    ingredientsTextOriginalLanguage: ingredientTexts.originalLanguage,
    ingredientsTextRu: ingredientTexts.russianText,
    ingredientsTextTranslatedRu: null,
    ingredientsTranslationSource: null,
    ingredientsTranslatedAt: null,
    nutritionFacts,
    officialNutriScoreCategory,
    fruitVegetableLegumePercent: null,
    containsNonSugarSweeteners: null,
    imageUrl,
    dataStatus: 'community',
    source: 'Open Food Facts',
    lastVerifiedAt: null
  });
}

export async function importOpenFoodFactsValidationBatch({
  barcodes = [...openFoodFactsValidationBarcodes],
  fetchProduct = fetchOpenFoodFactsProduct,
  repository,
  productService,
  tazaScorePreviewer,
  requestDelayMs = 0
}: {
  barcodes?: readonly string[];
  fetchProduct?: OpenFoodFactsFetcher;
  repository: ImportProductRepository;
  productService: ImportProductService;
  tazaScorePreviewer: TazaScorePreviewer;
  requestDelayMs?: number;
}): Promise<OpenFoodFactsImportReport> {
  const items: OpenFoodFactsImportReportItem[] = [];

  for (const [index, barcode] of barcodes.entries()) {
    if (index > 0 && requestDelayMs > 0) {
      await delay(requestDelayMs);
    }

    items.push(
      await importOneOpenFoodFactsProduct({
        barcode,
        fetchProduct,
        repository,
        productService,
        tazaScorePreviewer
      })
    );
  }

  return summarize(items);
}

async function importOneOpenFoodFactsProduct({
  barcode,
  fetchProduct,
  repository,
  productService,
  tazaScorePreviewer
}: {
  barcode: string;
  fetchProduct: OpenFoodFactsFetcher;
  repository: ImportProductRepository;
  productService: ImportProductService;
  tazaScorePreviewer: TazaScorePreviewer;
}): Promise<OpenFoodFactsImportReportItem> {
  try {
    const existing = await repository.findByBarcode(barcode);

    if (existing) {
      return reportItemFromExisting(barcode, existing);
    }

    const response = await fetchProduct(barcode);

    if (response.status !== 1 || !response.product) {
      return emptyReportItem(barcode, 'not_found');
    }

    const productBody = mapOpenFoodFactsProduct(barcode, response.product);

    if (!productBody) {
      return emptyReportItem(
        barcode,
        'skipped_incompatible',
        'Open Food Facts product is missing a compatible product name.'
      );
    }

    await productService.create(productBody);
    const tazaScore = tazaScorePreviewer.previewTazaScore(productBody);

    return reportItemFromProductBody(barcode, 'imported', productBody, tazaScore);
  } catch (error) {
    return emptyReportItem(
      barcode,
      'failed',
      error instanceof Error ? error.message : 'Unknown import failure'
    );
  }
}

function readNutritionFacts(
  nutriments: Record<string, unknown>,
  nutritionDataPer: unknown
) {
  return {
    servingType: readServingType(nutritionDataPer),
    energyKcal: readNumber(nutriments['energy-kcal_100g']),
    protein: readNumber(nutriments.proteins_100g),
    carbohydrates: readNumber(nutriments.carbohydrates_100g),
    sugars: readNumber(nutriments.sugars_100g),
    fat: readNumber(nutriments.fat_100g),
    saturatedFat: readNumber(nutriments['saturated-fat_100g']),
    fiber: readNumber(nutriments.fiber_100g),
    salt: readNumber(nutriments.salt_100g)
  };
}

function readServingType(nutritionDataPer: unknown) {
  const value = readText(nutritionDataPer)?.toLowerCase();

  return value === '100ml' ? 'per100ml' : 'per100g';
}

function reportItemFromExisting(
  barcode: string,
  product: Product
): OpenFoodFactsImportReportItem {
  const availableNutritionFields = nutritionFieldNames.filter(
    (field) => product[field] !== null
  );

  return {
    barcode,
    status: 'already_exists',
    productName: product.name,
    brand: product.brand,
    availableNutritionFields,
    missingRelevantFields: missingNutritionFields(availableNutritionFields),
    ingredientsAvailable: product.ingredients.length > 0,
    imageAvailable: product.imageUrl !== null,
    tazaScore: null,
    confidence: null,
    coverage: null,
    safeguardsApplied: [],
    error: null
  };
}

function reportItemFromProductBody(
  barcode: string,
  status: OpenFoodFactsImportStatus,
  product: ProductBody,
  tazaScore: TazaScoreResult
): OpenFoodFactsImportReportItem {
  const availableNutritionFields = nutritionFieldNames.filter(
    (field) => product.nutritionFacts[field] !== null
  );

  return {
    barcode,
    status,
    productName: product.name,
    brand: product.brand ?? null,
    availableNutritionFields,
    missingRelevantFields: missingNutritionFields(availableNutritionFields),
    ingredientsAvailable: product.ingredients.length > 0,
    imageAvailable: product.imageUrl !== null && product.imageUrl !== undefined,
    tazaScore: tazaScore.score,
    confidence: tazaScore.confidence.level,
    coverage: tazaScore.nutritionCoverage,
    safeguardsApplied: tazaScore.safeguardsApplied,
    error: null
  };
}

function emptyReportItem(
  barcode: string,
  status: OpenFoodFactsImportStatus,
  error: string | null = null
): OpenFoodFactsImportReportItem {
  return {
    barcode,
    status,
    productName: null,
    brand: null,
    availableNutritionFields: [],
    missingRelevantFields: [...nutritionFieldNames],
    ingredientsAvailable: false,
    imageAvailable: false,
    tazaScore: null,
    confidence: null,
    coverage: null,
    safeguardsApplied: [],
    error
  };
}

function summarize(items: OpenFoodFactsImportReportItem[]): OpenFoodFactsImportReport {
  return {
    requested: items.length,
    found: items.filter((item) => item.status !== 'not_found' && item.status !== 'failed').length,
    imported: items.filter((item) => item.status === 'imported').length,
    skipped: items.filter(
      (item) => item.status === 'already_exists' || item.status === 'skipped_incompatible'
    ).length,
    notFound: items.filter((item) => item.status === 'not_found').length,
    failed: items.filter((item) => item.status === 'failed').length,
    items
  };
}

function missingNutritionFields(availableNutritionFields: readonly string[]) {
  return nutritionFieldNames.filter(
    (field) => !availableNutritionFields.includes(field)
  );
}

export function selectOpenFoodFactsPrimaryImageUrl(product: OpenFoodFactsProduct) {
  const candidates = [
    ...readSelectedFrontImageUrls(product.selected_images),
    readText(product.image_front_url),
    readText(product.image_url)
  ].filter((value): value is string => value !== null);

  return (
    candidates.find((imageUrl) =>
      productImageQualityEvaluator.evaluate({
        imageUrl,
        source: 'Open Food Facts',
        dataStatus: 'community'
      }).usableAsPrimary
    ) ?? null
  );
}

function readSelectedFrontImageUrls(value: unknown) {
  if (!isRecord(value)) {
    return [];
  }

  const front = value.front;

  if (!isRecord(front)) {
    return [];
  }

  return ['display', 'small', 'thumb']
    .flatMap((size) => readLocalizedImageUrls(front[size]))
    .filter((url): url is string => url !== null);
}

function readLocalizedImageUrls(value: unknown) {
  if (!isRecord(value)) {
    return [];
  }

  return ['ru', 'en', 'fr', 'display']
    .map((key) => readText(value[key]))
    .filter((url): url is string => url !== null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFirstListValue(value: unknown) {
  const text = readText(value);

  return text?.split(',').map((part) => part.trim()).find(Boolean) ?? null;
}

function readCategoryFromTags(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const tag = value.find((item): item is string => typeof item === 'string');

  return tag?.replace(/^[a-z]{2}:/, '').replaceAll('-', ' ') ?? null;
}

export function readOfficialCategoryFromOffTags(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const tags = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.toLowerCase().replace(/^[a-z]{2}:/, ''));

  if (tags.some((tag) => tag.includes('water'))) return 'water';
  if (
    tags.some((tag) =>
      [
        'beverages',
        'drinks',
        'soft-drinks',
        'sodas',
        'juices',
        'fruit-juices',
        'milk',
        'milks',
        'milk-drinks',
        'plant-based-drinks',
        'plant-based-beverages'
      ].includes(tag)
    )
  ) {
    return 'beverage';
  }
  if (tags.some((tag) => tag.includes('cheese'))) return 'cheese';
  if (
    tags.some((tag) =>
      ['oil', 'fat', 'nuts', 'seeds'].some((keyword) => tag.includes(keyword))
    )
  ) {
    return 'fats_oils_nuts_seeds';
  }
  if (tags.some((tag) => tag.includes('red-meat'))) return 'red_meat';
  if (tags.length > 0) return 'general_food';

  return null;
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
