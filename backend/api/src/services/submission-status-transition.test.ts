import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Prisma, type ProductSubmission } from '../generated/prisma/client';
import { asyncHandler } from '../middleware/async-handler';
import { errorHandler } from '../middleware/error-handler';
import { validate } from '../middleware/validate';
import {
  approveSubmissionBodySchema,
  submissionIdParamsSchema,
  updateSubmissionStatusBodySchema,
  type UpdateSubmissionStatusBody
} from '../schemas/product-submission.schema';
import type { ProductBody } from '../schemas/product.schema';
import { ProductSubmissionService } from './product-submission.service';

// Moderation status transitions through the same validation and error handling as
// PUT /product-submissions/:id/status, against stateful in-memory storage.

const now = new Date('2026-08-01T00:00:00.000Z');
const submissionId = '11111111-1111-4111-8111-111111111111';
const approveBody = {
  barcode: '5449000000996',
  name: 'Coca-Cola Original Taste',
  category: 'Soft Drinks',
  ingredients: ['Carbonated water'],
  servingType: 'per100ml' as const
};

describe('submission moderation status transitions', () => {
  it.each(['rejected', 'needs_correction'] as const)(
    'allows pending -> %s over HTTP',
    async (status) => {
      const { app, store } = createHarness();

      const response = await putStatus(app, { status, moderationNote: 'Moderator note' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(status);
      expect(store.submission.status).toBe(status);
    }
  );

  it('allows needs_correction -> rejected and still allows approval afterwards', async () => {
    const { app, store, service } = createHarness();
    await putStatus(app, { status: 'needs_correction', moderationNote: 'Need label' });

    const rejected = await putStatus(app, { status: 'rejected', moderationNote: 'Unreadable' });
    expect(rejected.status).toBe(200);
    expect(store.submission.status).toBe('rejected');

    const approved = await service.approve(submissionId, approveBody, 'admin-id');
    expect(approved.status).toBe('approved');
    expect(store.products.size).toBe(1);
  });

  it.each(['rejected', 'needs_correction'] as const)(
    'returns a clean 409 for approved -> %s and leaves submission and product untouched',
    async (status) => {
      const { app, store, service } = createHarness();
      await service.approve(submissionId, approveBody, 'admin-id');
      const submissionBefore = { ...store.submission };
      const productsBefore = structuredClone([...store.products.entries()]);

      const response = await putStatus(app, { status, moderationNote: 'Changed my mind' });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: { message: 'Approved submissions cannot change moderation status' }
      });
      expect(store.submission).toEqual(submissionBefore);
      expect(store.submission.status).toBe('approved');
      expect([...store.products.entries()]).toEqual(productsBefore);
      expect(store.statusWrites).toBe(0);
    }
  );

  it('never moves an approved submission back to pending', async () => {
    const { app, store, service } = createHarness();
    await service.approve(submissionId, approveBody, 'admin-id');

    // The route only accepts rejected/needs_correction, so "pending" fails validation first…
    const response = await putStatus(app, { status: 'pending', moderationNote: 'Reopen' });
    expect(response.status).toBe(400);

    // …and the service refuses it too if it is ever reached another way.
    await expect(
      service.updateStatus(
        submissionId,
        { status: 'pending', moderationNote: 'Reopen' } as never,
        'admin-id'
      )
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(store.submission.status).toBe('approved');
  });

  it('rejects a stale status request that loses the race against approval', async () => {
    const { app, store, service } = createHarness();
    // The stale request reads "pending"; approval commits before its write runs.
    store.beforeStatusWrite = () => service.approve(submissionId, approveBody, 'admin-id');

    const response = await putStatus(app, { status: 'rejected', moderationNote: 'Stale' });

    expect(response.status).toBe(409);
    expect(store.submission.status).toBe('approved');
    expect(store.submission.createdProductId).toBe([...store.products.keys()][0]);
    expect(store.products.size).toBe(1);
  });

  it('returns a clean 409 to the loser of two racing approvals with the same barcode', async () => {
    const { app, store } = createHarness();
    // Hold both inserts until both requests have passed the up-front checks.
    let arrived = 0;
    let releaseBoth!: () => void;
    const bothChecked = new Promise<void>((resolve) => { releaseBoth = resolve; });
    store.beforeProductInsert = async () => {
      arrived += 1;
      if (arrived === 2) {
        releaseBoth();
      }
      await bothChecked;
    };

    const responses = await Promise.all([postApprove(app), postApprove(app)]);

    expect(arrived).toBe(2);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const loser = responses.find((response) => response.status === 409)!;
    expect(loser.body).toEqual({ error: { message: 'Submission is already approved' } });
    expect(loser.text).not.toMatch(/prisma|barcode`|Product_|modelName/);
    expect(store.products.size).toBe(1);
    expect(store.submission.createdProductId).toBe([...store.products.keys()][0]);
  });

  it('returns a clean 409 when racing approvals use different barcodes', async () => {
    const { app, store } = createHarness();
    let releaseFirst!: () => void;
    const firstMayInsert = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let inserts = 0;
    // Both pass the "not approved" check; the second commits first, then the first
    // inserts its own product and its guarded markApproved matches nothing.
    store.beforeProductInsert = async () => {
      inserts += 1;
      if (inserts === 1) {
        await firstMayInsert;
      }
    };

    const first = postApprove(app, { ...approveBody, barcode: '4870001234567' }).then((r) => r);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await postApprove(app);
    releaseFirst();
    const firstResponse = await first;

    expect(second.status).toBe(201);
    expect(firstResponse.status).toBe(409);
    expect(firstResponse.body).toEqual({ error: { message: 'Submission is already approved' } });
    expect(store.products.size).toBe(1); // the loser's product insert rolled back
    expect([...store.products.values()][0]!.barcode).toBe(approveBody.barcode);
    expect(store.submission.createdProductId).toBe([...store.products.keys()][0]);
  });

  it('returns 201 for a normal approval over HTTP', async () => {
    const { app, store } = createHarness();

    const response = await postApprove(app);

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('approved');
    expect(store.products.size).toBe(1);
  });

  it('approves once and returns 409 on repeated approval without creating another product', async () => {
    const { store, service } = createHarness();

    await expect(service.approve(submissionId, approveBody, 'admin-id')).resolves.toMatchObject({
      status: 'approved'
    });
    await expect(service.approve(submissionId, approveBody, 'admin-id')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Submission is already approved'
    });
    expect(store.products.size).toBe(1);
  });
});

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(
    'Invalid `prisma.product.create()` invocation: Unique constraint failed (`barcode`)',
    { code, clientVersion: '7.0.0', meta: { target: ['barcode'], modelName: 'Product' } }
  );
}

function postApprove(app: express.Express, body: Record<string, unknown> = approveBody) {
  return request(app).post(`/product-submissions/${submissionId}/approve`).send(body);
}

function putStatus(app: express.Express, body: Record<string, unknown>) {
  return request(app).put(`/product-submissions/${submissionId}/status`).send(body);
}

function createHarness() {
  const store = {
    submission: createSubmission(),
    products: new Map<string, ProductBody>(),
    statusWrites: 0,
    beforeStatusWrite: null as null | (() => Promise<unknown>),
    beforeProductInsert: null as null | (() => Promise<unknown>),
    productSequence: 0
  };

  const submissionRepository = {
    findById: async (id: string) =>
      id === store.submission.id ? { ...store.submission, createdProduct: null } : null,
    findProductByBarcode: async (barcode: string) =>
      [...store.products.values()].find((product) => product.barcode === barcode) ?? null,
    transaction: async <T>(operation: (transaction: never) => Promise<T>) => {
      const transaction = { insertedProductIds: [] as string[] };
      try {
        return await operation(transaction as never);
      } catch (error) {
        // Roll back only this transaction's product insert.
        for (const id of transaction.insertedProductIds) {
          store.products.delete(id);
        }
        throw error;
      }
    },
    // Same contract as the Prisma repository: the write only matches non-approved rows.
    updateStatus: async (id: string, data: UpdateSubmissionStatusBody, reviewedByUserId: string) => {
      const pending = store.beforeStatusWrite;
      store.beforeStatusWrite = null;
      await pending?.();

      if (id !== store.submission.id || store.submission.status === 'approved') {
        return null;
      }
      store.statusWrites += 1;
      store.submission = {
        ...store.submission,
        status: data.status,
        moderationNote: data.moderationNote,
        reviewedAt: now,
        reviewedByUserId
      };
      return store.submission;
    },
    markApproved: async (id: string, createdProductId: string, reviewedByUserId: string) => {
      // Same as Prisma: the guarded update (status != approved) matches no row.
      if (id !== store.submission.id || store.submission.status === 'approved') {
        throw prismaError('P2025');
      }
      store.submission = {
        ...store.submission,
        status: 'approved',
        createdProductId,
        reviewedAt: now,
        reviewedByUserId
      };
      return { ...store.submission, createdProduct: null };
    }
  };

  const productCreator = {
    create: async (data: ProductBody, transaction?: unknown) => {
      await store.beforeProductInsert?.();
      // Same as the Product.barcode unique index.
      if ([...store.products.values()].some((product) => product.barcode === data.barcode)) {
        throw prismaError('P2002');
      }
      const id = `product-${++store.productSequence}`;
      store.products.set(id, data);
      (transaction as { insertedProductIds?: string[] } | undefined)?.insertedProductIds?.push(id);
      return { id };
    }
  };

  const productImages = {
    copySubmissionImage: async () => null,
    deleteImage: async () => undefined
  };

  const service = new ProductSubmissionService(
    submissionRepository as never,
    productCreator,
    productImages
  );

  const app = express();
  app.use(express.json());
  app.put(
    '/product-submissions/:id/status',
    validate(submissionIdParamsSchema, 'params'),
    validate(updateSubmissionStatusBodySchema),
    asyncHandler(async (req, res) => {
      const submission = await service.updateStatus(
        String(req.params.id),
        req.body as UpdateSubmissionStatusBody,
        'admin-id'
      );
      res.status(200).json({ data: submission });
    })
  );
  app.post(
    '/product-submissions/:id/approve',
    validate(submissionIdParamsSchema, 'params'),
    asyncHandler(async (req, res) => {
      const body = approveSubmissionBodySchema.parse(req.body);
      const submission = await service.approve(String(req.params.id), body, 'admin-id');
      res.status(201).json({ data: submission });
    })
  );
  app.use(errorHandler);

  return { app, store, service };
}

function createSubmission(overrides: Partial<ProductSubmission> = {}): ProductSubmission {
  return {
    id: submissionId,
    barcode: '5449000000996',
    name: 'Coca-Cola Original Taste',
    brand: 'Coca-Cola',
    category: 'Soft Drinks',
    ingredients: ['Carbonated water'],
    servingType: 'per100ml',
    energyKcal: 42,
    protein: 0,
    carbohydrates: 10.6,
    sugars: 10.6,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    salt: 0,
    frontImageUrl: null,
    ingredientsImageUrl: null,
    nutritionImageUrl: null,
    barcodeImageUrl: null,
    status: 'pending',
    moderationNote: null,
    submittedAt: now,
    reviewedAt: null,
    reviewedByUserId: null,
    createdProductId: null,
    anonymousDeviceId: null,
    ...overrides
  };
}
