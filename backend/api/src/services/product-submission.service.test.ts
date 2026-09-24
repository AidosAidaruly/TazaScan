import { describe, expect, it, vi } from 'vitest';
import type { ProductSubmission } from '../generated/prisma/client';
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

class FakeSubmissionRepository {
  transaction<T>(operation: (transaction: never) => Promise<T>): Promise<T> {
    return operation(undefined as never);
  }

  submissions: ProductSubmission[] = [];
  productBarcodeExists = false;
  approvedProductId: string | null = null;

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

  markApproved(id: string, createdProductId: string) {
    this.approvedProductId = createdProductId;
    const submission = createSubmission({
      id,
      status: 'approved',
      createdProductId,
      reviewedAt: now,
      reviewedByUserId: 'admin-id'
    });
    return Promise.resolve({ ...submission, createdProduct: null });
  }
}

class FakeProductCreator {
  createdBody: unknown;

  create(data: unknown) {
    this.createdBody = data;
    return Promise.resolve({ id: 'created-product-id' });
  }
}

function createService(repository = new FakeSubmissionRepository()) {
  const productCreator = new FakeProductCreator();

  return {
    repository,
    productCreator,
    service: new ProductSubmissionService(repository as never, productCreator as never)
  };
}

describe('ProductSubmissionService', () => {
  it('does not approve when product creation fails inside the transaction', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [createSubmission()];
    const { service, productCreator } = createService(repository);
    const failure = new Error('insert failed');
    vi.spyOn(productCreator, 'create').mockRejectedValue(failure);
    const markApproved = vi.spyOn(repository, 'markApproved');
    const transaction = vi.spyOn(repository, 'transaction');
    await expect(service.approve(repository.submissions[0]!.id, {
      barcode: '5449000000996', name: 'Coca-Cola', category: 'Soft Drinks',
      ingredients: [], servingType: 'per100ml'
    }, 'admin-id')).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledOnce();
    expect(markApproved).not.toHaveBeenCalled();
  });

  it('creates a valid submission', async () => {
    const { service } = createService();

    const submission = await service.create(
      { barcode: '5449000000996', ingredients: [] },
      {
        frontImageUrl: '/product-submissions/uploads/front.jpg',
        ingredientsImageUrl: null,
        nutritionImageUrl: null,
        barcodeImageUrl: null
      }
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
        {
          frontImageUrl: '/product-submissions/uploads/front.jpg',
          ingredientsImageUrl: null,
          nutritionImageUrl: null,
          barcodeImageUrl: null
        }
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not create a duplicate submission when product barcode already exists', async () => {
    const repository = new FakeSubmissionRepository();
    repository.productBarcodeExists = true;
    const { service } = createService(repository);

    await expect(
      service.create(
        { barcode: '5449000000996', ingredients: [] },
        {
          frontImageUrl: '/product-submissions/uploads/front.jpg',
          ingredientsImageUrl: null,
          nutritionImageUrl: null,
          barcodeImageUrl: null
        }
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      details: expect.objectContaining({ code: 'product_exists' })
    });
  });

  it('requires a front package photo for unknown barcode submissions', async () => {
    const { service } = createService();

    await expect(
      service.create(
        { barcode: '5449000000996', ingredients: [] },
        { frontImageUrl: null, ingredientsImageUrl: null, nutritionImageUrl: null, barcodeImageUrl: null }
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      details: expect.objectContaining({ code: 'front_image_required' })
    });
  });

  it('approves a submission and creates a product', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [
      createSubmission({ frontImageUrl: '/product-submissions/uploads/front.jpg' })
    ];
    const { service, productCreator } = createService(repository);

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
    expect(productCreator.createdBody).toMatchObject({
      barcode: '5449000000996',
      imageUrl: '/product-submissions/uploads/front.jpg',
      dataStatus: 'community',
      source: 'user_submission',
      lastVerifiedAt: null
    });
    expect(repository.approvedProductId).toBe('created-product-id');
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
