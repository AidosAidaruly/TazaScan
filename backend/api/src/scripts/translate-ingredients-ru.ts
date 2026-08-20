import 'dotenv/config';
import { Prisma } from '../generated/prisma/client';
import { prisma } from '../prisma/client';
import {
  translateIngredientsToRussian,
  type IngredientTranslationReport
} from '../importers/ingredient-translation-ru';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const report = await translateIngredientsToRussian({
    dryRun,
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
      updateIngredientTranslationFields(id, data) {
        return prisma.product.update({
          where: { id },
          data
        });
      }
    }
  });

  printReport(report);
}

function printReport(report: IngredientTranslationReport) {
  console.info(
    [
      `Ingredient Russian translation${report.dryRun ? ' dry run' : ''}`,
      `Candidates: ${report.candidates}`,
      `Source Russian: ${report.sourceRussian}`,
      `Already translated: ${report.alreadyTranslated}`,
      `Would translate: ${report.wouldTranslate}`,
      `Translated: ${report.translated}`,
      `No ingredients: ${report.noIngredients}`,
      `Skipped: ${report.skipped}`,
      `Failed: ${report.failed}`,
      ''
    ].join('\n')
  );

  console.table(
    report.items.map((item) => ({
      barcode: item.barcode,
      action: item.action,
      name: item.productName,
      originalLanguage: item.originalLanguage ?? '',
      sourceRussian: item.sourceRussianAvailable ? 'yes' : 'no',
      generatedTranslation: item.generatedTranslationAvailable ? 'yes' : 'no',
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
