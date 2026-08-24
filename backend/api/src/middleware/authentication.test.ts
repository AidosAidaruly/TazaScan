import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { env } from '../config/env';
import { errorHandler } from './error-handler';
import { createAuthenticate } from './authenticate';
import { authorizeRole } from './authorize-role';
import { TokenService } from '../services/token.service';
import type { AuthUser } from '../types/auth';

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

  app.use(express.json());
  app.get('/products', (_request, response) => {
    response.status(200).json({ data: [] });
  });
  app.post(
    '/products',
    createAuthenticate(authService, new TokenService()),
    authorizeRole('admin'),
    (_request, response) => {
      response.status(201).json({ data: { id: 'product-id' } });
    }
  );
  app.post(
    '/products/taza-score-preview',
    createAuthenticate(authService, new TokenService()),
    authorizeRole('admin'),
    (_request, response) => {
      response.status(200).json({ data: { status: 'calculated', score: 41 } });
    }
  );
  app.put(
    '/products/:id/halal-certification',
    createAuthenticate(authService, new TokenService()),
    authorizeRole('admin'),
    (request, response) => {
      response.status(200).json({ data: { id: request.params.id } });
    }
  );
  app.delete(
    '/products/:id/halal-certification',
    createAuthenticate(authService, new TokenService()),
    authorizeRole('admin'),
    (request, response) => {
      response.status(200).json({ data: { id: request.params.id } });
    }
  );
  app.put(
    '/products/:id',
    createAuthenticate(authService, new TokenService()),
    authorizeRole('admin'),
    (request, response) => {
      response.status(200).json({ data: { id: request.params.id } });
    }
  );
  app.delete(
    '/products/:id',
    createAuthenticate(authService, new TokenService()),
    authorizeRole('admin'),
    (_request, response) => {
      response.status(204).send();
    }
  );
  app.use(errorHandler);

  return app;
}

function signToken(payload = { sub: 'user-id', role: 'admin' }) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '15m' });
}

describe('authentication middleware', () => {
  it('rejects missing token', async () => {
    const response = await request(createTestApp()).post('/products').send({});

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Missing token');
  });

  it('rejects invalid token', async () => {
    const response = await request(createTestApp())
      .post('/products')
      .set('Authorization', 'Bearer invalid-token')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Invalid token');
  });

  it('rejects expired token', async () => {
    const token = jwt.sign({ sub: 'user-id', role: 'admin' }, env.jwtSecret, {
      expiresIn: '-1s'
    });
    const response = await request(createTestApp())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Token expired');
  });

  it('allows authenticated admin to create a product', async () => {
    const response = await request(
      createTestApp({
        id: 'user-id',
        email: 'admin@example.com',
        role: 'admin'
      })
    )
      .post('/products')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({});

    expect(response.status).toBe(201);
  });

  it('rejects ordinary user creating a product', async () => {
    const response = await request(
      createTestApp({
        id: 'user-id',
        email: 'user@example.com',
        role: 'user'
      })
    )
      .post('/products')
      .set('Authorization', `Bearer ${signToken({ sub: 'user-id', role: 'user' })}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe('Insufficient role');
  });

  it('keeps TazaScore preview admin-only', async () => {
    const unauthenticated = await request(createTestApp())
      .post('/products/taza-score-preview')
      .send({});
    const ordinaryUser = await request(
      createTestApp({
        id: 'user-id',
        email: 'user@example.com',
        role: 'user'
      })
    )
      .post('/products/taza-score-preview')
      .set('Authorization', `Bearer ${signToken({ sub: 'user-id', role: 'user' })}`)
      .send({});
    const admin = await request(
      createTestApp({
        id: 'user-id',
        email: 'admin@example.com',
        role: 'admin'
      })
    )
      .post('/products/taza-score-preview')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({});

    expect(unauthenticated.status).toBe(401);
    expect(ordinaryUser.status).toBe(403);
    expect(admin.status).toBe(200);
  });

  it('rejects unauthenticated update and delete', async () => {
    const app = createTestApp();
    const updateResponse = await request(app).put('/products/product-id').send({});
    const deleteResponse = await request(app).delete('/products/product-id');

    expect(updateResponse.status).toBe(401);
    expect(deleteResponse.status).toBe(401);
  });

  it('keeps halal certification writes admin-only', async () => {
    const unauthenticated = await request(createTestApp())
      .put('/products/product-id/halal-certification')
      .send({});
    const ordinaryUser = await request(
      createTestApp({
        id: 'user-id',
        email: 'user@example.com',
        role: 'user'
      })
    )
      .delete('/products/product-id/halal-certification')
      .set('Authorization', `Bearer ${signToken({ sub: 'user-id', role: 'user' })}`);
    const admin = await request(
      createTestApp({
        id: 'user-id',
        email: 'admin@example.com',
        role: 'admin'
      })
    )
      .put('/products/product-id/halal-certification')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({});

    expect(unauthenticated.status).toBe(401);
    expect(ordinaryUser.status).toBe(403);
    expect(admin.status).toBe(200);
  });

  it('keeps public product GET endpoints available', async () => {
    const response = await request(createTestApp()).get('/products');

    expect(response.status).toBe(200);
  });
});
