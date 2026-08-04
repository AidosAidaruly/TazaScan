# TazaScan MVP Release Checklist

## Backend

- [ ] `prisma validate`
- [ ] `prisma migrate status`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Production env variables configured
- [ ] Hosted PostgreSQL configured
- [ ] HTTPS backend URL configured
- [ ] Upload storage persistence verified
- [ ] Login rate limit verified
- [ ] OCR rate limit verified or accepted as MVP risk
- [ ] Submission rate limit verified

## Admin

- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev`
- [ ] Admin login works
- [ ] Logout/token expiration works
- [ ] Product moderation works
- [ ] Duplicate barcode approval returns 409

## Flutter

- [ ] `dart analyze`
- [ ] `flutter test`
- [ ] Debug Android build
- [ ] Camera permission
- [ ] Gallery permission
- [ ] Barcode scan
- [ ] Photo search
- [ ] Product not found flow
- [ ] Product submission upload
- [ ] Offline history/favorites
- [ ] Scoring warnings visible
- [ ] Privacy and Terms screens visible

## Android

- [ ] applicationId documented
- [ ] Upload keystore created locally
- [ ] Cleartext HTTP disabled for production
- [ ] Release APK builds
- [ ] Release AAB builds

## iOS

- [ ] Bundle identifier documented
- [ ] Camera/photo permission strings verified
- [ ] Apple Developer account available
- [ ] Signing configured on macOS/Xcode
