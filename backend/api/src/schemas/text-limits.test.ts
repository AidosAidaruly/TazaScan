import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ZodTypeAny } from 'zod';
import { errorHandler } from '../middleware/error-handler';
import { validate } from '../middleware/validate';
import { loginBodySchema } from './auth.schema';
import {
  approveSubmissionBodySchema,
  productSubmissionBodySchema,
  updateSubmissionStatusBodySchema
} from './product-submission.schema';
import {
  halalCertificationBodySchema,
  listProductsQuerySchema,
  officialNutriScorePreviewBodySchema,
  productBodySchema,
  tazaScorePreviewBodySchema,
  updateProductBodySchema
} from './product.schema';
import { textLimits } from './text-limits';

// Realistic payloads as sent by the admin panel and the mobile app today.
const adminProduct = {
  barcode: '5449000000996',
  name: 'Coca-Cola Original Taste',
  brand: 'Coca-Cola',
  category: 'Soft Drinks',
  ingredients: ['Carbonated water', 'Sugar', 'Colour (caramel E150d)', 'Phosphoric acid'],
  ingredientsTextOriginal: 'Carbonated water, sugar, colour (caramel E150d), phosphoric acid',
  ingredientsTextOriginalLanguage: 'en',
  nutritionFacts: { servingType: 'per100ml', energyKcal: 42, sugars: 10.6 },
  imageUrl: 'https://images.openfoodfacts.org/images/products/544/900/000/0996/front_en.jpg',
  dataStatus: 'verified',
  source: 'Open Food Facts'
};
// Multipart fields arrive as strings; numbers are coerced.
const mobileSubmission = {
  barcode: '4870001234567',
  name: 'Йогурт клубничный',
  brand: 'Taza',
  category: 'Молочные продукты',
  ingredients: ['молоко', 'клубника', 'сахар'],
  servingType: 'per100g',
  energyKcal: '95',
  sugars: '12',
  carbohydrates: '14'
};
const halalCertification = {
  status: 'verified',
  issuer: 'Spiritual Administration of Muslims of Kazakhstan',
  certificateNumber: 'KZ-HAL-2026-0042',
  validUntil: '2027-01-01T00:00:00.000Z',
  source: 'Admin-reviewed certificate',
  evidenceUrl: 'https://example.com/certificates/KZ-HAL-2026-0042.pdf'
};

type Case = [label: string, schema: ZodTypeAny, base: Record<string, unknown>, field: string, max: number];

const textCases: Case[] = [
  ['product name', productBodySchema, adminProduct, 'name', textLimits.productName],
  ['product brand', productBodySchema, adminProduct, 'brand', textLimits.brand],
  ['product category', productBodySchema, adminProduct, 'category', textLimits.category],
  ['ingredients text original', productBodySchema, adminProduct, 'ingredientsTextOriginal', textLimits.ingredientsText],
  ['ingredients text ru', productBodySchema, adminProduct, 'ingredientsTextRu', textLimits.ingredientsText],
  ['ingredients text translated ru', productBodySchema, adminProduct, 'ingredientsTextTranslatedRu', textLimits.ingredientsText],
  ['ingredients language tag', productBodySchema, adminProduct, 'ingredientsTextOriginalLanguage', textLimits.languageTag],
  ['translation source', productBodySchema, adminProduct, 'ingredientsTranslationSource', textLimits.sourceLabel],
  ['manual override reason', productBodySchema, adminProduct, 'manualOverrideReason', textLimits.overrideReason],
  ['product source', productBodySchema, adminProduct, 'source', textLimits.sourceLabel],
  ['update: product name', updateProductBodySchema, { name: 'x' }, 'name', textLimits.productName],
  ['preview category', officialNutriScorePreviewBodySchema, {}, 'category', textLimits.category],
  ['taza preview category', tazaScorePreviewBodySchema, {}, 'category', textLimits.category],
  ['search q', listProductsQuerySchema, {}, 'q', textLimits.searchTerm],
  ['search name', listProductsQuerySchema, {}, 'name', textLimits.searchTerm],
  ['search brand', listProductsQuerySchema, {}, 'brand', textLimits.searchTerm],
  ['submission name', productSubmissionBodySchema, mobileSubmission, 'name', textLimits.productName],
  ['submission brand', productSubmissionBodySchema, mobileSubmission, 'brand', textLimits.brand],
  ['submission category', productSubmissionBodySchema, mobileSubmission, 'category', textLimits.category],
  ['submission device id', productSubmissionBodySchema, mobileSubmission, 'anonymousDeviceId', textLimits.deviceId],
  ['approval name', approveSubmissionBodySchema, mobileSubmission, 'name', textLimits.productName],
  ['approval category', approveSubmissionBodySchema, mobileSubmission, 'category', textLimits.category],
  ['approval moderation note', approveSubmissionBodySchema, mobileSubmission, 'moderationNote', textLimits.moderationNote],
  ['status moderation note', updateSubmissionStatusBodySchema, { status: 'rejected' }, 'moderationNote', textLimits.moderationNote],
  ['halal issuer', halalCertificationBodySchema, halalCertification, 'issuer', textLimits.certificationIssuer],
  ['halal certificate number', halalCertificationBodySchema, halalCertification, 'certificateNumber', textLimits.certificateNumber],
  ['halal source', halalCertificationBodySchema, halalCertification, 'source', textLimits.sourceLabel],
  ['login password', loginBodySchema, { email: 'admin@example.com' }, 'password', textLimits.password]
];

describe('text length limits', () => {
  it.each(textCases)('%s accepts exactly the maximum length', (_label, schema, base, field, max) => {
    const result = schema.safeParse({ ...base, [field]: 'я'.repeat(max) });

    expect(result.success).toBe(true);
  });

  it.each(textCases)('%s rejects one character over the maximum', (_label, schema, base, field, max) => {
    const result = schema.safeParse({ ...base, [field]: 'я'.repeat(max + 1) });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  // Passwords are deliberately not trimmed.
  const trimmedCases = textCases.filter(([, , , field]) => field !== 'password');

  it.each(trimmedCases)('%s measures length after trimming and never truncates', (_label, schema, base, field, max) => {
    const value = 'я'.repeat(max);
    const result = schema.safeParse({ ...base, [field]: `  ${value}  ` });

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>)[field]).toBe(value);
  });

  it('bounds the partial barcode search to the longest supported barcode', () => {
    expect(listProductsQuerySchema.safeParse({ barcode: '1'.repeat(13) }).success).toBe(true);
    expect(listProductsQuerySchema.safeParse({ barcode: '1'.repeat(14) }).success).toBe(false);
    expect(listProductsQuerySchema.safeParse({ barcode: '4870' }).success).toBe(true);
  });

  it.each([
    ['product', productBodySchema, adminProduct],
    ['submission', productSubmissionBodySchema, mobileSubmission],
    ['preview', officialNutriScorePreviewBodySchema, {}]
  ] as const)('limits %s ingredient entry length and count', (_label, schema, base) => {
    const parse = (ingredients: string[]) => schema.safeParse({ ...base, ingredients }).success;

    expect(parse(['я'.repeat(textLimits.ingredient)])).toBe(true);
    expect(parse(['я'.repeat(textLimits.ingredient + 1)])).toBe(false);
    expect(parse(Array.from({ length: textLimits.ingredientCount }, (_, i) => `i${i}`))).toBe(true);
    expect(parse(Array.from({ length: textLimits.ingredientCount + 1 }, (_, i) => `i${i}`))).toBe(false);
  });

  it.each([
    ['product imageUrl', productBodySchema, adminProduct, 'imageUrl'],
    ['halal evidenceUrl', halalCertificationBodySchema, halalCertification, 'evidenceUrl']
  ] as const)('limits %s length', (_label, schema, base, field) => {
    const prefix = 'https://example.com/';
    const url = (length: number) => prefix + 'a'.repeat(length - prefix.length);

    expect(schema.safeParse({ ...base, [field]: url(textLimits.url) }).success).toBe(true);
    expect(schema.safeParse({ ...base, [field]: url(textLimits.url + 1) }).success).toBe(false);
    expect(schema.safeParse({ ...base, [field]: null }).success).toBe(true);
  });

  it('limits login email to 254 characters', () => {
    const domain = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.kz`; // 195 chars
    const emailOfLength = (length: number) =>
      `${'u'.repeat(length - domain.length - 1)}@${domain}`;

    expect(loginBodySchema.safeParse({ email: emailOfLength(254), password: 'x' }).success).toBe(true);
    expect(loginBodySchema.safeParse({ email: emailOfLength(255), password: 'x' }).success).toBe(false);
  });
});

describe('existing client payloads', () => {
  it('accepts the current admin product payload', () => {
    expect(productBodySchema.parse(adminProduct)).toMatchObject({ name: adminProduct.name });
  });

  it('accepts the current mobile submission payload', () => {
    expect(productSubmissionBodySchema.parse(mobileSubmission)).toMatchObject({
      name: 'Йогурт клубничный',
      energyKcal: 95
    });
  });

  it('accepts the current halal certification and login payloads', () => {
    expect(halalCertificationBodySchema.safeParse(halalCertification).success).toBe(true);
    expect(
      loginBodySchema.safeParse({ email: 'Admin@Example.com', password: 'correct horse battery' })
    ).toMatchObject({ success: true, data: { email: 'admin@example.com' } });
  });

  it('keeps optional/null behavior unchanged', () => {
    const result = productSubmissionBodySchema.parse({ name: 'Cola', brand: null });

    expect(result).toMatchObject({ name: 'Cola', brand: null, ingredients: [] });
    expect(result.category).toBeUndefined();
    expect(productBodySchema.safeParse({ ...adminProduct, brand: '   ' }).success).toBe(false);
  });
});

describe('oversized input over HTTP', () => {
  function appFor(schema: ZodTypeAny, part: 'body' | 'query' = 'body') {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    const handler = (_request: express.Request, response: express.Response) => {
      response.status(201).json({ data: 'ok' });
    };
    app.post('/products', validate(schema, part), handler);
    app.get('/products', validate(schema, part), handler);
    app.use(errorHandler);
    return app;
  }

  it('returns a clean 400 without echoing the value or internals', async () => {
    const oversized = 'x'.repeat(textLimits.productName + 1);

    const response = await request(appFor(productBodySchema))
      .post('/products')
      .send({ ...adminProduct, name: oversized });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Validation failed');
    expect(Object.keys(response.body.error.details.fieldErrors)).toEqual(['name']);
    expect(response.text).not.toContain(oversized);
    expect(response.text).not.toMatch(/ZodError|at .*\.ts|stack/);
  });

  it('rejects an oversized search query with 400', async () => {
    const response = await request(appFor(listProductsQuerySchema, 'query'))
      .get('/products')
      .query({ q: 'x'.repeat(textLimits.searchTerm + 1) });

    expect(response.status).toBe(400);
    expect(Object.keys(response.body.error.details.fieldErrors)).toEqual(['q']);
  });

  it('still accepts a normal admin product request', async () => {
    const response = await request(appFor(productBodySchema)).post('/products').send(adminProduct);

    expect(response.status).toBe(201);
  });
});
