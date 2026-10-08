import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let uploadSubmissionImages: RequestHandler;
let uploadedFileUrl: (file?: Express.Multer.File) => string | null;
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
    vi.stubEnv('UPLOAD_ROOT', tempUploadRoot);

    const submissionUpload = await import('./submission-upload.js');
    const errorHandlerModule = await import('./error-handler.js');
    uploadSubmissionImages = submissionUpload.uploadSubmissionImages;
    uploadedFileUrl = submissionUpload.uploadedFileUrl;
    errorHandler = errorHandlerModule.errorHandler;
  });

  afterEach(async () => {
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
});

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
