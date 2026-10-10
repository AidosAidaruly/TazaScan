import cors from 'cors';
import type { RequestHandler } from 'express';
import { env } from './env';

/**
 * CORS with an exact-origin allowlist and credentials.
 * - No Origin header (mobile apps, curl, server-to-server): passes through unchanged.
 * - Allowed origin: standard CORS headers echoing that exact origin, with credentials.
 * - Any other origin: a clean 403 without CORS headers (preflights included), never a 500.
 */
export function createCorsMiddleware(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  const corsHandler = cors({ origin: [...allowed], credentials: true });

  return (request, response, next) => {
    const origin = request.headers.origin;

    if (origin !== undefined && !allowed.has(origin)) {
      response.vary('Origin');
      response.status(403).json({ error: { message: 'Origin not allowed' } });
      return;
    }

    corsHandler(request, response, next);
  };
}

export const corsMiddleware = createCorsMiddleware(env.corsOrigins);
