import type { ErrorRequestHandler, Request } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error';
import { prismaErrorCode, toPrismaHttpError } from '../utils/prisma-errors';

/**
 * Server-side diagnostics for an unexpected error. Never includes the request body, headers
 * or query string. Body-parser errors carry the raw body (and their message can quote it), so
 * only their type and status are logged.
 */
function unexpectedErrorLog(error: unknown, request: Request) {
  const base = {
    level: 'error',
    event: 'unhandled_error',
    method: request.method,
    path: request.path
  };

  if (!(error instanceof Error)) {
    return { ...base, name: typeof error };
  }

  const { type, status, code } = error as Error & {
    type?: unknown;
    status?: unknown;
    code?: unknown;
  };
  if (typeof type === 'string' && type.startsWith('entity.')) {
    return { ...base, name: error.name, type, status };
  }

  return {
    ...base,
    name: error.name,
    code: typeof code === 'string' || typeof code === 'number' ? code : undefined,
    message: error.message,
    stack: error.stack
  };
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        message: 'Validation failed',
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: {
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  const prismaHttpError = toPrismaHttpError(error);
  if (prismaHttpError) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'prisma_known_error',
      code: prismaErrorCode(error),
      statusCode: prismaHttpError.statusCode
    }));
    response.status(prismaHttpError.statusCode).json({
      error: { message: prismaHttpError.message }
    });
    return;
  }

  console.error(JSON.stringify(unexpectedErrorLog(error, request)));

  // Same generic body in every environment: error text can contain SQL, file paths or
  // other internals. Details stay in the server log above.
  response.status(500).json({
    error: { message: 'Internal server error' }
  });
};
