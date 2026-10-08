import zlib from 'node:zlib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  acceptsImageMimeType,
  maxInputPixels,
  normalizeImageBuffer
} from './image-normalization.service';

describe('image normalization service', () => {
  it('accepts JPEG, PNG and WebP MIME types', () => {
    expect(acceptsImageMimeType('image/jpeg')).toBe(true);
    expect(acceptsImageMimeType('image/png')).toBe(true);
    expect(acceptsImageMimeType('image/webp')).toBe(true);
  });

  it('rejects HEIC, HEIF, AVIF and other non-required MIME types', () => {
    expect(acceptsImageMimeType('image/heic')).toBe(false);
    expect(acceptsImageMimeType('image/heif')).toBe(false);
    expect(acceptsImageMimeType('image/avif')).toBe(false);
    expect(acceptsImageMimeType('image/gif')).toBe(false);
    expect(acceptsImageMimeType('image/svg+xml')).toBe(false);
    expect(acceptsImageMimeType('text/plain')).toBe(false);
  });

  it('allows application/octet-stream (Flutter default) but not an empty MIME type', () => {
    expect(acceptsImageMimeType('application/octet-stream')).toBe(true);
    expect(acceptsImageMimeType('')).toBe(false);
  });

  it('normalizes PNG to JPEG without trusting the extension', async () => {
    const input = await createImage(320, 180, 'png');
    const output = await normalizeImageBuffer(input);
    const metadata = await sharp(output.buffer).metadata();

    expect(output.mimetype).toBe('image/jpeg');
    expect(output.extension).toBe('.jpg');
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(180);
  });

  it('normalizes WebP to JPEG', async () => {
    const input = await createImage(180, 120, 'webp');
    const output = await normalizeImageBuffer(input);
    const metadata = await sharp(output.buffer).metadata();

    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(180);
    expect(metadata.height).toBe(120);
  });

  it('rejects AVIF even when the runtime decoder supports it', async () => {
    const input = await createOptionalImage(120, 80, 'avif');
    if (!input) {
      return;
    }

    await expect(normalizeImageBuffer(input)).rejects.toMatchObject({
      statusCode: 415,
      message: 'Unsupported image format'
    });
  });

  it('rejects content that is not a supported image signature', async () => {
    await expect(normalizeImageBuffer(Buffer.from('not an image'))).rejects.toMatchObject({
      statusCode: 415,
      message: 'Unsupported image format'
    });
  });

  it('resizes huge images to the maximum long edge', async () => {
    const input = await createImage(3200, 1600, 'jpeg');
    const output = await normalizeImageBuffer(input);
    const metadata = await sharp(output.buffer).metadata();

    expect(metadata.width).toBe(2200);
    expect(metadata.height).toBe(1100);
  });

  it('does not upscale small images', async () => {
    const input = await createImage(80, 40, 'jpeg');
    const output = await normalizeImageBuffer(input);
    const metadata = await sharp(output.buffer).metadata();

    expect(metadata.width).toBe(80);
    expect(metadata.height).toBe(40);
  });

  it('accepts a valid JPEG', async () => {
    const input = await createImage(640, 480, 'jpeg');
    const output = await normalizeImageBuffer(input);

    expect(output.mimetype).toBe('image/jpeg');
    expect(output.inputFormat).toBe('jpeg');
    expect(output.width).toBe(640);
    expect(output.height).toBe(480);
  });

  it('accepts a valid PNG and reports its detected input format', async () => {
    const output = await normalizeImageBuffer(await createImage(64, 48, 'png'));

    expect(output.mimetype).toBe('image/jpeg');
    expect(output.inputFormat).toBe('png');
  });

  describe('unsupported formats', () => {
    it.each(['gif', 'tiff'] as const)('rejects %s even though Sharp can decode it', async (format) => {
      const input = await createImage(32, 32, format);

      await expect(normalizeImageBuffer(input)).rejects.toMatchObject({
        statusCode: 415,
        message: 'Unsupported image format'
      });
    });

    it('rejects SVG without passing it to the SVG decoder', async () => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32"/></svg>'
      );

      await expect(normalizeImageBuffer(svg)).rejects.toMatchObject({
        statusCode: 415,
        message: 'Unsupported image format'
      });
    });
  });

  describe('corrupt images', () => {
    it('rejects a PNG signature followed by garbage', async () => {
      const corrupt = Buffer.concat([pngSignature, Buffer.from('garbage-instead-of-chunks')]);

      await expect(normalizeImageBuffer(corrupt)).rejects.toMatchObject({
        statusCode: 415,
        message: 'Unreadable image'
      });
    });

    it('rejects a truncated JPEG', async () => {
      const jpeg = await createImage(320, 240, 'jpeg');

      await expect(normalizeImageBuffer(jpeg.subarray(0, 64))).rejects.toMatchObject({
        statusCode: 415,
        message: 'Unreadable image'
      });
    });

    it('does not expose internal decoder errors', async () => {
      const corrupt = Buffer.concat([pngSignature, Buffer.from('garbage-instead-of-chunks')]);
      const error = await normalizeImageBuffer(corrupt).catch((caught: unknown) => caught);

      expect(error).toMatchObject({ message: 'Unreadable image' });
      expect(String((error as { details?: unknown }).details ?? '')).toBe('');
    });
  });

  describe('pixel limit', () => {
    it('rejects a tiny file that declares huge dimensions (decompression bomb)', async () => {
      const bomb = createPngBomb(20_000, 20_000);
      expect(bomb.length).toBeLessThan(100);

      await expect(normalizeImageBuffer(bomb)).rejects.toMatchObject({
        statusCode: 413,
        message: 'Image dimensions are too large'
      });
    });

    it('rejects images just above the pixel limit', async () => {
      const side = Math.ceil(Math.sqrt(maxInputPixels)) + 1;
      expect(side * side).toBeGreaterThan(maxInputPixels);

      await expect(normalizeImageBuffer(createPngBomb(side, side))).rejects.toMatchObject({
        statusCode: 413
      });
    });

    it('lets dimensions at the pixel limit through to decoding', async () => {
      // 8000 x 5000 = exactly the limit: passes the dimension check, then fails decoding
      // because the pixel data is truncated (proves the 413 above came from the pixel check).
      expect(8000 * 5000).toBe(maxInputPixels);

      await expect(normalizeImageBuffer(createPngBomb(8000, 5000))).rejects.toMatchObject({
        statusCode: 415,
        message: 'Unreadable image'
      });
    });
  });
});

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Decompression-bomb style PNG: valid IHDR declaring the given size plus a tiny compressed
// IDAT (far less data than the header promises) and IEND. Under 100 bytes for any size.
function createPngBomb(width: number, height: number) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB

  return Buffer.concat([
    pngSignature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.alloc(4096))),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function pngChunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type, 'latin1');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBytes, data])), 0);

  return Buffer.concat([length, typeBytes, data, crc]);
}

async function createImage(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'tiff'
) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#2bc4d9'
    }
  })
    .toFormat(format)
    .toBuffer();
}

async function createOptionalImage(
  width: number,
  height: number,
  format: 'avif'
) {
  try {
    return await createImage(width, height, format);
  } catch {
    return null;
  }
}
