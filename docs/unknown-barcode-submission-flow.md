# Unknown Barcode Submission Flow

This MVP flow lets a user submit a product when scanning a supported barcode that is not yet in TazaScan.

## Consumer Flow

1. Scanner reads an EAN/UPC barcode.
2. Mobile app calls the existing product lookup by barcode.
3. If the backend returns `404`, the app shows:
   - `Товар не найден`
   - `Этого штрихкода пока нет в нашей базе.`
   - action: `Добавить товар`
4. The submission screen opens with the scanned barcode prefilled.
5. For unknown-barcode submissions, the front package photo is required.
6. Nutrition and ingredients photos are encouraged, but nutrition fields may remain unknown.

Unknown nutrition values must stay unknown. They must not be converted to `0`.

## OCR-Assisted Submission

OCR is a helper inside the existing pending-submission flow:

```text
nutrition photo
-> OCR
-> parse candidate
-> auto-fill editable fields
-> user confirmation
-> admin approval
```

```text
ingredients photo
-> OCR
-> raw text candidate
-> auto-fill editable ingredients text
-> user confirmation
-> admin approval
```

OCR candidates are not authoritative:

- OCR does not create a `Product`.
- OCR does not approve a submission.
- OCR does not mark data as verified.
- OCR missing values remain `null`/empty.
- OCR explicit printed `0` may be kept as `0`.
- Serving-only nutrition tables are not silently treated as per-100g/per-100ml values.
- User-confirmed values are what the admin reviews.
- TazaScore methodology is unchanged; scores are calculated only after admin-approved Product creation through the existing service path.

## Backend Submission Rules

- A barcode that already exists in `Product` is rejected with `409` and `code: product_exists`.
- A pending duplicate submission is rejected with `409`.
- A barcode submission without a front package photo is rejected with `400` and `code: front_image_required`.
- Submitted data remains pending until admin review.
- OCR/photo data is assistance only and must not publish a product without moderation.

## Admin Approval

Approval creates the product through the existing `ProductService.create` path.

The approved product receives:

- `dataStatus: community`
- `source: user_submission`
- `lastVerifiedAt: null`
- `imageUrl` from the submission front image

Rejected submissions remain stored for audit/review history.

## Non-Goals

- No TazaScore methodology changes.
- No automatic verification.
- No automatic canonical-family linking.
- No SKU-specific logic.
