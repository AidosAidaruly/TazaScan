import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { HttpError } from '../utils/http-error';
import { prismaErrorCode, toPrismaHttpError } from '../utils/prisma-errors';
import { errorHandler } from './error-handler';

// Raw Prisma text that must never reach a client.
const leakyMessage =
  'Invalid `prisma.product.create()` invocation: Unique constraint failed on the fields: (`barcode`) ' +
  'constraint "Product_barcode_key" table "public"."Product" SELECT * FROM "Product"';
const leakyMeta = {
  modelName: 'Product',
  target: ['barcode'],
  constraint: 'Product_barcode_key',
  field_name: 'ProductSubmission_createdProductId_fkey (index)',
  cause: 'No record was found for an update.'
};
const leakyFragments = [
  'prisma',
  'Product_barcode_key',
  'ProductSubmission_createdProductId_fkey',
  'public',
  'SELECT',
  'barcode',
  'modelName',
  'No record was found'
];

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(leakyMessage, {
    code,
    clientVersion: '7.0.0',
    meta: leakyMeta
  });
}

function appThrowing(error: unknown) {
  const app = express();
  app.get('/fail', () => {
    throw error;
  });
  app.get('/ok', (_request, response) => {
    response.status(200).json({ data: { ok: true } });
  });
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('error handler: Prisma errors', () => {
  it.each([
    ['P2002', 409, 'Resource already exists'],
    ['P2025', 404, 'Resource not found'],
    ['P2003', 409, 'Operation conflicts with related records']
  ])('maps %s to %i with a generic message', async (code, status, message) => {
    const response = await request(appThrowing(knownError(code))).get('/fail');

    expect(response.status).toBe(status);
    expect(response.body).toEqual({ error: { message } });
  });

  it.each(['P2002', 'P2025', 'P2003'])('never exposes Prisma internals for %s', async (code) => {
    const response = await request(appThrowing(knownError(code))).get('/fail');

    for (const fragment of leakyFragments) {
      expect(response.text).not.toContain(fragment);
    }
  });

  it('logs mapped errors with only the code and status', async () => {
    await request(appThrowing(knownError('P2002'))).get('/fail');

    expect(console.warn).toHaveBeenCalledWith(
      JSON.stringify({ level: 'warn', event: 'prisma_known_error', code: 'P2002', statusCode: 409 })
    );
  });

  it('keeps unexpected known Prisma errors as 500 without details', async () => {
    const response = await request(appThrowing(knownError('P2034'))).get('/fail');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { message: 'Internal server error' } });
    for (const fragment of leakyFragments) {
      expect(response.text).not.toContain(fragment);
    }
  });

  it.each([
    [
      'unknown request',
      new Prisma.PrismaClientUnknownRequestError(leakyMessage, { clientVersion: '7.0.0' })
    ],
    ['validation', new Prisma.PrismaClientValidationError(leakyMessage, { clientVersion: '7.0.0' })],
    ['initialization', new Prisma.PrismaClientInitializationError(leakyMessage, '7.0.0')]
  ])('keeps Prisma %s errors as 500 without details', async (_kind, error) => {
    const response = await request(appThrowing(error)).get('/fail');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { message: 'Internal server error' } });
    expect(response.text).not.toContain('prisma');
  });
});

describe('error handler: existing behavior', () => {
  it('passes HttpError through unchanged, including details', async () => {
    const response = await request(
      appThrowing(
        new HttpError(409, 'Product already exists for this barcode', {
          code: 'product_exists',
          productId: 'product-id'
        })
      )
    ).get('/fail');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        message: 'Product already exists for this barcode',
        details: { code: 'product_exists', productId: 'product-id' }
      }
    });
  });

  it('keeps Zod validation errors as 400', async () => {
    const parsed = z.object({ name: z.string() }).safeParse({});
    const response = await request(appThrowing(parsed.error)).get('/fail');

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
  });

  it('keeps non-Prisma errors as 500', async () => {
    const response = await request(appThrowing(new Error('boom'))).get('/fail');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { message: 'Internal server error' } });
  });

  it('keeps Zod validation details unchanged', async () => {
    const parsed = z.object({ name: z.string() }).safeParse({});
    const response = await request(appThrowing(parsed.error)).get('/fail');

    expect(response.body).toEqual({
      error: { message: 'Validation failed', details: parsed.error!.flatten() }
    });
  });

  it('does not affect successful requests', async () => {
    const response = await request(appThrowing(new Error('unused'))).get('/ok');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { ok: true } });
  });
});

describe('prisma error helpers', () => {
  it('reads codes only from Prisma known request errors', () => {
    expect(prismaErrorCode(knownError('P2002'))).toBe('P2002');
    expect(prismaErrorCode(Object.assign(new Error('x'), { code: 'P2002' }))).toBeNull();
    expect(prismaErrorCode('P2002')).toBeNull();
    expect(toPrismaHttpError(new Error('x'))).toBeNull();
  });

  it('recognizes Prisma known errors from another module instance', () => {
    const foreign = Object.assign(new Error('x'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2025'
    });

    expect(toPrismaHttpError(foreign)).toMatchObject({ statusCode: 404 });
  });
});

describe('error handler: unexpected errors', () => {
  const sensitive = 'sensitive internal detail: connect ECONNREFUSED 10.0.0.5:5432 at C:\\srv\\db.ts';
  const sensitiveFragments = ['sensitive internal detail', 'ECONNREFUSED', '10.0.0.5', 'db.ts'];

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // A fresh handler module loaded under the given NODE_ENV.
  async function loadForEnv(nodeEnv: string) {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.resetModules();
    const { errorHandler: handler } = await import('./error-handler.js');
    const { Prisma: EnvPrisma } = await import('../generated/prisma/client.js');
    const { HttpError: EnvHttpError } = await import('../utils/http-error.js');
    return { handler, EnvPrisma, EnvHttpError };
  }

  function appWith(handler: typeof errorHandler, error: unknown) {
    const app = express();
    app.get('/fail', () => {
      throw error;
    });
    app.use(handler);
    return app;
  }

  it.each(['test', 'development', 'production'])(
    'returns a generic 500 with no details in %s',
    async (nodeEnv) => {
      const { handler } = await loadForEnv(nodeEnv);
      const thrown = Object.assign(new Error(sensitive), { code: 'ECONNREFUSED' });

      const response = await request(appWith(handler, thrown)).get('/fail');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: { message: 'Internal server error' } });
      for (const fragment of [...sensitiveFragments, 'stack', 'details', 'Error:']) {
        expect(response.text).not.toContain(fragment);
      }
    }
  );

  it.each([
    ['a string', sensitive],
    ['a plain object', { message: sensitive, query: 'SELECT secret FROM users' }],
    ['a TypeError', new TypeError(sensitive)]
  ])('stays generic in development when %s is thrown', async (_kind, thrown) => {
    const { handler } = await loadForEnv('development');

    const response = await request(appWith(handler, thrown)).get('/fail');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { message: 'Internal server error' } });
    expect(response.text).not.toContain('sensitive internal detail');
    expect(response.text).not.toContain('SELECT');
  });

  it('keeps unknown Prisma errors generic in development', async () => {
    const { handler, EnvPrisma } = await loadForEnv('development');
    const error = new EnvPrisma.PrismaClientUnknownRequestError(leakyMessage, {
      clientVersion: '7.0.0'
    });

    const response = await request(appWith(handler, error)).get('/fail');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { message: 'Internal server error' } });
    for (const fragment of leakyFragments) {
      expect(response.text).not.toContain(fragment);
    }
  });

  it('keeps known Prisma mappings and HttpError unchanged in development', async () => {
    const { handler, EnvPrisma, EnvHttpError } = await loadForEnv('development');
    const knownInDev = new EnvPrisma.PrismaClientKnownRequestError(leakyMessage, {
      code: 'P2002',
      clientVersion: '7.0.0',
      meta: leakyMeta
    });

    const conflict = await request(appWith(handler, knownInDev)).get('/fail');
    const explicit = await request(
      appWith(handler, new EnvHttpError(403, 'Forbidden', { reason: 'role' }))
    ).get('/fail');

    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ error: { message: 'Resource already exists' } });
    expect(explicit.status).toBe(403);
    expect(explicit.body).toEqual({ error: { message: 'Forbidden', details: { reason: 'role' } } });
  });

  it('logs useful diagnostics server-side as one structured line', async () => {
    const thrown = Object.assign(new Error(sensitive), { code: 'ECONNREFUSED' });

    await request(appThrowing(thrown)).get('/fail?token=query-secret');

    expect(console.error).toHaveBeenCalledTimes(1);
    const line = vi.mocked(console.error).mock.calls[0]![0] as string;
    const logged = JSON.parse(line);
    expect(logged).toMatchObject({
      level: 'error',
      event: 'unhandled_error',
      method: 'GET',
      path: '/fail',
      name: 'Error',
      code: 'ECONNREFUSED',
      message: sensitive
    });
    expect(logged.stack).toContain('sensitive internal detail');
    expect(line).not.toContain('query-secret');
  });

  it('never logs request bodies, headers or tokens', async () => {
    const app = express();
    app.use(express.json());
    app.post('/fail', () => {
      throw new Error('handler failed');
    });
    app.use(errorHandler);

    await request(app)
      .post('/fail')
      .set('Authorization', 'Bearer header.jwt.value')
      .send({ email: 'admin@example.com', password: 'body-password-value' });

    const line = vi.mocked(console.error).mock.calls[0]![0] as string;
    expect(JSON.parse(line)).toMatchObject({ event: 'unhandled_error', message: 'handler failed' });
    for (const secret of ['body-password-value', 'admin@example.com', 'header.jwt.value']) {
      expect(line).not.toContain(secret);
    }
  });

  it('logs only the type of unmapped body-parser errors, whose message can quote the raw body', async () => {
    const app = express();
    // A verify failure (403, entity.verify.failed) is not a mapped client error: it stays 500.
    app.use(express.json({
      verify: () => {
        throw new Error('verify rejected');
      }
    }));
    app.post('/fail', (_request, response) => {
      response.status(200).end();
    });
    app.use(errorHandler);

    const response = await request(app)
      .post('/fail')
      .set('Content-Type', 'application/json')
      .send('{"password":"leaked-password-value"}');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { message: 'Internal server error' } });
    expect(response.text).not.toContain('leaked-password-value');
    const line = vi.mocked(console.error).mock.calls[0]![0] as string;
    expect(JSON.parse(line)).toMatchObject({
      event: 'unhandled_error',
      name: 'Error',
      type: 'entity.verify.failed',
      status: 403
    });
    expect(line).not.toContain('leaked-password-value');
    expect(line).not.toContain('password');
  });
});

describe('error handler: request body errors', () => {
  function jsonApp() {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.post('/echo', (request, response) => {
      response.status(200).json({ data: request.body });
    });
    app.use(errorHandler);
    return app;
  }

  it('passes valid JSON through to the route', async () => {
    const response = await request(jsonApp()).post('/echo').send({ name: 'Кетчуп', count: 2 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { name: 'Кетчуп', count: 2 } });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('maps malformed JSON to 400 without echoing the body', async () => {
    const response = await request(jsonApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"password":"leaked-password-value"');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { message: 'Malformed JSON request body' } });
    expect(response.text).not.toContain('leaked-password-value');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('maps a body over the limit to 413', async () => {
    const response = await request(jsonApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding: 'a'.repeat(1024 * 1024) }));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: { message: 'Request body too large' } });
  });

  // raw-body errors that cannot be produced reliably over a real socket (Node's HTTP parser
  // enforces Content-Length), built with the same type/status/expose shape body-parser uses.
  it.each([
    ['request.size.invalid', 400, 'Request body size did not match Content-Length'],
    ['request.aborted', 400, 'Request aborted'],
    ['charset.unsupported', 415, 'Unsupported request body charset'],
    ['encoding.unsupported', 415, 'Unsupported request body encoding'],
    ['entity.parse.failed', 400, 'Malformed JSON request body'],
    ['entity.too.large', 413, 'Request body too large']
  ])('maps parser error %s to %i', async (type, status, message) => {
    const error = Object.assign(new Error(`raw body {"password":"leaked-password-value"}`), {
      type,
      status,
      statusCode: status,
      expose: true,
      body: '{"password":"leaked-password-value"}'
    });

    const response = await request(appThrowing(error)).get('/fail');

    expect(response.status).toBe(status);
    expect(response.body).toEqual({ error: { message } });
    expect(response.text).not.toContain('leaked-password-value');
  });

  // Codes observed from body-parser 2.4.0 for corrupt gzip, truncated gzip, deflate, br, zstd.
  it.each(['Z_DATA_ERROR', 'Z_BUF_ERROR', 'ERR__ERROR_FORMAT_PADDING_1', 'ZSTD_error_prefix_unknown'])(
    'maps a corrupt compressed body (%s) to 400',
    async (code) => {
      const error = Object.assign(new Error('incorrect header check'), {
        code,
        status: 400,
        statusCode: 400,
        expose: true
      });

      const response = await request(appThrowing(error)).get('/fail');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: { message: 'Malformed compressed request body' } });
      expect(response.text).not.toContain(code);
      expect(response.text).not.toContain('header check');
    }
  );

  it.each([
    ['a parser type with a different status', { type: 'entity.parse.failed', status: 500 }],
    ['a parser type without a status', { type: 'entity.too.large' }],
    ['a 400 status without a type', { status: 400 }],
    ['a 413 status with an unknown type', { type: 'upload.too.large', status: 413 }],
    ['an unmapped stream error', { type: 'stream.not.readable', status: 500 }],
    ['a zlib code without status 400', { code: 'Z_DATA_ERROR' }],
    ['a zlib code with status 500', { code: 'Z_DATA_ERROR', status: 500 }],
    ['a zlib code with another type', { code: 'Z_DATA_ERROR', status: 400, type: 'custom.error' }],
    ['a non-decompression code with status 400', { code: 'P2002', status: 400 }]
  ])('keeps %s as 500', async (_kind, fields) => {
    const response = await request(appThrowing(Object.assign(new Error('internal'), fields))).get('/fail');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { message: 'Internal server error' } });
  });

  it('keeps a non-Error value with parser fields as 500', async () => {
    const response = await request(
      appThrowing({ type: 'entity.parse.failed', status: 400, message: 'x' })
    ).get('/fail');

    expect(response.status).toBe(500);
  });

  it('leaves HttpError with the same status unchanged', async () => {
    const response = await request(
      appThrowing(new HttpError(413, 'Image too large', { maxBytes: 10 }))
    ).get('/fail');

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: { message: 'Image too large', details: { maxBytes: 10 } }
    });
  });
});
