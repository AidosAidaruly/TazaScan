import type { RequestHandler } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { HttpError } from '../utils/http-error';

const uploadRoot = path.resolve(process.cwd(), 'uploads', 'submissions');
const supportedMimeTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, uploadRoot);
  },
  filename: (_request, file, callback) => {
    const extension = supportedMimeTypes.get(file.mimetype);
    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 4
  },
  fileFilter: (_request, file, callback) => {
    if (!supportedMimeTypes.has(file.mimetype)) {
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

    next(error);
  });
};

export function uploadedFileUrl(file?: Express.Multer.File) {
  if (!file) {
    return null;
  }

  return `/product-submissions/uploads/${path.basename(file.filename)}`;
}
