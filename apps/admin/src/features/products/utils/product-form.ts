import type { ProductDto, ProductPayload } from "../types";

export type ProductFormValues = {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  ingredients: string;
  servingType: "per100g" | "per100ml";
  energyKcal: string;
  protein: string;
  carbohydrates: string;
  sugars: string;
  fat: string;
  saturatedFat: string;
  fiber: string;
  salt: string;
  officialNutriScoreCategory: string;
  fruitVegetableLegumePercent: string;
  containsNonSugarSweeteners: "unknown" | "true" | "false";
  imageUrl: string;
  dataStatus: "unverified" | "community" | "verified";
  source: string;
  lastVerifiedAt: string;
};

export const emptyProductFormValues: ProductFormValues = {
  barcode: "",
  name: "",
  brand: "",
  category: "",
  ingredients: "",
  servingType: "per100g",
  energyKcal: "",
  protein: "",
  carbohydrates: "",
  sugars: "",
  fat: "",
  saturatedFat: "",
  fiber: "",
  salt: "",
  officialNutriScoreCategory: "",
  fruitVegetableLegumePercent: "",
  containsNonSugarSweeteners: "unknown",
  imageUrl: "",
  dataStatus: "unverified",
  source: "",
  lastVerifiedAt: "",
};

export function productToFormValues(product: ProductDto): ProductFormValues {
  return {
    barcode: product.barcode,
    name: product.name,
    brand: product.brand ?? "",
    category: product.category,
    ingredients: product.ingredients.join("\n"),
    servingType: product.nutritionFacts.servingType,
    energyKcal: numberToInput(product.nutritionFacts.energyKcal),
    protein: numberToInput(product.nutritionFacts.protein),
    carbohydrates: numberToInput(product.nutritionFacts.carbohydrates),
    sugars: numberToInput(product.nutritionFacts.sugars),
    fat: numberToInput(product.nutritionFacts.fat),
    saturatedFat: numberToInput(product.nutritionFacts.saturatedFat),
    fiber: numberToInput(product.nutritionFacts.fiber),
    salt: numberToInput(product.nutritionFacts.salt),
    officialNutriScoreCategory: product.officialNutriScoreCategory ?? "",
    fruitVegetableLegumePercent: numberToInput(
      product.fruitVegetableLegumePercent,
    ),
    containsNonSugarSweeteners: booleanToInput(
      product.containsNonSugarSweeteners,
    ),
    imageUrl: product.imageUrl ?? "",
    dataStatus: product.dataStatus,
    source: product.source ?? "",
    lastVerifiedAt: product.lastVerifiedAt?.slice(0, 10) ?? "",
  };
}

export function formValuesToPayload(values: ProductFormValues): ProductPayload {
  return {
    barcode: values.barcode.trim(),
    name: values.name.trim(),
    brand: optionalText(values.brand),
    category: values.category.trim(),
    ingredients: values.ingredients
      .split("\n")
      .map((ingredient) => ingredient.trim())
      .filter(Boolean),
    nutritionFacts: {
      servingType: values.servingType,
      energyKcal: nullableNumber(values.energyKcal),
      protein: nullableNumber(values.protein),
      carbohydrates: nullableNumber(values.carbohydrates),
      sugars: nullableNumber(values.sugars),
      fat: nullableNumber(values.fat),
      saturatedFat: nullableNumber(values.saturatedFat),
      fiber: nullableNumber(values.fiber),
      salt: nullableNumber(values.salt),
    },
    officialNutriScoreCategory:
      values.officialNutriScoreCategory === ""
        ? null
        : (values.officialNutriScoreCategory as ProductPayload["officialNutriScoreCategory"]),
    fruitVegetableLegumePercent: nullableNumber(
      values.fruitVegetableLegumePercent,
    ),
    containsNonSugarSweeteners: nullableBoolean(
      values.containsNonSugarSweeteners,
    ),
    dataStatus: values.dataStatus,
    source: optionalText(values.source),
    lastVerifiedAt: values.lastVerifiedAt
      ? new Date(`${values.lastVerifiedAt}T00:00:00.000Z`).toISOString()
      : null,
  };
}

function nullableNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function numberToInput(value: number | null) {
  return value === null ? "" : String(value);
}

function booleanToInput(value: boolean | null) {
  if (value === null) return "unknown";
  return value ? "true" : "false";
}

function nullableBoolean(value: "unknown" | "true" | "false") {
  if (value === "unknown") return null;
  return value === "true";
}
