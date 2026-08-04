# TazaScan

TazaScan is a food product scanner app for Kazakhstan. Users can scan barcodes, search by photo, view nutrition scoring, save local history/favorites, and submit missing products for admin moderation.

## Monorepo

```text
apps/mobile   Flutter mobile app
apps/admin    React/Vite admin panel
backend/api   Node.js/Express/Prisma API
docs          architecture, release, privacy, and deployment docs
```

## Current Native Identifiers

These are documented for MVP release prep and are not changed yet:

```text
Android applicationId: kz.project.project
iOS bundle identifier: kz.project.project
```

## Development

Backend:

```bash
cd backend/api
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Admin:

```bash
cd apps/admin
npm install
npm run dev
```

Mobile:

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

Production builds must pass a public HTTPS API URL through `API_BASE_URL`.
