import { prisma } from '../prisma/client';
import type { ListProductsQuery, ProductBody, UpdateProductBody } from '../schemas/product.schema';
import type { Prisma } from '../generated/prisma/client';

export class ProductRepository {
  list(filters: ListProductsQuery) {
    const where = this.buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;

    return prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.pageSize
      }),
      prisma.product.count({ where })
    ]);
  }

  findById(id: string) {
    return prisma.product.findUnique({
      where: { id }
    });
  }

  findByBarcode(barcode: string) {
    return prisma.product.findUnique({
      where: { barcode }
    });
  }

  create(data: ProductBody) {
    return prisma.product.create({
      data: this.toPrismaData(data)
    });
  }

  update(id: string, data: UpdateProductBody) {
    return prisma.product.update({
      where: { id },
      data: this.toPrismaData(data)
    });
  }

  delete(id: string) {
    return prisma.product.delete({
      where: { id }
    });
  }

  private buildWhere(filters: ListProductsQuery): Prisma.ProductWhereInput {
    return {
      ...(filters.name
        ? { name: { contains: filters.name, mode: 'insensitive' } }
        : {}),
      ...(filters.brand
        ? { brand: { contains: filters.brand, mode: 'insensitive' } }
        : {}),
      ...(filters.barcode
        ? { barcode: { contains: filters.barcode } }
        : {})
    };
  }

  private toPrismaData(data: ProductBody): Prisma.ProductCreateInput;
  private toPrismaData(data: UpdateProductBody): Prisma.ProductUpdateInput;
  private toPrismaData(data: ProductBody | UpdateProductBody) {
    const nutritionFacts = data.nutritionFacts;
    const productData: Prisma.ProductUpdateInput = {};

    this.assignDefined(productData, 'barcode', data.barcode);
    this.assignDefined(productData, 'name', data.name);
    this.assignDefined(productData, 'brand', data.brand);
    this.assignDefined(productData, 'category', data.category);
    this.assignDefined(productData, 'ingredients', data.ingredients);
    this.assignDefined(productData, 'healthScore', data.healthScore);
    this.assignDefined(productData, 'imageUrl', data.imageUrl);
    this.assignDefined(productData, 'dataStatus', data.dataStatus);
    this.assignDefined(productData, 'source', data.source);
    this.assignDefined(
      productData,
      'lastVerifiedAt',
      data.lastVerifiedAt ? new Date(data.lastVerifiedAt) : data.lastVerifiedAt
    );

    if (nutritionFacts) {
      this.assignDefined(productData, 'servingType', nutritionFacts.servingType);
      this.assignDefined(productData, 'energyKcal', nutritionFacts.energyKcal);
      this.assignDefined(productData, 'protein', nutritionFacts.protein);
      this.assignDefined(productData, 'carbohydrates', nutritionFacts.carbohydrates);
      this.assignDefined(productData, 'sugars', nutritionFacts.sugars);
      this.assignDefined(productData, 'fat', nutritionFacts.fat);
      this.assignDefined(productData, 'saturatedFat', nutritionFacts.saturatedFat);
      this.assignDefined(productData, 'fiber', nutritionFacts.fiber);
      this.assignDefined(productData, 'salt', nutritionFacts.salt);
    }

    return productData;
  }

  private assignDefined<T extends object, K extends keyof T>(
    target: T,
    key: K,
    value: T[K] | undefined
  ) {
    if (value !== undefined) {
      target[key] = value;
    }
  }
}
