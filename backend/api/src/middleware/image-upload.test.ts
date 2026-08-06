import express from 'express';
import jwt from 'jsonwebtoken';
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
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', Buffer.from('image-bytes'), {
        filename: 'coca-cola.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.mimetype).toBe('image/png');
  });

  it('rejects unauthenticated upload', async () => {
    const response = await request(createTestApp())
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .attach('image', Buffer.from('image-bytes'), {
        filename: 'coca-cola.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(401);
  });

  it('rejects non-admin upload', async () => {
    const response = await request(
      createTestApp({ ...adminUser, role: 'user' })
    )
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken({ sub: 'user-id', role: 'user' })}`)
      .attach('image', Buffer.from('image-bytes'), {
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
    const response = await request(createTestApp(adminUser))
      .post('/products/11111111-1111-4111-8111-111111111111/image')
      .set('Authorization', `Bearer ${signToken()}`)
      .attach('image', Buffer.from('one'), {
        filename: 'one.png',
        contentType: 'image/png'
      })
      .attach('image', Buffer.from('two'), {
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
