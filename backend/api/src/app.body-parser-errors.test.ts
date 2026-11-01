import type { Express } from 'express';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import zlib, { gzipSync } from 'node:zlib';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Request body errors through the real middleware chain (createApp: helmet, CORS,
// express.json({ limit: '1mb' }), routes, error handler). No database is reached: the
// product repository is replaced, and every other request stops at parsing, auth or
// validation before any query.

const leakedValue = 'leaked-password-value';
const listFailure = 'connect ECONNREFUSED 10.0.0.5:5432 SELECT * FROM products';
let tempUploadRoot: string;
let app: Express;

beforeAll(async () => {
  vi.resetModules();
  tempUploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tazascan-body-errors-'));
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/tazascan');
  vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-9f2c7a1e4b8d6035-not-real');
  vi.stubEnv('UPLOAD_ROOT', tempUploadRoot);
  vi.doMock('./repositories/product.repository', () => ({
    ProductRepository: class {
      async list() {
        throw new Error(listFailure);
      }
    }
  }));

  const { createApp } = await import('./app.js');
  app = createApp();
});

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  vi.doUnmock('./repositories/product.repository');
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  await fs.rm(tempUploadRoot, { recursive: true, force: true });
});

const sensitiveFragments = [
  leakedValue,
  'SyntaxError',
  'Unexpected',
  'position',
  'stack',
  'node_modules',
  'body-parser',
  'expected',
  'limit'
];

function expectNoInternals(text: string) {
  for (const fragment of sensitiveFragments) {
    expect(text).not.toContain(fragment);
  }
}

function postJson(route: string, body: string | Buffer) {
  return request(app).post(route).set('Content-Type', 'application/json').send(body);
}

const zstdSupported = 'createZstdDecompress' in zlib;

// Compressed bodies go through node:http so the exact bytes reach the server unchanged.
function sendRaw(body: Buffer, encoding: string) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const outgoing = http.request(
        {
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: '/products/taza-score-preview',
          headers: {
            'Content-Type': 'application/json',
            'Content-Encoding': encoding,
            'Content-Length': body.length
          }
        },
        (incoming) => {
          let text = '';
          incoming.setEncoding('utf8');
          incoming.on('data', (chunk) => (text += chunk));
          incoming.on('end', () => server.close(() => resolve({ status: incoming.statusCode!, text })));
        }
      );
      outgoing.on('error', (error) => server.close(() => reject(error)));
      outgoing.end(body);
    });
  });
}

describe('request body errors through the real app', () => {
  it('still accepts valid JSON: the parsed body reaches route validation', async () => {
    const response = await postJson(
      '/auth/login',
      JSON.stringify({ email: 'not-an-email', password: 'some-password' })
    );

    // Zod validation ran on the parsed body: only the email field failed.
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
    expect(Object.keys(response.body.error.details.fieldErrors)).toEqual(['email']);
  });

  it('returns 400 for malformed JSON without echoing the body', async () => {
    const response = await postJson('/auth/login', `{"email":"a@b.c","password":"${leakedValue}"`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { message: 'Malformed JSON request body' } });
    expectNoInternals(response.text);
  });

  it.each([
    ['a bare string (strict mode)', '"just a string"'],
    ['a number (strict mode)', '42'],
    ['trailing garbage', '{"a":1}}'],
    ['an unterminated object', '{']
  ])('returns 400 for %s', async (_kind, body) => {
    const response = await postJson('/products/taza-score-preview', body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { message: 'Malformed JSON request body' } });
  });

  it('returns 400 for malformed JSON inside a valid gzip body', async () => {
    const response = await sendRaw(gzipSync(`{"password":"${leakedValue}"`), 'gzip');

    expect(response.status).toBe(400);
    expect(JSON.parse(response.text)).toEqual({ error: { message: 'Malformed JSON request body' } });
    expectNoInternals(response.text);
  });

  it('still accepts valid gzip-compressed JSON', async () => {
    const response = await sendRaw(gzipSync('{"a":1}'), 'gzip');

    // Decompressed and parsed; the route's authentication then rejects the request.
    expect(response.status).toBe(401);
  });

  it.each([
    ['gzip', 'not gzip data at all'],
    ['gzip', gzipSync('{"a":1}').subarray(0, 12)],
    ['deflate', 'not deflate data at all'],
    ['br', 'not brotli data at all!!'],
    ...(zstdSupported ? [['zstd', 'not zstd data at all!!']] : [])
  ] as Array<[string, string | Buffer]>)('returns 400 for a corrupt %s body', async (encoding, body) => {
    const response = await sendRaw(Buffer.from(body), encoding);

    expect(response.status).toBe(400);
    expect(JSON.parse(response.text)).toEqual({
      error: { message: 'Malformed compressed request body' }
    });
    for (const fragment of ['Z_', 'ERR_', 'ZSTD', 'header check', 'stack']) {
      expect(response.text).not.toContain(fragment);
    }
  });

  it('returns 413 for a JSON body over the 1 MB limit, before authentication', async () => {
    const body = JSON.stringify({ password: leakedValue, padding: 'a'.repeat(1024 * 1024) });

    const response = await postJson('/products/taza-score-preview', body);

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: { message: 'Request body too large' } });
    expectNoInternals(response.text);
  });

  it('keeps the 1 MB limit: a body just under it is parsed and reaches the route', async () => {
    const body = JSON.stringify({ padding: 'a'.repeat(1024 * 1024 - 64) });
    expect(Buffer.byteLength(body)).toBeLessThan(1024 * 1024);

    const response = await postJson('/products/taza-score-preview', body);

    // Parsed successfully; the route's authentication then rejects the request.
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Missing token');
  });

  it('returns 413 when a small gzip body inflates past the limit', async () => {
    const compressed = gzipSync(JSON.stringify({ padding: 'a'.repeat(2 * 1024 * 1024) }));
    expect(compressed.length).toBeLessThan(64 * 1024);

    const response = await sendRaw(compressed, 'gzip');

    expect(response.status).toBe(413);
    expect(JSON.parse(response.text)).toEqual({ error: { message: 'Request body too large' } });
  });

  it('returns 415 for an unsupported JSON charset', async () => {
    const response = await request(app)
      .post('/products/taza-score-preview')
      .set('Content-Type', 'application/json; charset=latin1')
      .send('{"a":1}');

    expect(response.status).toBe(415);
    expect(response.body).toEqual({ error: { message: 'Unsupported request body charset' } });
  });

  it('returns 415 for an unsupported content encoding', async () => {
    const response = await request(app)
      .post('/products/taza-score-preview')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'x-unknown')
      .send('{"a":1}');

    expect(response.status).toBe(415);
    expect(response.body).toEqual({ error: { message: 'Unsupported request body encoding' } });
  });

  it('logs rejected bodies as a warning with only type and status', async () => {
    await postJson('/auth/login', `{"password":"${leakedValue}"`);

    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    const line = vi.mocked(console.warn).mock.calls[0]![0] as string;
    expect(JSON.parse(line)).toEqual({
      level: 'warn',
      event: 'request_body_rejected',
      method: 'POST',
      path: '/auth/login',
      type: 'entity.parse.failed',
      status: 400
    });
    expect(line).not.toContain(leakedValue);
  });

  it('still returns a generic 500 for an unexpected server error', async () => {
    const response = await request(app).get('/products?name=cola');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { message: 'Internal server error' } });
    for (const fragment of ['ECONNREFUSED', '10.0.0.5', 'SELECT', 'stack']) {
      expect(response.text).not.toContain(fragment);
    }
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
