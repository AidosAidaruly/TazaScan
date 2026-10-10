// Same minimum as ADMIN_PASSWORD in env.ts.
export const minAdminPasswordLength = 12;

// Example values from .env.example, the READMEs, deployment docs and test fixtures, plus
// generic defaults. Compared trimmed and lowercase.
const placeholderAdminPasswords = new Set([
  'change-this-admin-password',
  'use-a-strong-password',
  'replace-with-a-strong-local-password',
  'strong-password',
  'example-admin-password',
  'change-me',
  'changeme',
  'password',
  'admin',
  'admin-password',
  'your-admin-password'
]);

export class AdminSeedConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminSeedConfigError';
  }
}

export type AdminSeedCredentials = { email: string; password: string };

/**
 * Admin credentials for the seed, or null when ADMIN_EMAIL is not set (the admin seed is
 * skipped). With ADMIN_EMAIL set, ADMIN_PASSWORD must be a real password: present, not blank,
 * at least 12 characters and not a documented placeholder. Errors never include the value.
 */
export function resolveAdminSeedCredentials(
  env: NodeJS.ProcessEnv = process.env
): AdminSeedCredentials | null {
  const email = env.ADMIN_EMAIL?.toLowerCase();
  if (!email) {
    return null;
  }

  const password = env.ADMIN_PASSWORD;

  if (password === undefined || password.trim().length === 0) {
    throw new AdminSeedConfigError(
      'ADMIN_PASSWORD is required when ADMIN_EMAIL is set. Set a strong, unique password.'
    );
  }

  if (password.length < minAdminPasswordLength) {
    throw new AdminSeedConfigError(
      `ADMIN_PASSWORD must be at least ${minAdminPasswordLength} characters long.`
    );
  }

  if (placeholderAdminPasswords.has(password.trim().toLowerCase())) {
    throw new AdminSeedConfigError(
      'ADMIN_PASSWORD is a documented placeholder/example value. Replace it with a strong, unique password.'
    );
  }

  return { email, password };
}
