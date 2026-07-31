import type { Product } from '../generated/prisma/client';
import type { ListProductsQuery, ProductBody, UpdateProductBody } from '../schemas/product.schema';
import type { PaginatedResponse } from '../types/pagination';
import type { ProductDto } from '../types/product';
import { toProductDto } from '../types/product';
import { HttpError } from '../utils/http-error';

type ProductRepositoryContract = {
  list(filters: ListProductsQuery): Promise<[Product[], number]>;
  findById(id: string): Promise<Product | null>;
  findByBarcode(barcode: string): Promise<Product | null>;
  create(data: ProductBody): Promise<Product>;
  update(id: string, data: UpdateProductBody): Promise<Product>;
  delete(id: string): Promise<Product>;
};

export class ProductService {
  constructor(private readonly productRepository: ProductRepositoryContract) {}

  async list(filters: ListProductsQuery): Promise<PaginatedResponse<ProductDto>> {
    const [products, total] = await this.productRepository.list(filters);

    return {
      items: products.map(toProductDto),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize)
      }
    };
  }

  async getById(id: string) {
    const product = await this.productRepository.findById(id);

    if (!product) {
      throw new HttpError(404, 'Product not found');
    }

    return toProductDto(product);
  }

  async getByBarcode(barcode: string) {
    const product = await this.productRepository.findByBarcode(barcode);

    if (!product) {
      throw new HttpError(404, 'Product not found');
    }

    return toProductDto(product);
  }

  async create(data: ProductBody) {
    await this.ensureBarcodeAvailable(data.barcode);
    const product = await this.productRepository.create(data);

    return toProductDto(product);
  }

  async update(id: string, data: UpdateProductBody) {
    await this.ensureExists(id);

    if (data.barcode) {
      await this.ensureBarcodeAvailable(data.barcode, id);
    }

    const product = await this.productRepository.update(id, data);

    return toProductDto(product);
  }

  async delete(id: string) {
    await this.ensureExists(id);
    await this.productRepository.delete(id);
  }

  private async ensureExists(id: string) {
    const product = await this.productRepository.findById(id);

    if (!product) {
      throw new HttpError(404, 'Product not found');
    }
  }

  private async ensureBarcodeAvailable(barcode: string, currentProductId?: string) {
    const product = await this.productRepository.findByBarcode(barcode);

    if (product && product.id !== currentProductId) {
      throw new HttpError(409, 'Barcode already exists');
    }
  }
}
