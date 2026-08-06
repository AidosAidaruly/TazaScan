import type { RequestHandler } from 'express';
import { ProductRepository } from '../repositories/product.repository';
import type { ListProductsQuery, ProductBody, UpdateProductBody } from '../schemas/product.schema';
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

export const createProduct: RequestHandler = async (request, response) => {
  const product = await productService.create(request.body as ProductBody);

  response.status(201).json({
    data: product
  });
};

export const updateProduct: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  const product = await productService.update(id, request.body as UpdateProductBody);

  response.status(200).json({
    data: product
  });
};

export const deleteProduct: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  await productService.delete(id);

  response.status(204).send();
};
