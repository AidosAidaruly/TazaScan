import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PasswordService } from '../src/services/password.service';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });
const passwordService = new PasswordService();

async function main() {
  await seedAdminUser();
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
      fiber: null,
      salt: 0,
      healthScore: 65,
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
      fiber: null,
      salt: 0,
      healthScore: 65,
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
