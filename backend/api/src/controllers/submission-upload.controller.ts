import type { RequestHandler } from 'express';
import { getLocalFileStorage } from '../storage/storage-provider';
import { HttpError } from '../utils/http-error';

// Errors `send` reports when the file does not exist (it maps these to status 404).
const notFoundCodes = new Set(['ENOENT', 'ENOTDIR', 'ENAMETOOLONG']);

function isFileNotFound(error: Error) {
  const { status, statusCode, code } = error as Error & {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
  };

  return status === 404 || statusCode === 404 || (typeof code === 'string' && notFoundCodes.has(code));
}

export const getSubmissionUpload: RequestHandler = (request, response, next) => {
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

  response.sendFile(localPath, (error) => {
    if (!error) {
      return;
    }

    // Already streaming: the response cannot be replaced; `send` ends it.
    if (response.headersSent) {
      return;
    }

    // A missing evidence file is an expected 404, not a server fault. Any other failure
    // (permissions, I/O) stays a real error for the central handler (generic 500 + log).
    next(isFileNotFound(error) ? new HttpError(404, 'Submission image not found') : error);
  });
};
