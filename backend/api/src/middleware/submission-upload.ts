import type { Request, RequestHandler } from 'express';
import path from 'node:path';
import multer from 'multer';
import {
  acceptsImageMimeType,
  normalizeImageBuffer
} from '../services/image-normalization.service';
import { fileStorage } from '../storage/storage-provider';
import { HttpError } from '../utils/http-error';
import { maxUploadFileSize, multipartLimits, toMultipartHttpError } from './multipart-limits';

type StoredSubmissionFile = Express.Multer.File & {
  storageKey?: string;
  storageUrl?: string;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    ...multipartLimits,
    fileSize: maxUploadFileSize,
    files: 4
  },
  fileFilter: (_request, file, callback) => {
    if (!acceptsImageMimeType(file.mimetype)) {
      callback(new HttpError(415, 'Unsupported image format'));
      return;
    }

    callback(null, true);
  }
});

export const uploadSubmissionImages: RequestHandler = (request, response, next) => {
  upload.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'ingredientsImage', maxCount: 1 },
    { name: 'nutritionImage', maxCount: 1 },
    { name: 'barcodeImage', maxCount: 1 }
  ])(request, response, (error: unknown) => {
    if (error) {
      next(toMultipartHttpError(error));
      return;
    }

    normalizeAndPersistSubmissionFiles(request)
      .then(() => next())
      .catch(next);
  });
};

export function uploadedFileUrl(file?: Express.Multer.File) {
  if (!file) {
    return null;
  }

  const storedFile = file as StoredSubmissionFile;
  if (storedFile.storageUrl) {
    return storedFile.storageUrl;
  }

  return `/product-submissions/uploads/${path.basename(file.filename)}`;
}

async function normalizeAndPersistSubmissionFiles(request: Request) {
  const files = request.files as
    | Record<string, Express.Multer.File[]>
    | undefined;

  if (!files) {
    return;
  }

  for (const fileList of Object.values(files)) {
    for (const file of fileList) {
      const image = await normalizeImageBuffer(file.buffer);
      const storedFile = await fileStorage.save({
        scope: 'submissions',
        buffer: image.buffer,
        contentType: image.mimetype
      });

      file.buffer = image.buffer;
      file.mimetype = image.mimetype;
      file.size = image.size;
      file.filename = path.basename(storedFile.url);
      file.path = storedFile.key;
      file.destination = 'submissions';
      (file as StoredSubmissionFile).storageKey = storedFile.key;
      (file as StoredSubmissionFile).storageUrl = storedFile.url;
    }
  }
}
