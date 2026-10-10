import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../prisma/client';
import type { ProductSubmissionBody } from '../schemas/product-submission.schema';
import { ProductSubmissionRepository, type SubmissionImageUrls } from './product-submission.repository';

// Opt-in PostgreSQL checks for atomic duplicate protection. Each test uses unique barcodes and
// names; only the submissions created here are deleted afterwards.
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true')('pending submission duplicates / PostgreSQL', () => {
  const repository = new ProductSubmissionRepository();
  const createdIds: string[] = [];
  const images: SubmissionImageUrls = {
    frontImageUrl: null,
    ingredientsImageUrl: null,
    nutritionImageUrl: null,
    barcodeImageUrl: null
  };

  const body = (overrides: Partial<ProductSubmissionBody>) =>
    ({ ingredients: [], ...overrides }) as ProductSubmissionBody;

  async function createAll(bodies: ProductSubmissionBody[]) {
    const results = await Promise.all(
      bodies.map((data) => repository.createUnlessPendingDuplicate(data, images))
    );
    for (const result of results) {
      if (result) {
        createdIds.push(result.id);
      }
    }
    return results;
  }

  afterAll(async () => {
    await prisma.productSubmission.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  });

  it('creates exactly one of many concurrent same-barcode submissions with rotating device ids', async () => {
    // Several rounds: without the lock, interleaving check-then-create would show up here.
    for (let round = 0; round < 5; round += 1) {
      const barcode = `dup-${randomUUID()}`;

      const results = await createAll(
        Array.from({ length: 8 }, (_, index) => body({ barcode, anonymousDeviceId: `device-${index}` }))
      );

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await prisma.productSubmission.count({ where: { barcode, status: 'pending' } })).toBe(1);
    }
  });

  it('creates exactly one of concurrent barcode-less submissions with the same name and brand', async () => {
    const name = `Duplicate test ${randomUUID()}`;

    const results = await createAll([
      body({ name, brand: 'Brand' }),
      body({ name: name.toUpperCase(), brand: 'brand', anonymousDeviceId: 'device-x' }),
      body({ name: name.toLowerCase(), brand: 'BRAND' }),
      body({ name, brand: 'Brand', anonymousDeviceId: 'device-y' })
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('still creates distinct submissions concurrently', async () => {
    const suffix = randomUUID();

    const results = await createAll([
      body({ barcode: `a-${suffix}` }),
      body({ barcode: `b-${suffix}` }),
      body({ name: `Distinct ${suffix}` }),
      body({ name: `Distinct ${suffix}`, brand: 'Other' }),
      body({}),
      body({})
    ]);

    expect(results.every(Boolean)).toBe(true);
  });

  it('allows a new pending submission once the previous one was moderated', async () => {
    const barcode = `moderated-${randomUUID()}`;
    const [first] = await createAll([body({ barcode })]);
    await prisma.productSubmission.update({ where: { id: first!.id }, data: { status: 'rejected' } });

    const [second] = await createAll([body({ barcode })]);

    expect(second).not.toBeNull();
  });
});
