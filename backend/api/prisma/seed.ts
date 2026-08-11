import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { NutriScoreEngine } from '../src/scoring/engines/nutri-score.engine';
import type { ScoreInput } from '../src/scoring/types/score-result';
import { PasswordService } from '../src/services/password.service';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });
const passwordService = new PasswordService();
const scoreEngine = new NutriScoreEngine();

type SeedProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  category: string;
  ingredients: string[];
  servingType: 'per100g' | 'per100ml';
  energyKcal: number | null;
  protein: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  fat: number | null;
  saturatedFat: number | null;
  fiber: number | null;
  salt: number | null;
  officialNutriScoreCategory:
    | 'general_food'
    | 'beverage'
    | 'water'
    | 'cheese'
    | 'fats_oils_nuts_seeds'
    | 'red_meat'
    | null;
  fruitVegetableLegumePercent: number | null;
  containsNonSugarSweeteners: boolean | null;
  dataStatus: 'verified' | 'community' | 'unverified';
  source: string;
};

const verifiedAt = new Date('2026-08-11T00:00:00.000Z');

const seedProducts: SeedProduct[] = [
  {
    barcode: '5449000000996',
    name: 'Coca-Cola Original Taste',
    brand: 'Coca-Cola',
    category: 'Soft Drinks',
    ingredients: [
      'Carbonated water',
      'Sugar',
      'Colour caramel E150d',
      'Phosphoric acid',
      'Natural flavourings',
      'Caffeine'
    ],
    servingType: 'per100ml',
    energyKcal: 42,
    protein: 0,
    carbohydrates: 10.6,
    sugars: 10.6,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    salt: 0,
    officialNutriScoreCategory: 'beverage',
    fruitVegetableLegumePercent: 0,
    containsNonSugarSweeteners: false,
    dataStatus: 'verified',
    source: 'seed'
  },
  {
    barcode: '4870207510444',
    name: 'WOTO Drinking Water',
    brand: 'WOTO',
    category: 'Water',
    ingredients: ['Water'],
    servingType: 'per100ml',
    energyKcal: 0,
    protein: 0,
    carbohydrates: 0,
    sugars: 0,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    salt: null,
    officialNutriScoreCategory: 'water',
    fruitVegetableLegumePercent: 0,
    containsNonSugarSweeteners: false,
    dataStatus: 'verified',
    source: 'physical product label'
  },
  {
    barcode: '4604248020767',
    name: 'Махеевъ Кетчуп Шашлычный',
    brand: 'Махеевъ',
    category: 'Ketchup / Sauces',
    ingredients: [
      'Water',
      'Tomato paste',
      'Sugar',
      'Modified starch E1422',
      'Salt',
      'Garlic',
      'Onion',
      'Spices and herbs',
      'Acidity regulators',
      'Ascorbic acid',
      'Potassium sorbate',
      'Sodium benzoate'
    ],
    servingType: 'per100g',
    energyKcal: 85,
    protein: 1.4,
    carbohydrates: 19.9,
    sugars: 17.5,
    fat: 0,
    saturatedFat: 0,
    fiber: null,
    salt: 2,
    officialNutriScoreCategory: 'general_food',
    fruitVegetableLegumePercent: null,
    containsNonSugarSweeteners: null,
    dataStatus: 'verified',
    source: 'physical product label / manufacturer ingredient data'
  },
  {
    barcode: '4870144749266',
    name: 'Bon Appetit Майонез Провансаль 67%',
    brand: 'Bon Appetit',
    category: 'Mayonnaise / Sauces',
    ingredients: [
      'Sunflower oil',
      'Water',
      'Sugar',
      'Salt',
      'Dried egg yolk',
      'Modified starch',
      'Acidity regulators including acetic acid and citric acid',
      'Natural-identical mustard flavour',
      'Sodium benzoate',
      'Potassium sorbate',
      'Beta-carotene'
    ],
    servingType: 'per100g',
    energyKcal: 619,
    protein: 1.1,
    carbohydrates: 3.0,
    sugars: null,
    fat: 67,
    saturatedFat: null,
    fiber: null,
    salt: null,
    officialNutriScoreCategory: 'fats_oils_nuts_seeds',
    fruitVegetableLegumePercent: null,
    containsNonSugarSweeteners: null,
    dataStatus: 'verified',
    source: 'physical product label'
  },
  {
    barcode: '4870144745152',
    name: 'Томатный рай Томатная паста 25%',
    brand: 'Томатный рай / Масло-Дел',
    category: 'Tomato paste',
    ingredients: ['Tomato paste', 'Water', 'Salt'],
    servingType: 'per100g',
    energyKcal: 79,
    protein: 4.9,
    carbohydrates: null,
    sugars: null,
    fat: 0.2,
    saturatedFat: null,
    fiber: null,
    salt: null,
    officialNutriScoreCategory: 'general_food',
    fruitVegetableLegumePercent: null,
    containsNonSugarSweeteners: false,
    dataStatus: 'verified',
    source: 'physical product label'
  }
];

async function main() {
  await seedAdminUser();

  for (const product of seedProducts) {
    await upsertProduct(product);
  }
}

async function upsertProduct(product: SeedProduct) {
  const score = scoreEngine.calculate(toLegacyScoreInput(product));
  const scoreData = {
    healthScore: score.score ?? 0,
    calculatedScore: score.score,
    calculatedGrade: score.grade,
    scoreStatus: score.status,
    scoreAlgorithm: score.algorithm,
    scoreVersion: score.algorithmVersion,
    scoreCalculatedAt: new Date(score.calculatedAt),
    scoreDetails: score
  };
  const data = {
    name: product.name,
    brand: product.brand,
    category: product.category,
    ingredients: product.ingredients,
    servingType: product.servingType,
    energyKcal: product.energyKcal,
    protein: product.protein,
    carbohydrates: product.carbohydrates,
    sugars: product.sugars,
    fat: product.fat,
    saturatedFat: product.saturatedFat,
    fiber: product.fiber,
    salt: product.salt,
    officialNutriScoreCategory: product.officialNutriScoreCategory,
    fruitVegetableLegumePercent: product.fruitVegetableLegumePercent,
    containsNonSugarSweeteners: product.containsNonSugarSweeteners,
    ...scoreData,
    dataStatus: product.dataStatus,
    source: product.source,
    lastVerifiedAt: verifiedAt
  };

  await prisma.product.upsert({
    where: {
      barcode: product.barcode
    },
    update: data,
    create: {
      barcode: product.barcode,
      ...data,
      imageUrl: null
    }
  });
}

function toLegacyScoreInput(product: SeedProduct): ScoreInput {
  return {
    servingType: product.servingType,
    energyKcal: product.energyKcal,
    protein: product.protein,
    carbohydrates: product.carbohydrates,
    sugars: product.sugars,
    fat: product.fat,
    saturatedFat: product.saturatedFat,
    fiber: product.fiber,
    salt: product.salt,
    category: product.category,
    ingredients: product.ingredients
  };
}

async function seedAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.info('Skipping admin seed because ADMIN_EMAIL or ADMIN_PASSWORD is missing.');
    return;
  }

  const passwordHash = await passwordService.hash(adminPassword);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: 'admin',
      isActive: true
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: 'admin',
      isActive: true
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
