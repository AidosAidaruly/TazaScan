import type { RequestHandler } from 'express';
import { ProductRepository } from '../repositories/product.repository';
import type {
  HalalCertificationBody,
  ListProductsQuery,
  OfficialNutriScorePreviewBody,
  ProductBody,
  TazaScorePreviewBody,
  UpdateProductBody
} from '../schemas/product.schema';
import { NutriScoreEngine } from '../scoring/engines/nutri-score.engine';
import { ProductService } from '../services/product.service';
import { requireParam } from '../utils/request';

const productService = new ProductService(new ProductRepository(), new NutriScoreEngine());

export const listProducts: RequestHandler = async (_request, response) => {
  const query = response.locals.validated.query as ListProductsQuery;
  const result = await productService.list(query);

  response.status(200).json({
    data: result.items,
    pagination: result.pagination
  });
};

export const getProductById: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  const product = await productService.getById(id);

  response.status(200).json({
    data: product
  });
};

export const getProductByBarcode: RequestHandler = async (request, response) => {
  const barcode = requireParam(request, 'barcode');
  const product = await productService.getByBarcode(barcode);

  response.status(200).json({
    data: product
  });
};

export const previewProductScore: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  const result = await productService.previewProductScore(id);

  response.status(200).json({
    data: result
  });
};

export const createProduct: RequestHandler = async (request, response) => {
  const product = await productService.create(request.body as ProductBody);

  response.status(201).json({
    data: product
  });
};

export const previewOfficialNutriScore: RequestHandler = async (request, response) => {
  const result = productService.previewOfficialNutriScore(
    request.body as OfficialNutriScorePreviewBody
  );

  response.status(200).json({
    data: result
  });
};

export const previewTazaScore: RequestHandler = async (request, response) => {
  const result = productService.previewTazaScore(request.body as TazaScorePreviewBody);

  response.status(200).json({
    data: result
  });
};

export const updateProduct: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  const product = await productService.update(id, request.body as UpdateProductBody);

  response.status(200).json({
    data: product
  });
};

export const uploadProductImage: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  const product = await productService.uploadImage(id, request.file);

  response.status(200).json({
    data: product
  });
};

export const removeProductImage: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  const product = await productService.removeImage(id);

  response.status(200).json({
    data: product
  });
};

export const replaceProductHalalCertification: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  const product = await productService.replaceHalalCertification(
    id,
    request.body as HalalCertificationBody
  );

  response.status(200).json({
    data: product
  });
};

export const clearProductHalalCertification: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  const product = await productService.clearHalalCertification(id);

  response.status(200).json({
    data: product
  });
};

export const deleteProduct: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  await productService.delete(id);

  response.status(204).send();
};
