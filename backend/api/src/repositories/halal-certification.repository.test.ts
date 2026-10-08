import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client';
import { toPrismaHttpError } from '../utils/prisma-errors';

// In-memory stand-in for PostgreSQL: certification rows plus an interactive
// transaction that only commits its writes when the callback succeeds.
const db = vi.hoisted(() => {
  type Row = { id: string; productId: string; issuer: string; status: string };
  const state = { committed: [] as Row[], calls: [] as string[], failCreate: null as Error | null };

  function client(rows: { current: Row[] }, label: string) {
    return {
      $queryRaw: vi.fn(async () => {
        state.calls.push(`${label}:lock`);
        return [{ id: 'product-1' }];
      }),
      productHalalCertification: {
        deleteMany: vi.fn(async ({ where }: { where: { productId: string } }) => {
          state.calls.push(`${label}:deleteMany`);
          rows.current = rows.current.filter((row) => row.productId !== where.productId);
          return { count: 1 };
        }),
        create: vi.fn(async ({ data }: { data: Omit<Row, 'id'> }) => {
          state.calls.push(`${label}:create`);
          if (state.failCreate) {
            throw state.failCreate;
          }
          const row = { id: `cert-${rows.current.length + 1}`, ...data };
          rows.current = [...rows.current, row];
          return row;
        })
      }
    };
  }

  const root = { current: [] as Row[] };
  const prisma = {
    ...client(root, 'root'),
    $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) => {
      const working = { current: [...state.committed] };
      const result = await operation(client(working, 'tx'));
      state.committed = working.current; // commit only on success
      return result;
    })
  };

  return { prisma, state };
});
vi.mock('../prisma/client', () => ({ prisma: db.prisma }));
import { ProductRepository } from './product.repository';

const previous = { id: 'cert-old', productId: 'product-1', issuer: 'Old issuer', status: 'verified' };
const otherProduct = { id: 'cert-other', productId: 'product-2', issuer: 'Other', status: 'verified' };
const body = {
  status: 'verified' as const,
  issuer: 'New issuer',
  certificateNumber: 'KZ-1',
  validUntil: '2027-01-01T00:00:00.000Z',
  source: 'admin',
  evidenceUrl: null,
  verifiedAt: null
};

beforeEach(() => {
  db.state.committed = [previous, otherProduct];
  db.state.calls = [];
  db.state.failCreate = null;
  vi.clearAllMocks();
});

describe('ProductRepository.replaceHalalCertification', () => {
  it('locks, deletes and inserts inside one transaction', async () => {
    const created = await new ProductRepository().replaceHalalCertification('product-1', body);

    expect(db.prisma.$transaction).toHaveBeenCalledOnce();
    expect(db.state.calls).toEqual(['tx:lock', 'tx:deleteMany', 'tx:create']);
    expect(created).toMatchObject({ productId: 'product-1', issuer: 'New issuer' });
    expect(db.state.committed).toEqual([
      otherProduct,
      expect.objectContaining({ productId: 'product-1', issuer: 'New issuer' })
    ]);
  });

  it('never writes through the non-transactional client', async () => {
    await new ProductRepository().replaceHalalCertification('product-1', body);

    expect(db.prisma.productHalalCertification.deleteMany).not.toHaveBeenCalled();
    expect(db.prisma.productHalalCertification.create).not.toHaveBeenCalled();
    expect(db.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('locks the product row with a parameterized FOR UPDATE query', async () => {
    let lockQuery: unknown[] = [];
    db.prisma.$transaction.mockImplementationOnce(async (operation) => {
      const tx = {
        $queryRaw: vi.fn(async (...args: unknown[]) => {
          lockQuery = args;
          return [];
        }),
        productHalalCertification: {
          deleteMany: vi.fn(async () => ({ count: 0 })),
          create: vi.fn(async () => ({}))
        }
      };
      return operation(tx);
    });

    await new ProductRepository().replaceHalalCertification('product-1', body);

    const [strings, productId] = lockQuery as [TemplateStringsArray, string];
    expect(strings.join('?')).toBe('SELECT "id" FROM "products" WHERE "id" = ? FOR UPDATE');
    expect(productId).toBe('product-1');
  });

  it('keeps the previous certification when the insert fails, rethrowing the error', async () => {
    const failure = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
      code: 'P2003',
      clientVersion: '7.0.0'
    });
    db.state.failCreate = failure;

    await expect(
      new ProductRepository().replaceHalalCertification('product-1', body)
    ).rejects.toBe(failure);

    // The delete ran inside the transaction but was never committed.
    expect(db.state.calls).toEqual(['tx:lock', 'tx:deleteMany', 'tx:create']);
    expect(db.state.committed).toEqual([previous, otherProduct]);
    expect(toPrismaHttpError(failure)).toMatchObject({ statusCode: 409 });
  });

  it('leaves no half-replaced state when the insert fails for a non-Prisma reason', async () => {
    db.state.failCreate = new Error('connection terminated');

    await expect(
      new ProductRepository().replaceHalalCertification('product-1', body)
    ).rejects.toThrow('connection terminated');

    expect(db.state.committed).toEqual([previous, otherProduct]);
  });
});

describe('ProductRepository.clearHalalCertification', () => {
  it('still clears with a single delete statement', async () => {
    await new ProductRepository().clearHalalCertification('product-1');

    expect(db.prisma.productHalalCertification.deleteMany).toHaveBeenCalledWith({
      where: { productId: 'product-1' }
    });
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
  });
});
