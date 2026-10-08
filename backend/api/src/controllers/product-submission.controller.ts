import type { RequestHandler } from 'express';
import { ProductRepository } from '../repositories/product.repository';
import { ProductSubmissionRepository } from '../repositories/product-submission.repository';
import {
  approveSubmissionBodySchema,
  type ListSubmissionsQuery,
  productSubmissionBodySchema,
  type UpdateSubmissionStatusBody
} from '../schemas/product-submission.schema';
import { NutriScoreEngine } from '../scoring/engines/nutri-score.engine';
import { ProductSubmissionService } from '../services/product-submission.service';
import { ProductService } from '../services/product.service';
import { HttpError } from '../utils/http-error';
import { requireParam } from '../utils/request';
import { discardSubmissionUploads, uploadedFileUrl } from '../middleware/submission-upload';

const productSubmissionService = new ProductSubmissionService(
  new ProductSubmissionRepository(),
  new ProductService(new ProductRepository(), new NutriScoreEngine())
);

export const listProductSubmissions: RequestHandler = async (_request, response) => {
  const query = response.locals.validated.query as ListSubmissionsQuery;
  const result = await productSubmissionService.list(query);

  response.status(200).json({
    data: result.items,
    pagination: result.pagination
  });
};

export const getProductSubmissionById: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  const submission = await productSubmissionService.getById(id);

  response.status(200).json({ data: submission });
};

export const createProductSubmission: RequestHandler = async (request, response) => {
  const discardUploads = () => discardSubmissionUploads(request);
  const parsedBody = productSubmissionBodySchema.safeParse(normalizeMultipartBody(request.body));
  if (!parsedBody.success) {
    await discardUploads();
    throw parsedBody.error;
  }

  const submission = await productSubmissionService.create(
    parsedBody.data,
    readImageUrls(request),
    discardUploads
  );

  response.status(201).json({ data: submission });
};

export const updateProductSubmissionStatus: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  const userId = request.user?.id;

  if (!userId) {
    throw new HttpError(401, 'Authentication required');
  }

  const submission = await productSubmissionService.updateStatus(
    id,
    request.body as UpdateSubmissionStatusBody,
    userId
  );

  response.status(200).json({ data: submission });
};

export const approveProductSubmission: RequestHandler = async (request, response) => {
  const id = requireParam(request, 'id');
  const userId = request.user?.id;

  if (!userId) {
    throw new HttpError(401, 'Authentication required');
  }

  const body = approveSubmissionBodySchema.parse(request.body);
  const submission = await productSubmissionService.approve(id, body, userId);

  response.status(201).json({ data: submission });
};

function readImageUrls(request: Parameters<RequestHandler>[0]) {
  const files = request.files as Record<string, Express.Multer.File[]> | undefined;

  return {
    frontImageUrl: uploadedFileUrl(files?.frontImage?.[0]),
    ingredientsImageUrl: uploadedFileUrl(files?.ingredientsImage?.[0]),
    nutritionImageUrl: uploadedFileUrl(files?.nutritionImage?.[0]),
    barcodeImageUrl: uploadedFileUrl(files?.barcodeImage?.[0])
  };
}

function normalizeMultipartBody(body: Record<string, unknown>) {
  return {
    ...Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, normalizeValue(value)])
    ),
    ingredients: normalizeIngredients(body.ingredients)
  };
}

function normalizeValue(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  return value;
}

function normalizeIngredients(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((ingredient) => ingredient.trim())
      .filter(Boolean);
  }

  return [];
}
