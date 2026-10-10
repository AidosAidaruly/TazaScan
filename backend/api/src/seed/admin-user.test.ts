import { describe, expect, it, vi } from 'vitest';
import type { User } from '../generated/prisma/client';
import { describeSeedAdminResult, ensureSeedAdmin } from './admin-user';

const email = 'admin@example.com';
const now = new Date('2026-08-01T00:00:00.000Z');

// In-memory `user` delegate with the two calls ensureSeedAdmin uses.
function createClient(users: User[] = []) {
  const user = {
    findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
      const found = users.find((item) => item.email === where.email);
      return found ? { role: found.role, isActive: found.isActive } : null;
    }),
    createMany: vi.fn(async ({ data }: { data: Array<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> }) => {
      let count = 0;
      for (const row of data) {
        if (!users.some((item) => item.email === row.email)) {
          users.push({ id: `user-${users.length + 1}`, createdAt: now, updatedAt: now, ...row });
          count += 1;
        }
      }
      return { count };
    }),
    upsert: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  };
  return { client: { user } as never, user, users };
}

function existingUser(overrides: Partial<User> = {}): User {
  return {
    id: 'existing-id',
    email,
    passwordHash: 'existing-hash',
    role: 'admin',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('ensureSeedAdmin', () => {
  it('creates a missing admin with the hashed password', async () => {
    const { client, users } = createClient();
    const hash = vi.fn(async (password: string) => `hash(${password})`);

    const result = await ensureSeedAdmin(client, { email, password: 'first-password-1' }, hash);

    expect(result).toEqual({ status: 'created' });
    expect(users).toEqual([
      expect.objectContaining({
        email,
        passwordHash: 'hash(first-password-1)',
        role: 'admin',
        isActive: true
      })
    ]);
  });

  it.each([
    ['an active admin', existingUser(), true],
    ['an inactive admin', existingUser({ isActive: false }), false],
    ['a non-admin user', existingUser({ role: 'user' }), false]
  ])('leaves %s completely unchanged, without hashing', async (_label, user, activeAdmin) => {
    const before = structuredClone(user);
    const { client, user: delegate, users } = createClient([user]);
    const hash = vi.fn(async () => 'new-hash');

    const result = await ensureSeedAdmin(client, { email, password: 'different-password-2' }, hash);

    expect(result).toEqual({ status: 'unchanged', activeAdmin });
    expect(users).toEqual([before]);
    expect(hash).not.toHaveBeenCalled();
    expect(delegate.createMany).not.toHaveBeenCalled();
    expect(delegate.upsert).not.toHaveBeenCalled();
    expect(delegate.update).not.toHaveBeenCalled();
    expect(delegate.updateMany).not.toHaveBeenCalled();
  });

  it('does not overwrite an admin created concurrently by another seed run', async () => {
    const { client, user, users } = createClient();
    // Another run inserts the account between our existence check and our insert.
    user.findUnique.mockResolvedValueOnce(null);
    users.push(existingUser({ passwordHash: 'other-run-hash' }));

    const result = await ensureSeedAdmin(client, { email, password: 'first-password-1' }, async () => 'our-hash');

    expect(result).toEqual({ status: 'unchanged', activeAdmin: true });
    expect(users).toHaveLength(1);
    expect(users[0]!.passwordHash).toBe('other-run-hash');
    expect(user.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });

  it('describes results without the email, password or hash', () => {
    const lines = [
      describeSeedAdminResult({ status: 'created' }),
      describeSeedAdminResult({ status: 'unchanged', activeAdmin: true }),
      describeSeedAdminResult({ status: 'unchanged', activeAdmin: false })
    ];

    expect(lines[1]).toContain('left unchanged (password not modified)');
    expect(lines[2]).toContain('not reactivated or promoted');
    for (const line of lines) {
      expect(line).not.toContain(email);
      expect(line).not.toMatch(/\$2[aby]\$/);
    }
  });
});
