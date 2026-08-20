import 'dotenv/config';
import { Prisma } from '../generated/prisma/client';
import { prisma } from '../prisma/client';
import {
  repairOpenFoodFactsCategories,
  type OpenFoodFactsCategoryRepairReport
} from '../importers/open-food-facts-category-repair';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const report = await repairOpenFoodFactsCategories({
    dryRun,
    requestDelayMs: 3000,
    repository: {
      findCandidates() {
        return prisma.product.findMany({
          where: {
            source: {
              contains: 'Open Food Facts',
              mode: Prisma.QueryMode.insensitive
            },
            officialNutriScoreCategory: null
          },
          orderBy: { createdAt: 'asc' }
        });
      },
      updateOfficialCategory(id, category) {
        return prisma.product.update({
          where: { id },
          data: { officialNutriScoreCategory: category }
        });
      }
    }
  });

  printReport(report);
}

function printReport(report: OpenFoodFactsCategoryRepairReport) {
  console.info(
    [
      `Open Food Facts category repair${report.dryRun ? ' dry run' : ''}`,
      `Candidates: ${report.candidates}`,
      `${report.dryRun ? 'Would repair' : 'Repaired'}: ${report.repaired}`,
      `Unresolved: ${report.unresolved}`,
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
      currentCategory: item.currentCategory,
      derivedCategory: item.derivedCategory ?? '',
      offCategories: item.offCategories ?? '',
      offTags: item.offCategoryTags.join(', '),
      tazaScore: item.tazaScore ?? '',
      confidence: item.confidence ?? '',
      coverage:
        item.nutritionCoverage === null
          ? ''
          : `${Math.round(item.nutritionCoverage * 100)}%`,
      missingCriticalFields: item.missingCriticalFields.join(', '),
      safeguards: item.safeguardsApplied.join(', '),
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
