import { Router } from 'express';
import {
  createProduct,
  deleteProduct,
  getProductByBarcode,
  getProductById,
  listProducts,
  updateProduct
} from '../controllers/product.controller';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/authenticate';
import { authorizeRole } from '../middleware/authorize-role';
import { validate } from '../middleware/validate';
import {
  barcodeParamsSchema,
  listProductsQuerySchema,
  productBodySchema,
  productIdParamsSchema,
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
