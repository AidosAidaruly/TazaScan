import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../prisma/client';
import { NutriScoreEngine } from '../scoring/engines/nutri-score.engine';
import { ProductService } from '../services/product.service';
import { prismaErrorCode, toPrismaHttpError } from '../utils/prisma-errors';
import { ProductRepository } from './product.repository';

// Opt-in PostgreSQL checks for atomic halal certification replacement. A temporary
// test product is created per test and deleted afterwards (certifications cascade);
// no existing records are touched.
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true')('halal certification replacement / PostgreSQL', () => {
  const repository = new ProductRepository();
  const service = new ProductService(repository, new NutriScoreEngine());
  const createdProductIds: string[] = [];
  let productId: string;

  const certification = (issuer: string) => ({
    status: 'verified' as const,
    issuer,
    certificateNumber: `KZ-${issuer}`,
    validUntil: '2030-01-01T00:00:00.000Z',
    source: 'integration-test',
    evidenceUrl: null,
    verifiedAt: '2026-01-01T00:00:00.000Z'
  });

  beforeEach(async () => {
    const product = await prisma.product.create({
      data: {
        barcode: `test-halal-${randomUUID()}`,
        name: 'Halal atomicity test',
        category: 'Test',
        ingredients: [],
        servingType: 'per100g'
      }
    });
    productId = product.id;
    createdProductIds.push(product.id);
    await prisma.productHalalCertification.create({
      data: { productId, status: 'verified', issuer: 'Original issuer', source: 'integration-test' }
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await prisma.$disconnect();
  });

  const rows = () =>
    prisma.productHalalCertification.findMany({ where: { productId }, orderBy: { createdAt: 'asc' } });

  it('replaces the previous certification with the new one', async () => {
    await repository.replaceHalalCertification(productId, certification('New issuer'));

    expect((await rows()).map((row) => row.issuer)).toEqual(['New issuer']);
  });

  it('keeps reads unchanged: the product exposes the new certification and halal check', async () => {
    const product = await service.replaceHalalCertification(productId, certification('New issuer'));

    expect(product.halalCheck.certification.status).toBe('verified');
    const read = await service.getById(productId);
    expect(read.halalCheck).toEqual(product.halalCheck);
  });

  it('rolls back the delete when the insert fails', async () => {
    await expect(
      repository.replaceHalalCertification(productId, {
        ...certification('Broken'),
        validUntil: 'not-a-date' // fails inside create(), after deleteMany already ran
      })
    ).rejects.toThrow();

    expect((await rows()).map((row) => row.issuer)).toEqual(['Original issuer']);
  });

  it('serializes concurrent replacements so exactly one certification remains', async () => {
    const issuers = ['A', 'B', 'C', 'D', 'E'];

    await Promise.all(
      issuers.map((issuer) => repository.replaceHalalCertification(productId, certification(issuer)))
    );

    const remaining = await rows();
    expect(remaining).toHaveLength(1);
    expect(issuers).toContain(remaining[0]!.issuer);
  });

  it('surfaces a vanished product as P2003, which M5 maps to 409', async () => {
    const error = await repository
      .replaceHalalCertification(randomUUID(), certification('Orphan'))
      .catch((caught: unknown) => caught);

    expect(prismaErrorCode(error)).toBe('P2003');
    expect(toPrismaHttpError(error)).toMatchObject({ statusCode: 409 });
    expect((await rows()).map((row) => row.issuer)).toEqual(['Original issuer']);
  });

  it('clears all certifications', async () => {
    await repository.clearHalalCertification(productId);

    expect(await rows()).toEqual([]);
  });
});
