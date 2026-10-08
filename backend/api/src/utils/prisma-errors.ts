import { Prisma } from '../generated/prisma/client';
import { HttpError } from './http-error';

// Expected Prisma failures and the client-safe responses they map to. Messages are
// deliberately generic: no model, field, constraint or SQL details reach clients.
const knownPrismaErrors: Record<string, { statusCode: number; message: string }> = {
  P2002: { statusCode: 409, message: 'Resource already exists' },
  P2003: { statusCode: 409, message: 'Operation conflicts with related records' },
  P2025: { statusCode: 404, message: 'Resource not found' }
};

/** Prisma error code (e.g. "P2002") of a known request error, otherwise null. */
export function prismaErrorCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code;
  }

  // Same class loaded through another module instance (e.g. test module resets).
  const code = error instanceof Error ? (error as Error & { code?: unknown }).code : undefined;
  if (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    typeof code === 'string'
  ) {
    return code;
  }

  return null;
}

/** Any error raised by the Prisma client (known, unknown, validation, init, panic). */
export function isPrismaError(error: unknown) {
  return error instanceof Error && error.name.startsWith('PrismaClient');
}

/** Client-safe HttpError for an expected Prisma failure, or null if it is not one. */
export function toPrismaHttpError(error: unknown): HttpError | null {
  const code = prismaErrorCode(error);
  const known = code ? knownPrismaErrors[code] : undefined;

  return known ? new HttpError(known.statusCode, known.message) : null;
}
