import path from 'node:path';
import { env } from '../config/env';
import type { FileStorage } from './file-storage';
import { LocalFileStorage } from './local-file-storage';

const localStorage = new LocalFileStorage(path.resolve(process.cwd(), env.uploadRoot));

export function validateStorageConfiguration() {
  if (env.storageDriver === 'local' && env.NODE_ENV === 'production') {
    if (!env.allowLocalProductionStorage) {
      throw new Error(
        'Local production storage requires a persistent disk. Set ALLOW_LOCAL_PRODUCTION_STORAGE=true only if the deployment provides persistent storage.'
      );
    }
  }

  if (env.storageDriver === 's3') {
    throw new Error(
      'STORAGE_DRIVER=s3 is reserved for a future object storage provider and is not implemented yet.'
    );
  }
}

export function createFileStorage(): FileStorage {
  validateStorageConfiguration();

  return localStorage;
}

export function getLocalFileStorage() {
  return localStorage;
}

export const fileStorage = createFileStorage();
