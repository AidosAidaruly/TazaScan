import express from 'express';
import jwt from 'jsonwebtoken';
import zlib from 'node:zlib';
import sharp from 'sharp';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { env } from '../config/env';
import { TokenService } from '../services/token.service';
import type { AuthUser } from '../types/auth';
import { createAuthenticate } from './authenticate';
import { authorizeRole } from './authorize-role';
import { errorHandler } from './error-handler';
import { uploadProductImage } from './image-upload';

function createTestApp(user?: AuthUser) {
  const app = express();
  const authService = {
    getCurrentUser: async () => {
      if (!user) {
        throw Object.assign(new Error('User not found'), { statusCode: 401 });
      }

      return user;
    }
  };

  app.post(
    '/products/:id/image',
    createAuthenticate(authService, new TokenService()),
    authorizeRole('admin'),
    uploadProductImage,
    (request, response) => {
      response.status(200).json({
        data: {
          filename: request.file?.originalname,
          mimetype: request.file?.mimetype,
          size: request.file?.size
        }
      });
    }
  );
  app.delete(
    '/products/:id/image',
    createAuthenticate(authService, new TokenService()),
    authorizeRole('admin'),
    (_request, response) => {
      response.status(200).json({ data: { imageUrl: null } });
    }
  );
  app.use(errorHandler);

  return app;
}

function signToken(payload = { sub: 'user-id', role: 'admin' }) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '15m' });
}

const adminUser: AuthUser = {
  id: 'user-id',
  email: 'admin@example.com',
  role: 'admin'
};

describe('product image upload middleware', () => {
  it('allows authenticated admin to upload a product image', async () => {
    const image = await createImage('png');
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', image, {
        filename: 'coca-cola.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.mimetype).toBe('image/jpeg');
  });

  it('rejects unauthenticated upload', async () => {
    const image = await createImage('png');
    const response = await request(createTestApp())
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .attach('image', image, {
        filename: 'coca-cola.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(401);
  });

  it('rejects non-admin upload', async () => {
    const image = await createImage('png');
    const response = await request(
      createTestApp({ ...adminUser, role: 'user' })
    )
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken({ sub: 'user-id', role: 'user' })}`)
      .attach('image', image, {
        filename: 'coca-cola.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(403);
  });

  it('rejects invalid MIME type', async () => {
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', Buffer.from('not-an-image'), {
        filename: 'program.exe',
        contentType: 'application/x-msdownload'
      });

    expect(response.status).toBe(415);
  });

  it('rejects a fake jpg with invalid image content', async () => {
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', Buffer.from('not-an-image'), {
        filename: 'photo.JPG',
        contentType: 'image/jpeg'
      });

    expect(response.status).toBe(415);
    expect(response.body.error.message).toBe('Unsupported image format');
  });

  it('accepts uppercase extensions when the image content is valid', async () => {
    const image = await createImage('jpeg');
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', image, {
        filename: 'PHOTO.JPG',
        contentType: 'image/jpeg'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.mimetype).toBe('image/jpeg');
  });

  it('accepts WebP and normalizes it to JPEG', async () => {
    const image = await createImage('webp');
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', image, {
        filename: 'front.webp',
        contentType: 'image/webp'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.mimetype).toBe('image/jpeg');
  });

  it('rejects AVIF even when the runtime decoder supports it', async () => {
    const image = await createOptionalImage('avif');
    if (!image) {
      return;
    }

    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', image, {
        filename: 'front.avif',
        contentType: 'image/avif'
      });

    expect(response.status).toBe(415);
  });

  it('does not let a misleading image/jpeg MIME type bypass format detection', async () => {
    const gif = await createImage('gif');
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', gif, {
        filename: 'photo.jpg',
        contentType: 'image/jpeg'
      });

    expect(response.status).toBe(415);
    expect(response.body.error.message).toBe('Unsupported image format');
  });

  it('rejects SVG disguised as PNG', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>');
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', svg, {
        filename: 'logo.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(415);
    expect(response.body.error.message).toBe('Unsupported image format');
  });

  it('accepts a JPEG sent as application/octet-stream (Flutter http default)', async () => {
    const image = await createImage('jpeg');
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', image, {
        filename: 'image_picker_123.jpg',
        contentType: 'application/octet-stream'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.mimetype).toBe('image/jpeg');
  });

  it('rejects images whose dimensions exceed the pixel limit with a clean 413', async () => {
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', createPngBomb(20_000, 20_000), {
        filename: 'bomb.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(413);
    expect(response.body.error.message).toBe('Image dimensions are too large');
    expect(JSON.stringify(response.body)).not.toMatch(/pixel limit|vips|sharp/i);
  });

  it('rejects oversized images', async () => {
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'large.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(413);
  });

  it('rejects multiple files', async () => {
    const image = await createImage('png');
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', image, {
        filename: 'one.png',
        contentType: 'image/png'
      })
      .attach('image', image, {
        filename: 'two.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(400);
  });

  it('allows authenticated admin to remove a product image', async () => {
    const response = await request(createTestApp(adminUser))
      .delete('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.data.imageUrl).toBeNull();
  });
});

async function createImage(format: 'jpeg' | 'png' | 'webp' | 'avif' | 'gif') {
  return sharp({
    create: {
      width: 24,
      height: 16,
      channels: 3,
      background: '#1677ff'
    }
  })
    .toFormat(format)
    .toBuffer();
}

async function createOptionalImage(format: 'avif') {
  try {
    return await createImage(format);
  } catch {
    return null;
  }
}

// Decompression-bomb style PNG: IHDR declares width x height, IDAT holds only a few bytes.
function createPngBomb(width: number, height: number) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.alloc(4096))),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function pngChunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type, 'latin1');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBytes, data])), 0);

  return Buffer.concat([length, typeBytes, data, crc]);
}
