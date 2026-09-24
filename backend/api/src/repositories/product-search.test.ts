import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../generated/prisma/client';
import { wordPrefixFilter } from './product-search';

const db = vi.hoisted(() => ({
  product: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries))
}));
vi.mock('../prisma/client', () => ({ prisma: db }));
import { ProductRepository } from './product.repository';

describe('word-prefix product search', () => {
  it('escapes SQL LIKE metacharacters and trims input', () => {
    expect(wordPrefixFilter('name', '  10%_\\  ').OR?.[0]).toEqual({
      name: { startsWith: '10\\%\\_\\\\', mode: 'insensitive' }
    });
  });

  it('filters names and brands before pagination and uses the same filter for counts', async () => {
    await new ProductRepository().list({ page: 2, pageSize: 3, name: 'cola', brand: 'coca' });
    const options = db.product.findMany.mock.calls.at(-1)?.[0] as Prisma.ProductFindManyArgs;
    expect(options.skip).toBe(3);
    expect(options.take).toBe(3);
    expect(options.where?.AND).toEqual([wordPrefixFilter('name', 'cola'), wordPrefixFilter('brand', 'coca')]);
    expect(db.product.count).toHaveBeenLastCalledWith({ where: options.where });
  });

  it('uses word prefixes for general and photo search while retaining barcode lookup', async () => {
    const repository = new ProductRepository();
    await repository.list({ page: 1, pageSize: 20, q: 'cola' });
    const options = db.product.findMany.mock.calls.at(-1)?.[0] as Prisma.ProductFindManyArgs;
    expect(options.where?.OR).toEqual([
      wordPrefixFilter('name', 'cola'), wordPrefixFilter('brand', 'cola'),
      { barcode: { contains: 'cola' } }
    ]);
    await repository.searchByNameOrBrand('cola', 5);
    expect(db.product.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { OR: [wordPrefixFilter('name', 'cola'), wordPrefixFilter('brand', 'cola')] }, take: 5
    }));
  });
});
