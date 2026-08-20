import 'dotenv/config';
import { prisma } from '../prisma/client';
import { ProductRepository } from '../repositories/product.repository';
import { NutriScoreEngine } from '../scoring/engines/nutri-score.engine';
import type { ProductBody } from '../schemas/product.schema';
import { ProductService } from '../services/product.service';
import {
  importOpenFoodFactsValidationBatch,
  type ImportProductRepository,
  type ImportProductService
} from '../importers/open-food-facts-validation-batch';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repository = new ProductRepository();
  const productService = new ProductService(repository, new NutriScoreEngine());

  const importService: ImportProductService = dryRun
    ? {
        async create() {
          return undefined;
        }
      }
    : productService;

  const importRepository: ImportProductRepository = dryRun
    ? {
        async findByBarcode(barcode: string) {
          return repository.findByBarcode(barcode);
        }
      }
    : repository;

  const report = await importOpenFoodFactsValidationBatch({
    repository: importRepository,
    productService: importService,
    tazaScorePreviewer: {
      previewTazaScore(data: ProductBody) {
        return productService.previewTazaScore(data);
      }
    },
    requestDelayMs: 3000
  });

  printReport(report, dryRun);
}

function printReport(
  report: Awaited<ReturnType<typeof importOpenFoodFactsValidationBatch>>,
  dryRun: boolean
) {
  console.info(
    [
      `Open Food Facts validation batch${dryRun ? ' dry run' : ''}`,
      `Requested: ${report.requested}`,
      `Found/skipped/import-compatible: ${report.found}`,
      `Imported: ${report.imported}`,
      `Skipped: ${report.skipped}`,
      `Not found: ${report.notFound}`,
      `Failed: ${report.failed}`,
      ''
    ].join('\n')
  );

  console.table(
    report.items.map((item) => ({
      barcode: item.barcode,
      status: item.status,
      name: item.productName ?? '',
      brand: item.brand ?? '',
      nutrition: item.availableNutritionFields.join(', '),
      missing: item.missingRelevantFields.join(', '),
      ingredients: item.ingredientsAvailable ? 'yes' : 'no',
      image: item.imageAvailable ? 'yes' : 'no',
      tazaScore: item.tazaScore ?? '',
      confidence: item.confidence ?? '',
      coverage:
        item.coverage === null ? '' : `${Math.round(item.coverage * 100)}%`,
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
