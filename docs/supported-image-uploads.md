# Supported image uploads

TazaScan normalizes consumer image uploads on the backend before OCR, photo
search, submission storage, or product image storage.

## Direct upload inputs

The upload middleware accepts these image MIME types for decoder validation:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/heic`
- `image/heif`
- `image/avif`

Some pickers send modern phone images as `application/octet-stream` or without a
MIME type. Those uploads are allowed to reach decoder validation, but they are
not trusted as images.

The MIME type is not trusted as proof that the file is valid. The uploaded bytes
must be decodable by the runtime image processor.

## Normalization

Uploaded images are decoded with `sharp`, auto-rotated using image metadata,
resized with `fit: inside`, and converted to JPEG.

Current processing target:

- output format: JPEG
- max long edge: 2200 px
- JPEG quality: 88
- no upscaling for small images

This keeps OCR/photo-search input predictable while preserving enough resolution
for package and nutrition-label text.

## Shared pipeline

The same normalization path is used for:

- Photo Search
- unknown-barcode submission front photo
- submission nutrition OCR photo
- submission ingredients OCR photo
- submission barcode photo
- admin product image upload

## Errors

Invalid or undecodable image bytes return a safe upload error. Mobile maps that
to a user-facing Russian message:

```text
Не удалось открыть изображение. Попробуйте выбрать другое фото.
```

Oversized images remain separate:

```text
Фото слишком большое.
```

## Limits

Existing upload size and image-count limits remain unchanged. External image
formats are supported only when the installed `sharp`/libvips runtime can decode
them.
