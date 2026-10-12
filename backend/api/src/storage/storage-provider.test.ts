import { afterEach, describe, expect, it, vi } from 'vitest';

describe('storage provider configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('allows local storage in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/tazascan');
    vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-9f2c7a1e4b8d6035-not-real');
    vi.stubEnv('STORAGE_DRIVER', 'local');

    const { validateStorageConfiguration } = await import('./storage-provider.js');

    expect(() => validateStorageConfiguration()).not.toThrow();
  });

  it('blocks local storage in production without explicit persistent-disk acknowledgement', async () => {
    stubProductionEnv({ ALLOW_LOCAL_PRODUCTION_STORAGE: 'false' });

    await expect(import('./storage-provider.js')).rejects.toThrow(
      'Local production storage requires a persistent disk'
    );
  });

  it('allows local storage in production when persistent local storage is explicitly acknowledged', async () => {
    stubProductionEnv({ ALLOW_LOCAL_PRODUCTION_STORAGE: 'true' });

    const { validateStorageConfiguration } = await import('./storage-provider.js');

    expect(() => validateStorageConfiguration()).not.toThrow();
  });

  it('fails clearly for the reserved s3 driver until an object provider is implemented', async () => {
    stubProductionEnv({
      STORAGE_DRIVER: 's3',
      ALLOW_LOCAL_PRODUCTION_STORAGE: 'true'
    });

    await expect(import('./storage-provider.js')).rejects.toThrow(
      'STORAGE_DRIVER=s3 is reserved for a future object storage provider'
    );
  });
});

function stubProductionEnv(overrides: Record<string, string>) {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('PORT', '4000');
  vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/tazascan');
  vi.stubEnv('CORS_ORIGIN', 'https://admin.example.com');
  vi.stubEnv('JWT_SECRET', 'unit-test-jwt-secret-9f2c7a1e4b8d6035-not-real');
  vi.stubEnv('ADMIN_EMAIL', 'admin@example.com');
  vi.stubEnv('ADMIN_PASSWORD', 'change-this-admin-password');
  vi.stubEnv('STORAGE_DRIVER', 'local');
  vi.stubEnv('UPLOAD_ROOT', 'uploads');

  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value);
  }
}
