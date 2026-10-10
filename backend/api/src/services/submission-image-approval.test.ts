import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import sharp from 'sharp';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, ProductSubmission } from '../generated/prisma/client';
import type { ProductBody } from '../schemas/product.schema';
import { NutriScoreEngine } from '../scoring/engines/nutri-score.engine';
import type { StoredFile } from '../storage/file-storage';
import { LocalFileStorage } from '../storage/local-file-storage';
import { ProductImageStorageService } from './product-image-storage.service';
import { ProductSubmissionService } from './product-submission.service';
import { ProductService } from './product.service';

// End-to-end image ownership checks against real files in a temporary upload root:
// submission evidence -> approval -> product image -> public GET -> replace/remove.

const now = new Date('2026-08-01T00:00:00.000Z');
const submissionId = '11111111-1111-4111-8111-111111111111';
const approveBody = {
  barcode: '5449000000996',
  name: 'Coca-Cola Original Taste',
  category: 'Soft Drinks',
  ingredients: ['Carbonated water'],
  servingType: 'per100ml' as const
};

let tempRoot: string;
let storage: LocalFileStorage;
let productImages: ProductImageStorageService;
let products: Map<string, Product>;
let evidence: StoredFile;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tazascan-approval-'));
  storage = new LocalFileStorage(tempRoot);
  await storage.ensureDirectories();
  productImages = new ProductImageStorageService(storage);
  products = new Map();
  evidence = await storage.save({
    scope: 'submissions',
    buffer: await createJpeg('#c0392b'),
    contentType: 'image/jpeg'
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe('submission approval image ownership', () => {
  it('gives the approved product its own product-scoped copy of the front image', async () => {
    const { submissionService } = createServices(createSubmission({ frontImageUrl: evidence.url }));

    const approved = await submissionService.approve(submissionId, approveBody, 'admin-id');
    const product = onlyProduct();

    expect(approved.status).toBe('approved');
    expect(product.imageUrl).toMatch(/^\/uploads\/products\/[a-f0-9-]+\.jpg$/);
    expect(product.imageUrl).not.toBe(evidence.url);
    expect(storage.scopeOfUrl(product.imageUrl)).toBe('products');

    const copyPath = storage.resolveLocalPathFromUrl(product.imageUrl);
    const evidencePath = storage.resolveLocalPathFromUrl(evidence.url);
    expect(copyPath).not.toBe(evidencePath);
    await expect(fs.readFile(copyPath!)).resolves.toEqual(await fs.readFile(evidencePath!));
  });

  it('keeps the original submission evidence after approval', async () => {
    const { submissionService } = createServices(createSubmission({ frontImageUrl: evidence.url }));

    await submissionService.approve(submissionId, approveBody, 'admin-id');

    await expect(fileExists(evidence.url)).resolves.toBe(true);
  });

  it('serves the approved image through the public product-image path and DTO', async () => {
    const { submissionService, productService } = createServices(
      createSubmission({ frontImageUrl: evidence.url })
    );
    await submissionService.approve(submissionId, approveBody, 'admin-id');
    const product = onlyProduct();

    const dto = await productService.getById(product.id);
    expect(dto.imageUrl).toBe(product.imageUrl);

    // Same static mount as app.ts: public, no authentication.
    const app = express();
    app.use('/uploads/products', express.static(storage.getDirectory('products')));
    const response = await request(app).get(dto.imageUrl!);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/image\/jpeg/);
  });

  it('does not delete submission evidence when the approved product image is replaced', async () => {
    const { submissionService, productService } = createServices(
      createSubmission({ frontImageUrl: evidence.url })
    );
    await submissionService.approve(submissionId, approveBody, 'admin-id');
    const product = onlyProduct();
    const copiedUrl = product.imageUrl;

    const updated = await productService.uploadImage(product.id, await uploadedJpeg());

    expect(updated.imageUrl).not.toBe(copiedUrl);
    await expect(fileExists(copiedUrl)).resolves.toBe(false);
    await expect(fileExists(evidence.url)).resolves.toBe(true);
  });

  it('does not delete submission evidence when the approved product image is removed', async () => {
    const { submissionService, productService } = createServices(
      createSubmission({ frontImageUrl: evidence.url })
    );
    await submissionService.approve(submissionId, approveBody, 'admin-id');
    const product = onlyProduct();
    const copiedUrl = product.imageUrl;

    await productService.removeImage(product.id);

    await expect(fileExists(copiedUrl)).resolves.toBe(false);
    await expect(fileExists(evidence.url)).resolves.toBe(true);
  });

  it('never deletes evidence for legacy products that still point at a submission URL', async () => {
    const { productService } = createServices(createSubmission());
    const legacy = createProduct({ id: randomUUID(), imageUrl: evidence.url });
    products.set(legacy.id, legacy);

    // Not exposed publicly (admin-only URL), and never deleted by product operations.
    await expect(productService.getById(legacy.id)).resolves.toMatchObject({ imageUrl: null });

    await productService.uploadImage(legacy.id, await uploadedJpeg());
    await expect(fileExists(evidence.url)).resolves.toBe(true);

    products.set(legacy.id, { ...legacy, imageUrl: evidence.url });
    await productService.removeImage(legacy.id);
    await expect(fileExists(evidence.url)).resolves.toBe(true);
  });

  it('approves a submission without a front image and creates no product image', async () => {
    const { submissionService } = createServices(createSubmission({ frontImageUrl: null }));

    const approved = await submissionService.approve(submissionId, approveBody, 'admin-id');

    expect(approved.status).toBe('approved');
    expect(onlyProduct().imageUrl).toBeNull();
    await expect(fs.readdir(storage.getDirectory('products'))).resolves.toEqual([]);
  });

  it('approves without an image when the evidence file is missing on disk', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await fs.rm(storage.resolveLocalPathFromUrl(evidence.url)!);
    const { submissionService } = createServices(createSubmission({ frontImageUrl: evidence.url }));

    const approved = await submissionService.approve(submissionId, approveBody, 'admin-id');

    expect(approved.status).toBe('approved');
    expect(onlyProduct().imageUrl).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('submission_image_unavailable'));
  });

  it('removes the copied product image when approval fails after copying', async () => {
    const failure = new Error('insert failed');
    const { submissionService } = createServices(
      createSubmission({ frontImageUrl: evidence.url }),
      { failMarkApproved: failure }
    );

    await expect(submissionService.approve(submissionId, approveBody, 'admin-id')).rejects.toBe(
      failure
    );

    await expect(fs.readdir(storage.getDirectory('products'))).resolves.toEqual([]);
    await expect(fileExists(evidence.url)).resolves.toBe(true);
  });
});

function createServices(
  submission: ProductSubmission,
  options: { failMarkApproved?: Error } = {}
) {
  let current = submission;
  const submissionRepository = {
    findById: async (id: string) => (id === current.id ? { ...current, createdProduct: null } : null),
    findProductByBarcode: async () => null,
    transaction: async <T>(operation: (transaction: never) => Promise<T>) => {
      const snapshot = new Map(products);
      try {
        return await operation({} as never);
      } catch (error) {
        products = snapshot; // emulate rollback of the product insert
        throw error;
      }
    },
    markApproved: async (id: string, createdProductId: string, reviewedByUserId: string) => {
      if (options.failMarkApproved) {
        throw options.failMarkApproved;
      }
      current = {
        ...current,
        id,
        status: 'approved',
        createdProductId,
        reviewedByUserId,
        reviewedAt: now
      };
      return { ...current, createdProduct: null };
    }
  };

  const productRepository = {
    findById: async (id: string) => products.get(id) ?? null,
    findByBarcode: async (barcode: string) =>
      [...products.values()].find((product) => product.barcode === barcode) ?? null,
    create: async (data: ProductBody) => {
      const product = createProduct({
        id: randomUUID(),
        barcode: data.barcode,
        name: data.name,
        imageUrl: data.imageUrl ?? null,
        dataStatus: data.dataStatus,
        source: data.source ?? null
      });
      products.set(product.id, product);
      return product;
    },
    updateImageUrl: async (id: string, imageUrl: string | null) => {
      const product = { ...products.get(id)!, imageUrl };
      products.set(id, product);
      return product;
    },
    isImageUrlInUse: async (imageUrl: string) =>
      [...products.values()].some((product) => product.imageUrl === imageUrl)
  };

  const productService = new ProductService(
    productRepository as never,
    new NutriScoreEngine(),
    productImages
  );
  const submissionService = new ProductSubmissionService(
    submissionRepository as never,
    productService,
    productImages
  );

  return { submissionService, productService };
}

function onlyProduct() {
  const all = [...products.values()];
  expect(all).toHaveLength(1);
  return all[0]!;
}

async function fileExists(url: string | null | undefined) {
  const localPath = storage.resolveLocalPathFromUrl(url);
  if (!localPath) {
    return false;
  }
  return fs.stat(localPath).then(
    () => true,
    () => false
  );
}

async function createJpeg(background: string) {
  return sharp({ create: { width: 40, height: 30, channels: 3, background } }).jpeg().toBuffer();
}

async function uploadedJpeg(): Promise<Express.Multer.File> {
  const buffer = await createJpeg('#2980b9');
  return {
    fieldname: 'image',
    originalname: 'front.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: buffer.length,
    buffer
  } as Express.Multer.File;
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

function createProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: randomUUID(),
    barcode: '5449000000996',
    name: 'Coca-Cola Original Taste',
    brand: 'Coca-Cola',
    category: 'Soft Drinks',
    ingredients: ['Carbonated water'],
    ingredientsTextOriginal: null,
    ingredientsTextOriginalLanguage: null,
    ingredientsTextRu: null,
    ingredientsTextTranslatedRu: null,
    ingredientsTranslationSource: null,
    ingredientsTranslatedAt: null,
    servingType: 'per100ml',
    energyKcal: 42,
    protein: 0,
    carbohydrates: 10.6,
    sugars: 10.6,
    fat: 0,
    saturatedFat: 0,
    fiber: null,
    salt: 0,
    officialNutriScoreCategory: null,
    fruitVegetableLegumePercent: null,
    containsNonSugarSweeteners: null,
    healthScore: 65,
    calculatedScore: 65,
    calculatedGrade: 'D',
    scoreStatus: 'calculated',
    scoreAlgorithm: 'test',
    scoreVersion: 'test-1',
    scoreCalculatedAt: now,
    scoreDetails: {},
    manualScoreOverride: null,
    manualOverrideReason: null,
    manualOverrideAt: null,
    imageUrl: null,
    dataStatus: 'community',
    source: 'user_submission',
    lastVerifiedAt: null,
    canonicalProductFamilyId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}
