import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { corsOptions } from './config/cors';
import { configureTrustProxy } from './config/trust-proxy';
import { errorHandler } from './middleware/error-handler';
import { loggingMiddleware } from './middleware/logging';
import { notFoundHandler } from './middleware/not-found';
import { apiRouter } from './routes';
import { ensureProductImageUploadDirectory } from './services/product-image-storage.service';
import { getLocalFileStorage } from './storage/storage-provider';

export function createApp() {
  const app = express();
  configureTrustProxy(app);

  void ensureProductImageUploadDirectory();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(loggingMiddleware);
  app.use(
    '/uploads/products',
    express.static(getLocalFileStorage().getDirectory('products'), {
      // Public product images are embedded by other origins (admin panel, web clients).
      // Relax CORP only on served image files; every other response keeps Helmet's
      // same-origin default, including admin-only submission evidence.
      setHeaders: (response) => {
        response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      }
    })
  );
  app.use(apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
