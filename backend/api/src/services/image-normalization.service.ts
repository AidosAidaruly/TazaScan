import sharp from 'sharp';
import { HttpError } from '../utils/http-error';

const normalizedMimeType = 'image/jpeg';
const normalizedExtension = '.jpg';
const maxLongEdge = 2200;
const jpegQuality = 88;

const uploadMimeTypes = new Set([
  '',
  'application/octet-stream',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif'
]);

export type NormalizedImage = {
  buffer: Buffer;
  mimetype: typeof normalizedMimeType;
  extension: typeof normalizedExtension;
  size: number;
  width?: number;
  height?: number;
  inputFormat?: string;
};

export function acceptsImageMimeType(mimetype: string) {
  return uploadMimeTypes.has(mimetype.toLowerCase());
}

export async function normalizeImageBuffer(buffer: Buffer): Promise<NormalizedImage> {
  if (buffer.length === 0) {
    throw new HttpError(400, 'Image is required');
  }

  try {
    const input = sharp(buffer, { failOn: 'error' });
    const metadata = await input.metadata();

    if (!metadata.format || !metadata.width || !metadata.height) {
      throw new HttpError(415, 'Unreadable image');
    }

    const normalizedBuffer = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({
        width: maxLongEdge,
        height: maxLongEdge,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: jpegQuality,
        mozjpeg: true
      })
      .toBuffer();

    const normalizedMetadata = await sharp(normalizedBuffer).metadata();

    return {
      buffer: normalizedBuffer,
      mimetype: normalizedMimeType,
      extension: normalizedExtension,
      size: normalizedBuffer.length,
      width: normalizedMetadata.width,
      height: normalizedMetadata.height,
      inputFormat: metadata.format
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(415, 'Unreadable image');
  }
}

export function normalizeImageUploadError(error: unknown) {
  if (error instanceof HttpError) {
    return error;
  }

  return new HttpError(415, 'Unreadable image');
}
