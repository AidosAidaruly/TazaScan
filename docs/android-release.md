# Android Release Preparation

Current Android applicationId:

```text
kz.project.project
```

Do not change it until the team decides the final package identifier.

## Permissions

- Internet
- Camera

Production should use HTTPS API URLs. The main/release manifest sets `usesCleartextTraffic=false` unless a release build explicitly passes `TAZASCAN_DEMO_HTTP=true` (local demo only); debug and profile builds allow cleartext for development.

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

## API URL Guard

The API address is compiled in with `--dart-define=API_BASE_URL=...`. Production rules apply when
`TAZASCAN_PRODUCTION=true` is passed, and to **every release build** that does not explicitly pass
`TAZASCAN_DEMO_HTTP=true`:

- `API_BASE_URL` must be given explicitly (no fallback to `10.0.2.2`/`localhost`);
- it must be an `https://` URL with a host and no user info, query or fragment;
- the host must not be `localhost`/`*.localhost`, loopback (`127.0.0.0/8`, `::1`), `0.0.0.0`/`::`,
  link-local, or an emulator alias (`10.0.2.2`, `10.0.3.2`). Private LAN addresses are allowed.

A build that breaks these rules still compiles, but the app stops on the splash screen with a clear
message. **Launch every release build once before distributing it.**

`TAZASCAN_DEMO_HTTP=true` is only for intentional local-network demo builds (USB reverse forwarding
or a laptop LAN address, see `docs/aitu-demo-readiness.md`); it also enables cleartext HTTP in the
release manifest. Never use it for store or production builds. Debug and profile builds may use local
URLs.

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
