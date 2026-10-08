import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileStorage } from '../storage/file-storage';

let uploadSubmissionImages: RequestHandler;
let uploadedFileUrl: (file?: Express.Multer.File) => string | null;
let discardSubmissionUploads: (request: express.Request) => Promise<void>;
let fileStorage: FileStorage;
let errorHandler: ErrorRequestHandler;
let tempUploadRoot: string;

function createTestApp() {
  const app = express();

  app.post('/product-submissions', uploadSubmissionImages, (request, response) => {
    const files = request.files as Record<string, Express.Multer.File[]>;
    response.status(201).json({
      data: {
        frontImage: toFileDto(files.frontImage?.[0]),
        ingredientsImage: toFileDto(files.ingredientsImage?.[0]),
        nutritionImage: toFileDto(files.nutritionImage?.[0])
      }
    });
  });
  app.use(errorHandler);

  return app;
}

function toFileDto(file?: Express.Multer.File) {
  if (!file) {
    return null;
  }

  return {
    mimetype: file.mimetype,
    filename: file.filename,
    url: uploadedFileUrl(file),
    size: file.size
  };
}

describe('submission image upload middleware', () => {
  beforeEach(async () => {
    vi.resetModules();
    tempUploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tazascan-upload-'));
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/tazascan');
    vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-9f2c7a1e4b8d6035-not-real');
    vi.stubEnv('UPLOAD_ROOT', tempUploadRoot);

    const submissionUpload = await import('./submission-upload.js');
    const errorHandlerModule = await import('./error-handler.js');
    uploadSubmissionImages = submissionUpload.uploadSubmissionImages;
    uploadedFileUrl = submissionUpload.uploadedFileUrl;
    discardSubmissionUploads = submissionUpload.discardSubmissionUploads;
    fileStorage = (await import('../storage/storage-provider.js')).fileStorage;
    errorHandler = errorHandlerModule.errorHandler;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await fs.rm(tempUploadRoot, { recursive: true, force: true });
  });

  it('normalizes front, nutrition and ingredients images through the same pipeline', async () => {
    const png = await createImage('png');
    const webp = await createImage('webp');
    const jpeg = await createImage('jpeg');

    const response = await request(createTestApp())
      .post('/product-submissions')
      .attach('frontImage', png, {
        filename: 'front.png',
        contentType: 'image/png'
      })
      .attach('nutritionImage', webp, {
        filename: 'nutrition.webp',
        contentType: 'image/webp'
      })
      .attach('ingredientsImage', jpeg, {
        filename: 'ingredients.JPG',
        contentType: 'image/jpeg'
      });

    expect(response.status).toBe(201);
    for (const key of ['frontImage', 'nutritionImage', 'ingredientsImage']) {
      const file = response.body.data[key];
      expect(file.mimetype).toBe('image/jpeg');
      expect(file.filename).toMatch(/\.jpg$/);
      expect(file.url).toMatch(/\.jpg$/);
      await expect(
        fs.stat(path.join(tempUploadRoot, 'submissions', file.filename))
      ).resolves.toBeTruthy();
    }
  });

  it('rejects invalid binary files without persisting them', async () => {
    const response = await request(createTestApp())
      .post('/product-submissions')
      .attach('frontImage', Buffer.from('not an image'), {
        filename: 'front.jpg',
        contentType: 'image/jpeg'
      });

    expect(response.status).toBe(415);
    expect(response.body.error.message).toBe('Unsupported image format');
    await expect(listStoredSubmissions()).resolves.toEqual([]);
  });

  it('accepts mobile uploads sent as application/octet-stream', async () => {
    const response = await request(createTestApp())
      .post('/product-submissions')
      .attach('frontImage', await createImage('jpeg'), {
        filename: 'image_picker_front.jpg',
        contentType: 'application/octet-stream'
      });

    expect(response.status).toBe(201);
    expect(response.body.data.frontImage.mimetype).toBe('image/jpeg');
  });

  it('rejects SVG disguised as JPEG on the public endpoint without persisting it', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>');
    const response = await request(createTestApp())
      .post('/product-submissions')
      .attach('frontImage', svg, {
        filename: 'front.jpg',
        contentType: 'image/jpeg'
      });

    expect(response.status).toBe(415);
    expect(response.body.error.message).toBe('Unsupported image format');
    await expect(listStoredSubmissions()).resolves.toEqual([]);
  });

  it('rejects GIF content sent as application/octet-stream', async () => {
    const gif = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#08111c' }
    })
      .gif()
      .toBuffer();
    const response = await request(createTestApp())
      .post('/product-submissions')
      .attach('frontImage', gif, {
        filename: 'front.jpg',
        contentType: 'application/octet-stream'
      });

    expect(response.status).toBe(415);
  });

  describe('request-owned upload cleanup', () => {
    function createDiscardingApp() {
      const app = express();
      // Simulates a later failure in the request: discard, then report what was stored.
      app.post('/product-submissions', uploadSubmissionImages, async (request, response) => {
        const files = request.files as Record<string, Express.Multer.File[]>;
        const urls = Object.values(files).flat().map((file) => uploadedFileUrl(file));
        await discardSubmissionUploads(request);
        response.status(422).json({ urls });
      });
      app.use(errorHandler);
      return app;
    }

    it('writes nothing when a later image in the same request fails normalization', async () => {
      const response = await request(createTestApp())
        .post('/product-submissions')
        .attach('frontImage', await createImage('jpeg'), {
          filename: 'front.jpg',
          contentType: 'image/jpeg'
        })
        .attach('ingredientsImage', await createImage('png'), {
          filename: 'ingredients.png',
          contentType: 'image/png'
        })
        .attach('nutritionImage', Buffer.from('not an image'), {
          filename: 'nutrition.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(415);
      await expect(listStoredSubmissions()).resolves.toEqual([]);
    });

    it('removes files already stored by this request when a later save fails', async () => {
      const existing = await seedForeignFiles();
      const save = fileStorage.save.bind(fileStorage);
      let calls = 0;
      vi.spyOn(fileStorage, 'save').mockImplementation(async (input) => {
        calls += 1;
        if (calls === 3) {
          throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
        }
        return save(input);
      });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const response = await attachAll(request(createTestApp()).post('/product-submissions'));

      expect(response.status).toBe(500);
      expect(calls).toBe(3);
      await expect(listStoredSubmissions()).resolves.toEqual([existing.evidenceName]);
      await expect(fs.stat(existing.productPath)).resolves.toBeTruthy();
    });

    it('discards only files stored by this request, and only in the submissions scope', async () => {
      const existing = await seedForeignFiles();
      const deleteByUrl = vi.spyOn(fileStorage, 'deleteByUrl');

      const response = await attachAll(request(createDiscardingApp()).post('/product-submissions'));

      expect(response.status).toBe(422);
      expect(response.body.urls).toHaveLength(4);
      expect(deleteByUrl).toHaveBeenCalledTimes(4);
      for (const [url, options] of deleteByUrl.mock.calls) {
        expect(response.body.urls).toContain(url);
        expect(options).toEqual({ scope: 'submissions' });
      }
      await expect(listStoredSubmissions()).resolves.toEqual([existing.evidenceName]);
      await expect(fs.stat(existing.productPath)).resolves.toBeTruthy();
    });

    it('does not touch files of a concurrent successful request', async () => {
      const [kept, discarded] = await Promise.all([
        attachAll(request(createTestApp()).post('/product-submissions')),
        attachAll(request(createDiscardingApp()).post('/product-submissions'))
      ]);

      expect(kept.status).toBe(201);
      expect(discarded.status).toBe(422);
      const keptNames = ['frontImage', 'ingredientsImage', 'nutritionImage'].map(
        (field) => kept.body.data[field].filename as string
      );
      const stored = await listStoredSubmissions();
      // createTestApp reports three fields; the fourth (barcode) image is also kept.
      expect(stored).toHaveLength(4);
      for (const name of keptNames) {
        expect(stored).toContain(name);
      }
      for (const url of discarded.body.urls as string[]) {
        expect(stored).not.toContain(path.basename(url));
      }
    });

    it('keeps deleting the remaining files when one deletion fails, logging no paths', async () => {
      const deleteByUrl = fileStorage.deleteByUrl.bind(fileStorage);
      let calls = 0;
      vi.spyOn(fileStorage, 'deleteByUrl').mockImplementation(async (url, options) => {
        calls += 1;
        if (calls === 1) {
          throw Object.assign(new Error(`EACCES: permission denied, unlink '${tempUploadRoot}'`), {
            code: 'EACCES'
          });
        }
        return deleteByUrl(url, options);
      });
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const response = await attachAll(request(createDiscardingApp()).post('/product-submissions'));

      expect(response.status).toBe(422);
      expect(calls).toBe(4);
      await expect(listStoredSubmissions()).resolves.toHaveLength(1);
      expect(errorLog).toHaveBeenCalledOnce();
      const logged = String(errorLog.mock.calls[0]![0]);
      expect(JSON.parse(logged)).toEqual({
        level: 'error',
        event: 'submission_upload_cleanup_failed',
        failed: 1,
        total: 4,
        codes: ['EACCES']
      });
      expect(logged).not.toContain(tempUploadRoot);
      expect(logged).not.toContain('/product-submissions/uploads/');
    });
  });

  describe('multipart limits', () => {
    const mobileFields = {
      barcode: '4870001234567',
      name: 'Йогурт клубничный',
      brand: 'Taza',
      category: 'Молочные продукты',
      ingredients: 'молоко\nклубника\nсахар',
      servingType: 'per100g',
      energyKcal: '95',
      protein: '3.2',
      carbohydrates: '14',
      sugars: '12',
      fat: '2.5',
      saturatedFat: '1.6',
      fiber: '0.3',
      salt: '0.1'
    };

    it('accepts a full mobile-style submission (14 fields + 4 images)', async () => {
      let pending = request(createTestApp()).post('/product-submissions');
      for (const [name, value] of Object.entries(mobileFields)) {
        pending = pending.field(name, value);
      }
      for (const field of ['frontImage', 'ingredientsImage', 'nutritionImage', 'barcodeImage']) {
        pending = pending.attach(field, await createImage('jpeg'), {
          filename: `${field}.jpg`,
          contentType: 'application/octet-stream'
        });
      }

      const response = await pending;

      expect(response.status).toBe(201);
      expect(response.body.data.frontImage.mimetype).toBe('image/jpeg');
    });

    it('accepts a long ingredients list within the field size limit', async () => {
      const ingredients = 'ингредиент, '.repeat(600); // ~13 KB of UTF-8 Cyrillic
      expect(Buffer.byteLength(ingredients)).toBeLessThan(16 * 1024);

      const response = await request(createTestApp())
        .post('/product-submissions')
        .field('ingredients', ingredients)
        .attach('frontImage', await createImage('jpeg'), {
          filename: 'front.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(201);
    });

    it('rejects too many text fields with 413 without persisting files', async () => {
      let pending = request(createTestApp()).post('/product-submissions');
      for (let index = 0; index <= 30; index += 1) {
        pending = pending.field(`field${index}`, 'x');
      }

      const response = await pending.attach('frontImage', await createImage('jpeg'), {
        filename: 'front.jpg',
        contentType: 'image/jpeg'
      });

      expect(response.status).toBe(413);
      expect(response.body.error).toEqual({ message: 'Too many form fields' });
      await expect(listStoredSubmissions()).resolves.toEqual([]);
    });

    it('rejects an oversized text field with 413', async () => {
      const response = await request(createTestApp())
        .post('/product-submissions')
        .field('ingredients', 'x'.repeat(16 * 1024 + 1));

      expect(response.status).toBe(413);
      expect(response.body.error).toEqual({ message: 'Form field is too large' });
    });

    it('rejects an oversized image with 413 (mapped by the mobile app as photo too large)', async () => {
      const response = await request(createTestApp())
        .post('/product-submissions')
        .attach('frontImage', Buffer.alloc(5 * 1024 * 1024 + 1), {
          filename: 'front.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(413);
      expect(response.body.error).toEqual({ message: 'Image file is too large' });
      await expect(listStoredSubmissions()).resolves.toEqual([]);
    });

    it('rejects an unexpected file field with 400 and no raw Multer details', async () => {
      const response = await request(createTestApp())
        .post('/product-submissions')
        .attach('backImage', await createImage('jpeg'), {
          filename: 'back.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({ message: 'Invalid image upload' });
    });

    it('answers a malformed multipart body with 400 and keeps serving requests', async () => {
      const app = createTestApp();
      const malformed = await request(app)
        .post('/product-submissions')
        .set('Content-Type', 'multipart/form-data; boundary=tazaBoundary')
        .send('--tazaBoundary\r\nContent-Disposition: form-data; name="name"\r\n\r\nunterminated');

      expect(malformed.status).toBe(400);
      expect(malformed.body.error).toEqual({ message: 'Malformed multipart request' });
      await expect(listStoredSubmissions()).resolves.toEqual([]);

      const followUp = await request(app)
        .post('/product-submissions')
        .attach('frontImage', await createImage('jpeg'), {
          filename: 'front.jpg',
          contentType: 'image/jpeg'
        });
      expect(followUp.status).toBe(201);
    });
  });
});

async function attachAll(pending: request.Test) {
  for (const field of ['frontImage', 'ingredientsImage', 'nutritionImage', 'barcodeImage']) {
    pending = pending.attach(field, await createImage('jpeg'), {
      filename: `${field}.jpg`,
      contentType: 'image/jpeg'
    });
  }
  return pending;
}

// A pre-existing submission's evidence and a product image, neither owned by the request.
async function seedForeignFiles() {
  const evidence = await fileStorage.save({
    scope: 'submissions',
    buffer: await createImage('jpeg'),
    contentType: 'image/jpeg'
  });
  const product = await fileStorage.save({
    scope: 'products',
    buffer: await createImage('jpeg'),
    contentType: 'image/jpeg'
  });
  return {
    evidenceName: path.basename(evidence.url),
    productPath: path.join(tempUploadRoot, product.key)
  };
}

async function listStoredSubmissions() {
  return fs.readdir(path.join(tempUploadRoot, 'submissions')).catch(() => []);
}

async function createImage(format: 'jpeg' | 'png' | 'webp') {
  return sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: '#08111c'
    }
  })
    .toFormat(format)
    .toBuffer();
}
