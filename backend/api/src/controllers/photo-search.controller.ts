import type { RequestHandler } from 'express';
import { ProductRepository } from '../repositories/product.repository';
import { OcrService } from '../services/ocr.service';
import { PhotoSearchService } from '../services/photo-search.service';
import { HttpError } from '../utils/http-error';

const photoSearchService = new PhotoSearchService(
  new OcrService(),
  new ProductRepository()
);

export const searchProductsByPhoto: RequestHandler = async (request, response) => {
  if (!request.file?.buffer) {
    throw new HttpError(400, 'Image is required');
  }

  const result = await photoSearchService.search(request.file.buffer);

  response.status(200).json({
    data: result.matches,
    query: result.query,
    message: result.message
  });
};
