import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { env } from '../config/env';
import { testOnlyJwtSecret } from '../config/jwt-secret';
import type { User } from '../generated/prisma/client';
import { createAuthenticate } from '../middleware/authenticate';
import { authorizeRole } from '../middleware/authorize-role';
import { errorHandler } from '../middleware/error-handler';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { jwtAlgorithm, TokenService } from './token.service';

const tokenService = new TokenService();
const payload = { sub: '11111111-1111-4111-8111-111111111111', role: 'admin' as const };

describe('TokenService', () => {
  it('uses the deterministic test-only secret under NODE_ENV=test', () => {
    expect(env.NODE_ENV).toBe('test');
    expect(env.jwtSecret).toBe(testOnlyJwtSecret);
  });

  it('signs access tokens with HS256 and keeps the configured expiry', () => {
    const token = tokenService.signAccessToken(payload);
    const decoded = jwt.decode(token, { complete: true });

    expect(jwtAlgorithm).toBe('HS256');
    expect(decoded?.header.alg).toBe('HS256');

    const claims = decoded?.payload as jwt.JwtPayload;
    expect(env.JWT_ACCESS_TOKEN_TTL).toBe('15m');
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(15 * 60);
  });

  it('verifies its own tokens', () => {
    const token = tokenService.signAccessToken(payload);

    expect(tokenService.verifyAccessToken(token)).toMatchObject(payload);
  });

  it.each(['HS384', 'HS512'] as const)(
    'rejects a token signed with %s even when the secret is correct',
    (algorithm) => {
      const token = jwt.sign(payload, env.jwtSecret, { algorithm, expiresIn: '15m' });

      expect(() => tokenService.verifyAccessToken(token)).toThrow(
        expect.objectContaining({ statusCode: 401, message: 'Invalid token' })
      );
    }
  );

  it('rejects an unsigned alg=none token', () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 900
    })}.`;

    expect(() => tokenService.verifyAccessToken(token)).toThrow(
      expect.objectContaining({ statusCode: 401, message: 'Invalid token' })
    );
  });

  it('rejects a token signed with a different secret', () => {
    const token = jwt.sign(payload, 'another-secret-another-secret-another-secret', {
      algorithm: 'HS256'
    });

    expect(() => tokenService.verifyAccessToken(token)).toThrow(
      expect.objectContaining({ statusCode: 401, message: 'Invalid token' })
    );
  });

  it('still reports expired tokens as expired', () => {
    const token = jwt.sign(payload, env.jwtSecret, { algorithm: 'HS256', expiresIn: -10 });

    expect(() => tokenService.verifyAccessToken(token)).toThrow(
      expect.objectContaining({ statusCode: 401, message: 'Token expired' })
    );
  });
});

describe('admin login flow', () => {
  it('logs in, then uses the issued token on an admin-protected route', async () => {
    const passwordService = new PasswordService();
    const now = new Date('2026-07-31T00:00:00.000Z');
    const admin: User = {
      id: payload.sub,
      email: 'admin@example.com',
      passwordHash: await passwordService.hash('correct-password'),
      role: 'admin',
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    const repository = {
      findByEmail: async (email: string) => (email === admin.email ? admin : null),
      findById: async (id: string) => (id === admin.id ? admin : null)
    };
    const authService = new AuthService(repository, passwordService, tokenService);

    const { accessToken } = await authService.login({
      email: 'admin@example.com',
      password: 'correct-password'
    });

    const app = express();
    app.get(
      '/admin-only',
      createAuthenticate(authService, tokenService),
      authorizeRole('admin'),
      (incoming, response) => {
        response.status(200).json({ data: incoming.user });
      }
    );
    app.use(errorHandler);

    const authorized = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(authorized.status).toBe(200);
    expect(authorized.body.data).toEqual({ id: admin.id, email: admin.email, role: 'admin' });

    const forged = jwt.sign({ sub: admin.id, role: 'admin' }, env.jwtSecret, {
      algorithm: 'HS512'
    });
    const rejected = await request(app).get('/admin-only').set('Authorization', `Bearer ${forged}`);
    expect(rejected.status).toBe(401);
  });
});
