import { Router } from 'express';
import {
  recognizeSubmissionIngredients,
  recognizeSubmissionNutrition
} from '../controllers/product-submission-ocr.controller';
import {
  approveProductSubmission,
  createProductSubmission,
  getProductSubmissionById,
  listProductSubmissions,
  updateProductSubmissionStatus
} from '../controllers/product-submission.controller';
import { getSubmissionUpload } from '../controllers/submission-upload.controller';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/authenticate';
import { authorizeRole } from '../middleware/authorize-role';
import { uploadProductImage } from '../middleware/image-upload';
import {
  ingredientsOcrRateLimit,
  nutritionOcrRateLimit
} from '../middleware/ocr-rate-limit';
import { submissionRateLimit } from '../middleware/submission-rate-limit';
import { uploadSubmissionImages } from '../middleware/submission-upload';
import { validate } from '../middleware/validate';
import {
  listSubmissionsQuerySchema,
  submissionIdParamsSchema,
  updateSubmissionStatusBodySchema
} from '../schemas/product-submission.schema';

export const productSubmissionRouter = Router();

productSubmissionRouter.post(
  '/ocr/nutrition',
  nutritionOcrRateLimit,
  uploadProductImage,
  asyncHandler(recognizeSubmissionNutrition)
);

productSubmissionRouter.post(
  '/ocr/ingredients',
  ingredientsOcrRateLimit,
  uploadProductImage,
  asyncHandler(recognizeSubmissionIngredients)
);

productSubmissionRouter.post(
  '/',
  submissionRateLimit,
  uploadSubmissionImages,
  asyncHandler(createProductSubmission)
);

productSubmissionRouter.get(
  '/',
  authenticate,
  authorizeRole('admin'),
  validate(listSubmissionsQuerySchema, 'query'),
  asyncHandler(listProductSubmissions)
);

productSubmissionRouter.get(
  '/uploads/:filename',
  authenticate,
  authorizeRole('admin'),
  asyncHandler(getSubmissionUpload)
);

productSubmissionRouter.get(
  '/:id',
  authenticate,
  authorizeRole('admin'),
  validate(submissionIdParamsSchema, 'params'),
  asyncHandler(getProductSubmissionById)
);

productSubmissionRouter.put(
  '/:id/status',
  authenticate,
  authorizeRole('admin'),
  validate(submissionIdParamsSchema, 'params'),
  validate(updateSubmissionStatusBodySchema),
  asyncHandler(updateProductSubmissionStatus)
);

productSubmissionRouter.post(
  '/:id/approve',
  authenticate,
  authorizeRole('admin'),
  validate(submissionIdParamsSchema, 'params'),
  asyncHandler(approveProductSubmission)
);
