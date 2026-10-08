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
    expect(response.body.error.message).toBe('Internal server error');
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
