import type { RequestHandler } from 'express';
import multer from 'multer';
import {
  acceptsImageMimeType,
  normalizeImageBuffer
} from '../services/image-normalization.service';
import { HttpError } from '../utils/http-error';
import { maxUploadFileSize, multipartLimits, toMultipartHttpError } from './multipart-limits';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    ...multipartLimits,
    fileSize: maxUploadFileSize
  },
  fileFilter: (_request, file, callback) => {
    if (!acceptsImageMimeType(file.mimetype)) {
      callback(new HttpError(415, 'Unsupported image format'));
      return;
    }

    callback(null, true);
  }
});

export const uploadProductImage: RequestHandler = (request, response, next) => {
  upload.single('image')(request, response, (error: unknown) => {
    if (error) {
      next(toMultipartHttpError(error));
      return;
    }

    if (request.file && request.file.size === 0) {
      next(new HttpError(400, 'Product image is required'));
      return;
    }

    if (!request.file) {
      next();
      return;
    }

    normalizeImageBuffer(request.file.buffer)
      .then((image) => {
        request.file!.buffer = image.buffer;
        request.file!.mimetype = image.mimetype;
        request.file!.size = image.size;
        request.file!.filename = `${request.file!.filename ?? 'image'}${image.extension}`;
        next();
      })
      .catch(next);
  });
};
