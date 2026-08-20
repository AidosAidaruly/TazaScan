import 'dotenv/config';
import { prisma } from '../prisma/client';
import { ProductRepository } from '../repositories/product.repository';
import { NutriScoreEngine } from '../scoring/engines/nutri-score.engine';
import type { ProductBody } from '../schemas/product.schema';
import { ProductService } from '../services/product.service';
import {
  buildOpenFoodFactsValidationBatch2,
  type OpenFoodFactsBatch2Report,
  type OpenFoodFactsBatch2ReportItem
} from '../importers/open-food-facts-validation-batch-2';
import type { ImportProductService } from '../importers/open-food-facts-validation-batch';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repository = new ProductRepository();
  const productService = new ProductService(repository, new NutriScoreEngine());
  const productImportService: ImportProductService = dryRun
    ? {
        async create() {
          return undefined;
        }
      }
    : productService;

  const report = await buildOpenFoodFactsValidationBatch2({
    dryRun,
    repository,
    productService: productImportService,
    tazaScorePreviewer: {
      previewTazaScore(data: ProductBody) {
        return productService.previewTazaScore(data);
      }
    },
    requestDelayMs: 1500
  });

  printReport(report);
}

function printReport(report: OpenFoodFactsBatch2Report) {
  console.info(
    [
      `Open Food Facts validation batch 2${report.dryRun ? ' dry run' : ''}`,
      `Candidates considered: ${report.candidatesConsidered}`,
      `Products selected: ${report.productsSelected}`,
      `Would import/imported: ${report.imported}`,
      `Already existing: ${report.alreadyExisting}`,
      `Not compatible: ${report.notCompatible}`,
      `With ingredients: ${report.withIngredients}`,
      `Without ingredients: ${report.withoutIngredients}`,
      `With image: ${report.withImage}`,
      `Full nutrition: ${report.fullNutrition}`,
      `Partial nutrition: ${report.partialNutrition}`,
      `Data-quality warnings: ${report.productsWithDataQualityWarnings}`,
      `Confidence: high=${report.confidenceCounts.high}, medium=${report.confidenceCounts.medium}, low=${report.confidenceCounts.low}`,
      `Discovery errors: ${report.discoveryErrors.length}`,
      '',
      'Category distribution:',
      JSON.stringify(report.categoryDistribution, null, 2),
      '',
      'TazaScore distribution:',
      JSON.stringify(report.tazaScoreDistribution, null, 2),
      ''
    ].join('\n')
  );

  console.table(report.items.map(tableRow));

  if (report.discoveryErrors.length > 0) {
    console.info('\nDiscovery errors');
    console.table(report.discoveryErrors);
  }
}

function tableRow(item: OpenFoodFactsBatch2ReportItem) {
  return {
    barcode: item.barcode,
    query: item.sourceQuery,
    status: item.status,
    name: item.productName ?? '',
    brand: item.brand ?? '',
    category: item.officialNutriScoreCategory ?? item.category ?? '',
    nutrition: item.nutritionFieldsAvailable.join(', '),
    missing: item.nutritionFieldsMissing.join(', '),
    ingredients: item.ingredientsAvailable ? 'yes' : 'no',
    image: item.imageAvailable ? 'yes' : 'no',
    dataQuality: item.dataQualityStatus ?? '',
    warnings: item.dataQualityWarningCodes.join(', '),
    tazaScore: item.tazaScore ?? '',
    confidence: item.confidence ?? '',
    coverage: item.coverage === null ? '' : `${Math.round(item.coverage * 100)}%`,
    safeguards: item.safeguardsApplied.join(', '),
    error: item.error ?? ''
  };
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
