# Android Release Preparation

Current Android applicationId:

```text
kz.project.project
```

Do not change it until the team decides the final package identifier.

## Permissions

- Internet
- Camera

Production should use HTTPS API URLs. Main manifest sets `usesCleartextTraffic=false`.

## Signing

Do not commit real signing secrets.

Copy:

```text
apps/mobile/android/key.properties.example
```

to:

```text
apps/mobile/android/key.properties
```

Then create an upload keystore and fill real local values.

## Build Commands

Debug APK:

```bash
cd apps/mobile
flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

Release APK:

```bash
flutter build apk --release --dart-define=TAZASCAN_PRODUCTION=true --dart-define=API_BASE_URL=https://api.example.com
```

Release AAB:

```bash
flutter build appbundle --release --dart-define=TAZASCAN_PRODUCTION=true --dart-define=API_BASE_URL=https://api.example.com
```

Do not publish until signing, privacy documents, backend HTTPS, and moderation workflows are verified.
