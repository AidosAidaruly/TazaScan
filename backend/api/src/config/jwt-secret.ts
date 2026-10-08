export const minJwtSecretLength = 32;

// Deterministic secret used only when NODE_ENV=test. Rejected in every other environment.
export const testOnlyJwtSecret = 'tazascan-test-only-jwt-secret-do-not-use-elsewhere';

// Defaults and documentation examples that must never sign real tokens (compared lowercase).
const placeholderSecrets = new Set([
  'development-only-change-this-secret-before-production',
  'change-this-secret-in-production',
  'replace-with-a-local-development-secret',
  'long-random-secret',
  'change-me',
  'changeme',
  'secret',
  'jwt-secret',
  'your-secret',
  'your-jwt-secret',
  testOnlyJwtSecret
]);

// A 32+ character value with very few distinct characters ("aaaa...", "abababab...") is not random.
const minDistinctCharacters = 10;

export class JwtSecretConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtSecretConfigError';
  }
}

/**
 * Returns the JWT signing secret for the given environment or throws a
 * JwtSecretConfigError. Error messages never include the secret value.
 */
export function resolveJwtSecret(nodeEnv: string, value: string | undefined): string {
  if (nodeEnv === 'test') {
    return testOnlyJwtSecret;
  }

  const secret = value?.trim() ?? '';

  if (secret.length === 0) {
    throw new JwtSecretConfigError(
      'JWT_SECRET is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
    );
  }

  if (secret.length < minJwtSecretLength) {
    throw new JwtSecretConfigError(
      `JWT_SECRET must be at least ${minJwtSecretLength} characters long.`
    );
  }

  if (placeholderSecrets.has(secret.toLowerCase())) {
    throw new JwtSecretConfigError(
      'JWT_SECRET is a known placeholder/default value. Replace it with a random secret.'
    );
  }

  if (new Set(secret).size < minDistinctCharacters) {
    throw new JwtSecretConfigError(
      'JWT_SECRET looks non-random (too few distinct characters). Replace it with a random secret.'
    );
  }

  return secret;
}
