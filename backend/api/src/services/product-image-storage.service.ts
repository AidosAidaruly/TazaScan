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

  async deleteImage(imageUrl: string | null | undefined) {
    await this.storage.deleteByUrl(imageUrl);
  }

  async deleteLocalImage(imageUrl: string | null | undefined) {
    await this.deleteImage(imageUrl);
  }

  isLocalProductImage(imageUrl: string | null | undefined) {
    return getLocalFileStorage().resolveLocalPathFromUrl(imageUrl) !== null;
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
