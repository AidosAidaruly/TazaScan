import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  acceptsImageMimeType,
  normalizeImageBuffer
} from './image-normalization.service';

describe('image normalization service', () => {
  it('accepts JPEG, PNG and WebP MIME types', () => {
    expect(acceptsImageMimeType('image/jpeg')).toBe(true);
    expect(acceptsImageMimeType('image/png')).toBe(true);
    expect(acceptsImageMimeType('image/webp')).toBe(true);
  });

  it('allows HEIC, HEIF and AVIF uploads for decoder validation', () => {
    expect(acceptsImageMimeType('image/heic')).toBe(true);
    expect(acceptsImageMimeType('image/heif')).toBe(true);
    expect(acceptsImageMimeType('image/avif')).toBe(true);
  });

  it('allows generic binary uploads so content validation can decide', () => {
    expect(acceptsImageMimeType('application/octet-stream')).toBe(true);
    expect(acceptsImageMimeType('')).toBe(true);
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

  it('normalizes AVIF to JPEG when runtime decoder supports it', async () => {
    const input = await createOptionalImage(120, 80, 'avif');
    if (!input) {
      return;
    }

    const output = await normalizeImageBuffer(input);
    const metadata = await sharp(output.buffer).metadata();

    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(120);
    expect(metadata.height).toBe(80);
  });

  it('rejects invalid binary content safely', async () => {
    await expect(normalizeImageBuffer(Buffer.from('not an image'))).rejects.toMatchObject({
      statusCode: 415,
      message: 'Unreadable image'
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
});

async function createImage(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp' | 'avif'
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
