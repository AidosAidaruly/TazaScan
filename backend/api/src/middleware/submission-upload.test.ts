import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { errorHandler } from './error-handler';
import { uploadSubmissionImages, uploadedFileUrl } from './submission-upload';

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
  const uploadedFiles: string[] = [];

  afterEach(async () => {
    await Promise.all(
      uploadedFiles.splice(0).map((filename) =>
        fs.rm(path.resolve(process.cwd(), 'uploads', 'submissions', filename), {
          force: true
        })
      )
    );
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
      uploadedFiles.push(file.filename);
      expect(file.mimetype).toBe('image/jpeg');
      expect(file.filename).toMatch(/\.jpg$/);
      expect(file.url).toMatch(/\.jpg$/);
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
    expect(response.body.error.message).toBe('Unreadable image');
  });
});

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
