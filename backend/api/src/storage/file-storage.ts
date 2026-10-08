export type FileStorageScope = 'products' | 'submissions';

export type SaveFileInput = {
  scope: FileStorageScope;
  buffer: Buffer;
  contentType: string;
};

export type StoredFile = {
  key: string;
  url: string;
  contentType: string;
  size: number;
};

export type DeleteFileOptions = {
  /** Only delete when the URL belongs to this scope; URLs from other scopes are ignored. */
  scope?: FileStorageScope;
};

export interface FileStorage {
  readonly driver: string;
  save(input: SaveFileInput): Promise<StoredFile>;
  /**
   * Copies the file behind `sourceUrl` (any known scope) into `targetScope` as a new,
   * independently owned file. Returns null when the source does not exist.
   */
  copyByUrl(sourceUrl: string, targetScope: FileStorageScope): Promise<StoredFile | null>;
  deleteByUrl(url: string | null | undefined, options?: DeleteFileOptions): Promise<void>;
  getPublicUrl(key: string): string | null;
  /** Scope a stored-file URL belongs to, or null for unknown/external URLs. */
  scopeOfUrl(url: string | null | undefined): FileStorageScope | null;
}
