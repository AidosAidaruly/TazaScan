import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError } from '../utils/http-error';

const uploadRoot = path.resolve(process.cwd(), 'uploads', 'products');
const publicUploadPath = '/uploads/products';

// MVP local storage. Production should move product images to persistent object storage.
const mimeExtensions = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

export type StoredProductImage = {
  imageUrl: string;
  absolutePath: string;
};

export async function ensureProductImageUploadDirectory() {
  await fs.mkdir(uploadRoot, { recursive: true });
}

export class ProductImageStorageService {
  async store(file: Express.Multer.File | undefined): Promise<StoredProductImage> {
    if (!file || file.size === 0 || file.buffer.length === 0) {
      throw new HttpError(400, 'Product image is required');
    }

    const extension = mimeExtensions.get(file.mimetype);

    if (!extension) {
      throw new HttpError(415, 'Unsupported image format');
    }

    await ensureProductImageUploadDirectory();

    const filename = `${randomUUID()}.${extension}`;
    const tempPath = path.join(uploadRoot, `${filename}.tmp`);
    const absolutePath = path.join(uploadRoot, filename);

    try {
      await fs.writeFile(tempPath, file.buffer, { flag: 'wx' });
      await fs.rename(tempPath, absolutePath);
    } catch (error) {
      await this.deletePath(tempPath);
      throw error;
    }

    return {
      imageUrl: `${publicUploadPath}/${filename}`,
      absolutePath
    };
  }

  async deleteLocalImage(imageUrl: string | null | undefined) {
    const absolutePath = this.toLocalPath(imageUrl);

    if (!absolutePath) {
      return;
    }

    await this.deletePath(absolutePath);
  }

  isLocalProductImage(imageUrl: string | null | undefined) {
    return this.toLocalPath(imageUrl) !== null;
  }

  private toLocalPath(imageUrl: string | null | undefined) {
    if (!imageUrl || !imageUrl.startsWith(`${publicUploadPath}/`)) {
      return null;
    }

    const filename = path.basename(imageUrl);

    if (filename !== imageUrl.slice(`${publicUploadPath}/`.length)) {
      return null;
    }

    return path.join(uploadRoot, filename);
  }

  private async deletePath(absolutePath: string) {
    await fs.rm(absolutePath, { force: true });
  }
}
