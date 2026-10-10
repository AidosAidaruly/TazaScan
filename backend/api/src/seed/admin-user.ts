import type { PrismaClient } from '../generated/prisma/client';
import type { AdminSeedCredentials } from '../config/admin-seed-credentials';

type UserClient = Pick<PrismaClient, 'user'>;

export type SeedAdminResult =
  | { status: 'created' }
  | { status: 'unchanged'; activeAdmin: boolean };

/**
 * Creates the seed admin only if no account with that email exists. An existing account is
 * never modified: its password hash, role and active status stay as they are, so re-running
 * the seed cannot reset a password or reactivate/promote an account. Creation is atomic
 * (ON CONFLICT DO NOTHING), so concurrent seed runs cannot overwrite each other.
 */
export async function ensureSeedAdmin(
  client: UserClient,
  credentials: AdminSeedCredentials,
  hashPassword: (password: string) => Promise<string>
): Promise<SeedAdminResult> {
  const existing = await findExisting(client, credentials.email);
  if (existing) {
    return existing;
  }

  const passwordHash = await hashPassword(credentials.password);
  const { count } = await client.user.createMany({
    data: [{ email: credentials.email, passwordHash, role: 'admin', isActive: true }],
    skipDuplicates: true
  });

  if (count === 1) {
    return { status: 'created' };
  }

  // Created concurrently by another seed run between the check and the insert.
  return (await findExisting(client, credentials.email)) ?? { status: 'unchanged', activeAdmin: false };
}

/** Seed log line. Never includes the email, password or hash. */
export function describeSeedAdminResult(result: SeedAdminResult) {
  if (result.status === 'created') {
    return 'Created the admin account for ADMIN_EMAIL.';
  }

  return result.activeAdmin
    ? 'Admin account for ADMIN_EMAIL already exists; left unchanged (password not modified).'
    : 'An account for ADMIN_EMAIL already exists but is not an active admin; left unchanged ' +
        '(not reactivated or promoted, password not modified).';
}

async function findExisting(client: UserClient, email: string): Promise<SeedAdminResult | null> {
  const user = await client.user.findUnique({
    where: { email },
    select: { role: true, isActive: true }
  });

  return user
    ? { status: 'unchanged', activeAdmin: user.role === 'admin' && user.isActive }
    : null;
}
