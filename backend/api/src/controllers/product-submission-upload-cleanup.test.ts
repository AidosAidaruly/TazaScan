import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductSubmission } from '../generated/prisma/client';
import type { ProductSubmissionRepository } from '../repositories/product-submission.repository';
import type { FileStorage } from '../storage/file-storage';

// POST /product-submissions end to end (real upload middleware, controller, service and
// local storage; only the database repository is stubbed): failed submissions must not
// leave files behind, successful ones keep every evidence file.

let tempUploadRoot: string;
let app: express.Express;
let fileStorage: FileStorage;
let repository: ProductSubmissionRepository;
let created: Array<Record<string, unknown>>;

const imageFields = ['frontImage', 'ingredientsImage', 'nutritionImage', 'barcodeImage'] as const;

beforeEach(async () => {
  vi.resetModules();
  tempUploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tazascan-submission-cleanup-'));
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/tazascan');
  vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-9f2c7a1e4b8d6035-not-real');
  vi.stubEnv('UPLOAD_ROOT', tempUploadRoot);

  const { uploadSubmissionImages } = await import('../middleware/submission-upload.js');
  const { asyncHandler } = await import('../middleware/async-handler.js');
  const { errorHandler } = await import('../middleware/error-handler.js');
  const { createProductSubmission } = await import('./product-submission.controller.js');
  const { ProductSubmissionRepository } = await import(
    '../repositories/product-submission.repository.js'
  );
  fileStorage = (await import('../storage/storage-provider.js')).fileStorage;
  repository = ProductSubmissionRepository.prototype;

  created = [];
  vi.spyOn(repository, 'findProductByBarcode').mockResolvedValue(null);
  vi.spyOn(repository, 'findPendingDuplicate').mockResolvedValue(null);
  vi.spyOn(repository, 'create').mockImplementation((async (
    data: Parameters<ProductSubmissionRepository['create']>[0],
    images: Parameters<ProductSubmissionRepository['create']>[1]
  ) => {
    created.push({ ...data, ...images });
    return createSubmission({ barcode: data.barcode ?? null, name: data.name ?? null, ...images });
  }) as never);

  // Same chain as the route, minus the IP rate limiter.
  app = express();
  app.post('/product-submissions', uploadSubmissionImages, asyncHandler(createProductSubmission));
  app.use(errorHandler);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await fs.rm(tempUploadRoot, { recursive: true, force: true });
});

describe('POST /product-submissions upload ownership', () => {
  it('keeps every evidence file of a successful submission', async () => {
    const foreign = await seedForeignFiles();

    const response = await submit({ barcode: '4870001234567', name: 'Йогурт' }, imageFields);

    expect(response.status).toBe(201);
    const urls = Object.values(response.body.data.images) as string[];
    expect(urls).toHaveLength(4);
    expect(created).toHaveLength(1);
    for (const url of urls) {
      expect(url).toMatch(/^\/product-submissions\/uploads\/[a-f0-9-]+\.jpg$/);
      expect(Object.values(created[0]!)).toContain(url);
    }
    await expect(listSubmissionFiles()).resolves.toEqual(
      [foreign.evidenceName, ...urls.map((url) => path.basename(url))].sort()
    );
    await expectForeignFilesIntact(foreign);
  });

  it('accepts a submission without images and stores nothing', async () => {
    const response = await submit({ name: 'Йогурт' }, []);

    expect(response.status).toBe(201);
    await expect(listSubmissionFiles()).resolves.toEqual([]);
  });

  it('leaves no new files when the body fails validation', async () => {
    const foreign = await seedForeignFiles();

    const response = await submit({ barcode: 'not-a-barcode' }, imageFields);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
    await expectOnlyForeignFiles(foreign);
  });

  it('leaves no new files when the nutrition data is inconsistent', async () => {
    const foreign = await seedForeignFiles();

    const response = await submit(
      { name: 'Йогурт', sugars: '20', carbohydrates: '10' },
      imageFields
    );

    expect(response.status).toBe(400);
    await expectOnlyForeignFiles(foreign);
  });

  it('leaves no new files when a barcode submission lacks the front photo', async () => {
    const foreign = await seedForeignFiles();

    const response = await submit({ barcode: '4870001234567' }, ['nutritionImage']);

    expect(response.status).toBe(400);
    expect(response.body.error.details.code).toBe('front_image_required');
    await expectOnlyForeignFiles(foreign);
  });

  it('leaves no new files when a product already exists for the barcode', async () => {
    const foreign = await seedForeignFiles();
    vi.mocked(repository.findProductByBarcode).mockResolvedValue({ id: 'product-id' } as never);

    const response = await submit({ barcode: '4870001234567' }, imageFields);

    expect(response.status).toBe(409);
    expect(response.body.error.details.code).toBe('product_exists');
    await expectOnlyForeignFiles(foreign);
  });

  it('leaves no new files for a duplicate pending submission', async () => {
    const foreign = await seedForeignFiles();
    vi.mocked(repository.findPendingDuplicate).mockResolvedValue(createSubmission());

    const response = await submit({ barcode: '4870001234567' }, imageFields);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe('A similar pending submission already exists');
    await expectOnlyForeignFiles(foreign);
  });

  it('leaves no new files when the repository create fails', async () => {
    const foreign = await seedForeignFiles();
    vi.mocked(repository.create).mockRejectedValue(new Error('connection terminated'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await submit({ barcode: '4870001234567' }, imageFields);

    expect(response.status).toBe(500);
    expect(response.body.error.message).toBe('Internal server error');
    await expectOnlyForeignFiles(foreign);
  });

  it('cleans earlier files when processing a later image fails', async () => {
    const foreign = await seedForeignFiles();

    const response = await request(app)
      .post('/product-submissions')
      .field('barcode', '4870001234567')
      .attach('frontImage', await createJpeg(), { filename: 'front.jpg', contentType: 'image/jpeg' })
      .attach('ingredientsImage', await createJpeg(), {
        filename: 'ingredients.jpg',
        contentType: 'image/jpeg'
      })
      .attach('nutritionImage', Buffer.from('broken'), {
        filename: 'nutrition.jpg',
        contentType: 'image/jpeg'
      });

    expect(response.status).toBe(415);
    expect(repository.create).not.toHaveBeenCalled();
    await expectOnlyForeignFiles(foreign);
  });

  it('keeps the original error when cleanup itself fails', async () => {
    const foreign = await seedForeignFiles();
    vi.mocked(repository.findPendingDuplicate).mockResolvedValue(createSubmission());
    vi.spyOn(fileStorage, 'deleteByUrl').mockRejectedValue(
      Object.assign(new Error(`EPERM: operation not permitted '${tempUploadRoot}'`), {
        code: 'EPERM'
      })
    );
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await submit({ barcode: '4870001234567' }, imageFields);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe('A similar pending submission already exists');
    expect(JSON.stringify(response.body)).not.toContain(tempUploadRoot);
    expect(fileStorage.deleteByUrl).toHaveBeenCalledTimes(4);
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('"event":"submission_upload_cleanup_failed"')
    );
    expect(String(errorLog.mock.calls[0]![0])).not.toContain(tempUploadRoot);
    await expectForeignFilesIntact(foreign);
  });

  it('never cleans another concurrent request\'s files', async () => {
    vi.mocked(repository.findPendingDuplicate).mockImplementation((async (barcode?: string | null) =>
      barcode === '4870001234567' ? createSubmission() : null) as never);

    const [failed, succeeded] = await Promise.all([
      submit({ barcode: '4870001234567' }, imageFields),
      submit({ barcode: '5449000000996' }, imageFields)
    ]);

    expect(failed.status).toBe(409);
    expect(succeeded.status).toBe(201);
    const keptNames = (Object.values(succeeded.body.data.images) as string[]).map((url) =>
      path.basename(url)
    );
    await expect(listSubmissionFiles()).resolves.toEqual(keptNames.sort());
  });
});

async function submit(fields: Record<string, string>, images: readonly string[]) {
  let pending = request(app).post('/product-submissions');
  for (const [name, value] of Object.entries(fields)) {
    pending = pending.field(name, value);
  }
  for (const field of images) {
    pending = pending.attach(field, await createJpeg(), {
      filename: `${field}.jpg`,
      contentType: 'image/jpeg'
    });
  }
  return pending;
}

// A pre-existing submission's evidence and a product image; no request owns them.
async function seedForeignFiles() {
  const evidence = await fileStorage.save({
    scope: 'submissions',
    buffer: await createJpeg(),
    contentType: 'image/jpeg'
  });
  const product = await fileStorage.save({
    scope: 'products',
    buffer: await createJpeg(),
    contentType: 'image/jpeg'
  });
  return { evidenceName: path.basename(evidence.url), productKey: product.key };
}

async function expectOnlyForeignFiles(foreign: Awaited<ReturnType<typeof seedForeignFiles>>) {
  await expect(listSubmissionFiles()).resolves.toEqual([foreign.evidenceName]);
  await expectForeignFilesIntact(foreign);
}

async function expectForeignFilesIntact(foreign: Awaited<ReturnType<typeof seedForeignFiles>>) {
  await expect(
    fs.stat(path.join(tempUploadRoot, 'submissions', foreign.evidenceName))
  ).resolves.toBeTruthy();
  await expect(fs.stat(path.join(tempUploadRoot, foreign.productKey))).resolves.toBeTruthy();
}

async function listSubmissionFiles() {
  const names = await fs.readdir(path.join(tempUploadRoot, 'submissions')).catch(() => []);
  return names.sort();
}

function createJpeg() {
  return sharp({ create: { width: 32, height: 24, channels: 3, background: '#08111c' } })
    .jpeg()
    .toBuffer();
}

function createSubmission(overrides: Partial<ProductSubmission> = {}): ProductSubmission {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    barcode: null,
    name: null,
    brand: null,
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
    frontImageUrl: null,
    ingredientsImageUrl: null,
    nutritionImageUrl: null,
    barcodeImageUrl: null,
    status: 'pending',
    moderationNote: null,
    submittedAt: new Date('2026-08-01T00:00:00.000Z'),
    reviewedAt: null,
    reviewedByUserId: null,
    createdProductId: null,
    anonymousDeviceId: null,
    ...overrides
  };
}
