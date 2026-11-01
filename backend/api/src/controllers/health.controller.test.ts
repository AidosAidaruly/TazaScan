import express, { type Express } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { createReadinessHandler as CreateReadinessHandler } from './health.controller';

// Port 1 on loopback refuses connections immediately; the credentials are fake and must
// never appear in a response or log.
const unreachableDatabaseUrl = 'postgresql://tazascan_user:s3cr3t-db-pass@127.0.0.1:1/tazascan_ready_check';
const secrets = ['s3cr3t-db-pass', 'tazascan_user', 'postgresql://', '127.0.0.1:1', 'tazascan_ready_check'];

let createReadinessHandler: typeof CreateReadinessHandler;
let createApp: () => Express;
let sharedPrisma: { $queryRaw: (...args: never[]) => Promise<unknown> };
let tempUploadRoot: string;
let warnSpy: MockInstance<typeof console.warn>;

beforeAll(async () => {
  vi.resetModules();
  tempUploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tazascan-health-'));
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('DATABASE_URL', unreachableDatabaseUrl);
  vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-9f2c7a1e4b8d6035-not-real');
  vi.stubEnv('UPLOAD_ROOT', tempUploadRoot);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  ({ createReadinessHandler } = await import('./health.controller.js'));
  ({ createApp } = await import('../app.js'));
  ({ prisma: sharedPrisma } = await import('../prisma/client.js'));
});

afterAll(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await fs.rm(tempUploadRoot, { recursive: true, force: true });
});

beforeEach(() => {
  warnSpy?.mockRestore();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

function readinessApp(check: () => Promise<unknown>, timeoutMs?: number) {
  const app = express();
  app.get('/health/ready', createReadinessHandler(check, timeoutMs));
  return app;
}

function expectNotReadyWithoutLeaks(response: request.Response) {
  expect(response.status).toBe(503);
  expect(response.body).toEqual({
    status: 'not_ready',
    service: 'tazascan-api',
    timestamp: expect.any(String),
    checks: { database: 'unavailable' }
  });
  const logged = warnSpy.mock.calls.map((call) => call.join(' ')).join('\n');
  for (const secret of [...secrets, 'ECONNREFUSED connect', 'Error:', ' at ']) {
    expect(response.text).not.toContain(secret);
    expect(logged).not.toContain(secret);
  }
}

describe('GET /health/ready', () => {
  it('returns 200 when the database answers', async () => {
    const check = vi.fn(async () => [{ '?column?': 1 }]);

    const response = await request(readinessApp(check)).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ready',
      service: 'tazascan-api',
      timestamp: expect.any(String),
      checks: { database: 'ok' }
    });
    expect(check).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns 503 when the database is unreachable, without leaking connection details', async () => {
    const refused = Object.assign(
      new Error(`connect ECONNREFUSED 127.0.0.1:1 (${unreachableDatabaseUrl})`),
      { code: 'ECONNREFUSED' }
    );

    const response = await request(readinessApp(async () => { throw refused; })).get('/health/ready');

    expectNotReadyWithoutLeaks(response);
    expect(JSON.parse(warnSpy.mock.calls[0]![0] as string)).toEqual({
      level: 'warn',
      event: 'readiness_check_failed',
      dependency: 'database',
      reason: 'error',
      name: 'Error',
      code: 'ECONNREFUSED'
    });
  });

  it('returns 503 when the database query rejects', async () => {
    const queryError = Object.assign(new Error('relation does not exist: s3cr3t-db-pass'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2010'
    });

    const response = await request(readinessApp(() => Promise.reject(queryError))).get('/health/ready');

    expectNotReadyWithoutLeaks(response);
    expect(JSON.parse(warnSpy.mock.calls[0]![0] as string)).toMatchObject({ reason: 'error', code: 'P2010' });
  });

  it('returns 503 within the timeout when the database check hangs', async () => {
    const neverSettles = () => new Promise<never>(() => undefined);
    const startedAt = Date.now();

    const response = await request(readinessApp(neverSettles, 50)).get('/health/ready');

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expectNotReadyWithoutLeaks(response);
    expect(JSON.parse(warnSpy.mock.calls[0]![0] as string)).toMatchObject({
      reason: 'timeout',
      name: 'ReadinessTimeoutError'
    });
  });

  it('absorbs a database check that fails after the timeout (no unhandled rejection)', async () => {
    const lateFailure = () =>
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('late failure')), 80));

    const response = await request(readinessApp(lateFailure, 20)).get('/health/ready');
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(response.status).toBe(503);
  });
});

describe('real app wiring (PostgreSQL unreachable)', () => {
  it('keeps the liveness check at /health independent of the database', async () => {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'tazascan-api',
      timestamp: expect.any(String)
    });
  });

  it('reports /health/ready as 503 through the shared Prisma client, without leaks', async () => {
    const querySpy = vi.spyOn(sharedPrisma, '$queryRaw');
    const app = createApp();

    const first = await request(app).get('/health/ready');
    const second = await request(app).get('/health/ready');

    expectNotReadyWithoutLeaks(first);
    expectNotReadyWithoutLeaks(second);
    // Each request reuses the one shared client; no client is created per request.
    expect(querySpy).toHaveBeenCalledTimes(2);
    querySpy.mockRestore();
  });

  it('reports /health/ready as 200 through the real route when the shared client answers', async () => {
    const querySpy = vi.spyOn(sharedPrisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);

    const response = await request(createApp()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ready', checks: { database: 'ok' } });
    expect(querySpy).toHaveBeenCalledOnce();
    querySpy.mockRestore();
  });
});
