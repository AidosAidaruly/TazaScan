import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { HttpError } from '../utils/http-error';
import { isPrismaError, prismaErrorCode, toPrismaHttpError } from '../utils/prisma-errors';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
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

  console.error(error);

  response.status(500).json({
    error: {
      message: 'Internal server error',
      // Prisma messages can contain SQL, table and constraint names: never returned.
      details:
        env.NODE_ENV === 'production' || isPrismaError(error) ? undefined : String(error)
    }
  });
};
