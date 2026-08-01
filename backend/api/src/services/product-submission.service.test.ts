import { describe, expect, it } from 'vitest';
import type { ProductSubmission } from '../generated/prisma/client';
import type { ScoreEngine } from '../scoring/contracts/score-engine';
import type { ScoreInput, ScoreResult } from '../scoring/types/score-result';
import { ProductSubmissionService } from './product-submission.service';

const now = new Date('2026-08-01T00:00:00.000Z');
type ProductSubmissionWithProduct = ProductSubmission & { createdProduct: null };

function createSubmission(overrides: Partial<ProductSubmission> = {}): ProductSubmission {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    barcode: '5449000000996',
    name: 'Coca-Cola Original Taste',
    brand: 'Coca-Cola',
    category: 'Soft Drinks',
    ingredients: ['Carbonated water', 'Sugar'],
    servingType: 'per100ml',
    energyKcal: 42,
    protein: 0,
    carbohydrates: 10.6,
    sugars: 10.6,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    salt: 0,
    frontImageUrl: null,
    ingredientsImageUrl: null,
    nutritionImageUrl: null,
    barcodeImageUrl: null,
    status: 'pending',
    moderationNote: null,
    submittedAt: now,
    reviewedAt: null,
    reviewedByUserId: null,
    createdProductId: null,
    anonymousDeviceId: null,
    ...overrides
  };
}

class FakeScoreEngine implements ScoreEngine {
  calculate(_input: ScoreInput): ScoreResult {
    return {
      score: 65,
      grade: 'C',
      status: 'calculated',
      positiveReasons: [],
      negativeReasons: ['High sugar content.'],
      warnings: [],
      missingFields: [],
      algorithm: 'test',
      algorithmVersion: 'test-1',
      calculatedAt: now.toISOString()
    };
  }
}

class FakeSubmissionRepository {
  submissions: ProductSubmission[] = [];
  productBarcodeExists = false;

  list() {
    return Promise.resolve<[ProductSubmissionWithProduct[], number]>([
      this.submissions.map((submission) => ({
        ...submission,
        createdProduct: null
      })),
      this.submissions.length
    ]);
  }

  findById(id: string) {
    const submission = this.submissions.find((item) => item.id === id);
    return Promise.resolve(
      submission
        ? {
            ...submission,
            createdProduct: null
          }
        : null
    );
  }

  findPendingDuplicate() {
    return Promise.resolve(this.submissions.find((item) => item.status === 'pending') ?? null);
  }

  create(data: { barcode?: string | null | undefined; name?: string | null | undefined }) {
    const submission = createSubmission({ barcode: data.barcode ?? null, name: data.name ?? null });
    this.submissions.push(submission);
    return Promise.resolve(submission);
  }

  updateStatus(id: string, data: { status: 'rejected' | 'needs_correction'; moderationNote: string }) {
    const submission = createSubmission({
      id,
      status: data.status,
      moderationNote: data.moderationNote,
      reviewedAt: now,
      reviewedByUserId: 'admin-id'
    });
    return Promise.resolve(submission);
  }

  findProductByBarcode() {
    return Promise.resolve(this.productBarcodeExists ? { id: 'product-id' } : null);
  }

  approve(id: string) {
    const submission = createSubmission({
      id,
      status: 'approved',
      createdProductId: 'created-product-id',
      reviewedAt: now,
      reviewedByUserId: 'admin-id'
    });
    return Promise.resolve({ ...submission, createdProduct: null });
  }
}

function createService(repository = new FakeSubmissionRepository()) {
  return {
    repository,
    service: new ProductSubmissionService(repository as never, new FakeScoreEngine())
  };
}

describe('ProductSubmissionService', () => {
  it('creates a valid submission', async () => {
    const { service } = createService();

    const submission = await service.create(
      { barcode: '5449000000996', ingredients: [] },
      { frontImageUrl: null, ingredientsImageUrl: null, nutritionImageUrl: null, barcodeImageUrl: null }
    );

    expect(submission.barcode).toBe('5449000000996');
    expect(submission.status).toBe('pending');
  });

  it('rejects missing identifying data', async () => {
    const { service } = createService();

    await expect(
      service.create(
        { ingredients: [] },
        { frontImageUrl: null, ingredientsImageUrl: null, nutritionImageUrl: null, barcodeImageUrl: null }
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('prevents duplicate pending submissions', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [createSubmission()];
    const { service } = createService(repository);

    await expect(
      service.create(
        { barcode: '5449000000996', ingredients: [] },
        { frontImageUrl: null, ingredientsImageUrl: null, nutritionImageUrl: null, barcodeImageUrl: null }
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('approves a submission and creates a product', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [createSubmission()];
    const { service } = createService(repository);

    const submission = await service.approve(
      '11111111-1111-4111-8111-111111111111',
      {
        barcode: '5449000000996',
        name: 'Coca-Cola Original Taste',
        category: 'Soft Drinks',
        ingredients: ['Carbonated water'],
        servingType: 'per100ml'
      },
      'admin-id'
    );

    expect(submission.status).toBe('approved');
    expect(submission.createdProductId).toBe('created-product-id');
  });

  it('fails approval safely for duplicate barcode', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [createSubmission()];
    repository.productBarcodeExists = true;
    const { service } = createService(repository);

    await expect(
      service.approve(
        '11111111-1111-4111-8111-111111111111',
        {
          barcode: '5449000000996',
          name: 'Coca-Cola Original Taste',
          category: 'Soft Drinks',
          ingredients: [],
          servingType: 'per100ml'
        },
        'admin-id'
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects a submission with note', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [createSubmission()];
    const { service } = createService(repository);

    const submission = await service.updateStatus(
      '11111111-1111-4111-8111-111111111111',
      { status: 'rejected', moderationNote: 'Photo is unreadable' },
      'admin-id'
    );

    expect(submission.status).toBe('rejected');
  });

  it('marks a submission as needs correction', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [createSubmission()];
    const { service } = createService(repository);

    const submission = await service.updateStatus(
      '11111111-1111-4111-8111-111111111111',
      { status: 'needs_correction', moderationNote: 'Need nutrition label' },
      'admin-id'
    );

    expect(submission.status).toBe('needs_correction');
  });
});
