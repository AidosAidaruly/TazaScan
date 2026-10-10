import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { ProductSubmission } from '../generated/prisma/client';
import { configureTrustProxy } from '../config/trust-proxy';
import {
  pendingDuplicateKey,
  type SubmissionImageUrls
} from '../repositories/product-submission.repository';
import type { ProductSubmissionBody } from '../schemas/product-submission.schema';
import { ProductSubmissionService } from './product-submission.service';

// Duplicate protection is server-defined (submitted content + atomic repository write) and the
// IP rate limit keys on the proxy-aware request.ip; the client-controlled anonymousDeviceId
// plays no part in either.

const now = new Date('2026-08-01T00:00:00.000Z');
const noImages: SubmissionImageUrls = {
  frontImageUrl: null,
  ingredientsImageUrl: null,
  nutritionImageUrl: null,
  barcodeImageUrl: null
};
const frontImage = { ...noImages, frontImageUrl: '/uploads/submissions/front.jpg' };

function body(overrides: Partial<ProductSubmissionBody>): ProductSubmissionBody {
  return { ingredients: [], ...overrides } as ProductSubmissionBody;
}

// In-memory repository applying the same pendingDuplicateKey rule as the real one.
class InMemorySubmissionRepository {
  submissions: ProductSubmission[] = [];

  createUnlessPendingDuplicate(data: ProductSubmissionBody, images: SubmissionImageUrls) {
    const key = pendingDuplicateKey(data);
    const duplicate =
      key &&
      this.submissions.some(
        (item) =>
          item.status === 'pending' &&
          (data.barcode
            ? item.barcode === data.barcode
            : item.barcode === null &&
              item.name?.toLowerCase() === data.name?.toLowerCase() &&
              (item.brand?.toLowerCase() ?? null) === (data.brand?.toLowerCase() ?? null))
      );
    if (duplicate) {
      return Promise.resolve(null);
    }

    const submission = {
      id: `submission-${this.submissions.length + 1}`,
      barcode: data.barcode ?? null,
      name: data.name ?? null,
      brand: data.brand ?? null,
      category: null,
      ingredients: [],
      servingType: null,
      energyKcal: null,
      protein: null,
      carbohydrates: null,
      sugars: null,
      fat: null,
      saturatedFat: null,
      fiber: null,
      salt: null,
      ...images,
      status: 'pending',
      moderationNote: null,
      submittedAt: now,
      reviewedAt: null,
      reviewedByUserId: null,
      createdProductId: null,
      anonymousDeviceId: data.anonymousDeviceId ?? null
    } as ProductSubmission;
    this.submissions.push(submission);
    return Promise.resolve(submission);
  }

  findProductByBarcode() {
    return Promise.resolve(null);
  }
}

function createService() {
  const repository = new InMemorySubmissionRepository();
  const service = new ProductSubmissionService(
    repository as never,
    { create: async () => ({ id: 'product-id' }) },
    { copySubmissionImage: async () => null, deleteImage: async () => undefined }
  );
  return { repository, service };
}

describe('pendingDuplicateKey', () => {
  it('ignores anonymousDeviceId entirely', () => {
    for (const data of [
      { barcode: '4870001234567' },
      { name: 'Ayran', brand: 'Food Master' },
      { name: 'Ayran' }
    ]) {
      const keys = ['device-a', 'device-b', undefined].map((anonymousDeviceId) =>
        JSON.stringify(pendingDuplicateKey(body({ ...data, anonymousDeviceId })))
      );
      expect(new Set(keys).size).toBe(1);
    }
  });

  it('uses the barcode when present, otherwise case-insensitive name and brand', () => {
    expect(pendingDuplicateKey(body({ barcode: '4870001234567', name: 'Ayran' }))).toEqual({
      lockKey: 'product-submission:barcode:4870001234567',
      where: { barcode: '4870001234567' }
    });
    expect(pendingDuplicateKey(body({ name: 'AYRAN', brand: 'Food Master' }))?.lockKey).toBe(
      pendingDuplicateKey(body({ name: 'ayran', brand: 'food master' }))?.lockKey
    );
    expect(pendingDuplicateKey(body({ name: 'Ayran', brand: 'A' }))?.lockKey).not.toBe(
      pendingDuplicateKey(body({ name: 'Ayran' }))?.lockKey
    );
  });

  it('builds lock keys PostgreSQL text accepts and that cannot collide across fields', () => {
    const key = pendingDuplicateKey(body({ name: 'A\u0000B', brand: 'C' }))!.lockKey;

    expect(key).not.toContain('\u0000');
    expect(pendingDuplicateKey(body({ name: 'a","b' }))?.lockKey).not.toBe(
      pendingDuplicateKey(body({ name: 'a', brand: 'b' }))?.lockKey
    );
  });

  it('has no duplicate key for photo-only submissions', () => {
    expect(pendingDuplicateKey(body({}))).toBeNull();
  });
});

describe('ProductSubmissionService duplicate protection', () => {
  it('rotating anonymousDeviceId does not bypass the barcode rule', async () => {
    const { service } = createService();
    await service.create(body({ barcode: '4870001234567', anonymousDeviceId: 'device-1' }), frontImage);

    for (const anonymousDeviceId of ['device-2', 'device-3', undefined]) {
      const discardUploads = vi.fn(async () => undefined);
      await expect(
        service.create(body({ barcode: '4870001234567', anonymousDeviceId }), frontImage, discardUploads)
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'A similar pending submission already exists'
      });
      expect(discardUploads).toHaveBeenCalledTimes(1);
    }
  });

  it('rotating or omitting anonymousDeviceId does not bypass the barcode-less rule', async () => {
    const { service, repository } = createService();
    await service.create(body({ name: 'Ayran', brand: 'Food Master' }), noImages);

    for (const anonymousDeviceId of [`device-${Math.random()}`, `device-${Math.random()}`, undefined]) {
      const discardUploads = vi.fn(async () => undefined);
      await expect(
        service.create(
          body({ name: '  ayran '.trim(), brand: 'FOOD MASTER', anonymousDeviceId }),
          frontImage,
          discardUploads
        )
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(discardUploads).toHaveBeenCalledTimes(1);
    }
    expect(repository.submissions).toHaveLength(1);
  });

  it('still accepts legitimate, different submissions', async () => {
    const { service, repository } = createService();

    // Same device, several different barcode-less products: allowed (the old device rule blocked this).
    await service.create(body({ name: 'Ayran', anonymousDeviceId: 'device-1' }), noImages);
    await service.create(body({ name: 'Kefir', anonymousDeviceId: 'device-1' }), noImages);
    await service.create(body({ name: 'Ayran', brand: 'Other brand', anonymousDeviceId: 'device-1' }), noImages);
    // Different barcodes from different devices.
    await service.create(body({ barcode: '4870001234567', anonymousDeviceId: 'device-2' }), frontImage);
    await service.create(body({ barcode: '5449000000996', anonymousDeviceId: 'device-3' }), frontImage);
    // A barcode submission with the same name as a barcode-less one is a different product key.
    await service.create(body({ barcode: '4870000000016', name: 'Ayran' }), frontImage);
    // Photo-only submissions have nothing to compare; the IP rate limit applies to them.
    await service.create(body({}), frontImage);
    await service.create(body({}), frontImage);

    expect(repository.submissions).toHaveLength(8);
  });

  it('allows a new submission once the earlier one is no longer pending', async () => {
    const { service, repository } = createService();
    await service.create(body({ barcode: '4870001234567' }), frontImage);
    repository.submissions[0]!.status = 'rejected';

    await expect(
      service.create(body({ barcode: '4870001234567' }), frontImage)
    ).resolves.toMatchObject({ status: 'pending' });
  });
});

describe('submission IP rate limit', () => {
  // Fresh limiter state per app; the same hop-count trust as the real app (H1).
  async function createApp(hops: number): Promise<Express> {
    vi.resetModules();
    const { submissionRateLimit } = await import('../middleware/submission-rate-limit.js');
    const app = express();
    configureTrustProxy(app, hops);
    app.use(express.json());
    app.post('/product-submissions', submissionRateLimit, (_request, response) => {
      response.status(201).json({ data: { id: 'submission-id' } });
    });
    return app;
  }

  it('limits to 8 per window regardless of rotating device ids and spoofed X-Forwarded-For', async () => {
    const app = await createApp(0);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await request(app)
        .post('/product-submissions')
        .set('X-Forwarded-For', `198.51.100.${attempt}`)
        .send({ anonymousDeviceId: `device-${attempt}` });
      expect(response.status).toBe(201);
    }

    const limited = await request(app)
      .post('/product-submissions')
      .set('X-Forwarded-For', '198.51.100.250')
      .send({ anonymousDeviceId: 'device-fresh' });

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: { message: 'Too many submissions. Try again later.' } });
  });

  it('behind one trusted proxy, client-prepended X-Forwarded-For entries do not reset the limit', async () => {
    const app = await createApp(1);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await request(app)
        .post('/product-submissions')
        .set('X-Forwarded-For', `10.0.0.${attempt}, 203.0.113.7`)
        .send({});
      expect(response.status).toBe(201);
    }

    const limited = await request(app)
      .post('/product-submissions')
      .set('X-Forwarded-For', '10.0.0.200, 203.0.113.7')
      .send({});
    const otherClient = await request(app)
      .post('/product-submissions')
      .set('X-Forwarded-For', '203.0.113.8')
      .send({});

    expect(limited.status).toBe(429);
    expect(otherClient.status).toBe(201);
  });
});
