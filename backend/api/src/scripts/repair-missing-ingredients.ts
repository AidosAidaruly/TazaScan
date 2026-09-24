import 'dotenv/config';
import { prisma } from '../prisma/client';
import {
  backfillMissingIngredients,
  type MissingIngredientsBackfillReport
} from '../importers/missing-ingredients-backfill';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const report = await backfillMissingIngredients({
    dryRun,
    requestDelayMs: 3000,
    repository: {
      findProducts() {
        return readProductsForBackfill();
      },
      updateIngredientProvenanceFields(id, data) {
        return prisma.product.update({
          where: { id },
          data
        });
      }
    }
  });

  printReport(report);
}

async function readProductsForBackfill() {
  const certificationTableAvailable = await hasHalalCertificationTable();

  if (certificationTableAvailable) {
    return prisma.product.findMany({
      include: {
        halalCertifications: true
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
  }

  console.warn(
    'Halal certification table is not available in this database. Continuing ingredient-only backfill.'
  );

  const products = await prisma.product.findMany({
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
  });

  return products.map((product) => ({
    ...product,
    halalCertifications: []
  }));
}

async function hasHalalCertificationTable() {
  const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('public.product_halal_certifications') IS NOT NULL AS "exists"
  `;

  return result[0]?.exists === true;
}

function printReport(report: MissingIngredientsBackfillReport) {
  console.info(
    [
      `Missing ingredient backfill${report.dryRun ? ' dry run' : ''}`,
      `Total products: ${report.coverageBefore.totalProducts}`,
      `Reliable ingredients before: ${report.coverageBefore.reliableIngredientsAvailable}`,
      `Missing ingredients before: ${report.coverageBefore.missingIngredients}`,
      `Source Russian before: ${report.coverageBefore.sourceRussianAvailable}`,
      `Generated Russian only before: ${report.coverageBefore.generatedRussianOnly}`,
      `Original foreign before: ${report.coverageBefore.originalForeignAvailable}`,
      '',
      `Candidates: ${report.candidates}`,
      `${report.dryRun ? 'Would repair' : 'Repaired'}: ${
        report.dryRun ? report.wouldRepair : report.repaired
      }`,
      `Already has ingredients: ${report.alreadyHasIngredients}`,
      `OFF no ingredients: ${report.offNoIngredients}`,
      `Source data unusable: ${report.sourceDataUnusable}`,
      `Skipped: ${report.skipped}`,
      `Failed: ${report.failed}`,
      '',
      'Halal Check before:',
      ...Object.entries(report.halalBeforeDistribution).map(
        ([status, count]) => `- ${status}: ${count}`
      ),
      '',
      'Halal Check after/projected:',
      ...Object.entries(report.halalAfterDistribution).map(
        ([status, count]) => `- ${status}: ${count}`
      ),
      ''
    ].join('\n')
  );

  console.table(
    report.items.map((item) => ({
      barcode: item.barcode,
      action: item.action,
      name: item.name,
      source: item.source ?? '',
      dataStatus: item.dataStatus,
      currentIngredientStatus: item.currentIngredientStatus,
      sourceResult: item.sourceResult,
      sourceLanguage: item.sourceLanguage ?? '',
      russianAvailable: item.russianAvailable ? 'yes' : 'no',
      halalBefore: item.halalBefore,
      halalAfter: item.halalAfter ?? '',
      screeningBefore: item.halalIngredientScreeningBefore,
      screeningAfter: item.halalIngredientScreeningAfter ?? '',
      error: item.error ?? ''
    }))
  );

  const unresolved = report.items.filter((item) =>
    ['off_no_ingredients', 'source_data_unusable', 'not_found', 'failed'].includes(
      item.action
    )
  );

  if (unresolved.length > 0) {
    console.info('');
    console.info('Unresolved missing ingredient products:');
    for (const item of unresolved) {
      console.info(
        `- ${item.barcode} ${item.name}: ${item.action}${
          item.error ? ` (${item.error})` : ''
        }`
      );
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
