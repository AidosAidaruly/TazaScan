import express from 'express';
import jwt from 'jsonwebtoken';
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
    expect(response.body.error.message).toBe('Unreadable image');
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

  it('accepts AVIF when the runtime decoder supports it', async () => {
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

    expect(response.status).toBe(200);
    expect(response.body.data.mimetype).toBe('image/jpeg');
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

async function createImage(format: 'jpeg' | 'png' | 'webp' | 'avif') {
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
