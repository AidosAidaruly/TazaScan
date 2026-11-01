import type { ErrorRequestHandler, Request } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error';
import { prismaErrorCode, toPrismaHttpError } from '../utils/prisma-errors';

/**
 * Server-side diagnostics for an unexpected error. Never includes the request body, headers
 * or query string. Body-parser errors not mapped to a client status above carry the raw body
 * (and their message can quote it), so only their type and status are logged.
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

/**
 * Client errors raised while reading or parsing the request body (express.json / body-parser
 * and raw-body). Each type is mapped only when it carries the status the parser always uses
 * for it, so an unrelated error that merely has a `type` or `status` field still becomes 500.
 */
const requestBodyErrors: Record<string, { status: number; message: string }> = {
  'entity.parse.failed': { status: 400, message: 'Malformed JSON request body' },
  'entity.too.large': { status: 413, message: 'Request body too large' },
  'request.size.invalid': { status: 400, message: 'Request body size did not match Content-Length' },
  'request.aborted': { status: 400, message: 'Request aborted' },
  'charset.unsupported': { status: 415, message: 'Unsupported request body charset' },
  'encoding.unsupported': { status: 415, message: 'Unsupported request body encoding' }
};

// A corrupt Content-Encoding stream reaches us as the decompressor's error wrapped by
// body-parser with status 400 and no `type`: zlib (gzip/deflate), brotli and zstd codes.
const decompressionErrorCode = /^(Z_[A-Z_]+|ERR__ERROR_[A-Z0-9_]+|ZSTD_error_\w+)$/;

function toRequestBodyError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  const { type, status, code } = error as Error & { type?: unknown; status?: unknown; code?: unknown };
  if (type === undefined && status === 400 && typeof code === 'string' && decompressionErrorCode.test(code)) {
    return { type: 'entity.decompress.failed', status: 400, message: 'Malformed compressed request body' };
  }

  const mapped = typeof type === 'string' ? requestBodyErrors[type] : undefined;
  return mapped && mapped.status === status ? { type: type as string, ...mapped } : null;
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const bodyError = toRequestBodyError(error);
  if (bodyError) {
    // Type and status only: the parser's message and error object can quote the raw body.
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'request_body_rejected',
      method: request.method,
      path: request.path,
      type: bodyError.type,
      status: bodyError.status
    }));
    response.status(bodyError.status).json({
      error: { message: bodyError.message }
    });
    return;
  }

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
