import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalFileStorage } from './local-file-storage';

describe('LocalFileStorage', () => {
  let tempRoot: string;
  let storage: LocalFileStorage;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tazascan-storage-'));
    storage = new LocalFileStorage(tempRoot);
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('saves a product image and returns a compatible key and URL', async () => {
    const stored = await storage.save({
      scope: 'products',
      buffer: Buffer.from('normalized image'),
      contentType: 'image/jpeg'
    });

    expect(stored.key).toMatch(/^products\/[a-f0-9-]+\.jpg$/);
    expect(stored.url).toMatch(/^\/uploads\/products\/[a-f0-9-]+\.jpg$/);
    expect(stored.contentType).toBe('image/jpeg');
    expect(stored.size).toBe(Buffer.byteLength('normalized image'));
    await expect(fs.stat(path.join(tempRoot, stored.key))).resolves.toBeTruthy();
  });

  it('saves submission images under the submission URL namespace', async () => {
    const stored = await storage.save({
      scope: 'submissions',
      buffer: Buffer.from('submission image'),
      contentType: 'image/jpeg'
    });

    expect(stored.key).toMatch(/^submissions\/[a-f0-9-]+\.jpg$/);
    expect(stored.url).toMatch(
      /^\/product-submissions\/uploads\/[a-f0-9-]+\.jpg$/
    );
  });

  it('does not resolve path traversal URLs', () => {
    expect(
      storage.resolveLocalPathFromUrl('/uploads/products/../secret.jpg')
    ).toBeNull();
    expect(
      storage.resolveLocalPathFromUrl('/product-submissions/uploads/../secret.jpg')
    ).toBeNull();
  });

  it('deletes stored files by URL and ignores missing files', async () => {
    const stored = await storage.save({
      scope: 'products',
      buffer: Buffer.from('image'),
      contentType: 'image/jpeg'
    });
    const absolutePath = path.join(tempRoot, stored.key);

    await storage.deleteByUrl(stored.url);
    await storage.deleteByUrl(stored.url);

    await expect(fs.stat(absolutePath)).rejects.toMatchObject({
      code: 'ENOENT'
    });
  });

  it('keeps existing local URL compatibility', () => {
    const localPath = storage.resolveLocalPathFromUrl(
      '/uploads/products/existing.jpg'
    );

    expect(localPath).toBe(path.join(tempRoot, 'products', 'existing.jpg'));
  });
});
