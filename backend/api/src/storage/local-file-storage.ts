import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  FileStorage,
  FileStorageScope,
  SaveFileInput,
  StoredFile
} from './file-storage';

const scopePublicPaths: Record<FileStorageScope, string> = {
  products: '/uploads/products',
  submissions: '/product-submissions/uploads'
};

const mimeExtensions = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

export class LocalFileStorage implements FileStorage {
  readonly driver = 'local';

  constructor(private readonly uploadRoot: string) {}

  async save(input: SaveFileInput): Promise<StoredFile> {
    const extension = this.extensionFor(input.contentType);
    const filename = `${randomUUID()}.${extension}`;
    const key = `${input.scope}/${filename}`;
    const directory = this.scopeDirectory(input.scope);
    const tempPath = path.join(directory, `${filename}.tmp`);
    const absolutePath = path.join(directory, filename);

    await fs.mkdir(directory, { recursive: true });

    try {
      await fs.writeFile(tempPath, input.buffer, { flag: 'wx' });
      await fs.rename(tempPath, absolutePath);
    } catch (error) {
      await this.deletePath(tempPath);
      throw error;
    }

    return {
      key,
      url: this.getPublicUrl(key) ?? '',
      contentType: input.contentType,
      size: input.buffer.length
    };
  }

  async deleteByUrl(url: string | null | undefined) {
    const absolutePath = this.resolveLocalPathFromUrl(url);

    if (!absolutePath) {
      return;
    }

    await this.deletePath(absolutePath);
  }

  getPublicUrl(key: string) {
    const parsed = this.parseKey(key);

    if (!parsed) {
      return null;
    }

    return `${scopePublicPaths[parsed.scope]}/${parsed.filename}`;
  }

  resolveLocalPathFromUrl(url: string | null | undefined) {
    if (!url) {
      return null;
    }

    for (const [scope, publicPath] of Object.entries(scopePublicPaths) as Array<
      [FileStorageScope, string]
    >) {
      if (!url.startsWith(`${publicPath}/`)) {
        continue;
      }

      const filename = url.slice(`${publicPath}/`.length);
      if (filename !== path.basename(filename)) {
        return null;
      }

      return path.join(this.scopeDirectory(scope), filename);
    }

    return null;
  }

  async ensureDirectories() {
    await Promise.all(
      (Object.keys(scopePublicPaths) as FileStorageScope[]).map((scope) =>
        fs.mkdir(this.scopeDirectory(scope), { recursive: true })
      )
    );
  }

  getDirectory(scope: FileStorageScope) {
    return this.scopeDirectory(scope);
  }

  private scopeDirectory(scope: FileStorageScope) {
    return path.resolve(this.uploadRoot, scope);
  }

  private parseKey(key: string): { scope: FileStorageScope; filename: string } | null {
    const [scope, filename, ...rest] = key.split('/');

    if (
      rest.length > 0 ||
      (scope !== 'products' && scope !== 'submissions') ||
      !filename ||
      filename !== path.basename(filename)
    ) {
      return null;
    }

    return {
      scope,
      filename
    };
  }

  private extensionFor(contentType: string) {
    const extension = mimeExtensions.get(contentType);

    if (!extension) {
      throw new Error(`Unsupported storage content type: ${contentType}`);
    }

    return extension;
  }

  private async deletePath(absolutePath: string) {
    await fs.rm(absolutePath, { force: true });
  }
}
