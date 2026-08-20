import 'dotenv/config';
import { prisma } from '../prisma/client';
import { auditProductDuplicates } from '../audits/product-duplicate-audit';

async function main() {
  const products = await prisma.product.findMany({
    orderBy: [{ brand: 'asc' }, { name: 'asc' }, { barcode: 'asc' }]
  });
  const report = auditProductDuplicates({ products });

  console.info(
    [
      'Product duplicate audit',
      `Likely duplicate groups: ${report.groups.length}`,
      `exact_duplicate: ${report.counts.exact_duplicate}`,
      `package_variant: ${report.counts.package_variant}`,
      `recipe_or_market_variant: ${report.counts.recipe_or_market_variant}`,
      `uncertain: ${report.counts.uncertain}`,
      `Coca-Cola-like groups: ${report.cocaColaGroups.length}`,
      ''
    ].join('\n')
  );

  console.table(
    report.groups.map((group) => ({
      group: group.groupId,
      identity: group.normalizedIdentity,
      classification: group.classification,
      products: group.items.map((item) => item.barcode).join(', '),
      action: group.recommendedAction,
      reason: group.reason
    }))
  );

  for (const group of report.cocaColaGroups) {
    console.info(`\n${group.groupId}: ${group.normalizedIdentity}`);
    console.table(
      group.items.map((item) => ({
        barcode: item.barcode,
        name: item.name,
        brand: item.brand ?? '',
        source: item.source ?? '',
        category: item.category,
        tazaScore: item.tazaScore ?? '',
        confidence: item.confidence,
        coverage: `${Math.round(item.coverage * 100)}%`,
        warnings: item.dataQualityWarnings.join(', '),
        scoreDifferenceReasons: item.scoreDifferenceReasons.join(', ')
      }))
    );
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
