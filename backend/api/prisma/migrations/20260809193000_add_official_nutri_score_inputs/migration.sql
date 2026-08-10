CREATE TYPE "OfficialNutriScoreCategory" AS ENUM (
  'general_food',
  'beverage',
  'water',
  'cheese',
  'fats_oils_nuts_seeds',
  'red_meat'
);

ALTER TABLE "products"
ADD COLUMN "officialNutriScoreCategory" "OfficialNutriScoreCategory",
ADD COLUMN "fruitVegetableLegumePercent" DOUBLE PRECISION,
ADD COLUMN "containsNonSugarSweeteners" BOOLEAN;
