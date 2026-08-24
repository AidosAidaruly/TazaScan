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

export interface FileStorage {
  readonly driver: string;
  save(input: SaveFileInput): Promise<StoredFile>;
  deleteByUrl(url: string | null | undefined): Promise<void>;
  getPublicUrl(key: string): string | null;
}
