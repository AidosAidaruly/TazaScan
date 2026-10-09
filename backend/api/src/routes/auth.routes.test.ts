import bcrypt from 'bcryptjs';
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../generated/prisma/client';

// POST /auth/login through the real router (rate limit, validation, controller, service)
// with an in-memory user repository instead of the database.

const users = vi.hoisted(() => [] as User[]);

vi.mock('../repositories/user.repository', () => ({
  UserRepository: class {
    findByEmail(email: string) {
      return Promise.resolve(users.find((user) => user.email === email) ?? null);
    }

    findById(id: string) {
      return Promise.resolve(users.find((user) => user.id === id) ?? null);
    }
  }
}));

const now = new Date('2026-07-31T00:00:00.000Z');
const correctPassword = 'correct-password-for-route-test';
const genericFailure = { error: { message: 'Invalid email or password' } };
let passwordHash: string;

function createUser(overrides: Partial<User>): User {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    passwordHash,
    role: 'admin',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

// A fresh router (and so a fresh login rate-limit counter) per test.
async function createTestApp(): Promise<Express> {
  vi.resetModules();
  const { authRouter } = await import('./auth.routes.js');
  // Same module instance as the router, so `instanceof HttpError` matches.
  const { errorHandler } = await import('../middleware/error-handler.js');
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use(errorHandler);
  return app;
}

beforeAll(async () => {
  passwordHash = await bcrypt.hash(correctPassword, 12);
});

beforeEach(() => {
  users.length = 0;
  users.push(
    createUser({}),
    createUser({
      id: '22222222-2222-4222-8222-222222222222',
      email: 'inactive@example.com',
      isActive: false
    })
  );
});

describe('POST /auth/login', () => {
  it('returns an identical 401 for unknown email, wrong password and inactive account', async () => {
    const app = await createTestApp();
    const attempts = [
      { email: 'missing@example.com', password: correctPassword },
      { email: 'admin@example.com', password: 'wrong-password' },
      { email: 'inactive@example.com', password: 'wrong-password' },
      { email: 'inactive@example.com', password: correctPassword }
    ];

    for (const attempt of attempts) {
      const response = await request(app).post('/auth/login').send(attempt);

      expect(response.status, attempt.email).toBe(401);
      expect(response.body, attempt.email).toEqual(genericFailure);

      const raw = response.text.toLowerCase();
      for (const sensitive of [
        attempt.email,
        attempt.password,
        'inactive',
        'not found',
        'exist',
        '$2'
      ]) {
        expect(raw).not.toContain(sensitive.toLowerCase());
      }
    }
  }, 30_000);

  it('logs in an active admin with the correct password', async () => {
    const app = await createTestApp();

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'Admin@Example.com', password: correctPassword });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      accessToken: expect.any(String),
      user: { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.com', role: 'admin' }
    });
    expect(response.text).not.toContain('passwordHash');
  });

  it('still validates the body before authenticating', async () => {
    const app = await createTestApp();

    const response = await request(app).post('/auth/login').send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
  });

  it('keeps the login rate limit: 10 attempts per window, then 429', async () => {
    const app = await createTestApp();
    const compare = vi.spyOn(bcrypt, 'compare');

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'missing@example.com', password: 'wrong-password' });
      expect(response.status).toBe(401);
    }

    expect(compare).toHaveBeenCalledTimes(10);

    const limited = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: correctPassword });

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      error: { message: 'Too many login attempts. Try again later.' }
    });
    expect(compare).toHaveBeenCalledTimes(10);
    compare.mockRestore();
  }, 60_000);
});
