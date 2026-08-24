import type { RequestHandler } from 'express';
import { getLocalFileStorage } from '../storage/storage-provider';
import { HttpError } from '../utils/http-error';

export const getSubmissionUpload: RequestHandler = (request, response) => {
  const filename = request.params.filename;

  if (typeof filename !== 'string' || !/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)) {
    throw new HttpError(400, 'Invalid upload filename');
  }

  const localPath = getLocalFileStorage().resolveLocalPathFromUrl(
    `/product-submissions/uploads/${filename}`
  );

  if (!localPath) {
    throw new HttpError(400, 'Invalid upload filename');
  }

  response.sendFile(localPath);
};
