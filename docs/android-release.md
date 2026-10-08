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

Release APKs and AABs are **always** signed with the release (upload) key. There is no
fallback to the debug key: if release signing is not configured correctly, the release
build fails before compiling, with a message naming the problem (never the secrets).

1. Create an upload keystore outside git, for example:

   ```bash
   keytool -genkeypair -v -keystore apps/mobile/android/upload-keystore.jks \
     -storetype PKCS12 -alias tazascan-upload -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Copy `apps/mobile/android/key.properties.example` to
   `apps/mobile/android/key.properties` (next to `settings.gradle.kts`) and fill in:

   | Property | Meaning |
   | --- | --- |
   | `storeFile` | Keystore path; relative paths resolve from `apps/mobile/android/app` |
   | `storePassword` | Keystore password |
   | `keyAlias` | Alias of the upload key inside the keystore |
   | `keyPassword` | Password of that key |

3. **Never commit `key.properties` or the keystore.** Both are git-ignored
   (`key.properties`, `*.jks`, `*.keystore`). Back the keystore up securely; losing it
   means losing the ability to update the app.

A release build stops with `Release signing is not configured: …` when:

- `apps/mobile/android/key.properties` does not exist;
- any of the four properties is missing or empty;
- `storeFile` does not point to an existing file;
- the keystore cannot be opened (wrong `storePassword` or not a keystore);
- `keyAlias` does not exist in the keystore;
- the key cannot be read with `keyPassword`.

Debug builds, `flutter run` and IDE sync do not need `key.properties` and keep using the
standard debug key. CI release jobs must write `key.properties` and the keystore from
their secret store before running `flutter build apk --release` or
`flutter build appbundle --release`.

To check which key each variant uses (no passwords are printed):

```bash
cd apps/mobile/android
./gradlew :app:signingReport
```

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
