import type { Request, RequestHandler } from 'express';
import path from 'node:path';
import multer from 'multer';
import {
  acceptsImageMimeType,
  normalizeImageBuffer
} from '../services/image-normalization.service';
import { fileStorage } from '../storage/storage-provider';
import { HttpError } from '../utils/http-error';
import { maxUploadFileSize, multipartLimits, toMultipartHttpError } from './multipart-limits';

type StoredSubmissionFile = Express.Multer.File & {
  storageKey?: string;
  storageUrl?: string;
};

// Submission files persisted by each in-flight request (stored URLs, not client input).
const requestOwnedUploads = new WeakMap<Request, string[]>();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    ...multipartLimits,
    fileSize: maxUploadFileSize,
    files: 4
  },
  fileFilter: (_request, file, callback) => {
    if (!acceptsImageMimeType(file.mimetype)) {
      callback(new HttpError(415, 'Unsupported image format'));
      return;
    }

    callback(null, true);
  }
});

export const uploadSubmissionImages: RequestHandler = (request, response, next) => {
  upload.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'ingredientsImage', maxCount: 1 },
    { name: 'nutritionImage', maxCount: 1 },
    { name: 'barcodeImage', maxCount: 1 }
  ])(request, response, (error: unknown) => {
    if (error) {
      next(toMultipartHttpError(error));
      return;
    }

    normalizeAndPersistSubmissionFiles(request)
      .then(() => next())
      .catch(next);
  });
};

export function uploadedFileUrl(file?: Express.Multer.File) {
  if (!file) {
    return null;
  }

  const storedFile = file as StoredSubmissionFile;
  if (storedFile.storageUrl) {
    return storedFile.storageUrl;
  }

  return `/product-submissions/uploads/${path.basename(file.filename)}`;
}

/**
 * Deletes the submission files persisted by this request, and only those. Used when the
 * request fails before a ProductSubmission references them. Never throws: one failed
 * deletion does not stop the others, and the caller's original error is preserved.
 */
export async function discardSubmissionUploads(request: Request) {
  const ownedUrls = requestOwnedUploads.get(request);
  requestOwnedUploads.delete(request);

  if (!ownedUrls || ownedUrls.length === 0) {
    return;
  }

  try {
    const results = await Promise.allSettled(
      ownedUrls.map((url) => fileStorage.deleteByUrl(url, { scope: 'submissions' }))
    );
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );

    if (failures.length > 0) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'submission_upload_cleanup_failed',
        failed: failures.length,
        total: ownedUrls.length,
        codes: failures.map((failure) => errorCode(failure.reason))
      }));
    }
  } catch {
    // Cleanup is best effort and must never replace the request's real error.
  }
}

async function normalizeAndPersistSubmissionFiles(request: Request) {
  const files = request.files as
    | Record<string, Express.Multer.File[]>
    | undefined;

  if (!files) {
    return;
  }

  const uploads = Object.values(files).flat();

  // Normalize every image in memory first: if any image is rejected, nothing is written.
  const images = [];
  for (const file of uploads) {
    images.push(await normalizeImageBuffer(file.buffer));
  }

  // Every file saved from here on is owned by this request until a submission row
  // references it; failed requests discard exactly these files.
  const ownedUrls: string[] = [];
  requestOwnedUploads.set(request, ownedUrls);

  try {
    for (const [index, file] of uploads.entries()) {
      const image = images[index]!;
      const storedFile = await fileStorage.save({
        scope: 'submissions',
        buffer: image.buffer,
        contentType: image.mimetype
      });
      ownedUrls.push(storedFile.url);

      file.buffer = image.buffer;
      file.mimetype = image.mimetype;
      file.size = image.size;
      file.filename = path.basename(storedFile.url);
      file.path = storedFile.key;
      file.destination = 'submissions';
      (file as StoredSubmissionFile).storageKey = storedFile.key;
      (file as StoredSubmissionFile).storageUrl = storedFile.url;
    }
  } catch (error) {
    await discardSubmissionUploads(request);
    throw error;
  }
}

function errorCode(error: unknown) {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return typeof code === 'string' ? code : 'unknown';
}
