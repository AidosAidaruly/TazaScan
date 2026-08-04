# TazaScan Mobile

Flutter app for the Kazakhstan food product scanner.

## Local History and Favorites

History and favorites are local-only for the MVP. Users do not need an account yet.

Persistence uses `shared_preferences` because the stored data is small, simple, and bounded:

- history is limited to the latest 100 viewed products
- favorites are product summaries keyed by product id
- values are compact JSON strings
- corrupted local JSON is ignored safely instead of crashing the app

## Local Data Model

Both history and favorites store `CachedProductSummary`:

```text
product id
barcode
name
brand
category
imageUrl
calculated score
grade
createdAt / updatedAt
viewedAt for history
```

The summary can create a cached `Product` so Product Details can open without internet.

## Offline Behavior

When a saved product is opened:

1. Product Details renders the cached summary immediately.
2. The screen tries to refresh fresh product data by barcode.
3. If refresh succeeds, the UI updates and history is refreshed.
4. If refresh fails, cached data remains visible with an `Offline data` notice.

## Future Account Sync

When user accounts are added, local history and favorites can be synced to the backend:

- keep local storage as the offline-first cache
- add authenticated endpoints for history and favorites
- upload local changes after login
- resolve conflicts by latest timestamp
- keep product summaries denormalized for fast offline cards

## Product Submissions

When a product is not found after barcode scan or photo search, the user can open `Help add this product`.

The submission flow:

```text
Product not found
-> Help add this product
-> optional product fields
-> package photos
-> review dialog
-> upload for moderation
```

Registration is not required. The app does not collect name, email, or phone. Photos are preferred over guessed nutrition values; unknown values are sent as empty and stay unknown on the backend.

Approved submissions later become real products through the admin moderation panel.

## Checks

```bash
dart analyze
flutter test
```
