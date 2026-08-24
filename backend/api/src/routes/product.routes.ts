import { Router } from 'express';
import {
  clearProductHalalCertification,
  createProduct,
  deleteProduct,
  getProductByBarcode,
  getProductById,
  listProducts,
  previewProductScore,
  previewOfficialNutriScore,
  previewTazaScore,
  replaceProductHalalCertification,
  removeProductImage,
  uploadProductImage as uploadProductImageController,
  updateProduct
} from '../controllers/product.controller';
import { searchProductsByPhoto } from '../controllers/photo-search.controller';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/authenticate';
import { authorizeRole } from '../middleware/authorize-role';
import { uploadProductImage } from '../middleware/image-upload';
import { ocrRateLimit } from '../middleware/ocr-rate-limit';
import { validate } from '../middleware/validate';
import {
  barcodeParamsSchema,
  halalCertificationBodySchema,
  listProductsQuerySchema,
  officialNutriScorePreviewBodySchema,
  productBodySchema,
  productIdParamsSchema,
  tazaScorePreviewBodySchema,
  updateProductBodySchema
} from '../schemas/product.schema';

export const productRouter = Router();

productRouter.get(
  '/',
  validate(listProductsQuerySchema, 'query'),
  asyncHandler(listProducts)
);

productRouter.get(
  '/barcode/:barcode',
  validate(barcodeParamsSchema, 'params'),
  asyncHandler(getProductByBarcode)
);

productRouter.post(
  '/photo-search',
  ocrRateLimit,
  uploadProductImage,
  asyncHandler(searchProductsByPhoto)
);

productRouter.post(
  '/nutri-score-preview',
  authenticate,
  authorizeRole('admin'),
  validate(officialNutriScorePreviewBodySchema),
  asyncHandler(previewOfficialNutriScore)
);

productRouter.post(
  '/taza-score-preview',
  authenticate,
  authorizeRole('admin'),
  validate(tazaScorePreviewBodySchema),
  asyncHandler(previewTazaScore)
);

productRouter.get(
  '/:id/score-preview',
  validate(productIdParamsSchema, 'params'),
  asyncHandler(previewProductScore)
);

productRouter.get(
  '/:id',
  validate(productIdParamsSchema, 'params'),
  asyncHandler(getProductById)
);

productRouter.post(
  '/',
  authenticate,
  authorizeRole('admin'),
  validate(productBodySchema),
  asyncHandler(createProduct)
);

productRouter.post(
  '/:id/image',
  authenticate,
  authorizeRole('admin'),
  validate(productIdParamsSchema, 'params'),
  uploadProductImage,
  asyncHandler(uploadProductImageController)
);

productRouter.delete(
  '/:id/image',
  authenticate,
  authorizeRole('admin'),
  validate(productIdParamsSchema, 'params'),
  asyncHandler(removeProductImage)
);

productRouter.put(
  '/:id/halal-certification',
  authenticate,
  authorizeRole('admin'),
  validate(productIdParamsSchema, 'params'),
  validate(halalCertificationBodySchema),
  asyncHandler(replaceProductHalalCertification)
);

productRouter.delete(
  '/:id/halal-certification',
  authenticate,
  authorizeRole('admin'),
  validate(productIdParamsSchema, 'params'),
  asyncHandler(clearProductHalalCertification)
);

productRouter.put(
  '/:id',
  authenticate,
  authorizeRole('admin'),
  validate(productIdParamsSchema, 'params'),
  validate(updateProductBodySchema),
  asyncHandler(updateProduct)
);

productRouter.delete(
  '/:id',
  authenticate,
  authorizeRole('admin'),
  validate(productIdParamsSchema, 'params'),
  asyncHandler(deleteProduct)
);
