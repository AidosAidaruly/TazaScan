import type {
  OcrNumericFieldCandidate,
  SubmissionIngredientsOcrCandidate,
  SubmissionNutritionOcrCandidate
} from '../types/submission-ocr';

type NutritionField = keyof SubmissionNutritionOcrCandidate['nutrition'];

const nutritionFields: NutritionField[] = [
  'energyKcal',
  'protein',
  'carbohydrates',
  'sugars',
  'fat',
  'saturatedFat',
  'fiber',
  'salt'
];

const fieldAliases: Record<NutritionField, RegExp[]> = {
  energyKcal: [/energy/i, /энергетическая\s+ценность/i, /калори/i],
  protein: [/protein/i, /белк/i, /ақуыз/i],
  carbohydrates: [/carbohydrate/i, /углевод/i, /көмірсу/i],
  sugars: [/sugars?/i, /сахар/i, /қант/i],
  fat: [/^жиры?\b/i, /\bfat\b/i, /майлар/i],
  saturatedFat: [/saturated\s+fat/i, /насыщенн/i, /қаныққан/i],
  fiber: [/fib(?:er|re)/i, /клетчат/i, /пищевые\s+волокна/i, /талшық/i],
  salt: [/\bsalt\b/i, /соль/i, /тұз/i]
};

export class SubmissionOcrParser {
  parseNutrition(rawText: string): SubmissionNutritionOcrCandidate {
    const text = normalizeText(rawText);
    const detectedBasis = this.detectBasis(text);
    const warnings: string[] = [];
    const emptyNutrition = this.emptyNutrition();

    if (detectedBasis === 'serving' || detectedBasis === 'unknown') {
      warnings.push(
        detectedBasis === 'serving'
          ? 'serving_values_not_used'
          : 'per100_basis_not_detected'
      );

      return {
        nutrition: emptyNutrition,
        detectedBasis,
        rawText,
        warnings
      };
    }

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const nutrition = this.emptyNutrition();

    for (const field of nutritionFields) {
      const value = field === 'energyKcal'
        ? this.extractEnergy(lines)
        : this.extractFieldValue(lines, field);
      nutrition[field] = toCandidate(value);
    }

    for (const field of nutritionFields) {
      if (nutrition[field].value === null) {
        warnings.push(`${field}_not_detected`);
      }
    }

    return {
      nutrition,
      detectedBasis,
      rawText,
      warnings
    };
  }

  parseIngredients(rawText: string): SubmissionIngredientsOcrCandidate {
    const text = rawText.trim();
    const extracted = this.extractIngredientText(text);
    const warnings: string[] = [];

    if (!extracted) {
      warnings.push('ingredients_text_not_detected');
    }

    return {
      ingredientsText: {
        value: extracted,
        confidence: extracted ? 'detected' : 'not_detected',
        detectedLanguage: extracted ? this.detectLanguage(extracted) : 'unknown'
      },
      rawText,
      warnings
    };
  }

  private detectBasis(text: string): SubmissionNutritionOcrCandidate['detectedBasis'] {
    if (/(на\s*)?100\s*(ml|мл|миллилитр|миллилитров)/i.test(text)) {
      return 'per100ml';
    }

    if (/(на\s*)?100\s*(g|гр|г|gram|grams|грамм|граммов)/i.test(text)) {
      return 'per100g';
    }

    if (/\bserving\b|порци|на\s+порц/i.test(text)) {
      return 'serving';
    }

    return 'unknown';
  }

  private extractEnergy(lines: string[]) {
    for (const line of this.linesForField(lines, 'energyKcal')) {
      const kcal = readNumberBeforeUnit(line, /kcal|ккал/i);
      if (kcal !== null) {
        return kcal;
      }
    }

    for (const line of this.linesForField(lines, 'energyKcal')) {
      const kj = readNumberBeforeUnit(line, /kj|кдж|кж/i);
      if (kj !== null) {
        return roundOneDecimal(kj / 4.184);
      }
    }

    return null;
  }

  private extractFieldValue(lines: string[], field: NutritionField) {
    for (const line of this.linesForField(lines, field)) {
      const sanitizedLine = line
        .replace(/100\s*(ml|мл|g|гр|г|gram|grams|грамм|граммов)/gi, ' ')
        .replace(/\d+\s*(kcal|ккал|kj|кдж|кж)/gi, ' ');
      const value = readFirstNumber(sanitizedLine);
      if (value !== null) {
        return value;
      }
    }

    return null;
  }

  private linesForField(lines: string[], field: NutritionField) {
    return lines.filter((line) => {
      if (field === 'fat' && fieldAliases.saturatedFat.some((alias) => alias.test(line))) {
        return false;
      }

      return fieldAliases[field].some((alias) => alias.test(line));
    });
  }

  private extractIngredientText(text: string) {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return null;
    }

    const marker = /(состав|ингредиенты|ingredients|құрамы)\s*[:：-]?/i.exec(normalized);
    const candidate = marker
      ? normalized.slice(marker.index + marker[0].length)
      : normalized;
    const firstSection = candidate
      .split(/\n(?=.*(?:nutrition|пищевая|энергетическая|kcal|ккал))/i)[0] ?? '';
    const cleaned = firstSection
      .replace(/\s+/g, ' ')
      .replace(/^[\s:：-]+/, '')
      .trim();

    return cleaned.length >= 3 ? cleaned : null;
  }

  private detectLanguage(value: string): SubmissionIngredientsOcrCandidate['ingredientsText']['detectedLanguage'] {
    if (/[әғқңөұүһі]/i.test(value)) {
      return 'kk';
    }

    if (/[а-яё]/i.test(value)) {
      return 'ru';
    }

    if (/[a-z]/i.test(value)) {
      return 'en';
    }

    return 'unknown';
  }

  private emptyNutrition(): SubmissionNutritionOcrCandidate['nutrition'] {
    return Object.fromEntries(
      nutritionFields.map((field) => [field, toCandidate(null)])
    ) as SubmissionNutritionOcrCandidate['nutrition'];
  }
}

function normalizeText(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/[|]/g, ' ');
}

function toCandidate(value: number | null): OcrNumericFieldCandidate {
  return {
    value,
    confidence: value === null ? 'not_detected' : 'detected'
  };
}

function readNumberBeforeUnit(line: string, unit: RegExp) {
  const matches = [...line.matchAll(/(-?\d+(?:[,.]\d+)?)\s*([a-zа-яё]+)/gi)];
  for (const match of matches) {
    const rawValue = match[1];
    const rawUnit = match[2];
    if (rawValue && rawUnit && unit.test(rawUnit)) {
      return parseOcrNumber(rawValue);
    }
  }

  return null;
}

function readFirstNumber(line: string) {
  const match = /(-?\d+(?:[,.]\d+)?)/.exec(line);
  return match?.[1] ? parseOcrNumber(match[1]) : null;
}

function parseOcrNumber(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
