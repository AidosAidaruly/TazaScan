import bcrypt from 'bcryptjs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { User } from '../generated/prisma/client';
import { AuthService } from './auth.service';
import { dummyPasswordHash, PasswordService, saltRounds } from './password.service';
import { TokenService } from './token.service';

const now = new Date('2026-07-31T00:00:00.000Z');
const passwordService = new PasswordService();
const tokenService = new TokenService();

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    passwordHash: '',
    role: 'admin',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

class FakeUserRepository {
  users: User[] = [];

  findByEmail(email: string) {
    return Promise.resolve(this.users.find((user) => user.email === email) ?? null);
  }

  findById(id: string) {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
  }
}

async function createService(users: User[]) {
  const repository = new FakeUserRepository();
  repository.users = users;

  return new AuthService(repository, passwordService, tokenService);
}

describe('AuthService', () => {
  it('logs in an admin with valid credentials', async () => {
    const passwordHash = await passwordService.hash('correct-password');
    const service = await createService([createUser({ passwordHash })]);

    const result = await service.login({
      email: 'admin@example.com',
      password: 'correct-password'
    });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.user).toMatchObject({
      email: 'admin@example.com',
      role: 'admin'
    });
  });

  it('rejects incorrect password with a generic login error', async () => {
    const passwordHash = await passwordService.hash('correct-password');
    const service = await createService([createUser({ passwordHash })]);

    await expect(
      service.login({
        email: 'admin@example.com',
        password: 'wrong-password'
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password'
    });
  });

  it('rejects unknown email with a generic login error', async () => {
    const service = await createService([]);

    await expect(
      service.login({
        email: 'missing@example.com',
        password: 'any-password'
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password'
    });
  });
});

describe('AuthService login failures are indistinguishable', () => {
  const genericFailure = { statusCode: 401, message: 'Invalid email or password' };
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await passwordService.hash('correct-password');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function loginFailure(users: User[], email: string, password: string) {
    const service = await createService(users);
    const error = await service.login({ email, password }).then(
      () => {
        throw new Error('expected login to fail');
      },
      (caught: unknown) => caught as Error & { statusCode: number; details?: unknown }
    );

    return { statusCode: error.statusCode, message: error.message, details: error.details };
  }

  it('dummy hash is a valid bcrypt hash with the same cost as real passwords', () => {
    expect(dummyPasswordHash).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
    expect(bcrypt.getRounds(dummyPasswordHash)).toBe(saltRounds);
    expect(bcrypt.getRounds(passwordHash)).toBe(saltRounds);
  });

  it('runs a bcrypt comparison against the fixed dummy hash for an unknown email', async () => {
    const compare = vi.spyOn(bcrypt, 'compare');
    const service = await createService([]);

    await expect(
      service.login({ email: 'missing@example.com', password: 'any-password' })
    ).rejects.toMatchObject(genericFailure);

    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare).toHaveBeenCalledWith('any-password', dummyPasswordHash);
  });

  it('reuses the dummy hash instead of generating one per request', async () => {
    const compare = vi.spyOn(bcrypt, 'compare');
    const hash = vi.spyOn(bcrypt, 'hash');
    const genSalt = vi.spyOn(bcrypt, 'genSalt');
    const service = await createService([]);

    for (const email of ['first@example.com', 'second@example.com']) {
      await expect(service.login({ email, password: 'any-password' })).rejects.toMatchObject(
        genericFailure
      );
    }

    expect(hash).not.toHaveBeenCalled();
    expect(genSalt).not.toHaveBeenCalled();
    expect(compare.mock.calls.map(([, usedHash]) => usedHash)).toEqual([
      dummyPasswordHash,
      dummyPasswordHash
    ]);
  });

  it('never accepts the dummy hash, even if a password happened to match it', async () => {
    vi.spyOn(bcrypt, 'compare').mockImplementation(async () => true);
    const service = await createService([]);

    await expect(
      service.login({ email: 'missing@example.com', password: 'any-password' })
    ).rejects.toMatchObject(genericFailure);
  });

  it('performs exactly one bcrypt comparison on every login path', async () => {
    const compare = vi.spyOn(bcrypt, 'compare');
    const users = [
      createUser({ passwordHash }),
      createUser({
        id: '22222222-2222-4222-8222-222222222222',
        email: 'inactive@example.com',
        passwordHash,
        isActive: false
      })
    ];
    const attempts = [
      ['missing@example.com', 'wrong-password'],
      ['admin@example.com', 'wrong-password'],
      ['inactive@example.com', 'wrong-password'],
      ['inactive@example.com', 'correct-password']
    ];

    for (const [email, password] of attempts) {
      compare.mockClear();
      await loginFailure(users, email!, password!);
      expect(compare, email).toHaveBeenCalledTimes(1);
    }
  });

  it('returns the same failure for unknown email, wrong password and inactive account', async () => {
    const active = createUser({ passwordHash });
    const inactive = createUser({ passwordHash, isActive: false });

    const failures = [
      await loginFailure([active], 'missing@example.com', 'correct-password'),
      await loginFailure([active], 'admin@example.com', 'wrong-password'),
      await loginFailure([inactive], 'admin@example.com', 'wrong-password'),
      await loginFailure([inactive], 'admin@example.com', 'correct-password')
    ];

    for (const failure of failures) {
      expect(failure).toEqual({ ...genericFailure, details: undefined });
    }
  });

  it('still logs in an active user with the correct password', async () => {
    const service = await createService([createUser({ passwordHash })]);

    const result = await service.login({
      email: 'admin@example.com',
      password: 'correct-password'
    });

    expect(result.user).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@example.com',
      role: 'admin'
    });
    expect(tokenService.verifyAccessToken(result.accessToken)).toMatchObject({
      sub: '11111111-1111-4111-8111-111111111111',
      role: 'admin'
    });
  });
});
