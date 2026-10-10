import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AdminSeedConfigError,
  minAdminPasswordLength,
  resolveAdminSeedCredentials
} from './admin-seed-credentials';

const validPassword = 'Seed-Admin-7f3c91d2b84e';
const email = 'admin@example.com';

function rejection(env: NodeJS.ProcessEnv) {
  try {
    resolveAdminSeedCredentials(env);
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected rejection');
}

describe('resolveAdminSeedCredentials', () => {
  it('accepts a valid password and lowercases the email', () => {
    expect(
      resolveAdminSeedCredentials({ ADMIN_EMAIL: 'Admin@Example.com', ADMIN_PASSWORD: validPassword })
    ).toEqual({ email, password: validPassword });
  });

  it('keeps the password exactly as given', () => {
    const password = '  spaced pass phrase 42  ';
    expect(resolveAdminSeedCredentials({ ADMIN_EMAIL: email, ADMIN_PASSWORD: password })).toEqual({
      email,
      password
    });
  });

  it('skips the admin seed when ADMIN_EMAIL is not set (unchanged)', () => {
    expect(resolveAdminSeedCredentials({})).toBeNull();
    expect(resolveAdminSeedCredentials({ ADMIN_PASSWORD: validPassword })).toBeNull();
    expect(resolveAdminSeedCredentials({ ADMIN_EMAIL: '', ADMIN_PASSWORD: 'x' })).toBeNull();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['whitespace-only', '   \t  ']
  ])('rejects a %s ADMIN_PASSWORD', (_label, password) => {
    const error = rejection({ ADMIN_EMAIL: email, ADMIN_PASSWORD: password });

    expect(error).toBeInstanceOf(AdminSeedConfigError);
    expect(error.message).toBe(
      'ADMIN_PASSWORD is required when ADMIN_EMAIL is set. Set a strong, unique password.'
    );
  });

  it('rejects passwords shorter than the server minimum', () => {
    const error = rejection({ ADMIN_EMAIL: email, ADMIN_PASSWORD: 'short-pw-1' });

    expect(error.message).toBe(
      `ADMIN_PASSWORD must be at least ${minAdminPasswordLength} characters long.`
    );
    expect(error.message).not.toContain('short-pw-1');
  });

  it.each([
    'change-this-admin-password',
    'CHANGE-THIS-ADMIN-PASSWORD',
    '  change-this-admin-password  ',
    'use-a-strong-password',
    'replace-with-a-strong-local-password',
    'strong-password',
    'example-admin-password',
    'your-admin-password'
  ])('rejects the documented placeholder %j without echoing it', (password) => {
    const error = rejection({ ADMIN_EMAIL: email, ADMIN_PASSWORD: password });

    expect(error).toBeInstanceOf(AdminSeedConfigError);
    expect(error.message).toMatch(/placeholder\/example value/);
    expect(error.message.toLowerCase()).not.toContain(password.trim().toLowerCase());
  });
});

describe('prisma seed with ADMIN_PASSWORD (separate process)', { timeout: 60_000 }, () => {
  const apiRoot = path.resolve(__dirname, '../..');

  // Runs the real seed script without loading .env and with an unreachable database, so a
  // configuration rejection is visible before any database access and nothing is written.
  function runSeed(overrides: Record<string, string>) {
    return spawnSync(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
      cwd: apiRoot,
      encoding: 'utf8',
      timeout: 45_000,
      env: {
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
        DOTENV_CONFIG_PATH: path.join(apiRoot, 'does-not-exist.env'),
        DATABASE_URL: 'postgresql://seed:seed@127.0.0.1:1/unreachable',
        ...overrides
      }
    });
  }

  it.each([
    ['missing', {}],
    ['blank', { ADMIN_PASSWORD: '   ' }]
  ])('fails clearly for a %s password before touching the database', (_label, overrides) => {
    const result = runSeed({ ADMIN_EMAIL: email, ...overrides });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Invalid seed configuration: ADMIN_PASSWORD is required when ADMIN_EMAIL is set.'
    );
    expect(result.stderr).not.toMatch(/ECONNREFUSED|Can't reach database/i);
  });

  it('refuses the .env.example placeholder without printing it', () => {
    const result = runSeed({ ADMIN_EMAIL: email, ADMIN_PASSWORD: 'change-this-admin-password' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Invalid seed configuration: ADMIN_PASSWORD is a documented placeholder/example value.'
    );
    expect(result.stdout + result.stderr).not.toContain('change-this-admin-password');
  });

  it('passes validation with a valid password (then stops at the unreachable database)', () => {
    const result = runSeed({ ADMIN_EMAIL: email, ADMIN_PASSWORD: validPassword });

    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain('Invalid seed configuration');
    // Validation passed: the run got as far as the admin lookup.
    expect(result.stderr).toContain('user.findUnique()');
    expect(result.stdout + result.stderr).not.toContain(validPassword);
  });

  it('still skips only the admin seed when ADMIN_EMAIL is missing (unchanged)', () => {
    const result = runSeed({ ADMIN_PASSWORD: 'change-this-admin-password' });

    expect(result.stdout).toContain('Skipping admin seed because ADMIN_EMAIL is missing.');
    expect(result.stderr).not.toContain('Invalid seed configuration');
    expect(result.stdout + result.stderr).not.toContain('change-this-admin-password');
  });
});
