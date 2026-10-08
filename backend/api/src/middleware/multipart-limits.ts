import multer from 'multer';
import { HttpError } from '../utils/http-error';

export const maxUploadFileSize = 5 * 1024 * 1024;

// Shared non-file limits for every multipart endpoint. Real clients send at most 14 short
// text fields (mobile product submission) plus up to 4 files; photo search, OCR and admin
// image uploads send no text fields. `parts` is a backstop: fields + files stay below it.
export const multipartLimits = {
  fields: 30,
  fieldSize: 16 * 1024,
  fieldNameSize: 100,
  parts: 40,
  // Field names are flat; one level still allows `ingredients[]`.
  fieldNestingDepth: 1,
  fieldArrayIndexLimit: 30
};

const payloadTooLargeMessages: Record<string, string> = {
  LIMIT_FILE_SIZE: 'Image file is too large',
  LIMIT_FILE_COUNT: 'Too many files',
  LIMIT_FIELD_COUNT: 'Too many form fields',
  LIMIT_FIELD_VALUE: 'Form field is too large',
  LIMIT_FIELD_KEY: 'Form field name is too long',
  LIMIT_PART_COUNT: 'Too many multipart parts'
};

/**
 * Maps errors raised while parsing a multipart request to client-safe HTTP errors.
 * Raw Multer/busboy messages are never forwarded.
 */
export function toMultipartHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof multer.MulterError) {
    const message = payloadTooLargeMessages[error.code];
    return message
      ? new HttpError(413, message)
      : new HttpError(400, 'Invalid image upload');
  }

  // busboy parse failures (malformed body, missing boundary) and aborted requests.
  return new HttpError(400, 'Malformed multipart request');
}
