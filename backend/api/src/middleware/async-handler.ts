import type { AsyncRequestHandler } from '../types/http';

export function asyncHandler(handler: AsyncRequestHandler): AsyncRequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}
