import type { Product } from '../generated/prisma/client';

export type NutritionFactsDto = {
  servingType: Product['servingType'];
  energyKcal: number | null;
  protein: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  fat: number | null;
  saturatedFat: number | null;
  fiber: number | null;
  salt: number | null;
};

export type ProductDto = {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  category: string;
  ingredients: string[];
  nutritionFacts: NutritionFactsDto;
  healthScore: number;
  imageUrl: string | null;
  dataStatus: Product['dataStatus'];
  source: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toProductDto(product: Product): ProductDto {
  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    category: product.category,
    ingredients: product.ingredients,
    nutritionFacts: {
      servingType: product.servingType,
      energyKcal: product.energyKcal,
      protein: product.protein,
      carbohydrates: product.carbohydrates,
      sugars: product.sugars,
      fat: product.fat,
      saturatedFat: product.saturatedFat,
      fiber: product.fiber,
      salt: product.salt
    },
    healthScore: product.healthScore,
    imageUrl: product.imageUrl,
    dataStatus: product.dataStatus,
    source: product.source,
    lastVerifiedAt: product.lastVerifiedAt?.toISOString() ?? null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  };
}
