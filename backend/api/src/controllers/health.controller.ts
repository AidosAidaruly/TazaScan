import type { RequestHandler } from 'express';
import { prisma } from '../prisma/client';

/** Upper bound for the readiness database check; an unreachable database can otherwise hang. */
export const readinessTimeoutMs = 2_000;

/** Minimal read-only PostgreSQL round trip on the shared Prisma client. */
export type DatabaseCheck = () => Promise<unknown>;

const checkDatabase: DatabaseCheck = () => prisma.$queryRaw`SELECT 1`;

class ReadinessTimeoutError extends Error {
  constructor() {
    super('Readiness database check timed out');
    this.name = 'ReadinessTimeoutError';
  }
}

export const getHealth: RequestHandler = (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'tazascan-api',
    timestamp: new Date().toISOString()
  });
};

/**
 * Ready only when PostgreSQL answers within `timeoutMs`. Failures return a fixed 503 body;
 * the log records only the error name and code, never its message (database errors can
 * contain hosts or connection details).
 */
export function createReadinessHandler(
  databaseCheck: DatabaseCheck = checkDatabase,
  timeoutMs: number = readinessTimeoutMs
): RequestHandler {
  return async (_request, response) => {
    try {
      await withTimeout(databaseCheck(), timeoutMs);
    } catch (error) {
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'readiness_check_failed',
        dependency: 'database',
        reason: error instanceof ReadinessTimeoutError ? 'timeout' : 'error',
        name: error instanceof Error ? error.name : typeof error,
        code: errorCode(error)
      }));
      response.status(503).json({
        status: 'not_ready',
        service: 'tazascan-api',
        timestamp: new Date().toISOString(),
        checks: { database: 'unavailable' }
      });
      return;
    }

    response.status(200).json({
      status: 'ready',
      service: 'tazascan-api',
      timestamp: new Date().toISOString(),
      checks: { database: 'ok' }
    });
  };
}

export const getReadiness = createReadinessHandler();

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  // The check keeps running after a timeout; absorb its late failure so it is never unhandled.
  operation.catch(() => undefined);

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new ReadinessTimeoutError()), timeoutMs);
  });

  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

function errorCode(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' || typeof code === 'number' ? code : undefined;
}
