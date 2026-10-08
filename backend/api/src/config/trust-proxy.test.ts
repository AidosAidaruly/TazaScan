import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loginRateLimit } from '../middleware/login-rate-limit';
import { ocrRateLimit } from '../middleware/ocr-rate-limit';
import { submissionRateLimit } from '../middleware/submission-rate-limit';
import { configureTrustProxy } from './trust-proxy';

// Each test uses its own client IPs (TEST-NET ranges) because the real limiters keep a
// module-level in-memory store shared across tests.

function createIpEchoApp(hops: number) {
  const app = express();
  configureTrustProxy(app, hops);
  app.get('/ip', (incoming, response) => {
    response.status(200).json({ ip: incoming.ip });
  });

  return app;
}

function createRateLimitedApp(hops: number, limiter: RequestHandler) {
  const app = express();
  configureTrustProxy(app, hops);
  app.post('/limited', limiter, (_request, response) => {
    response.status(200).json({ ok: true });
  });

  return app;
}

async function exhaustBucket(app: express.Express, forwardedFor: (attempt: number) => string) {
  const first = await request(app).post('/limited').set('X-Forwarded-For', forwardedFor(0));
  expect(first.status).toBe(200);

  const limit = Number(first.headers['ratelimit-limit']);
  expect(limit).toBeGreaterThan(0);

  for (let attempt = 1; attempt < limit; attempt += 1) {
    const response = await request(app)
      .post('/limited')
      .set('X-Forwarded-For', forwardedFor(attempt));
    expect(response.status).toBe(200);
  }

  return limit;
}

describe('configureTrustProxy', () => {
  it('rejects invalid hop counts', () => {
    expect(() => configureTrustProxy(express(), -1)).toThrow();
    expect(() => configureTrustProxy(express(), 1.5)).toThrow();
  });

  describe('direct / local requests', () => {
    it('uses the socket address when no proxy is trusted (default)', async () => {
      const response = await request(createIpEchoApp(0)).get('/ip');

      expect(response.status).toBe(200);
      expect(response.body.ip).toMatch(/127\.0\.0\.1|::1/);
    });

    it('still works without X-Forwarded-For when a proxy hop is configured', async () => {
      const response = await request(createIpEchoApp(1)).get('/ip');

      expect(response.status).toBe(200);
      expect(response.body.ip).toMatch(/127\.0\.0\.1|::1/);
    });

    it('lets direct requests through the real rate limiters', async () => {
      for (const limiter of [loginRateLimit, ocrRateLimit, submissionRateLimit]) {
        const response = await request(createRateLimitedApp(0, limiter)).post('/limited');
        expect(response.status).toBe(200);
      }
    });
  });

  describe('proxied requests', () => {
    it('uses the client IP appended by the trusted proxy', async () => {
      const response = await request(createIpEchoApp(1))
        .get('/ip')
        .set('X-Forwarded-For', '203.0.113.10');

      expect(response.body.ip).toBe('203.0.113.10');
    });

    it('resolves the client IP behind two trusted proxies', async () => {
      const response = await request(createIpEchoApp(2))
        .get('/ip')
        .set('X-Forwarded-For', '203.0.113.11, 10.0.0.2');

      expect(response.body.ip).toBe('203.0.113.11');
    });

    it.each([
      ['login', loginRateLimit, '198.51.100.1', '198.51.100.2'],
      ['ocr', ocrRateLimit, '198.51.100.3', '198.51.100.4'],
      ['submission', submissionRateLimit, '198.51.100.5', '198.51.100.6']
    ])(
      'gives different clients behind the same proxy separate %s buckets',
      async (_name, limiter, clientA, clientB) => {
        const app = createRateLimitedApp(1, limiter);

        await exhaustBucket(app, () => clientA);

        const blocked = await request(app).post('/limited').set('X-Forwarded-For', clientA);
        expect(blocked.status).toBe(429);

        const otherClient = await request(app).post('/limited').set('X-Forwarded-For', clientB);
        expect(otherClient.status).toBe(200);
      }
    );
  });

  describe('spoofed forwarding headers', () => {
    it('ignores X-Forwarded-For entirely when no proxy is trusted', async () => {
      const response = await request(createIpEchoApp(0))
        .get('/ip')
        .set('X-Forwarded-For', '203.0.113.99');

      expect(response.body.ip).not.toBe('203.0.113.99');
      expect(response.body.ip).toMatch(/127\.0\.0\.1|::1/);
    });

    it('ignores client-supplied entries beyond the configured proxy depth', async () => {
      // Client sends "6.6.6.6"; the single trusted proxy appends the real address.
      const response = await request(createIpEchoApp(1))
        .get('/ip')
        .set('X-Forwarded-For', '6.6.6.6, 203.0.113.20');

      expect(response.body.ip).toBe('203.0.113.20');
    });

    it('does not let a client escape its rate-limit bucket by rotating spoofed entries', async () => {
      const realClient = '198.51.100.7';
      const app = createRateLimitedApp(1, loginRateLimit);

      await exhaustBucket(app, (attempt) => `192.0.2.${attempt + 1}, ${realClient}`);

      const blocked = await request(app)
        .post('/limited')
        .set('X-Forwarded-For', `192.0.2.250, ${realClient}`);
      expect(blocked.status).toBe(429);
    });
  });
});
