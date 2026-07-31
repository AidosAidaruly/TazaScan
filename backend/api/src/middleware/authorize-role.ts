import type { RequestHandler } from 'express';
import type { UserRole } from '../generated/prisma/client';
import { HttpError } from '../utils/http-error';

export function authorizeRole(role: UserRole): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) {
      next(new HttpError(401, 'Missing authenticated user'));
      return;
    }

    if (request.user.role !== role) {
      next(new HttpError(403, 'Insufficient role'));
      return;
    }

    next();
  };
}
