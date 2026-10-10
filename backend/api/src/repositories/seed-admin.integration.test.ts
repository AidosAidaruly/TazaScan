import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveAdminSeedCredentials } from '../config/admin-seed-credentials';
import { prisma } from '../prisma/client';
import { ensureSeedAdmin } from '../seed/admin-user';
import { PasswordService } from '../services/password.service';

// Opt-in PostgreSQL checks for the seed admin step. Each test uses a unique throwaway email;
// only those accounts are deleted afterwards. The real admin account is never touched.
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true')('seed admin / PostgreSQL', () => {
  const passwordService = new PasswordService();
  const emails: string[] = [];
  const firstPassword = 'Seed-First-Password-41c9e2';
  const secondPassword = 'Seed-Second-Password-7d0a3b';

  function newEmail() {
    const email = `seed-admin-${randomUUID()}@example.test`;
    emails.push(email);
    return email;
  }

  // Same path as prisma/seed.ts: validated credentials, then create-if-missing.
  function seed(email: string, password: string) {
    const credentials = resolveAdminSeedCredentials({ ADMIN_EMAIL: email, ADMIN_PASSWORD: password });
    return ensureSeedAdmin(prisma, credentials!, (value) => passwordService.hash(value));
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it('creates a missing admin whose password verifies', async () => {
    const email = newEmail();

    expect(await seed(email, firstPassword)).toEqual({ status: 'created' });

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({ role: 'admin', isActive: true });
    expect(await passwordService.verify(firstPassword, user.passwordHash)).toBe(true);
  });

  it('a second run with a different ADMIN_PASSWORD changes nothing', async () => {
    const email = newEmail();
    await seed(email, firstPassword);
    const before = await prisma.user.findUniqueOrThrow({ where: { email } });

    expect(await seed(email, firstPassword)).toEqual({ status: 'unchanged', activeAdmin: true });
    expect(await seed(email, secondPassword)).toEqual({ status: 'unchanged', activeAdmin: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(after).toEqual(before);
    expect(await passwordService.verify(firstPassword, after.passwordHash)).toBe(true);
    expect(await passwordService.verify(secondPassword, after.passwordHash)).toBe(false);
  });

  it.each([
    ['an inactive admin', { role: 'admin' as const, isActive: false }],
    ['a non-admin user', { role: 'user' as const, isActive: true }]
  ])('does not reactivate, promote or re-password %s', async (_label, fields) => {
    const email = newEmail();
    const passwordHash = await passwordService.hash(firstPassword);
    await prisma.user.create({ data: { email, passwordHash, ...fields } });
    const before = await prisma.user.findUniqueOrThrow({ where: { email } });

    expect(await seed(email, secondPassword)).toEqual({ status: 'unchanged', activeAdmin: false });

    expect(await prisma.user.findUniqueOrThrow({ where: { email } })).toEqual(before);
  });

  it('concurrent first runs create exactly one account and keep the first hash', async () => {
    const email = newEmail();

    const results = await Promise.all([
      seed(email, firstPassword),
      seed(email, secondPassword),
      seed(email, firstPassword)
    ]);

    expect(results.filter((result) => result.status === 'created')).toHaveLength(1);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    const verifies = await Promise.all(
      [firstPassword, secondPassword].map((password) => passwordService.verify(password, stored.passwordHash))
    );
    expect(verifies.filter(Boolean)).toHaveLength(1);
  });
});
