import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { NutriScoreEngine } from '../src/scoring/engines/nutri-score.engine';
import { PasswordService } from '../src/services/password.service';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });
const passwordService = new PasswordService();
const scoreEngine = new NutriScoreEngine();

async function main() {
  await seedAdminUser();
  const cocaColaScore = scoreEngine.calculate({
    servingType: 'per100ml',
    energyKcal: 42,
    protein: 0,
    carbohydrates: 10.6,
    sugars: 10.6,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    salt: 0,
    category: 'Soft Drinks',
    ingredients: [
      'Carbonated water',
      'Sugar',
      'Colour caramel E150d',
      'Phosphoric acid',
      'Natural flavourings',
      'Caffeine'
    ]
  });
  const scoreData = {
    healthScore: cocaColaScore.score ?? 0,
    calculatedScore: cocaColaScore.score,
    calculatedGrade: cocaColaScore.grade,
    scoreStatus: cocaColaScore.status,
    scoreAlgorithm: cocaColaScore.algorithm,
    scoreVersion: cocaColaScore.algorithmVersion,
    scoreCalculatedAt: new Date(cocaColaScore.calculatedAt),
    scoreDetails: cocaColaScore
  };

  await prisma.product.upsert({
    where: {
      barcode: '5449000000996'
    },
    update: {
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
      ...scoreData,
      imageUrl: null,
      dataStatus: 'verified',
      source: 'seed',
      lastVerifiedAt: new Date()
    },
    create: {
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
      ...scoreData,
      imageUrl: null,
      dataStatus: 'verified',
      source: 'seed',
      lastVerifiedAt: new Date()
    }
  });
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
