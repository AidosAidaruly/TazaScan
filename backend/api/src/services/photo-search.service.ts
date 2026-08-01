import type { Product } from '../generated/prisma/client';
import type { PhotoSearchResponseDto } from '../types/photo-search';
import { toProductDto } from '../types/product';

type ProductRepositoryContract = {
  searchByNameOrBrand(query: string, limit: number): Promise<Product[]>;
};

type OcrServiceContract = {
  extractText(imageBuffer: Buffer): Promise<string>;
};

const noMatchesMessage = 'No matching products found';
const maxMatches = 10;

export class PhotoSearchService {
  constructor(
    private readonly ocrService: OcrServiceContract,
    private readonly productRepository: ProductRepositoryContract
  ) {}

  async search(imageBuffer: Buffer): Promise<PhotoSearchResponseDto> {
    const text = await this.ocrService.extractText(imageBuffer);
    const query = this.extractProbableProductName(text);

    if (!query) {
      return {
        query: null,
        message: noMatchesMessage,
        matches: []
      };
    }

    const products = await this.productRepository.searchByNameOrBrand(
      query,
      maxMatches
    );
    const matches = products
      .map((product) => ({
        ...toProductDto(product),
        matchScore: this.scoreProduct(product, query)
      }))
      .sort((left, right) => right.matchScore - left.matchScore);

    return {
      query,
      message: matches.length === 0 ? noMatchesMessage : null,
      matches
    };
  }

  private extractProbableProductName(text: string): string | null {
    const lines = text
      .split(/\r?\n/)
      .map((line) => this.normalizeSearchText(line))
      .filter((line) => line.length >= 3 && !this.isNoiseLine(line));

    return lines.sort((left, right) => right.length - left.length)[0] ?? null;
  }

  private scoreProduct(product: Product, query: string): number {
    const normalizedQuery = this.normalizeSearchText(query);
    const normalizedName = this.normalizeSearchText(product.name);
    const normalizedBrand = this.normalizeSearchText(product.brand ?? '');
    let score = 0;

    if (normalizedName === normalizedQuery) score += 100;
    if (normalizedName.includes(normalizedQuery)) score += 70;
    if (normalizedBrand && normalizedQuery.includes(normalizedBrand)) score += 20;

    const queryWords = normalizedQuery.split(' ');
    const nameWords = new Set(normalizedName.split(' '));
    score += queryWords.filter((word) => nameWords.has(word)).length * 8;

    return score;
  }

  private normalizeSearchText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-zа-яёәғқңөұүһі0-9\s-]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isNoiseLine(line: string): boolean {
    return /^\d+$/.test(line) || line.includes('kcal') || line.includes('barcode');
  }
}
