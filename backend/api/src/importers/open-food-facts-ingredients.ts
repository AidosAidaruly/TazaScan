export type OpenFoodFactsIngredientTextFields = {
  ingredients_text?: unknown;
  ingredients_text_en?: unknown;
  ingredients_text_ru?: unknown;
  ingredients_text_kk?: unknown;
};

export type IngredientLanguageSelection = {
  consumerText: string | null;
  consumerLanguage: string | null;
  originalText: string | null;
  originalLanguage: string | null;
  russianText: string | null;
};

export function selectOpenFoodFactsIngredientTexts(
  product: OpenFoodFactsIngredientTextFields
): IngredientLanguageSelection {
  const russianText = readText(product.ingredients_text_ru);
  const kazakhText = readText(product.ingredients_text_kk);
  const defaultText = readText(product.ingredients_text);
  const englishText = readText(product.ingredients_text_en);
  const original = selectOriginalIngredientText({
    defaultText,
    russianText,
    kazakhText,
    englishText
  });
  const consumerText = russianText ?? kazakhText ?? defaultText ?? englishText;

  return {
    consumerText,
    consumerLanguage: russianText
      ? 'ru'
      : kazakhText
        ? 'kk'
        : defaultText
          ? original.language
          : englishText
            ? 'en'
            : null,
    originalText: original.text,
    originalLanguage: original.language,
    russianText
  };
}

export function splitIngredients(value: string) {
  return value
    .split(/[;,]/)
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);
}

export function readText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function selectOriginalIngredientText({
  defaultText,
  russianText,
  kazakhText,
  englishText
}: {
  defaultText: string | null;
  russianText: string | null;
  kazakhText: string | null;
  englishText: string | null;
}) {
  if (defaultText) {
    return {
      text: defaultText,
      language: inferIngredientLanguage(defaultText, {
        russianText,
        kazakhText,
        englishText
      })
    };
  }

  if (russianText) return { text: russianText, language: 'ru' };
  if (kazakhText) return { text: kazakhText, language: 'kk' };
  if (englishText) return { text: englishText, language: 'en' };

  return { text: null, language: null };
}

function inferIngredientLanguage(
  text: string,
  known: {
    russianText: string | null;
    kazakhText: string | null;
    englishText: string | null;
  }
) {
  if (known.russianText && text === known.russianText) return 'ru';
  if (known.kazakhText && text === known.kazakhText) return 'kk';
  if (known.englishText && text === known.englishText) return 'en';
  if (/[а-яё]/i.test(text)) return 'ru';
  if (/[әғқңөұүһі]/i.test(text)) return 'kk';

  return 'unknown';
}
