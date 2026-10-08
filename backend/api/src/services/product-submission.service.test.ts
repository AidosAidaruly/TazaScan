import { describe, expect, it, vi } from 'vitest';
import { Prisma, type ProductSubmission } from '../generated/prisma/client';
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

  // Mirrors the repository's guarded write: approved rows are never updated.
  updateStatus(id: string, data: { status: 'rejected' | 'needs_correction'; moderationNote: string }) {
    const index = this.submissions.findIndex((item) => item.id === id);
    const current = this.submissions[index];
    if (!current || current.status === 'approved') {
      return Promise.resolve(null);
    }

    const submission = {
      ...current,
      status: data.status,
      moderationNote: data.moderationNote,
      reviewedAt: now,
      reviewedByUserId: 'admin-id'
    };
    this.submissions[index] = submission;
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

class FakeProductImages {
  copiedFrom: string[] = [];
  deleted: string[] = [];
  copyResult: string | null = '/uploads/products/copied-front.jpg';

  copySubmissionImage(url: string | null | undefined) {
    this.copiedFrom.push(String(url));
    return Promise.resolve(this.copyResult);
  }

  deleteImage(url: string | null | undefined) {
    this.deleted.push(String(url));
    return Promise.resolve();
  }
}

function createService(repository = new FakeSubmissionRepository()) {
  const productCreator = new FakeProductCreator();
  const productImages = new FakeProductImages();

  return {
    repository,
    productCreator,
    productImages,
    service: new ProductSubmissionService(
      repository as never,
      productCreator as never,
      productImages
    )
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

  describe('discarding uploads of failed submissions', () => {
    const images = {
      frontImageUrl: '/product-submissions/uploads/front.jpg',
      ingredientsImageUrl: '/product-submissions/uploads/ingredients.jpg',
      nutritionImageUrl: null,
      barcodeImageUrl: null
    };

    it.each([
      ['missing identifying data', { ingredients: [] }, {}, { statusCode: 400 }],
      [
        'sugars greater than carbohydrates',
        { name: 'Cola', ingredients: [], sugars: 20, carbohydrates: 10 },
        {},
        { statusCode: 400 }
      ],
      [
        'existing product barcode',
        { barcode: '5449000000996', ingredients: [] },
        { productBarcodeExists: true },
        { statusCode: 409 }
      ],
      [
        'duplicate pending submission',
        { barcode: '5449000000996', ingredients: [] },
        { submissions: [createSubmission()] },
        { statusCode: 409 }
      ]
    ] as const)('discards uploads on %s', async (_case, data, state, expected) => {
      const repository = Object.assign(new FakeSubmissionRepository(), structuredClone(state));
      const { service } = createService(repository);
      const discardUploads = vi.fn(async () => undefined);
      const uploadImages = 'barcode' in data ? images : { ...images, frontImageUrl: null };

      await expect(
        service.create(structuredClone(data) as never, uploadImages, discardUploads)
      ).rejects.toMatchObject(expected);

      expect(discardUploads).toHaveBeenCalledOnce();
    });

    it('discards uploads when the repository create fails, keeping the original error', async () => {
      const repository = new FakeSubmissionRepository();
      const failure = new Error('database unavailable');
      vi.spyOn(repository, 'create').mockRejectedValue(failure);
      const { service } = createService(repository);
      const discardUploads = vi.fn(async () => undefined);

      await expect(
        service.create({ barcode: '5449000000996', ingredients: [] }, images, discardUploads)
      ).rejects.toBe(failure);

      expect(discardUploads).toHaveBeenCalledOnce();
    });

    it('keeps uploads of a created submission', async () => {
      const { service } = createService();
      const discardUploads = vi.fn(async () => undefined);

      await service.create({ barcode: '5449000000996', ingredients: [] }, images, discardUploads);

      expect(discardUploads).not.toHaveBeenCalled();
    });
  });

  it('approves a submission and creates a product', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [
      createSubmission({ frontImageUrl: '/product-submissions/uploads/front.jpg' })
    ];
    const { service, productCreator, productImages } = createService(repository);

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
    expect(productImages.copiedFrom).toEqual(['/product-submissions/uploads/front.jpg']);
    expect(productCreator.createdBody).toMatchObject({
      barcode: '5449000000996',
      imageUrl: '/uploads/products/copied-front.jpg',
      dataStatus: 'community',
      source: 'user_submission',
      lastVerifiedAt: null
    });
    expect(repository.approvedProductId).toBe('created-product-id');
    expect(productImages.deleted).toEqual([]);
  });

  it('never gives the product the submission-scoped evidence URL', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [
      createSubmission({ frontImageUrl: '/product-submissions/uploads/front.jpg' })
    ];
    const { service, productCreator, productImages } = createService(repository);
    productImages.copyResult = null; // evidence file missing on disk
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await service.approve(
      '11111111-1111-4111-8111-111111111111',
      { barcode: '5449000000996', name: 'Cola', category: 'Soft Drinks', ingredients: [] },
      'admin-id'
    );

    expect(productCreator.createdBody).toMatchObject({ imageUrl: null });
  });

  it('approves a submission without a front image without copying anything', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [createSubmission({ frontImageUrl: null })];
    const { service, productCreator, productImages } = createService(repository);

    const submission = await service.approve(
      '11111111-1111-4111-8111-111111111111',
      { barcode: '5449000000996', name: 'Cola', category: 'Soft Drinks', ingredients: [] },
      'admin-id'
    );

    expect(submission.status).toBe('approved');
    expect(productImages.copiedFrom).toEqual([]);
    expect(productCreator.createdBody).toMatchObject({ imageUrl: null });
  });

  it('deletes the copied product image when the approval transaction fails', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [
      createSubmission({ frontImageUrl: '/product-submissions/uploads/front.jpg' })
    ];
    const { service, productCreator, productImages } = createService(repository);
    const failure = new Error('insert failed');
    vi.spyOn(productCreator, 'create').mockRejectedValue(failure);

    await expect(
      service.approve(
        '11111111-1111-4111-8111-111111111111',
        { barcode: '5449000000996', name: 'Cola', category: 'Soft Drinks', ingredients: [] },
        'admin-id'
      )
    ).rejects.toBe(failure);

    expect(productImages.deleted).toEqual(['/uploads/products/copied-front.jpg']);
  });

  it('keeps the original approval error when copied-image cleanup also fails', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [
      createSubmission({ frontImageUrl: '/product-submissions/uploads/front.jpg' })
    ];
    const { service, productCreator, productImages } = createService(repository);
    const failure = new Error('insert failed');
    vi.spyOn(productCreator, 'create').mockRejectedValue(failure);
    vi.spyOn(productImages, 'deleteImage').mockRejectedValue(new Error('disk error'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      service.approve(
        '11111111-1111-4111-8111-111111111111',
        { barcode: '5449000000996', name: 'Cola', category: 'Soft Drinks', ingredients: [] },
        'admin-id'
      )
    ).rejects.toBe(failure);
  });

  it('does not copy the image when approval is rejected before product creation', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [
      createSubmission({ frontImageUrl: '/product-submissions/uploads/front.jpg' })
    ];
    repository.productBarcodeExists = true;
    const { service, productImages } = createService(repository);

    await expect(
      service.approve(
        '11111111-1111-4111-8111-111111111111',
        { barcode: '5449000000996', name: 'Cola', category: 'Soft Drinks', ingredients: [] },
        'admin-id'
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(productImages.copiedFrom).toEqual([]);
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

  it.each([
    ['needs_correction', 'rejected'],
    ['needs_correction', 'needs_correction'],
    ['rejected', 'needs_correction'],
    ['rejected', 'rejected']
  ] as const)('still allows %s -> %s', async (from, to) => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [createSubmission({ status: from })];
    const { service } = createService(repository);

    const submission = await service.updateStatus(
      '11111111-1111-4111-8111-111111111111',
      { status: to, moderationNote: 'Moderator note' },
      'admin-id'
    );

    expect(submission.status).toBe(to);
  });

  it.each(['rejected', 'needs_correction', 'pending'] as const)(
    'returns 409 for approved -> %s without writing',
    async (status) => {
      const repository = new FakeSubmissionRepository();
      const approved = createSubmission({
        status: 'approved',
        createdProductId: 'created-product-id',
        moderationNote: 'Looks good'
      });
      repository.submissions = [approved];
      const updateStatus = vi.spyOn(repository, 'updateStatus');
      const { service } = createService(repository);

      await expect(
        service.updateStatus(
          '11111111-1111-4111-8111-111111111111',
          // 'pending' is rejected by the route schema; the service must still refuse it.
          { status, moderationNote: 'Changed my mind' } as never,
          'admin-id'
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'Approved submissions cannot change moderation status'
      });

      expect(updateStatus).not.toHaveBeenCalled();
      expect(repository.submissions[0]).toEqual(approved);
    }
  );

  it('returns 409 when approval commits between the read and the status write', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [createSubmission({ status: 'pending' })];
    const { service } = createService(repository);
    // Stale admin request: it reads "pending", then another admin's approval commits.
    const findById = repository.findById.bind(repository);
    vi.spyOn(repository, 'findById').mockImplementationOnce(async (id) => {
      const stale = await findById(id);
      repository.submissions[0] = {
        ...repository.submissions[0]!,
        status: 'approved',
        createdProductId: 'created-product-id'
      };
      return stale;
    });

    await expect(
      service.updateStatus(
        '11111111-1111-4111-8111-111111111111',
        { status: 'rejected', moderationNote: 'Stale reject' },
        'admin-id'
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(repository.submissions[0]).toMatchObject({
      status: 'approved',
      createdProductId: 'created-product-id',
      moderationNote: null
    });
  });

  it('returns 404 for status updates on a missing submission', async () => {
    const { service } = createService(new FakeSubmissionRepository());

    await expect(
      service.updateStatus(
        '11111111-1111-4111-8111-111111111111',
        { status: 'rejected', moderationNote: 'Missing' },
        'admin-id'
      )
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  describe('approval racing a concurrent approval', () => {
    const approveBody = {
      barcode: '5449000000996',
      name: 'Cola',
      category: 'Soft Drinks',
      ingredients: []
    };

    function prismaError(code: string) {
      return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on Product_barcode_key', {
        code,
        clientVersion: '7.0.0',
        meta: { target: ['barcode'] }
      });
    }

    function setup(winnerApproves = true) {
      const repository = new FakeSubmissionRepository();
      repository.submissions = [
        createSubmission({ frontImageUrl: '/product-submissions/uploads/front.jpg' })
      ];
      const created = createService(repository);
      const commitWinner = () => {
        if (winnerApproves) {
          repository.submissions[0] = {
            ...repository.submissions[0]!,
            status: 'approved',
            createdProductId: 'winner-product-id'
          };
        }
      };
      return { commitWinner, ...created };
    }

    it('returns 409 when the product insert loses the barcode race (P2002)', async () => {
      const { service, productCreator, productImages, commitWinner } = setup();
      vi.spyOn(productCreator, 'create').mockImplementation(async () => {
        commitWinner();
        throw prismaError('P2002');
      });

      await expect(service.approve(
        '11111111-1111-4111-8111-111111111111', approveBody, 'admin-id'
      )).rejects.toMatchObject({ statusCode: 409, message: 'Submission is already approved' });
      expect(productImages.deleted).toEqual(['/uploads/products/copied-front.jpg']);
    });

    it('returns 409 when the guarded approval update matches nothing (P2025)', async () => {
      const { service, repository, productImages, commitWinner } = setup();
      vi.spyOn(repository, 'markApproved').mockImplementation(async () => {
        commitWinner();
        throw prismaError('P2025');
      });

      await expect(service.approve(
        '11111111-1111-4111-8111-111111111111', approveBody, 'admin-id'
      )).rejects.toMatchObject({ statusCode: 409, message: 'Submission is already approved' });
      expect(productImages.deleted).toEqual(['/uploads/products/copied-front.jpg']);
      expect(repository.submissions[0]!.createdProductId).toBe('winner-product-id');
    });

    it('returns 409 "Barcode already exists" when another product took the barcode', async () => {
      const { service, productCreator } = setup(false);
      vi.spyOn(productCreator, 'create').mockRejectedValue(prismaError('P2002'));

      await expect(service.approve(
        '11111111-1111-4111-8111-111111111111', approveBody, 'admin-id'
      )).rejects.toMatchObject({ statusCode: 409, message: 'Barcode already exists' });
    });

    it('returns 404 when the submission disappeared during approval', async () => {
      const { service, repository } = setup(false);
      vi.spyOn(repository, 'markApproved').mockImplementation(async () => {
        repository.submissions = [];
        throw prismaError('P2025');
      });

      await expect(service.approve(
        '11111111-1111-4111-8111-111111111111', approveBody, 'admin-id'
      )).rejects.toMatchObject({ statusCode: 404, message: 'Product submission not found' });
    });

    it('rethrows P2025 unchanged when the submission is still unapproved', async () => {
      const { service, repository } = setup(false);
      const failure = prismaError('P2025');
      vi.spyOn(repository, 'markApproved').mockRejectedValue(failure);

      await expect(service.approve(
        '11111111-1111-4111-8111-111111111111', approveBody, 'admin-id'
      )).rejects.toBe(failure);
    });

    it('rethrows other database errors unchanged', async () => {
      const { service, productCreator } = setup();
      const failure = prismaError('P2034');
      vi.spyOn(productCreator, 'create').mockRejectedValue(failure);

      await expect(service.approve(
        '11111111-1111-4111-8111-111111111111', approveBody, 'admin-id'
      )).rejects.toBe(failure);
    });
  });

  it('keeps returning 409 for repeated approval', async () => {
    const repository = new FakeSubmissionRepository();
    repository.submissions = [createSubmission({ status: 'approved' })];
    const { service, productCreator } = createService(repository);

    await expect(
      service.approve(
        '11111111-1111-4111-8111-111111111111',
        { barcode: '5449000000996', name: 'Cola', category: 'Soft Drinks', ingredients: [] },
        'admin-id'
      )
    ).rejects.toMatchObject({ statusCode: 409, message: 'Submission is already approved' });
    expect(productCreator.createdBody).toBeUndefined();
  });
});
