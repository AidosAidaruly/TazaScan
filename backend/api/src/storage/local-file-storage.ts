import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  DeleteFileOptions,
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

const extensionMimeTypes = new Map(
  [...mimeExtensions].map(([contentType, extension]) => [extension, contentType])
);

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

  async copyByUrl(sourceUrl: string, targetScope: FileStorageScope): Promise<StoredFile | null> {
    const parsed = this.parseUrl(sourceUrl);
    if (!parsed) {
      return null;
    }

    const contentType = extensionMimeTypes.get(path.extname(parsed.filename).slice(1).toLowerCase());
    if (!contentType) {
      return null;
    }

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(path.join(this.scopeDirectory(parsed.scope), parsed.filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }

    return this.save({ scope: targetScope, buffer, contentType });
  }

  async deleteByUrl(url: string | null | undefined, options: DeleteFileOptions = {}) {
    const parsed = this.parseUrl(url);

    if (!parsed || (options.scope && parsed.scope !== options.scope)) {
      return;
    }

    await this.deletePath(path.join(this.scopeDirectory(parsed.scope), parsed.filename));
  }

  scopeOfUrl(url: string | null | undefined): FileStorageScope | null {
    return this.parseUrl(url)?.scope ?? null;
  }

  getPublicUrl(key: string) {
    const parsed = this.parseKey(key);

    if (!parsed) {
      return null;
    }

    return `${scopePublicPaths[parsed.scope]}/${parsed.filename}`;
  }

  resolveLocalPathFromUrl(url: string | null | undefined) {
    const parsed = this.parseUrl(url);

    return parsed ? path.join(this.scopeDirectory(parsed.scope), parsed.filename) : null;
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

  private parseUrl(
    url: string | null | undefined
  ): { scope: FileStorageScope; filename: string } | null {
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
      if (
        !filename ||
        filename === '.' ||
        filename === '..' ||
        filename !== path.basename(filename)
      ) {
        return null;
      }

      return { scope, filename };
    }

    return null;
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
