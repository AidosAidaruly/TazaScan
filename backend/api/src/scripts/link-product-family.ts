import 'dotenv/config';
import { prisma } from '../prisma/client';
import { classifyProductFamilyCandidates } from '../audits/product-family-audit';

type Args = {
  canonical: string | undefined;
  members: string[];
  remove: string[];
  inspect: boolean;
  dryRun: boolean;
  allowUncertain: boolean;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.inspect || (!args.canonical && args.remove.length === 0)) {
    await inspectFamilies();
    return;
  }

  if (args.remove.length > 0) {
    await unlinkMembers(args.remove, args.dryRun);
    return;
  }

  if (!args.canonical) {
    throw new Error('--canonical=<barcode> is required when linking a family');
  }

  await linkFamily(args);
}

async function linkFamily(args: Args) {
  const barcodes = [...new Set([args.canonical!, ...args.members])];
  const products = await prisma.product.findMany({
    where: { barcode: { in: barcodes } }
  });
  const foundBarcodes = new Set(products.map((product) => product.barcode));
  const missing = barcodes.filter((barcode) => !foundBarcodes.has(barcode));

  if (missing.length > 0) {
    throw new Error(`Products not found: ${missing.join(', ')}`);
  }

  const classification = classifyProductFamilyCandidates(products);
  if (
    classification.classification === 'different_variant' ||
    classification.classification === 'different_recipe' ||
    (classification.classification === 'uncertain' && !args.allowUncertain)
  ) {
    throw new Error(
      `Unsafe family assignment: ${classification.classification}. ${classification.matchingReason}`
    );
  }

  const canonical = products.find((product) => product.barcode === args.canonical)!;
  const existingFamily = await prisma.canonicalProductFamily.findFirst({
    where: { canonicalProductId: canonical.id }
  });
  const familyName = canonical.name;

  console.info(
    [
      `Product family ${args.dryRun ? 'dry run' : 'link'}`,
      `Canonical: ${canonical.barcode} ${canonical.name}`,
      `Members: ${barcodes.join(', ')}`,
      `Classification: ${classification.classification}`,
      `Reason: ${classification.matchingReason}`,
      `Conflicts: ${classification.conflicts.join(', ') || 'none'}`,
      ''
    ].join('\n')
  );

  if (args.dryRun) return;

  await prisma.$transaction(async (tx) => {
    const family =
      existingFamily ??
      (await tx.canonicalProductFamily.create({
        data: {
          canonicalProductId: canonical.id,
          canonicalName: familyName,
          brand: canonical.brand,
          variant: null
        }
      }));

    await tx.product.updateMany({
      where: { barcode: { in: barcodes } },
      data: { canonicalProductFamilyId: family.id }
    });
  });
}

async function unlinkMembers(barcodes: string[], dryRun: boolean) {
  const products = await prisma.product.findMany({
    where: { barcode: { in: barcodes } }
  });

  console.info(
    [
      `Product family unlink${dryRun ? ' dry run' : ''}`,
      `Requested: ${barcodes.join(', ')}`,
      `Found: ${products.map((product) => product.barcode).join(', ') || 'none'}`,
      ''
    ].join('\n')
  );

  if (dryRun) return;

  await prisma.product.updateMany({
    where: { id: { in: products.map((product) => product.id) } },
    data: { canonicalProductFamilyId: null }
  });
}

async function inspectFamilies() {
  const families = await prisma.canonicalProductFamily.findMany({
    include: {
      canonicalProduct: true,
      members: { orderBy: { barcode: 'asc' } }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.info(`Canonical product families: ${families.length}`);
  for (const family of families) {
    console.info(`\n${family.id}: ${family.canonicalName}`);
    console.table(
      family.members.map((member) => ({
        barcode: member.barcode,
        name: member.name,
        canonical: member.id === family.canonicalProductId ? 'yes' : 'no',
        source: member.source ?? '',
        dataStatus: member.dataStatus
      }))
    );
  }
}

function parseArgs(args: string[]): Args {
  return {
    canonical: readOption(args, '--canonical'),
    members: readCsvOption(args, '--members'),
    remove: readCsvOption(args, '--remove'),
    inspect: args.includes('--inspect'),
    dryRun: args.includes('--dry-run'),
    allowUncertain: args.includes('--allow-uncertain')
  };
}

function readOption(args: string[], name: string) {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readCsvOption(args: string[], name: string) {
  return (
    readOption(args, name)
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? []
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
