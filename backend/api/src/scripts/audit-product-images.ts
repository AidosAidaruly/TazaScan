import 'dotenv/config';
import { productImageQualityEvaluator } from '../data-quality/product-image-quality.evaluator';
import { prisma } from '../prisma/client';

async function main() {
  const products = await prisma.product.findMany({
    where: {
      source: 'Open Food Facts'
    },
    orderBy: [{ createdAt: 'asc' }, { barcode: 'asc' }]
  });
  const rows = products.map((product) => {
    const quality = productImageQualityEvaluator.evaluate(product);

    return {
      barcode: product.barcode,
      name: product.name,
      source: product.source ?? '',
      dataStatus: product.dataStatus,
      imageUrl: product.imageUrl ?? '',
      quality: quality.status,
      usableAsPrimary: quality.usableAsPrimary ? 'yes' : 'no',
      reasons: quality.reasons.join(', ')
    };
  });

  console.info(`Audited Open Food Facts product images: ${rows.length}`);
  console.info(
    `Usable as primary: ${rows.filter((row) => row.usableAsPrimary === 'yes').length}`
  );
  console.info(
    `Fallback recommended: ${rows.filter((row) => row.usableAsPrimary === 'no').length}`
  );
  console.table(rows);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
