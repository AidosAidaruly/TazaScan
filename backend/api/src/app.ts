import cors from 'cors';
import express from 'express';
import { corsOptions } from './config/cors';
import { errorHandler } from './middleware/error-handler';
import { loggingMiddleware } from './middleware/logging';
import { notFoundHandler } from './middleware/not-found';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(loggingMiddleware);
  app.use(apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
