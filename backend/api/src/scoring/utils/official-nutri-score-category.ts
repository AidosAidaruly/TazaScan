import type { OfficialNutriScoreCategory } from '../types/official-nutri-score-result';

const categoryMap: Record<string, OfficialNutriScoreCategory> = {
  water: 'water',
  'plain water': 'water',
  'mineral water': 'water',
  напитки: 'beverage',
  beverages: 'beverage',
  drinks: 'beverage',
  soda: 'beverage',
  'soft drinks': 'beverage',
  juice: 'beverage',
  juices: 'beverage',
  milk: 'beverage',
  'milk drinks': 'beverage',
  'plant-based drinks': 'beverage',
  'plant-based beverages': 'beverage',
  cheese: 'cheese',
  cheeses: 'cheese',
  oils: 'fats_oils_nuts_seeds',
  fats: 'fats_oils_nuts_seeds',
  nuts: 'fats_oils_nuts_seeds',
  seeds: 'fats_oils_nuts_seeds',
  meat: 'red_meat',
  'red meat': 'red_meat',
  food: 'general_food',
  foods: 'general_food',
  dairy: 'general_food',
  snacks: 'general_food',
  bread: 'general_food',
  cereals: 'general_food'
};

export function classifyOfficialNutriScoreCategory(
  category?: OfficialNutriScoreCategory,
  legacyCategoryLabel?: string
): OfficialNutriScoreCategory | null {
  if (category) return category;
  if (!legacyCategoryLabel) return null;

  return categoryMap[legacyCategoryLabel.trim().toLowerCase()] ?? null;
}
