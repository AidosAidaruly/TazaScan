import type { Express } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../generated/prisma/client';

// GET /product-submissions/uploads/:filename on the real app, with an in-memory user lookup
// for authentication and a temporary upload root.

const users = vi.hoisted(() => new Map<string, User>());

vi.mock('../repositories/user.repository', () => ({
  UserRepository: class {
    findById(id: string) {
      return Promise.resolve(users.get(id) ?? null);
    }

    findByEmail(email: string) {
      return Promise.resolve([...users.values()].find((user) => user.email === email) ?? null);
    }
  }
}));

const now = new Date('2026-08-01T00:00:00.000Z');
const adminId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const existingFile = 'aaaaaaaa-1111-4222-8333-444444444444.jpg';
const missingFile = 'bbbbbbbb-1111-4222-8333-444444444444.jpg';
const directoryFile = 'cccccccc-1111-4222-8333-444444444444.jpg';
const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

let app: Express;
let tempUploadRoot: string;
let adminToken: string;
let userToken: string;

function evidence(filename: string, token?: string) {
  const pending = request(app).get(`/product-submissions/uploads/${filename}`);
  return token ? pending.set('Authorization', `Bearer ${token}`) : pending;
}

function unhandledErrorLogs() {
  return vi
    .mocked(console.error)
    .mock.calls.map((call) => String(call[0]))
    .filter((line) => line.includes('unhandled_error'));
}

beforeAll(async () => {
  vi.resetModules();
  tempUploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tazascan-evidence-'));
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/tazascan');
  vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-9f2c7a1e4b8d6035-not-real');
  vi.stubEnv('UPLOAD_ROOT', tempUploadRoot);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);

  const submissionsDir = path.join(tempUploadRoot, 'submissions');
  await fs.mkdir(path.join(tempUploadRoot, 'products'), { recursive: true });
  await fs.mkdir(submissionsDir, { recursive: true });
  await fs.writeFile(path.join(submissionsDir, existingFile), imageBytes);
  // A directory where the file should be: a real read failure that is not "not found".
  await fs.mkdir(path.join(submissionsDir, directoryFile));

  for (const [id, role] of [
    [adminId, 'admin'],
    [userId, 'user']
  ] as const) {
    users.set(id, {
      id,
      email: `${role}@example.com`,
      passwordHash: 'unused',
      role,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
  }

  const { TokenService } = await import('../services/token.service.js');
  const tokens = new TokenService();
  adminToken = tokens.signAccessToken({ sub: adminId, role: 'admin' });
  userToken = tokens.signAccessToken({ sub: userId, role: 'user' });

  const { createApp } = await import('../app.js');
  app = createApp();
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterAll(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await fs.rm(tempUploadRoot, { recursive: true, force: true });
});

describe('GET /product-submissions/uploads/:filename', () => {
  it('serves an existing evidence file to an admin, unchanged', async () => {
    const response = await evidence(existingFile, adminToken);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(Buffer.from(response.body)).toEqual(imageBytes);
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
  });

  it('returns a clean 404 for a missing evidence file', async () => {
    const response = await evidence(missingFile, adminToken);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { message: 'Submission image not found' } });
    expect(unhandledErrorLogs()).toEqual([]);
  });

  it('never leaks filesystem details in the 404', async () => {
    const response = await evidence(missingFile, adminToken);

    for (const fragment of [tempUploadRoot, 'submissions', missingFile, 'ENOENT', 'stat', 'no such file']) {
      expect(response.text).not.toContain(fragment);
    }
  });

  it('keeps other read failures as real server errors, not 404', async () => {
    const response = await evidence(directoryFile, adminToken);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { message: 'Internal server error' } });
    expect(response.text).not.toContain(tempUploadRoot);
    expect(unhandledErrorLogs()).toHaveLength(1);
  });

  it('still requires authentication', async () => {
    for (const filename of [existingFile, missingFile]) {
      const response = await evidence(filename);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: { message: 'Missing token' } });
    }
  });

  it('still requires the admin role', async () => {
    for (const filename of [existingFile, missingFile]) {
      const response = await evidence(filename, userToken);

      expect(response.status).toBe(403);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
    }
  });

  it('still rejects invalid filenames with 400', async () => {
    const response = await evidence('not-a-uuid.txt', adminToken);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Invalid upload filename');
  });
});
