import { prisma } from '../prisma/client';
import type { ListProductsQuery, ProductBody, UpdateProductBody } from '../schemas/product.schema';
import type { Prisma } from '../generated/prisma/client';
import type { ScoreResult } from '../scoring/types/score-result';

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

  searchByNameOrBrand(query: string, limit: number) {
    return prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { brand: { contains: query, mode: 'insensitive' } }
        ]
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    });
  }

  create(data: ProductBody, scoreResult: ScoreResult) {
    const productData: Prisma.ProductCreateInput = {
      ...this.toCreatePrismaData(data),
      ...this.toScorePrismaData(scoreResult)
    };

    return prisma.product.create({
      data: productData
    });
  }

  update(id: string, data: UpdateProductBody, scoreResult: ScoreResult) {
    const productData: Prisma.ProductUpdateInput = {
      ...this.toUpdatePrismaData(data),
      ...this.toScorePrismaData(scoreResult)
    };

    return prisma.product.update({
      where: { id },
      data: productData
    });
  }

  delete(id: string) {
    return prisma.product.delete({
      where: { id }
    });
  }

  private buildWhere(filters: ListProductsQuery): Prisma.ProductWhereInput {
    return {
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: 'insensitive' } },
              { brand: { contains: filters.q, mode: 'insensitive' } },
              { barcode: { contains: filters.q } }
            ]
          }
        : {}),
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

  private toCreatePrismaData(data: ProductBody): Prisma.ProductCreateInput {
    const productData: Prisma.ProductCreateInput = {
      barcode: data.barcode,
      name: data.name,
      category: data.category,
      ingredients: data.ingredients,
      servingType: data.nutritionFacts.servingType,
      dataStatus: data.dataStatus
    };

    this.assignDefined(productData, 'brand', data.brand);
    this.assignDefined(productData, 'energyKcal', data.nutritionFacts.energyKcal);
    this.assignDefined(productData, 'protein', data.nutritionFacts.protein);
    this.assignDefined(productData, 'carbohydrates', data.nutritionFacts.carbohydrates);
    this.assignDefined(productData, 'sugars', data.nutritionFacts.sugars);
    this.assignDefined(productData, 'fat', data.nutritionFacts.fat);
    this.assignDefined(productData, 'saturatedFat', data.nutritionFacts.saturatedFat);
    this.assignDefined(productData, 'fiber', data.nutritionFacts.fiber);
    this.assignDefined(productData, 'salt', data.nutritionFacts.salt);
    this.assignDefined(productData, 'manualScoreOverride', data.manualScoreOverride);
    this.assignDefined(productData, 'manualOverrideReason', data.manualOverrideReason);
    this.assignDefined(productData, 'imageUrl', data.imageUrl);
    this.assignDefined(productData, 'source', data.source);
    this.assignDefined(
      productData,
      'lastVerifiedAt',
      data.lastVerifiedAt ? new Date(data.lastVerifiedAt) : data.lastVerifiedAt
    );

    if (data.manualScoreOverride !== undefined || data.manualOverrideReason !== undefined) {
      productData.manualOverrideAt = data.manualScoreOverride === null ? null : new Date();
    }

    return productData;
  }

  private toUpdatePrismaData(data: UpdateProductBody): Prisma.ProductUpdateInput {
    return this.toPrismaData(data);
  }

  private toPrismaData(data: ProductBody | UpdateProductBody): Prisma.ProductUpdateInput {
    const nutritionFacts = data.nutritionFacts;
    const productData: Prisma.ProductUpdateInput = {};

    this.assignDefined(productData, 'barcode', data.barcode);
    this.assignDefined(productData, 'name', data.name);
    this.assignDefined(productData, 'brand', data.brand);
    this.assignDefined(productData, 'category', data.category);
    this.assignDefined(productData, 'ingredients', data.ingredients);
    this.assignDefined(productData, 'manualScoreOverride', data.manualScoreOverride);
    this.assignDefined(
      productData,
      'manualOverrideReason',
      data.manualOverrideReason
    );
    if (data.manualScoreOverride !== undefined || data.manualOverrideReason !== undefined) {
      productData.manualOverrideAt = data.manualScoreOverride === null ? null : new Date();
    }
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

  private toScorePrismaData(scoreResult: ScoreResult) {
    return {
      calculatedScore: scoreResult.score,
      calculatedGrade: scoreResult.grade,
      scoreStatus: scoreResult.status,
      scoreAlgorithm: scoreResult.algorithm,
      scoreVersion: scoreResult.algorithmVersion,
      scoreCalculatedAt: new Date(scoreResult.calculatedAt),
      scoreDetails: scoreResult,
      healthScore: scoreResult.score ?? 0
    };
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
