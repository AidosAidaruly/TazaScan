import { auditHalalCheckProducts } from '../audits/halal-check-audit';
import { prisma } from '../prisma/client';

async function main() {
  const { products, certificationTableAvailable } = await readProductsForAudit();
  const report = auditHalalCheckProducts(products);

  printSummary(report, { certificationTableAvailable });
}

async function readProductsForAudit() {
  const certificationTableAvailable = await hasHalalCertificationTable();

  if (certificationTableAvailable) {
    const products = await prisma.product.findMany({
      include: {
        halalCertifications: true,
        canonicalProductFamily: {
          include: {
            canonicalProduct: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return {
      products,
      certificationTableAvailable: true
    };
  }

  console.warn(
    'Halal certification table is not available in this database. Continuing ingredient-only audit.'
  );

  const products = await prisma.product.findMany({
    include: {
      canonicalProductFamily: {
        include: {
          canonicalProduct: true
        }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return {
    products: products.map((product) => ({
      ...product,
      halalCertifications: []
    })),
    certificationTableAvailable: false
  };
}

async function hasHalalCertificationTable() {
  const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('public.product_halal_certifications') IS NOT NULL AS "exists"
  `;

  return result[0]?.exists === true;
}

function printSummary(
  report: ReturnType<typeof auditHalalCheckProducts>,
  options: { certificationTableAvailable: boolean }
) {
  console.info('Halal Check v1.2 audit');
  console.info(`Total products: ${report.totalProducts}`);
  console.info(
    `Certification table available: ${options.certificationTableAvailable ? 'yes' : 'no'}`
  );
  console.info('');
  console.info('Status distribution:');
  for (const [status, count] of Object.entries(report.statusDistribution)) {
    console.info(
      `- ${status}: ${count} / ${report.totalProducts} = ${percent(count, report.totalProducts)}`
    );
  }
  console.info('');
  console.info('Ingredient screening distribution:');
  for (const [status, count] of Object.entries(report.ingredientScreeningDistribution)) {
    console.info(
      `- ${status}: ${count} / ${report.totalProducts} = ${percent(count, report.totalProducts)}`
    );
  }
  console.info('');
  console.info('Certification distribution:');
  for (const [status, count] of Object.entries(report.certificationDistribution)) {
    console.info(
      `- ${status}: ${count} / ${report.totalProducts} = ${percent(count, report.totalProducts)}`
    );
  }
  console.info('');
  console.info('Rule distribution:');

  const ruleEntries = Object.entries(report.ruleDistribution).sort(
    (a, b) => b[1] - a[1]
  );
  if (ruleEntries.length === 0) {
    console.info('- none');
  } else {
    for (const [rule, count] of ruleEntries) {
      console.info(`- ${rule}: ${count}`);
    }
  }

  console.info('');
  console.info('Certification summary:');
  console.info(`- total: ${report.certificationSummary.total}`);
  console.info(`- verified: ${report.certificationSummary.verified}`);
  console.info(`- unverified: ${report.certificationSummary.unverified}`);
  console.info(`- expired: ${report.certificationSummary.expired}`);
  console.info(`- conflicts: ${report.certificationSummary.conflicts}`);
  console.info('');
  console.info('E-number mentions:');
  printRecord(report.eNumberMentions);
  console.info('');
  console.info('Ignored E-number mentions:');
  printRecord(report.ignoredENumberMentions);
  console.info('');
  console.info('Product-level table:');

  for (const row of report.rows) {
    console.info(
      [
        row.barcode,
        truncate(row.name, 36),
        row.status,
        row.ingredientScreeningStatus,
        row.certificationStatus,
        row.ingredientSource,
        row.quality,
        truncate(row.matchedSignals.join('; ') || '-', 48),
        truncate(row.reviewNote, 58)
      ].join(' | ')
    );
  }

  console.info('');
  console.info('Focused findings:');
  console.info(`- gelatin products: ${report.gelatinProducts.length}`);
  console.info(`- alcohol products: ${report.alcoholProducts.length}`);
  console.info(`- rennet/enzyme products: ${report.rennetOrEnzymeProducts.length}`);
  console.info(`- canonical family rows: ${report.canonicalFamilyRows.length}`);
}

function printRecord(record: Record<string, number>) {
  const entries = Object.entries(record).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    console.info('- none');
    return;
  }

  for (const [key, count] of entries) {
    console.info(`- ${key}: ${count}`);
  }
}

function percent(count: number, total: number) {
  if (total === 0) {
    return '0%';
  }

  return `${Math.round((count / total) * 100)}%`;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
