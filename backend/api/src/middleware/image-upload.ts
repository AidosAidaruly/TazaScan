import type { RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from '../utils/http-error';

const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    if (!supportedMimeTypes.has(file.mimetype)) {
      callback(new HttpError(415, 'Unsupported image format'));
      return;
    }

    callback(null, true);
  }
});

export const uploadProductImage: RequestHandler = (request, response, next) => {
  upload.single('image')(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(new HttpError(413, 'Image file is too large', error.message));
        return;
      }

      next(new HttpError(400, 'Invalid image upload', error.message));
      return;
    }

    if (error) {
      next(error);
      return;
    }

    if (request.file && request.file.size === 0) {
      next(new HttpError(400, 'Product image is required'));
      return;
    }

    next();
  });
};
