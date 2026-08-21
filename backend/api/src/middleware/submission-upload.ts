import type { Request, RequestHandler } from 'express';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import {
  acceptsImageMimeType,
  normalizeImageBuffer
} from '../services/image-normalization.service';
import { HttpError } from '../utils/http-error';

const uploadRoot = path.resolve(process.cwd(), 'uploads', 'submissions');
const normalizedExtension = '.jpg';

fs.mkdirSync(uploadRoot, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
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
    if (error instanceof multer.MulterError) {
      next(new HttpError(400, 'Invalid image upload', error.message));
      return;
    }

    if (error) {
      next(error);
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

  return `/product-submissions/uploads/${path.basename(file.filename)}`;
}

async function normalizeAndPersistSubmissionFiles(request: Request) {
  const files = request.files as
    | Record<string, Express.Multer.File[]>
    | undefined;

  if (!files) {
    return;
  }

  await fsPromises.mkdir(uploadRoot, { recursive: true });

  for (const fileList of Object.values(files)) {
    for (const file of fileList) {
      const image = await normalizeImageBuffer(file.buffer);
      const filename = `${crypto.randomUUID()}${normalizedExtension}`;
      const tempPath = path.join(uploadRoot, `${filename}.tmp`);
      const absolutePath = path.join(uploadRoot, filename);

      await fsPromises.writeFile(tempPath, image.buffer, { flag: 'wx' });
      await fsPromises.rename(tempPath, absolutePath);

      file.buffer = image.buffer;
      file.mimetype = image.mimetype;
      file.size = image.size;
      file.filename = filename;
      file.path = absolutePath;
      file.destination = uploadRoot;
    }
  }
}
