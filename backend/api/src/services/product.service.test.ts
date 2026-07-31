import { describe, expect, it } from 'vitest';
import type { Product } from '../generated/prisma/client';
import type { ListProductsQuery } from '../schemas/product.schema';
import { productBodySchema } from '../schemas/product.schema';
import { ProductService } from './product.service';

const now = new Date('2026-07-31T00:00:00.000Z');

function createProduct(overrides: Partial<Product> = {}): Product {
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
    fiber: null,
    salt: 0,
    healthScore: 65,
    imageUrl: null,
    dataStatus: 'verified',
    source: 'test',
    lastVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createProductBody(overrides = {}) {
  return {
    barcode: '5449000000996',
    name: 'Coca-Cola Original Taste',
    brand: 'Coca-Cola',
    category: 'Soft Drinks',
    ingredients: ['Carbonated water', 'Sugar'],
    nutritionFacts: {
      servingType: 'per100ml',
      energyKcal: 42,
      protein: 0,
      carbohydrates: 10.6,
      sugars: 10.6,
      fat: 0,
      saturatedFat: 0,
      fiber: null,
      salt: 0
    },
    healthScore: 65,
    dataStatus: 'verified',
    ...overrides
  };
}

class FakeProductRepository {
  products: Product[] = [];
  deletedIds: string[] = [];
  lastListFilters: unknown;

  list(filters: ListProductsQuery) {
    this.lastListFilters = filters;
    const filteredProducts = this.products.filter((product) => {
      const matchesName =
        !filters.name ||
        product.name.toLowerCase().includes(filters.name.toLowerCase());
      const matchesBrand =
        !filters.brand ||
        product.brand?.toLowerCase().includes(filters.brand.toLowerCase());
      const matchesBarcode =
        !filters.barcode || product.barcode.includes(filters.barcode);

      return matchesName && matchesBrand && matchesBarcode;
    });
    const start = (filters.page - 1) * filters.pageSize;
    const items = filteredProducts.slice(start, start + filters.pageSize);

    return Promise.resolve<[Product[], number]>([items, filteredProducts.length]);
  }

  findById(id: string) {
    return Promise.resolve(this.products.find((product) => product.id === id) ?? null);
  }

  findByBarcode(barcode: string) {
    return Promise.resolve(
      this.products.find((product) => product.barcode === barcode) ?? null
    );
  }

  create(_data: unknown) {
    const product = createProduct();
    this.products.push(product);
    return Promise.resolve(product);
  }

  update(id: string, _data: unknown) {
    const product = createProduct({ id, name: 'Updated product' });
    this.products = this.products.map((item) => (item.id === id ? product : item));
    return Promise.resolve(product);
  }

  delete(id: string) {
    this.deletedIds.push(id);
    this.products = this.products.filter((product) => product.id !== id);
    return Promise.resolve(createProduct({ id }));
  }
}

function createService(repository = new FakeProductRepository()) {
  return {
    repository,
    service: new ProductService(repository)
  };
}

describe('ProductService', () => {
  it('creates a product', async () => {
    const { service } = createService();

    const product = await service.create(productBodySchema.parse(createProductBody()));

    expect(product.barcode).toBe('5449000000996');
    expect(product.nutritionFacts.sugars).toBe(10.6);
  });

  it('returns 409 for duplicate barcode', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct()];
    const { service } = createService(repository);

    await expect(
      service.create(productBodySchema.parse(createProductBody()))
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Barcode already exists'
    });
  });

  it('rejects invalid barcode through schema validation', () => {
    const result = productBodySchema.safeParse(
      createProductBody({ barcode: 'invalid-barcode' })
    );

    expect(result.success).toBe(false);
  });

  it('finds a product by ID', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct()];
    const { service } = createService(repository);

    const product = await service.getById('11111111-1111-4111-8111-111111111111');

    expect(product.name).toBe('Coca-Cola Original Taste');
  });

  it('updates a product', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct()];
    const { service } = createService(repository);

    const product = await service.update('11111111-1111-4111-8111-111111111111', {
      name: 'Updated product'
    });

    expect(product.name).toBe('Updated product');
  });

  it('deletes a product', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct()];
    const { service } = createService(repository);

    await service.delete('11111111-1111-4111-8111-111111111111');

    expect(repository.deletedIds).toContain('11111111-1111-4111-8111-111111111111');
  });

  it('returns pagination metadata', async () => {
    const repository = new FakeProductRepository();
    repository.products = [createProduct(), createProduct({ id: '22222222-2222-4222-8222-222222222222' })];
    const { service } = createService(repository);

    const result = await service.list({ page: 1, pageSize: 1 });

    expect(result.pagination.total).toBe(2);
    expect(result.pagination.totalPages).toBe(2);
  });

  it('searches products', async () => {
    const repository = new FakeProductRepository();
    repository.products = [
      createProduct(),
      createProduct({
        id: '22222222-2222-4222-8222-222222222222',
        barcode: '5901234123457',
        name: 'Plain Yogurt',
        brand: 'Dairy Co',
        category: 'Dairy'
      })
    ];
    const { service } = createService(repository);

    const result = await service.list({
      page: 1,
      pageSize: 20,
      name: 'cola',
      brand: 'coca'
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.barcode).toBe('5449000000996');
    expect(repository.lastListFilters).toMatchObject({
      name: 'cola',
      brand: 'coca'
    });
  });

  it('returns 404 for missing products', async () => {
    const { service } = createService();

    await expect(
      service.getById('11111111-1111-4111-8111-111111111111')
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Product not found'
    });
  });

  it('returns 404 when updating a missing product', async () => {
    const { service } = createService();

    await expect(
      service.update('11111111-1111-4111-8111-111111111111', {
        name: 'Updated product'
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Product not found'
    });
  });
});
