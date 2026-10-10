import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../prisma/client';
import { NutriScoreEngine } from '../scoring/engines/nutri-score.engine';
import { ProductImageStorageService } from '../services/product-image-storage.service';
import { ProductService } from '../services/product.service';
import { LocalFileStorage } from '../storage/local-file-storage';
import { ProductRepository } from './product.repository';

// Opt-in PostgreSQL checks for product image cleanup with the real repository. Temporary
// products and a temporary upload directory are used; no existing records or files are touched.
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true')('product image lifecycle / PostgreSQL', () => {
  const repository = new ProductRepository();
  const createdProductIds: string[] = [];
  let uploadRoot: string;
  let storage: LocalFileStorage;
  let service: ProductService;

  async function createProduct(imageUrl: string | null) {
    const product = await prisma.product.create({
      data: {
        barcode: `test-image-${randomUUID()}`,
        name: 'Image lifecycle test',
        category: 'Test',
        ingredients: [],
        servingType: 'per100g',
        imageUrl
      }
    });
    createdProductIds.push(product.id);
    return product;
  }

  async function storeProductFile() {
    const stored = await storage.save({
      scope: 'products',
      buffer: Buffer.from('image'),
      contentType: 'image/webp'
    });
    return stored.url;
  }

  async function exists(url: string) {
    return fs.access(storage.resolveLocalPathFromUrl(url)!).then(
      () => true,
      () => false
    );
  }

  beforeEach(async () => {
    uploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tazascan-image-db-'));
    storage = new LocalFileStorage(uploadRoot);
    await storage.ensureDirectories();
    service = new ProductService(
      repository,
      new NutriScoreEngine(),
      new ProductImageStorageService(storage)
    );
  });

  afterEach(async () => {
    await fs.rm(uploadRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await prisma.$disconnect();
  });

  it('reports whether any product still references an image URL', async () => {
    const imageUrl = `/uploads/products/${randomUUID()}.webp`;

    expect(await repository.isImageUrlInUse(imageUrl)).toBe(false);
    await createProduct(imageUrl);
    expect(await repository.isImageUrlInUse(imageUrl)).toBe(true);
  });

  it('deleting a product removes its image file but keeps files other products share', async () => {
    const ownUrl = await storeProductFile();
    const sharedUrl = await storeProductFile();
    const own = await createProduct(ownUrl);
    const sharing = await createProduct(sharedUrl);
    await createProduct(sharedUrl);

    await service.delete(own.id);
    await service.delete(sharing.id);

    expect(await exists(ownUrl)).toBe(false);
    expect(await exists(sharedUrl)).toBe(true);
  });

  it('replacing an image through the real repository deletes the old file', async () => {
    const oldUrl = await storeProductFile();
    const product = await createProduct(oldUrl);

    const updated = await service.uploadImage(product.id, {
      buffer: Buffer.from('new'),
      size: 3,
      mimetype: 'image/webp'
    } as Express.Multer.File);

    const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(stored.imageUrl).toBe(updated.imageUrl);
    expect(await exists(updated.imageUrl!)).toBe(true);
    expect(await exists(oldUrl)).toBe(false);
  });
});
