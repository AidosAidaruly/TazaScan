import type { Request } from 'express';
import { HttpError } from './http-error';

export function requireParam(request: Request, name: string) {
  const value = request.params[name];

  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpError(400, `Missing route parameter: ${name}`);
  }

  return value;
}
