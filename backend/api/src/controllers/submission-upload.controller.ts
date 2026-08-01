import type { RequestHandler } from 'express';
import path from 'node:path';
import { HttpError } from '../utils/http-error';

const uploadRoot = path.resolve(process.cwd(), 'uploads', 'submissions');

export const getSubmissionUpload: RequestHandler = (request, response) => {
  const filename = request.params.filename;

  if (typeof filename !== 'string' || !/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)) {
    throw new HttpError(400, 'Invalid upload filename');
  }

  response.sendFile(path.join(uploadRoot, filename));
};
