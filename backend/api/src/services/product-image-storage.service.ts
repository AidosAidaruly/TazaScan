import type { FileStorage, StoredFile } from '../storage/file-storage';
import { fileStorage, getLocalFileStorage } from '../storage/storage-provider';
import { HttpError } from '../utils/http-error';

const mimeExtensions = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

export type StoredProductImage = {
  imageUrl: string;
  key: string;
  contentType: string;
  size: number;
};

export async function ensureProductImageUploadDirectory() {
  await getLocalFileStorage().ensureDirectories();
}

export class ProductImageStorageService {
  constructor(private readonly storage: FileStorage = fileStorage) {}

  async store(file: Express.Multer.File | undefined): Promise<StoredProductImage> {
    if (!file || file.size === 0 || file.buffer.length === 0) {
      throw new HttpError(400, 'Product image is required');
    }

    if (!mimeExtensions.has(file.mimetype)) {
      throw new HttpError(415, 'Unsupported image format');
    }

    const storedFile = await this.storage.save({
      scope: 'products',
      buffer: file.buffer,
      contentType: file.mimetype
    });

    return this.toStoredProductImage(storedFile);
  }

  /**
   * Copies an approved submission's image into the public products scope and returns the
   * new product image URL. The submission file is left untouched as moderation evidence.
   * Returns null when the URL is not a submission image or the evidence file is missing.
   */
  async copySubmissionImage(submissionImageUrl: string | null | undefined): Promise<string | null> {
    if (!submissionImageUrl || this.storage.scopeOfUrl(submissionImageUrl) !== 'submissions') {
      return null;
    }

    const copied = await this.storage.copyByUrl(submissionImageUrl, 'products');
    return copied?.url ?? null;
  }

  /**
   * Deletes a product image. Only product-scoped files are ever deleted; submission
   * evidence and external URLs are ignored.
   */
  async deleteImage(imageUrl: string | null | undefined) {
    await this.storage.deleteByUrl(imageUrl, { scope: 'products' });
  }

  async deleteLocalImage(imageUrl: string | null | undefined) {
    await this.deleteImage(imageUrl);
  }

  isLocalProductImage(imageUrl: string | null | undefined) {
    return getLocalFileStorage().scopeOfUrl(imageUrl) === 'products';
  }

  private toStoredProductImage(storedFile: StoredFile): StoredProductImage {
    return {
      imageUrl: storedFile.url,
      key: storedFile.key,
      contentType: storedFile.contentType,
      size: storedFile.size
    };
  }
}
