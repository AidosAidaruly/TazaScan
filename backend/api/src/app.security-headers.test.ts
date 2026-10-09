import type { Express } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Cross-Origin-Resource-Policy on the real app: only served public product images are
// embeddable cross-origin; everything else keeps Helmet's same-origin default.

let tempUploadRoot: string;
let app: Express;
let productImage: Buffer;
const productFile = '11111111-2222-4333-8444-555555555555.jpg';
const evidenceFile = '66666666-7777-4888-9999-000000000000.jpg';

beforeAll(async () => {
  vi.resetModules();
  tempUploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tazascan-headers-'));
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/tazascan');
  vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-9f2c7a1e4b8d6035-not-real');
  vi.stubEnv('UPLOAD_ROOT', tempUploadRoot);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);

  productImage = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#2980b9' }
  })
    .jpeg()
    .toBuffer();
  await fs.mkdir(path.join(tempUploadRoot, 'products'), { recursive: true });
  await fs.mkdir(path.join(tempUploadRoot, 'submissions'), { recursive: true });
  await fs.writeFile(path.join(tempUploadRoot, 'products', productFile), productImage);
  await fs.writeFile(path.join(tempUploadRoot, 'submissions', evidenceFile), productImage);

  const { createApp } = await import('./app.js');
  app = createApp();
});

afterAll(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await fs.rm(tempUploadRoot, { recursive: true, force: true });
});

describe('Cross-Origin-Resource-Policy', () => {
  it('lets other origins embed served public product images', async () => {
    const response = await request(app).get(`/uploads/products/${productFile}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(Buffer.from(response.body)).toEqual(productImage);
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('keeps the other Helmet headers on product images', async () => {
    const response = await request(app).get(`/uploads/products/${productFile}`);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('does not relax missing product image responses', async () => {
    const response = await request(app).get('/uploads/products/missing.jpg');

    expect(response.status).toBe(404);
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
  });

  it('keeps same-origin on normal API responses', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
  });

  it('keeps submission evidence admin-only and same-origin', async () => {
    const anonymous = await request(app).get(`/product-submissions/uploads/${evidenceFile}`);
    const badToken = await request(app)
      .get(`/product-submissions/uploads/${evidenceFile}`)
      .set('Authorization', 'Bearer not-a-valid-token');

    for (const response of [anonymous, badToken]) {
      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    }
    expect(anonymous.body).toEqual({ error: { message: 'Missing token' } });
    expect(badToken.body).toEqual({ error: { message: 'Invalid token' } });
  });

  it('never serves submission evidence through the public product mount', async () => {
    for (const url of [
      `/uploads/products/../submissions/${evidenceFile}`,
      `/uploads/products/%2e%2e/submissions/${evidenceFile}`,
      `/uploads/products/..%2fsubmissions%2f${evidenceFile}`,
      `/uploads/submissions/${evidenceFile}`
    ]) {
      const response = await request(app).get(url);

      expect(response.status, url).not.toBe(200);
      expect(response.headers['content-type'] ?? '', url).not.toMatch(/^image\//);
      expect(response.headers['cross-origin-resource-policy'], url).toBe('same-origin');
    }
  });
});
