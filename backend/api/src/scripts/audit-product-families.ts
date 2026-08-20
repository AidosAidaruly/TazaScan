import 'dotenv/config';
import { prisma } from '../prisma/client';
import { auditProductFamilies } from '../audits/product-family-audit';

async function main() {
  const products = await prisma.product.findMany({
    orderBy: [{ brand: 'asc' }, { name: 'asc' }, { barcode: 'asc' }]
  });
  const report = auditProductFamilies({ products });

  console.info(
    [
      'Product family audit',
      `Candidate groups: ${report.groups.length}`,
      `same_recipe: ${report.counts.same_recipe}`,
      `likely_same_recipe: ${report.counts.likely_same_recipe}`,
      `different_variant: ${report.counts.different_variant}`,
      `different_recipe: ${report.counts.different_recipe}`,
      `uncertain: ${report.counts.uncertain}`,
      ''
    ].join('\n')
  );

  console.table(
    report.groups.map((group) => ({
      group: group.groupId,
      key: group.normalizedFamilyKey,
      classification: group.classification,
      action: group.recommendedAction,
      barcodes: group.items.map((item) => item.barcode).join(', '),
      reason: group.matchingReason,
      conflicts: group.conflicts.join(', ')
    }))
  );

  for (const group of report.groups) {
    console.info(`\n${group.groupId}: ${group.normalizedFamilyKey}`);
    console.table(
      group.items.map((item) => ({
        barcode: item.barcode,
        name: item.name,
        brand: item.brand ?? '',
        source: item.source ?? '',
        dataStatus: item.dataStatus,
        tazaScore: item.tazaScore ?? '',
        confidence: item.confidence,
        kcal: item.nutrition.energyKcal ?? '',
        sugars: item.nutrition.sugars ?? '',
        salt: item.nutrition.salt ?? ''
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
