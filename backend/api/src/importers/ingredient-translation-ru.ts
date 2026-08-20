import type { Product } from '../generated/prisma/client';

export type IngredientTranslationProvider = {
  readonly source: string;
  translateToRussian(text: string, sourceLanguage: string | null): string | null;
};

export type IngredientTranslationStatus =
  | 'translated'
  | 'would_translate'
  | 'source_russian_available'
  | 'already_translated'
  | 'already_russian_original'
  | 'no_ingredients'
  | 'no_translation_available'
  | 'skipped_verified'
  | 'failed';

export type IngredientTranslationItem = {
  barcode: string;
  productName: string;
  originalLanguage: string | null;
  sourceRussianAvailable: boolean;
  generatedTranslationAvailable: boolean;
  action: IngredientTranslationStatus;
  error: string | null;
};

export type IngredientTranslationReport = {
  dryRun: boolean;
  candidates: number;
  sourceRussian: number;
  alreadyTranslated: number;
  wouldTranslate: number;
  translated: number;
  noIngredients: number;
  skipped: number;
  failed: number;
  items: IngredientTranslationItem[];
};

export type IngredientTranslationRepository = {
  findCandidates(): Promise<Product[]>;
  updateIngredientTranslationFields(
    id: string,
    data: {
      ingredientsTextTranslatedRu: string;
      ingredientsTranslationSource: string;
      ingredientsTranslatedAt: Date;
    }
  ): Promise<Product>;
};

const ingredientGlossary = new Map<string, string>([
  ['water', 'вода'],
  ['carbonated water', 'газированная вода'],
  ['sugar', 'сахар'],
  ['salt', 'соль'],
  ['cocoa butter', 'какао-масло'],
  ['cocoa mass', 'какао тертое'],
  ['milk powder', 'сухое молоко'],
  ['skimmed milk powder', 'сухое обезжиренное молоко'],
  ['whole milk powder', 'сухое цельное молоко'],
  ['whey powder', 'сухая молочная сыворотка'],
  ['vegetable oil', 'растительное масло'],
  ['sunflower oil', 'подсолнечное масло'],
  ['palm oil', 'пальмовое масло'],
  ['wheat flour', 'пшеничная мука'],
  ['whole wheat flour', 'цельнозерновая пшеничная мука'],
  ['oat flakes', 'овсяные хлопья'],
  ['whole oats', 'цельный овес'],
  ['glucose syrup', 'глюкозный сироп'],
  ['fructose-glucose syrup', 'глюкозно-фруктозный сироп'],
  ['natural flavourings', 'натуральные ароматизаторы'],
  ['natural flavors', 'натуральные ароматизаторы'],
  ['caffeine', 'кофеин'],
  ['phosphoric acid', 'фосфорная кислота'],
  ['citric acid', 'лимонная кислота'],
  ['colour caramel e150d', 'краситель карамельный E150d'],
  ['color caramel e150d', 'краситель карамельный E150d'],
  ['acidity regulator e338', 'регулятор кислотности E338'],
  ['aspartame', 'аспартам'],
  ['acesulfame k', 'ацесульфам K'],
  ['sucralose', 'сукралоза'],
  ['cyclamate', 'цикламат'],
  ['emulsifier', 'эмульгатор'],
  ['lecithins', 'лецитины'],
  ['soy lecithin', 'соевый лецитин'],
  ['hazelnuts', 'фундук'],
  ['almonds', 'миндаль'],
  ['orange juice', 'апельсиновый сок'],
  ['tomato paste', 'томатная паста'],
  ['vinegar', 'уксус'],
  ['mustard', 'горчица'],
  ['egg yolk', 'яичный желток'],
  ['milk', 'молоко'],
  ['cream', 'сливки'],
  ['starter cultures', 'заквасочные культуры']
]);

export class GlossaryIngredientTranslationProvider implements IngredientTranslationProvider {
  readonly source = 'local_glossary_v1';

  translateToRussian(text: string, sourceLanguage: string | null): string | null {
    if (!shouldTranslateText(text, sourceLanguage)) return null;

    const segments = splitIngredientText(text);
    if (segments.length === 0) return null;

    let translatedCount = 0;
    const translated = segments.map((segment) => {
      const translation = translateSegment(segment);
      if (translation !== null) {
        translatedCount += 1;
        return translation;
      }

      return segment;
    });

    if (translatedCount === 0) return null;

    return translated.join('; ');
  }
}

export async function translateIngredientsToRussian({
  repository,
  provider = new GlossaryIngredientTranslationProvider(),
  dryRun = false
}: {
  repository: IngredientTranslationRepository;
  provider?: IngredientTranslationProvider;
  dryRun?: boolean;
}): Promise<IngredientTranslationReport> {
  const candidates = await repository.findCandidates();
  const items: IngredientTranslationItem[] = [];

  for (const product of candidates) {
    items.push(await translateOneProduct({ product, repository, provider, dryRun }));
  }

  return summarize(dryRun, candidates.length, items);
}

async function translateOneProduct({
  product,
  repository,
  provider,
  dryRun
}: {
  product: Product;
  repository: IngredientTranslationRepository;
  provider: IngredientTranslationProvider;
  dryRun: boolean;
}): Promise<IngredientTranslationItem> {
  try {
    if (product.dataStatus === 'verified') {
      return item(product, 'skipped_verified');
    }

    if (product.ingredientsTextRu?.trim()) {
      return item(product, 'source_russian_available');
    }

    if (product.ingredientsTextTranslatedRu?.trim()) {
      return item(product, 'already_translated');
    }

    const originalText = readOriginalIngredientText(product);
    if (!originalText) {
      return item(product, 'no_ingredients');
    }

    if (!shouldTranslateText(originalText, product.ingredientsTextOriginalLanguage)) {
      return item(product, 'already_russian_original');
    }

    const translated = provider.translateToRussian(
      originalText,
      product.ingredientsTextOriginalLanguage
    );

    if (!translated) {
      return item(product, 'no_translation_available');
    }

    if (!dryRun) {
      await repository.updateIngredientTranslationFields(product.id, {
        ingredientsTextTranslatedRu: translated,
        ingredientsTranslationSource: provider.source,
        ingredientsTranslatedAt: new Date()
      });
    }

    return item(
      {
        ...product,
        ingredientsTextTranslatedRu: translated,
        ingredientsTranslationSource: provider.source,
        ingredientsTranslatedAt: new Date()
      },
      dryRun ? 'would_translate' : 'translated'
    );
  } catch (error) {
    return item(
      product,
      'failed',
      error instanceof Error ? error.message : 'Unknown translation failure'
    );
  }
}

function item(
  product: Product,
  action: IngredientTranslationStatus,
  error: string | null = null
): IngredientTranslationItem {
  return {
    barcode: product.barcode,
    productName: product.name,
    originalLanguage: product.ingredientsTextOriginalLanguage,
    sourceRussianAvailable: Boolean(product.ingredientsTextRu?.trim()),
    generatedTranslationAvailable: Boolean(product.ingredientsTextTranslatedRu?.trim()),
    action,
    error
  };
}

function summarize(
  dryRun: boolean,
  candidates: number,
  items: IngredientTranslationItem[]
): IngredientTranslationReport {
  return {
    dryRun,
    candidates,
    sourceRussian: count(items, 'source_russian_available'),
    alreadyTranslated: count(items, 'already_translated'),
    wouldTranslate: count(items, 'would_translate'),
    translated: count(items, 'translated'),
    noIngredients: count(items, 'no_ingredients'),
    skipped: count(items, 'skipped_verified') + count(items, 'already_russian_original'),
    failed: count(items, 'failed'),
    items
  };
}

function count(items: IngredientTranslationItem[], status: IngredientTranslationStatus) {
  return items.filter((item) => item.action === status).length;
}

function readOriginalIngredientText(product: Product) {
  if (product.ingredientsTextOriginal?.trim()) return product.ingredientsTextOriginal.trim();
  if (product.ingredients.length > 0) return product.ingredients.join('; ');
  return null;
}

export function shouldTranslateText(text: string, sourceLanguage: string | null) {
  if (!text.trim()) return false;
  if (sourceLanguage === 'ru') return false;
  if (looksRussian(text)) return false;
  return true;
}

function looksRussian(text: string) {
  return /[а-яё]/i.test(text);
}

function splitIngredientText(text: string) {
  return text
    .split(/[;,]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function translateSegment(segment: string) {
  const normalized = normalizeIngredient(segment);
  return ingredientGlossary.get(normalized) ?? null;
}

function normalizeIngredient(segment: string) {
  return segment
    .toLowerCase()
    .replace(/[*_]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[:.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
