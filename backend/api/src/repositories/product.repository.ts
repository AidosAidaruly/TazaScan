import { prisma } from '../prisma/client';
import { wordPrefixFilter } from './product-search';
import type {
  HalalCertificationBody,
  ListProductsQuery,
  ProductBody,
  UpdateProductBody
} from '../schemas/product.schema';
import type { Prisma } from '../generated/prisma/client';
import type { ScoreResult } from '../scoring/types/score-result';
import type { ProductWithCanonicalFamily } from '../types/product';

const productWithCanonicalFamily = {
  canonicalProductFamily: {
    include: {
      canonicalProduct: true
    }
  },
  halalCertifications: true
} as const;

const productWithCanonicalFamilyOnly = {
  canonicalProductFamily: {
    include: {
      canonicalProduct: true
    }
  }
} as const;

export class ProductRepository {
  async list(filters: ListProductsQuery): Promise<[ProductWithCanonicalFamily[], number]> {
    const where = this.buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;

    try {
      return await prisma.$transaction([
        prisma.product.findMany({
          where,
          include: productWithCanonicalFamily,
          orderBy: { createdAt: 'desc' },
          skip,
          take: filters.pageSize
        }),
        prisma.product.count({ where })
      ]);
    } catch (error) {
      if (!isMissingHalalCertificationTableError(error)) {
        throw error;
      }

      const [products, count] = await prisma.$transaction([
        prisma.product.findMany({
          where,
          include: productWithCanonicalFamilyOnly,
          orderBy: { createdAt: 'desc' },
          skip,
          take: filters.pageSize
        }),
        prisma.product.count({ where })
      ]);

      return [withEmptyHalalCertifications(products), count];
    }
  }

  async findById(id: string): Promise<ProductWithCanonicalFamily | null> {
    try {
      return await prisma.product.findUnique({
        where: { id },
        include: productWithCanonicalFamily
      });
    } catch (error) {
      if (!isMissingHalalCertificationTableError(error)) {
        throw error;
      }

      const product = await prisma.product.findUnique({
        where: { id },
        include: productWithCanonicalFamilyOnly
      });

      return product ? withEmptyHalalCertification(product) : null;
    }
  }

  async findByBarcode(barcode: string): Promise<ProductWithCanonicalFamily | null> {
    try {
      return await prisma.product.findUnique({
        where: { barcode },
        include: productWithCanonicalFamily
      });
    } catch (error) {
      if (!isMissingHalalCertificationTableError(error)) {
        throw error;
      }

      const product = await prisma.product.findUnique({
        where: { barcode },
        include: productWithCanonicalFamilyOnly
      });

      return product ? withEmptyHalalCertification(product) : null;
    }
  }

  async searchByNameOrBrand(
    query: string,
    limit: number
  ): Promise<ProductWithCanonicalFamily[]> {
    const where = {
      OR: [
        wordPrefixFilter('name', query),
        wordPrefixFilter('brand', query)
      ]
    } satisfies Prisma.ProductWhereInput;

    try {
      return await prisma.product.findMany({
        where,
        include: productWithCanonicalFamily,
        orderBy: { updatedAt: 'desc' },
        take: limit
      });
    } catch (error) {
      if (!isMissingHalalCertificationTableError(error)) {
        throw error;
      }

      const products = await prisma.product.findMany({
        where,
        include: productWithCanonicalFamilyOnly,
        orderBy: { updatedAt: 'desc' },
        take: limit
      });

      return withEmptyHalalCertifications(products);
    }
  }

  create(data: ProductBody, scoreResult: ScoreResult, transaction: Prisma.TransactionClient = prisma) {
    const productData: Prisma.ProductCreateInput = {
      ...this.toCreatePrismaData(data),
      ...this.toScorePrismaData(scoreResult)
    };

    return transaction.product.create({
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

  updateImageUrl(id: string, imageUrl: string | null) {
    return prisma.product.update({
      where: { id },
      data: { imageUrl }
    });
  }

  delete(id: string) {
    return prisma.product.delete({
      where: { id }
    });
  }

  async replaceHalalCertification(productId: string, data: HalalCertificationBody) {
    await prisma.productHalalCertification.deleteMany({
      where: { productId }
    });

    return prisma.productHalalCertification.create({
      data: {
        productId,
        status: data.status,
        issuer: data.issuer,
        certificateNumber: data.certificateNumber ?? null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        source: data.source,
        evidenceUrl: data.evidenceUrl ?? null,
        verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : null
      }
    });
  }

  async clearHalalCertification(productId: string) {
    await prisma.productHalalCertification.deleteMany({
      where: { productId }
    });
  }

  private buildWhere(filters: ListProductsQuery): Prisma.ProductWhereInput {
    return {
      ...(filters.q
        ? {
            OR: [
              wordPrefixFilter('name', filters.q),
              wordPrefixFilter('brand', filters.q),
              { barcode: { contains: filters.q } }
            ]
          }
        : {}),
      AND: [
        ...(filters.name ? [wordPrefixFilter('name', filters.name)] : []),
        ...(filters.brand ? [wordPrefixFilter('brand', filters.brand)] : [])
      ],
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
    this.assignDefined(productData, 'ingredientsTextOriginal', data.ingredientsTextOriginal);
    this.assignDefined(
      productData,
      'ingredientsTextOriginalLanguage',
      data.ingredientsTextOriginalLanguage
    );
    this.assignDefined(productData, 'ingredientsTextRu', data.ingredientsTextRu);
    this.assignDefined(productData, 'ingredientsTextTranslatedRu', data.ingredientsTextTranslatedRu);
    this.assignDefined(productData, 'ingredientsTranslationSource', data.ingredientsTranslationSource);
    this.assignDefined(
      productData,
      'ingredientsTranslatedAt',
      data.ingredientsTranslatedAt ? new Date(data.ingredientsTranslatedAt) : data.ingredientsTranslatedAt
    );
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
    this.assignDefined(productData, 'officialNutriScoreCategory', data.officialNutriScoreCategory);
    this.assignDefined(productData, 'fruitVegetableLegumePercent', data.fruitVegetableLegumePercent);
    this.assignDefined(productData, 'containsNonSugarSweeteners', data.containsNonSugarSweeteners);
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
    this.assignDefined(productData, 'ingredientsTextOriginal', data.ingredientsTextOriginal);
    this.assignDefined(
      productData,
      'ingredientsTextOriginalLanguage',
      data.ingredientsTextOriginalLanguage
    );
    this.assignDefined(productData, 'ingredientsTextRu', data.ingredientsTextRu);
    this.assignDefined(productData, 'ingredientsTextTranslatedRu', data.ingredientsTextTranslatedRu);
    this.assignDefined(productData, 'ingredientsTranslationSource', data.ingredientsTranslationSource);
    this.assignDefined(
      productData,
      'ingredientsTranslatedAt',
      data.ingredientsTranslatedAt ? new Date(data.ingredientsTranslatedAt) : data.ingredientsTranslatedAt
    );
    this.assignDefined(productData, 'manualScoreOverride', data.manualScoreOverride);
    this.assignDefined(
      productData,
      'manualOverrideReason',
      data.manualOverrideReason
    );
    this.assignDefined(productData, 'officialNutriScoreCategory', data.officialNutriScoreCategory);
    this.assignDefined(productData, 'fruitVegetableLegumePercent', data.fruitVegetableLegumePercent);
    this.assignDefined(productData, 'containsNonSugarSweeteners', data.containsNonSugarSweeteners);
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

function withEmptyHalalCertifications<T extends object>(
  products: T[]
): Array<T & { halalCertifications: [] }> {
  return products.map(withEmptyHalalCertification);
}

function withEmptyHalalCertification<T extends object>(
  product: T
): T & { halalCertifications: [] } {
  return {
    ...product,
    halalCertifications: []
  };
}

function isMissingHalalCertificationTableError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    String(error.message).includes('product_halal_certifications')
  );
}
