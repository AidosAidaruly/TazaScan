# iOS Release Preparation

Current iOS bundle identifier:

```text
kz.project.project
```

Do not change it until the team decides the final identifier.

## Permissions

iOS Info.plist includes:

- camera usage description
- photo library usage description

## Requirements

- macOS
- Xcode
- Apple Developer account
- signing certificate and provisioning profile

## Run On Real iPhone

```bash
cd apps/mobile
flutter run -d <iphone-device-id> --dart-define=API_BASE_URL=https://api.example.com
```

For local backend testing on a real iPhone, use the computer LAN IP and ensure the phone can reach it.

Do not attempt App Store submission until signing, app privacy details, screenshots, and production backend are ready.
