import { describe, expect, it } from 'vitest';
import type { User } from '../generated/prisma/client';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
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
