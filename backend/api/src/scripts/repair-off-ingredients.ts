import 'dotenv/config';
import { Prisma } from '../generated/prisma/client';
import { prisma } from '../prisma/client';
import {
  repairOpenFoodFactsIngredients,
  type OpenFoodFactsIngredientsRepairReport
} from '../importers/open-food-facts-ingredients-repair';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const report = await repairOpenFoodFactsIngredients({
    dryRun,
    requestDelayMs: 3000,
    repository: {
      findCandidates() {
        return prisma.product.findMany({
          where: {
            source: {
              contains: 'Open Food Facts',
              mode: Prisma.QueryMode.insensitive
            }
          },
          orderBy: { createdAt: 'asc' }
        });
      },
      updateIngredientLanguageFields(id, data) {
        return prisma.product.update({
          where: { id },
          data
        });
      }
    }
  });

  printReport(report);
}

function printReport(report: OpenFoodFactsIngredientsRepairReport) {
  console.info(
    [
      `Open Food Facts ingredients repair${report.dryRun ? ' dry run' : ''}`,
      `Candidates: ${report.candidates}`,
      `${report.dryRun ? 'Would repair' : 'Repaired'}: ${report.repaired}`,
      `Already Russian: ${report.alreadyRussian}`,
      `Without Russian: ${report.withoutRussian}`,
      `Skipped: ${report.skipped}`,
      `Failed: ${report.failed}`,
      ''
    ].join('\n')
  );

  console.table(
    report.items.map((item) => ({
      barcode: item.barcode,
      status: item.status,
      name: item.productName,
      source: item.source ?? '',
      originalLanguage: item.originalIngredientsLanguage ?? '',
      russianAvailable: item.russianIngredientsAvailable ? 'yes' : 'no',
      currentConsumerLanguage: item.currentConsumerIngredientsLanguage ?? '',
      proposedConsumerLanguage: item.proposedConsumerIngredientsLanguage ?? '',
      error: item.error ?? ''
    }))
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
