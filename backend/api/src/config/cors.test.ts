import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../middleware/error-handler';
import { createCorsMiddleware } from './cors';
import { CorsConfigError, developmentDefaultCorsOrigins, parseCorsOrigins } from './cors-origins';

const adminOrigin = 'https://admin.example.com';
const evilOrigin = 'https://evil.example.net';

describe('parseCorsOrigins', () => {
  it('parses a comma-separated allowlist of exact origins', () => {
    expect(
      parseCorsOrigins('production', ' https://admin.example.com , http://localhost:5173,https://admin.example.com ')
    ).toEqual(['https://admin.example.com', 'http://localhost:5173']);
  });

  it.each(['development', 'test', 'production'])('rejects wildcards in %s', (nodeEnv) => {
    for (const value of ['*', 'https://admin.example.com,*', 'https://*.example.com']) {
      expect(() => parseCorsOrigins(nodeEnv, value)).toThrow(CorsConfigError);
    }
  });

  it.each([
    'admin.example.com',
    'https://admin.example.com/',
    'https://admin.example.com/admin',
    'https://admin.example.com?x=1',
    'ftp://admin.example.com',
    'null'
  ])('rejects %j because it is not an exact http(s) origin', (value) => {
    expect(() => parseCorsOrigins('development', value)).toThrow(/exact origins/);
  });

  it('uses only the explicit local admin origins when empty in development', () => {
    expect(parseCorsOrigins('development', '')).toEqual([...developmentDefaultCorsOrigins]);
    expect(parseCorsOrigins('development', undefined)).toEqual([...developmentDefaultCorsOrigins]);
    expect(developmentDefaultCorsOrigins.every((origin) => /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))).toBe(true);
  });

  it('allows no browser origins when empty in test', () => {
    expect(parseCorsOrigins('test', '')).toEqual([]);
  });

  it.each(['', ' ', ',', ' , '])('fails in production when CORS_ORIGIN is %j', (value) => {
    expect(() => parseCorsOrigins('production', value)).toThrow(
      'CORS_ORIGIN must list at least one allowed admin origin in production.'
    );
  });
});

describe('CORS middleware', () => {
  function createTestApp(allowedOrigins: readonly string[]) {
    const app = express();
    app.use(createCorsMiddleware(allowedOrigins));
    app.get('/products', (_request, response) => {
      response.status(200).json({ data: [] });
    });
    app.post('/auth/login', (_request, response) => {
      response.status(200).json({ data: { ok: true } });
    });
    app.use(errorHandler);
    return app;
  }

  const app = createTestApp([adminOrigin, 'http://localhost:5173']);

  it('allows a configured origin with credentials', async () => {
    const response = await request(app).get('/products').set('Origin', adminOrigin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(adminOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers.vary).toMatch(/Origin/);
  });

  it('answers preflights for a configured origin', async () => {
    const response = await request(app)
      .options('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-headers']).toBe('authorization,content-type');
  });

  it('never answers with a wildcard origin', async () => {
    const response = await request(app).get('/products').set('Origin', adminOrigin);

    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });

  it.each([
    ['simple request', 'get'],
    ['preflight', 'options']
  ] as const)('rejects a disallowed origin %s with a clean 403', async (_kind, method) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await request(app)[method]('/products')
      .set('Origin', evilOrigin)
      .set('Access-Control-Request-Method', 'GET');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: { message: 'Origin not allowed' } });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.text).not.toContain(evilOrigin);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it.each(['null', 'https://admin.example.com.evil.net', 'http://admin.example.com', 'HTTPS://ADMIN.EXAMPLE.COM'])(
    'does not treat %j as an allowed origin',
    async (origin) => {
      const response = await request(app).get('/products').set('Origin', origin);

      expect(response.status).toBe(403);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    }
  );

  it('lets requests without an Origin header through without CORS headers', async () => {
    const getResponse = await request(app).get('/products');
    const postResponse = await request(app).post('/auth/login').send({});

    expect(getResponse.status).toBe(200);
    expect(postResponse.status).toBe(200);
    expect(getResponse.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('with an empty allowlist, rejects every browser origin but still serves no-Origin requests', async () => {
    const emptyApp = createTestApp([]);

    for (const origin of [evilOrigin, 'http://localhost:5173']) {
      const response = await request(emptyApp).get('/products').set('Origin', origin);
      expect(response.status).toBe(403);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    }
    expect((await request(emptyApp).get('/products')).status).toBe(200);
  });
});

describe('CORS on the real app', () => {
  let tempUploadRoot: string;
  const productFile = '11111111-2222-4333-8444-555555555555.jpg';

  async function loadApp(corsOrigin: string): Promise<Express> {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/tazascan');
    vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-9f2c7a1e4b8d6035-not-real');
    vi.stubEnv('UPLOAD_ROOT', tempUploadRoot);
    vi.stubEnv('CORS_ORIGIN', corsOrigin);
    const { createApp } = await import('../app.js');
    return createApp();
  }

  beforeAll(async () => {
    tempUploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tazascan-cors-'));
    await fs.mkdir(path.join(tempUploadRoot, 'products'), { recursive: true });
    await fs.mkdir(path.join(tempUploadRoot, 'submissions'), { recursive: true });
    await fs.writeFile(path.join(tempUploadRoot, 'products', productFile), Buffer.from('jpeg'));
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempUploadRoot, { recursive: true, force: true });
  });

  it('allows the configured admin origin and rejects others without a 500', async () => {
    const app = await loadApp(adminOrigin);

    const allowed = await request(app).get('/health').set('Origin', adminOrigin);
    const blocked = await request(app).get('/health').set('Origin', evilOrigin);

    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(adminOrigin);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(blocked.status).toBe(403);
    expect(blocked.body).toEqual({ error: { message: 'Origin not allowed' } });
    expect(blocked.headers['x-content-type-options']).toBe('nosniff');
  });

  it('empty CORS_ORIGIN in development allows only the local admin origins', async () => {
    const app = await loadApp('');

    const local = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    const other = await request(app).get('/health').set('Origin', evilOrigin);
    const noOrigin = await request(app).get('/health');

    expect(local.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(other.status).toBe(403);
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
    expect(noOrigin.status).toBe(200);
  });

  it('keeps B1 product-image headers unchanged', async () => {
    const app = await loadApp(adminOrigin);

    for (const origin of [undefined, adminOrigin]) {
      const pending = request(app).get(`/uploads/products/${productFile}`);
      const response = await (origin ? pending.set('Origin', origin) : pending);

      expect(response.status).toBe(200);
      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    }

    const health = await request(app).get('/health');
    expect(health.headers['cross-origin-resource-policy']).toBe('same-origin');
  });
});

describe('CORS startup configuration (env.ts)', { timeout: 60_000 }, () => {
  const apiRoot = path.resolve(__dirname, '../..');
  const productionVars = {
    NODE_ENV: 'production',
    JWT_SECRET: 'unit-test-jwt-secret-9f2c7a1e4b8d6035-not-real',
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'example-admin-password',
    PUBLIC_UPLOADS_BASE_URL: 'https://api.example.com/uploads'
  };

  // Runs env.ts in a fresh Node process, as the server does at startup.
  function loadEnv(overrides: Record<string, string>) {
    return spawnSync(process.execPath, ['--import', 'tsx', 'src/config/env.ts'], {
      cwd: apiRoot,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tazascan',
        ...overrides
      }
    });
  }

  it('starts in production with an exact allowlist', () => {
    const result = loadEnv({ ...productionVars, CORS_ORIGIN: adminOrigin });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it.each([',', ' , ', '*'])('refuses production startup with CORS_ORIGIN=%j', (value) => {
    const result = loadEnv({ ...productionVars, CORS_ORIGIN: value });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid configuration: CORS_ORIGIN');
  });

  it('refuses a wildcard in development too', () => {
    const result = loadEnv({
      NODE_ENV: 'development',
      JWT_SECRET: productionVars.JWT_SECRET,
      CORS_ORIGIN: '*'
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('wildcards are not allowed');
  });
});
