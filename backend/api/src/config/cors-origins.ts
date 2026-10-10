// Local admin origins (Vite dev server and `vite preview`) used in development when
// CORS_ORIGIN is empty. An explicit list, never "allow every origin".
export const developmentDefaultCorsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
] as const;

export class CorsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorsConfigError';
  }
}

/**
 * Parses CORS_ORIGIN, a comma-separated allowlist of exact browser origins
 * (scheme://host[:port], no path or trailing slash). Wildcards are rejected: the API sends
 * credentials-enabled CORS responses. Empty means the development defaults in development,
 * no browser origins in test, and a startup error in production.
 */
export function parseCorsOrigins(nodeEnv: string, value: string | undefined): string[] {
  const entries = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const entry of entries) {
    if (entry.includes('*')) {
      throw new CorsConfigError(
        'CORS_ORIGIN must list exact origins; wildcards are not allowed with credentials.'
      );
    }

    if (!isExactOrigin(entry)) {
      throw new CorsConfigError(
        'CORS_ORIGIN entries must be exact origins like https://admin.example.com ' +
          '(http or https, no path, query or trailing slash).'
      );
    }
  }

  if (entries.length > 0) {
    return [...new Set(entries)];
  }

  if (nodeEnv === 'production') {
    throw new CorsConfigError(
      'CORS_ORIGIN must list at least one allowed admin origin in production.'
    );
  }

  return nodeEnv === 'development' ? [...developmentDefaultCorsOrigins] : [];
}

function isExactOrigin(entry: string) {
  try {
    const url = new URL(entry);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === entry;
  } catch {
    return false;
  }
}
