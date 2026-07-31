import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

type RequestPart = 'body' | 'params' | 'query';

export function validate(schema: ZodSchema, part: RequestPart = 'body'): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request[part]);

    if (!result.success) {
      next(result.error);
      return;
    }

    request[part] = result.data;
    next();
  };
}
