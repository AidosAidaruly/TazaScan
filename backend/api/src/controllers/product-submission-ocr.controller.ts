import type { RequestHandler } from 'express';
import { OcrService } from '../services/ocr.service';
import { SubmissionOcrService } from '../services/submission-ocr.service';
import { HttpError } from '../utils/http-error';

const submissionOcrService = new SubmissionOcrService(new OcrService());

export const recognizeSubmissionNutrition: RequestHandler = async (request, response) => {
  if (!request.file?.buffer) {
    throw new HttpError(400, 'Image is required');
  }

  const result = await submissionOcrService.recognizeNutrition(request.file.buffer);
  response.status(200).json({ data: result });
};

export const recognizeSubmissionIngredients: RequestHandler = async (request, response) => {
  if (!request.file?.buffer) {
    throw new HttpError(400, 'Image is required');
  }

  const result = await submissionOcrService.recognizeIngredients(request.file.buffer);
  response.status(200).json({ data: result });
};
