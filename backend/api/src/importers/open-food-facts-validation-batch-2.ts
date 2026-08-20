import type { Product } from '../generated/prisma/client';
import {
  ProductDataQualityEvaluator,
  type ProductDataQualityInput
} from '../data-quality/product-data-quality.evaluator';
import type { ProductBody } from '../schemas/product.schema';
import type { TazaScoreResult } from '../scoring/types/taza-score-result';
import {
  fetchOpenFoodFactsProduct,
  mapOpenFoodFactsProduct,
  type ImportProductRepository,
  type ImportProductService,
  type OpenFoodFactsFetcher,
  type OpenFoodFactsProduct
} from './open-food-facts-validation-batch';

export type OpenFoodFactsSearchQuery = {
  label: string;
  searchTerms: string;
  categoryTags?: string[];
  countryTags?: string[];
};

export const openFoodFactsValidationBatch2SearchQueries = [
  { label: 'water', searchTerms: 'water', categoryTags: ['waters'] },
  { label: 'soda', searchTerms: 'soda', categoryTags: ['sodas', 'soft-drinks'] },
  { label: 'juice', searchTerms: 'juice', categoryTags: ['fruit-juices', 'juices'] },
  { label: 'milk', searchTerms: 'milk', categoryTags: ['milks'] },
  { label: 'yogurt-kefir', searchTerms: 'yogurt kefir', categoryTags: ['yogurts', 'fermented-milks'] },
  { label: 'cheese', searchTerms: 'cheese', categoryTags: ['cheeses'] },
  { label: 'cottage-cheese', searchTerms: 'tvorog cottage cheese', categoryTags: ['cottage-cheeses'] },
  { label: 'bread', searchTerms: 'bread', categoryTags: ['breads'] },
  { label: 'cereals-oats', searchTerms: 'oats cereal', categoryTags: ['breakfast-cereals', 'oatmeals'] },
  { label: 'chocolate', searchTerms: 'chocolate', categoryTags: ['chocolates'] },
  { label: 'cookies', searchTerms: 'cookies biscuits', categoryTags: ['biscuits-and-cakes', 'biscuits'] },
  { label: 'chips-snacks', searchTerms: 'chips snacks', categoryTags: ['chips-and-fries', 'salty-snacks'] },
  { label: 'sauce-ketchup', searchTerms: 'ketchup sauce', categoryTags: ['ketchups', 'sauces'] },
  { label: 'mayonnaise', searchTerms: 'mayonnaise', categoryTags: ['mayonnaises'] },
  { label: 'sausage-meat', searchTerms: 'sausage', categoryTags: ['sausages'] },
  { label: 'staples', searchTerms: 'pasta buckwheat rice', categoryTags: ['pastas', 'rices', 'buckwheats'] }
] as const satisfies readonly OpenFoodFactsSearchQuery[];

export type OpenFoodFactsSearchResponse = {
  products?: OpenFoodFactsProduct[];
};

export type OpenFoodFactsSearchFetcher = (
  query: OpenFoodFactsSearchQuery
) => Promise<OpenFoodFactsSearchResponse>;

export type TazaScorePreviewer = {
  previewTazaScore(data: ProductBody): TazaScoreResult;
};

export type OpenFoodFactsBatch2Status =
  | 'would_import'
  | 'imported'
  | 'already_exists'
  | 'not_found'
  | 'skipped_incompatible'
  | 'failed';

export type OpenFoodFactsBatch2ReportItem = {
  barcode: string;
  sourceQuery: string;
  status: OpenFoodFactsBatch2Status;
  productName: string | null;
  brand: string | null;
  category: string | null;
  officialNutriScoreCategory: Product['officialNutriScoreCategory'];
  nutritionFieldsAvailable: string[];
  nutritionFieldsMissing: string[];
  ingredientsAvailable: boolean;
  imageAvailable: boolean;
  dataQualityStatus: string | null;
  dataQualityWarningCodes: string[];
  dataQualityWarningFields: string[];
  tazaScore: number | null;
  confidence: string | null;
  coverage: number | null;
  missingCriticalFields: string[];
  scoreBeforeSafeguard: number | null;
  scoreCap: number | null;
  safeguardsApplied: string[];
  error: string | null;
};

export type OpenFoodFactsBatch2DiscoveryError = {
  sourceQuery: string;
  searchTerms: string;
  error: string;
};

export type OpenFoodFactsBatch2Aggregate = {
  candidatesConsidered: number;
  discoveryErrors: OpenFoodFactsBatch2DiscoveryError[];
  productsSelected: number;
  imported: number;
  alreadyExisting: number;
  notCompatible: number;
  withIngredients: number;
  withoutIngredients: number;
  withImage: number;
  fullNutrition: number;
  partialNutrition: number;
  confidenceCounts: Record<'high' | 'medium' | 'low', number>;
  productsWithDataQualityWarnings: number;
  categoryDistribution: Record<string, number>;
  tazaScoreDistribution: Record<string, number>;
};

export type OpenFoodFactsBatch2Report = OpenFoodFactsBatch2Aggregate & {
  dryRun: boolean;
  items: OpenFoodFactsBatch2ReportItem[];
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

const productDataQualityEvaluator = new ProductDataQualityEvaluator();

export async function fetchOpenFoodFactsSearch(
  query: OpenFoodFactsSearchQuery
): Promise<OpenFoodFactsSearchResponse> {
  const attempts = [
    { includeCountries: true, includeCategories: true },
    { includeCountries: false, includeCategories: true },
    { includeCountries: false, includeCategories: false }
  ];
  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      return await fetchOpenFoodFactsSearchAttempt(query, attempt);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown OFF search failure');
    }
  }

  throw lastError ?? new Error('Open Food Facts search failed');
}

async function fetchOpenFoodFactsSearchAttempt(
  query: OpenFoodFactsSearchQuery,
  {
    includeCountries,
    includeCategories
  }: {
    includeCountries: boolean;
    includeCategories: boolean;
  }
): Promise<OpenFoodFactsSearchResponse> {
  const url = new URL('https://world.openfoodfacts.org/api/v2/search');
  url.searchParams.set('search_terms', query.searchTerms);
  url.searchParams.set('page_size', '12');

  if (includeCountries) {
    url.searchParams.set(
      'countries_tags_en',
      (query.countryTags ?? ['Kazakhstan', 'Russia']).join(',')
    );
  }

  if (includeCategories && query.categoryTags && query.categoryTags.length > 0) {
    url.searchParams.set('categories_tags_en', query.categoryTags.join(','));
  }
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
      'nutriments',
      'countries_tags'
    ].join(',')
  );

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'TazaScan validation batch 2 importer - contact: local-development'
    }
  });

  if (!response.ok) {
    throw new Error(`Open Food Facts search failed with ${response.status}`);
  }

  return (await response.json()) as OpenFoodFactsSearchResponse;
}

export async function buildOpenFoodFactsValidationBatch2({
  dryRun = true,
  searchQueries = [...openFoodFactsValidationBatch2SearchQueries],
  searchFetcher = fetchOpenFoodFactsSearch,
  fetchProduct = fetchOpenFoodFactsProduct,
  repository,
  productService,
  tazaScorePreviewer,
  maxProducts = 25,
  maxProductsPerQuery = 3,
  requestDelayMs = 0
}: {
  dryRun?: boolean;
  searchQueries?: readonly OpenFoodFactsSearchQuery[];
  searchFetcher?: OpenFoodFactsSearchFetcher;
  fetchProduct?: OpenFoodFactsFetcher;
  repository: ImportProductRepository;
  productService: ImportProductService;
  tazaScorePreviewer: TazaScorePreviewer;
  maxProducts?: number;
  maxProductsPerQuery?: number;
  requestDelayMs?: number;
}): Promise<OpenFoodFactsBatch2Report> {
  const candidates = await discoverCandidates({
    searchQueries,
    searchFetcher,
    maxProductsPerQuery,
    requestDelayMs
  });
  const selectedCandidates = selectCandidates(candidates.items, maxProducts);
  const items: OpenFoodFactsBatch2ReportItem[] = [];

  for (const [index, candidate] of selectedCandidates.entries()) {
    if (index > 0 && requestDelayMs > 0) {
      await delay(requestDelayMs);
    }

    items.push(
      await evaluateCandidate({
        candidate,
        dryRun,
        repository,
        productService,
        fetchProduct,
        tazaScorePreviewer
      })
    );
  }

  return summarize({
    dryRun,
    candidatesConsidered: candidates.items.length,
    discoveryErrors: candidates.discoveryErrors,
    items
  });
}

async function discoverCandidates({
  searchQueries,
  searchFetcher,
  maxProductsPerQuery,
  requestDelayMs
}: {
  searchQueries: readonly OpenFoodFactsSearchQuery[];
  searchFetcher: OpenFoodFactsSearchFetcher;
  maxProductsPerQuery: number;
  requestDelayMs: number;
}) {
  const candidates: Candidate[] = [];
  const discoveryErrors: OpenFoodFactsBatch2DiscoveryError[] = [];
  const seenBarcodes = new Set<string>();

  for (const [index, query] of searchQueries.entries()) {
    if (index > 0 && requestDelayMs > 0) {
      await delay(requestDelayMs);
    }

    let response: OpenFoodFactsSearchResponse;

    try {
      response = await searchFetcher(query);
    } catch (error) {
      discoveryErrors.push({
        sourceQuery: query.label,
        searchTerms: query.searchTerms,
        error: error instanceof Error ? error.message : 'Unknown OFF search failure'
      });
      continue;
    }
    let acceptedForQuery = 0;

    for (const product of response.products ?? []) {
      const barcode = readBarcode(product.code);

      if (!barcode || seenBarcodes.has(barcode)) {
        continue;
      }

      seenBarcodes.add(barcode);
      candidates.push({
        barcode,
        sourceQuery: query.label,
        suitabilityScore: candidateSuitability(product)
      });
      acceptedForQuery += 1;

      if (acceptedForQuery >= maxProductsPerQuery) {
        break;
      }
    }
  }

  return {
    items: candidates,
    discoveryErrors
  };
}

function selectCandidates(candidates: Candidate[], maxProducts: number) {
  const grouped = new Map<string, Candidate[]>();

  for (const candidate of candidates) {
    const group = grouped.get(candidate.sourceQuery) ?? [];
    group.push(candidate);
    grouped.set(candidate.sourceQuery, group);
  }

  for (const group of grouped.values()) {
    group.sort((left, right) => right.suitabilityScore - left.suitabilityScore);
  }

  const selected: Candidate[] = [];

  while (selected.length < maxProducts) {
    const previousCount = selected.length;

    for (const group of grouped.values()) {
      const candidate = group.shift();

      if (candidate) {
        selected.push(candidate);
      }

      if (selected.length >= maxProducts) {
        break;
      }
    }

    if (selected.length === previousCount) {
      break;
    }
  }

  return selected;
}

async function evaluateCandidate({
  candidate,
  dryRun,
  repository,
  productService,
  fetchProduct,
  tazaScorePreviewer
}: {
  candidate: Candidate;
  dryRun: boolean;
  repository: ImportProductRepository;
  productService: ImportProductService;
  fetchProduct: OpenFoodFactsFetcher;
  tazaScorePreviewer: TazaScorePreviewer;
}): Promise<OpenFoodFactsBatch2ReportItem> {
  try {
    const existing = await repository.findByBarcode(candidate.barcode);

    if (existing) {
      return itemFromExisting(candidate, existing);
    }

    const response = await fetchProduct(candidate.barcode);

    if (response.status !== 1 || !response.product) {
      return emptyItem(candidate, 'not_found');
    }

    const productBody = mapOpenFoodFactsProduct(candidate.barcode, response.product);

    if (!productBody) {
      return emptyItem(
        candidate,
        'skipped_incompatible',
        'Open Food Facts product is missing fields required by Product creation.'
      );
    }

    if (!dryRun) {
      await productService.create(productBody);
    }

    return itemFromProductBody(
      candidate,
      dryRun ? 'would_import' : 'imported',
      productBody,
      tazaScorePreviewer.previewTazaScore(productBody)
    );
  } catch (error) {
    return emptyItem(
      candidate,
      'failed',
      error instanceof Error ? error.message : 'Unknown batch 2 import failure'
    );
  }
}

function itemFromExisting(
  candidate: Candidate,
  product: Product
): OpenFoodFactsBatch2ReportItem {
  const availableNutrition = nutritionFieldNames.filter(
    (field) => product[field] !== null
  );

  return {
    barcode: candidate.barcode,
    sourceQuery: candidate.sourceQuery,
    status: 'already_exists',
    productName: product.name,
    brand: product.brand,
    category: product.category,
    officialNutriScoreCategory: product.officialNutriScoreCategory,
    nutritionFieldsAvailable: availableNutrition,
    nutritionFieldsMissing: missingNutritionFields(availableNutrition),
    ingredientsAvailable: product.ingredients.length > 0,
    imageAvailable: product.imageUrl !== null,
    dataQualityStatus: null,
    dataQualityWarningCodes: [],
    dataQualityWarningFields: [],
    tazaScore: null,
    confidence: null,
    coverage: null,
    missingCriticalFields: [],
    scoreBeforeSafeguard: null,
    scoreCap: null,
    safeguardsApplied: [],
    error: null
  };
}

function itemFromProductBody(
  candidate: Candidate,
  status: Extract<OpenFoodFactsBatch2Status, 'would_import' | 'imported'>,
  product: ProductBody,
  tazaScore: TazaScoreResult
): OpenFoodFactsBatch2ReportItem {
  const availableNutrition = nutritionFieldNames.filter(
    (field) => product.nutritionFacts[field] !== null
  );
  const dataQuality = productDataQualityEvaluator.evaluate(
    dataQualityInputFromProductBody(product)
  );

  return {
    barcode: candidate.barcode,
    sourceQuery: candidate.sourceQuery,
    status,
    productName: product.name,
    brand: product.brand ?? null,
    category: product.category,
    officialNutriScoreCategory: product.officialNutriScoreCategory ?? null,
    nutritionFieldsAvailable: availableNutrition,
    nutritionFieldsMissing: missingNutritionFields(availableNutrition),
    ingredientsAvailable: product.ingredients.length > 0,
    imageAvailable: product.imageUrl !== null && product.imageUrl !== undefined,
    dataQualityStatus: dataQuality.status,
    dataQualityWarningCodes: dataQuality.warnings.map((warning) => warning.code),
    dataQualityWarningFields: unique(
      dataQuality.warnings.flatMap((warning) => warning.fields)
    ),
    tazaScore: tazaScore.score,
    confidence: tazaScore.confidence.level,
    coverage: tazaScore.nutritionCoverage,
    missingCriticalFields: tazaScore.missingCriticalFields,
    scoreBeforeSafeguard: tazaScore.scoreBeforeSafeguard,
    scoreCap: tazaScore.scoreCap,
    safeguardsApplied: tazaScore.safeguardsApplied,
    error: null
  };
}

function emptyItem(
  candidate: Candidate,
  status: Exclude<OpenFoodFactsBatch2Status, 'would_import' | 'imported' | 'already_exists'>,
  error: string | null = null
): OpenFoodFactsBatch2ReportItem {
  return {
    barcode: candidate.barcode,
    sourceQuery: candidate.sourceQuery,
    status,
    productName: null,
    brand: null,
    category: null,
    officialNutriScoreCategory: null,
    nutritionFieldsAvailable: [],
    nutritionFieldsMissing: [...nutritionFieldNames],
    ingredientsAvailable: false,
    imageAvailable: false,
    dataQualityStatus: null,
    dataQualityWarningCodes: [],
    dataQualityWarningFields: [],
    tazaScore: null,
    confidence: null,
    coverage: null,
    missingCriticalFields: [],
    scoreBeforeSafeguard: null,
    scoreCap: null,
    safeguardsApplied: [],
    error
  };
}

function summarize({
  dryRun,
  candidatesConsidered,
  discoveryErrors,
  items
}: {
  dryRun: boolean;
  candidatesConsidered: number;
  discoveryErrors: OpenFoodFactsBatch2DiscoveryError[];
  items: OpenFoodFactsBatch2ReportItem[];
}): OpenFoodFactsBatch2Report {
  const categoryDistribution: Record<string, number> = {};
  const tazaScoreDistribution: Record<string, number> = {};
  const confidenceCounts = { high: 0, medium: 0, low: 0 };

  for (const item of items) {
    if (item.officialNutriScoreCategory) {
      categoryDistribution[item.officialNutriScoreCategory] =
        (categoryDistribution[item.officialNutriScoreCategory] ?? 0) + 1;
    }

    if (item.confidence === 'high' || item.confidence === 'medium' || item.confidence === 'low') {
      confidenceCounts[item.confidence] += 1;
    }

    const band = scoreBand(item.tazaScore);
    tazaScoreDistribution[band] = (tazaScoreDistribution[band] ?? 0) + 1;
  }

  return {
    dryRun,
    candidatesConsidered,
    discoveryErrors,
    productsSelected: items.length,
    imported: items.filter((item) => item.status === 'imported' || item.status === 'would_import')
      .length,
    alreadyExisting: items.filter((item) => item.status === 'already_exists').length,
    notCompatible: items.filter((item) => item.status === 'skipped_incompatible').length,
    withIngredients: items.filter((item) => item.ingredientsAvailable).length,
    withoutIngredients: items.filter((item) => !item.ingredientsAvailable).length,
    withImage: items.filter((item) => item.imageAvailable).length,
    fullNutrition: items.filter((item) => item.nutritionFieldsMissing.length === 0).length,
    partialNutrition: items.filter(
      (item) =>
        item.nutritionFieldsAvailable.length > 0 && item.nutritionFieldsMissing.length > 0
    ).length,
    confidenceCounts,
    productsWithDataQualityWarnings: items.filter(
      (item) => item.dataQualityWarningCodes.length > 0
    ).length,
    categoryDistribution,
    tazaScoreDistribution,
    items
  };
}

function candidateSuitability(product: OpenFoodFactsProduct) {
  let score = 0;

  if (readBarcode(product.code)) score += 3;
  if (hasText(product.product_name) || hasText(product.product_name_ru) || hasText(product.product_name_en)) {
    score += 3;
  }
  if (hasText(product.brands)) score += 1;
  if (hasText(product.image_front_url) || hasText(product.image_url)) score += 2;
  if (hasText(product.ingredients_text) || hasText(product.ingredients_text_ru) || hasText(product.ingredients_text_en)) {
    score += 2;
  }

  const nutritionCount = nutritionFieldNames.filter(
    (field) => readOffNutritionNumber(product, field) !== null
  ).length;
  score += Math.min(nutritionCount, 5);

  if (Array.isArray(product.categories_tags) && product.categories_tags.length > 0) {
    score += 2;
  }

  if (isKazakhstanOrCisRelevant(product)) {
    score += 1;
  }

  return score;
}

function readOffNutritionNumber(product: OpenFoodFactsProduct, field: (typeof nutritionFieldNames)[number]) {
  const nutriments = product.nutriments ?? {};
  const offFieldByNutritionField = {
    energyKcal: 'energy-kcal_100g',
    protein: 'proteins_100g',
    carbohydrates: 'carbohydrates_100g',
    sugars: 'sugars_100g',
    fat: 'fat_100g',
    saturatedFat: 'saturated-fat_100g',
    fiber: 'fiber_100g',
    salt: 'salt_100g'
  } satisfies Record<(typeof nutritionFieldNames)[number], string>;
  const value = nutriments[offFieldByNutritionField[field]];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function dataQualityInputFromProductBody(product: ProductBody): ProductDataQualityInput {
  return {
    source: product.source ?? null,
    dataStatus: product.dataStatus ?? 'unverified',
    officialNutriScoreCategory: product.officialNutriScoreCategory ?? null,
    energyKcal: product.nutritionFacts.energyKcal ?? null,
    protein: product.nutritionFacts.protein ?? null,
    carbohydrates: product.nutritionFacts.carbohydrates ?? null,
    sugars: product.nutritionFacts.sugars ?? null,
    fat: product.nutritionFacts.fat ?? null,
    saturatedFat: product.nutritionFacts.saturatedFat ?? null,
    fiber: product.nutritionFacts.fiber ?? null,
    salt: product.nutritionFacts.salt ?? null
  };
}

function missingNutritionFields(availableNutritionFields: readonly string[]) {
  return nutritionFieldNames.filter(
    (field) => !availableNutritionFields.includes(field)
  );
}

function readBarcode(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : null;

  return text && /^\d{8,14}$/.test(text) ? text : null;
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isKazakhstanOrCisRelevant(product: OpenFoodFactsProduct) {
  const tags = Array.isArray(product.countries_tags)
    ? product.countries_tags.filter((item): item is string => typeof item === 'string')
    : [];

  return tags.some((tag) =>
    ['kazakhstan', 'russia', 'belarus', 'kyrgyzstan'].some((country) =>
      tag.toLowerCase().includes(country)
    )
  );
}

function scoreBand(score: number | null) {
  if (score === null) return 'unavailable';
  if (score >= 80) return '80-100';
  if (score >= 60) return '60-79';
  if (score >= 40) return '40-59';
  if (score >= 20) return '20-39';

  return '0-19';
}

function unique(values: string[]) {
  return [...new Set(values)];
}

type Candidate = {
  barcode: string;
  sourceQuery: string;
  suitabilityScore: number;
};

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
