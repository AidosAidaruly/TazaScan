import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real product and submission routers with stubbed OCR controllers and upload middleware:
// proves the route wiring, the per-endpoint counters, the limiter-before-upload order and that
// the OCR pool's 503/504 responses still pass through unchanged.

const calls = vi.hoisted(() => ({ upload: 0, ocr: 0, nextError: null as unknown }));

vi.mock('./image-upload', () => ({
  uploadProductImage: (_request: unknown, _response: unknown, next: () => void) => {
    calls.upload += 1;
    next();
  }
}));

function ocrHandler(_request: express.Request, response: express.Response) {
  calls.ocr += 1;
  if (calls.nextError) {
    const error = calls.nextError;
    calls.nextError = null;
    throw error;
  }
  response.status(200).json({ data: { ok: true } });
}

vi.mock('../controllers/photo-search.controller', () => ({ searchProductsByPhoto: ocrHandler }));
vi.mock('../controllers/product-submission-ocr.controller', () => ({
  recognizeSubmissionNutrition: ocrHandler,
  recognizeSubmissionIngredients: ocrHandler
}));

const endpoints = {
  photoSearch: {
    path: '/products/photo-search',
    limit: 20,
    message: 'Too many photo searches. Try again later.'
  },
  nutrition: {
    path: '/product-submissions/ocr/nutrition',
    limit: 10,
    message: 'Too many nutrition label scans. Try again later.'
  },
  ingredients: {
    path: '/product-submissions/ocr/ingredients',
    limit: 10,
    message: 'Too many ingredient list scans. Try again later.'
  }
} as const;
type Endpoint = (typeof endpoints)[keyof typeof endpoints];

let app: Express;

// Fresh routers (and limiter stores) per test, behind `hops` trusted proxies like the real app.
async function createApp(hops = 0) {
  vi.resetModules();
  const { configureTrustProxy } = await import('../config/trust-proxy.js');
  const { productRouter } = await import('../routes/product.routes.js');
  const { productSubmissionRouter } = await import('../routes/product-submission.routes.js');
  const { errorHandler } = await import('./error-handler.js');
  const created = express();
  configureTrustProxy(created, hops);
  created.use('/products', productRouter);
  created.use('/product-submissions', productSubmissionRouter);
  created.use(errorHandler);
  return created;
}

function post(endpoint: Endpoint, forwardedFor?: string) {
  const pending = request(app).post(endpoint.path);
  return forwardedFor ? pending.set('X-Forwarded-For', forwardedFor) : pending;
}

async function exhaust(endpoint: Endpoint, forwardedFor?: (attempt: number) => string) {
  for (let attempt = 0; attempt < endpoint.limit; attempt += 1) {
    const response = await post(endpoint, forwardedFor?.(attempt));
    expect(response.status, `${endpoint.path} #${attempt + 1}`).toBe(200);
  }
}

beforeEach(async () => {
  calls.upload = 0;
  calls.ocr = 0;
  calls.nextError = null;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  app = await createApp();
});

describe('OCR rate limits', () => {
  it.each(Object.entries(endpoints))(
    '%s allows its limit, then answers 429 with its own message',
    async (_name, endpoint) => {
      await exhaust(endpoint);

      const limited = await post(endpoint);

      expect(limited.status).toBe(429);
      expect(limited.body).toEqual({ error: { message: endpoint.message } });
      expect(limited.headers['ratelimit-limit']).toBe(String(endpoint.limit));
    }
  );

  it('exhausting photo search does not block submission OCR', async () => {
    await exhaust(endpoints.photoSearch);
    expect((await post(endpoints.photoSearch)).status).toBe(429);

    expect((await post(endpoints.nutrition)).status).toBe(200);
    expect((await post(endpoints.ingredients)).status).toBe(200);
  });

  it('exhausting submission OCR does not block photo search', async () => {
    await exhaust(endpoints.nutrition);
    await exhaust(endpoints.ingredients);
    expect((await post(endpoints.nutrition)).status).toBe(429);
    expect((await post(endpoints.ingredients)).status).toBe(429);

    expect((await post(endpoints.photoSearch)).status).toBe(200);
  });

  it('the two submission scans have independent counters', async () => {
    await exhaust(endpoints.nutrition);

    expect((await post(endpoints.nutrition)).status).toBe(429);
    expect((await post(endpoints.ingredients)).status).toBe(200);
  });

  it('runs the limiter before the upload middleware and the OCR handler', async () => {
    await exhaust(endpoints.nutrition);
    const uploadsBefore = calls.upload;
    const ocrBefore = calls.ocr;
    // Allowed requests did go through the upload step.
    expect(uploadsBefore).toBe(endpoints.nutrition.limit);

    const limited = await request(app)
      .post(endpoints.nutrition.path)
      .attach('image', Buffer.from('not processed'), { filename: 'label.jpg', contentType: 'image/jpeg' });

    expect(limited.status).toBe(429);
    expect(calls.upload).toBe(uploadsBefore);
    expect(calls.ocr).toBe(ocrBefore);
  });

  it('spoofed X-Forwarded-For values do not bypass the limit on a direct connection', async () => {
    await exhaust(endpoints.photoSearch, (attempt) => `198.51.100.${attempt}`);

    const spoofed = await post(endpoints.photoSearch, '203.0.113.99');

    expect(spoofed.status).toBe(429);
    expect(spoofed.body.error.message).toBe(endpoints.photoSearch.message);
  });

  it('behind a trusted proxy, client-prepended entries do not bypass, but real clients are separate', async () => {
    app = await createApp(1);

    await exhaust(endpoints.ingredients, (attempt) => `10.0.0.${attempt}, 203.0.113.7`);

    expect((await post(endpoints.ingredients, '10.9.9.9, 203.0.113.7')).status).toBe(429);
    expect((await post(endpoints.ingredients, '203.0.113.8')).status).toBe(200);
  });

  it.each([
    [503, 'OCR service is busy. Try again later.'],
    [504, 'OCR timed out']
  ])('passes the OCR pool %i response through unchanged', async (status, message) => {
    const { HttpError } = await import('../utils/http-error.js');
    calls.nextError = new HttpError(status, message);

    const response = await post(endpoints.photoSearch);

    expect(response.status).toBe(status);
    expect(response.body.error.message).toBe(message);
  });
});
