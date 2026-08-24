# Image Storage

TazaScan now routes persistent uploaded images through a backend storage abstraction.

## Current Implementation

```text
Product/Submission upload
  -> multer memory upload
  -> image normalization with sharp
  -> FileStorage
  -> LocalFileStorage
```

The current implemented provider is local filesystem storage:

- product images: `UPLOAD_ROOT/products`
- submission review images: `UPLOAD_ROOT/submissions`
- product URLs remain compatible with `/uploads/products/...`
- submission URLs remain compatible with `/product-submissions/uploads/...`

The database still stores `imageUrl` for compatibility. The storage layer returns both a stable internal `key` and a public/review URL, but no Prisma migration was added in this phase.

## Configuration

```text
STORAGE_DRIVER=local
UPLOAD_ROOT=uploads
ALLOW_LOCAL_PRODUCTION_STORAGE=false
```

Development defaults to local storage.

In production, local storage is blocked unless:

```text
ALLOW_LOCAL_PRODUCTION_STORAGE=true
```

Only set this when the host provides a persistent disk and that disk is included in backups.

## Object Storage Boundary

`STORAGE_DRIVER=s3` is reserved for a future S3-compatible implementation. It intentionally fails today with a clear startup error instead of silently pretending object storage is configured.

Future object storage should support:

- S3-compatible storage, Supabase Storage, Cloudflare R2, or another blob provider.
- public product images.
- private or signed submission review images.
- safe delete by object key.
- migration/backfill of existing `/uploads/...` files.

## Product Images

Product image upload flow:

```text
multipart image
  -> normalize
  -> storage.save(scope: products)
  -> Product.imageUrl
```

When a product image is replaced, the old stored local image is deleted after the database update succeeds. External image URLs are ignored by local deletion.

## Submission Images

Submission photo flow:

```text
front / ingredients / nutrition / barcode image
  -> normalize
  -> storage.save(scope: submissions)
  -> ProductSubmission image URL
```

Admin review still reads submission images through the existing authenticated route:

```text
/product-submissions/uploads/:filename
```

## OCR

OCR continues to read the normalized upload buffer directly. It does not need to download the stored image again.

## Approval Flow

When a submission is approved, the existing front image URL can become the product image URL. The current MVP reuses the reference instead of copying the object.

This avoids duplicate storage. Future private-submission storage may need an explicit promote/copy operation before approval.

## Deletion And Orphans

The current policy is conservative:

- delete replaced product images when safe.
- do not aggressively delete submission files during normal moderation changes.
- prefer harmless orphan retention over accidental data loss.

A later maintenance script can clean unreferenced local/object files after reference checks.
