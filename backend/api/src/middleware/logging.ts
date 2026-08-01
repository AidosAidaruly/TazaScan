import type { RequestHandler } from 'express';

export const loggingMiddleware: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();

  response.on('finish', () => {
    const durationMs = Math.round(performance.now() - startedAt);
    console.info(
      JSON.stringify({
        level: 'info',
        event: 'request',
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs
      })
    );
  });

  next();
};
