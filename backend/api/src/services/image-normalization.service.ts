import sharp from 'sharp';
import { HttpError } from '../utils/http-error';

const normalizedMimeType = 'image/jpeg';
const normalizedExtension = '.jpg';
const maxLongEdge = 2200;
const jpegQuality = 88;

// Decoded-size cap (width * height). 40 MP covers full-resolution 12-24 MP phone photos
// and admin uploads within the 5 MB file limit, while bounding decode memory
// (~120 MB RGB) against decompression bombs (tiny files declaring huge dimensions).
export const maxInputPixels = 40_000_000;

type AllowedImageFormat = 'jpeg' | 'png' | 'webp';

// The client MIME type is only a coarse pre-filter; the detected format is authoritative.
// application/octet-stream stays allowed because Flutter's http package sends
// MultipartFile.fromPath uploads with that type by default (all mobile uploads).
const uploadMimeTypes = new Set([
  'application/octet-stream',
  'image/jpeg',
  'image/png',
  'image/webp'
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

  // Sniff magic bytes before handing anything to libvips, so other decoders
  // (SVG/librsvg, HEIF/libheif, TIFF, GIF, ...) are never reached.
  const detectedFormat = detectImageFormat(buffer);
  if (!detectedFormat) {
    throw new HttpError(415, 'Unsupported image format');
  }

  try {
    // Header-only read; the pixel check below runs before any full decode.
    const metadata = await sharp(buffer, { failOn: 'error', limitInputPixels: false }).metadata();

    if (metadata.format !== detectedFormat || !metadata.width || !metadata.height) {
      throw new HttpError(415, 'Unreadable image');
    }

    if (metadata.width * metadata.height > maxInputPixels) {
      throw new HttpError(413, 'Image dimensions are too large');
    }

    const normalizedBuffer = await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: maxInputPixels
    })
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

function detectImageFormat(buffer: Buffer): AllowedImageFormat | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

export function normalizeImageUploadError(error: unknown) {
  if (error instanceof HttpError) {
    return error;
  }

  return new HttpError(415, 'Unreadable image');
}
