import { randomInt, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../prisma/client';
import { ProductRepository } from './product.repository';
import { ProductSubmissionRepository } from './product-submission.repository';
import { ProductService } from '../services/product.service';
import { ProductSubmissionService } from '../services/product-submission.service';
import { NutriScoreEngine } from '../scoring/engines/nutri-score.engine';
import { wordPrefixFilter } from './product-search';

// Opt-in PostgreSQL checks. All inserted test products roll back; no demo data
// is added and no existing records are changed.
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true')('demo readiness / PostgreSQL', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('rolls back product creation when the submission update fails', async () => {
    const id = randomUUID();
    const barcode = `29${randomInt(10000000000, 99999999999)}`;
    const repository = new ProductSubmissionRepository();
    vi.spyOn(repository, 'findById').mockResolvedValue({
      id, status: 'pending', frontImageUrl: null
    } as never);
    const products = new ProductRepository();
    const create = vi.spyOn(products, 'create');
    const service = new ProductSubmissionService(
      repository, new ProductService(products, new NutriScoreEngine())
    );
    // Missing submission id deliberately fails the real UPDATE after INSERT.
    await expect(service.approve(id, {
      barcode, name: 'Rollback test', category: 'Test', ingredients: [],
      servingType: 'per100g'
    }, randomUUID())).rejects.toMatchObject({ code: 'P2025' });
    expect(create).toHaveBeenCalledOnce();
    expect(await prisma.product.findUnique({ where: { barcode } })).toBeNull();
  });

  it('matches cola at word starts, preserves partial and Cyrillic search, and treats wildcards literally', async () => {
    const rollback = new Error('rollback test fixtures');
    await expect(prisma.$transaction(async (tx) => {
      const names = ['Coca-Cola', 'COLA Zero', 'Milk chocolate', 'Молочный шоколад', '10%_ special'];
      const ids: string[] = [];
      for (const name of names) {
        const product = await tx.product.create({ data: {
          barcode: `test-${randomUUID()}`, name, category: 'Test',
          ingredients: [], servingType: 'per100g'
        } });
        ids.push(product.id);
      }
      const search = async (query: string) => (await tx.product.findMany({
        where: { id: { in: ids }, ...wordPrefixFilter('name', query) }
      })).map((p) => p.name).sort();
      expect(await search('cola')).toEqual(['COLA Zero', 'Coca-Cola']);
      expect(await search('choco')).toEqual(['Milk chocolate']);
      expect(await search('шоко')).toEqual(['Молочный шоколад']);
      expect(await search('10%_')).toEqual(['10%_ special']);
      expect(await search('%')).toEqual([]);
      throw rollback;
    })).rejects.toBe(rollback);
  });
});
