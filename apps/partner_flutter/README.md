# LocalWala Partner Flutter App

Partner/operations app shell (spec §5, §13, §31, task OC-0032).

## Structure

```
lib/
  main.dart                 # guarded-zone entry point
  app.dart                  # MaterialApp.router + Riverpod providers
  core/
    config/app_config.dart  # --dart-define driven (API_BASE_URL, APP_ENV)
    networking/              # ApiClient abstraction + Dio implementation
    auth/                   # SessionStore (secure storage / in-memory)
    routing/                # GoRouter table = deep-link contract
    strings/                # single source of shell copy (l10n-ready)
    crash/                  # FlutterError + zone error capture
    analytics/              # Analytics abstraction (noop in shell)
    widgets/                # PartnerShell (bottom nav) + placeholders
  features/                 # §13 surfaces: dashboard, orders, menu,
                            # earnings, offers, timings, staff, analytics,
                            # support, notifications, profile, auth
```

## Conventions

- **Operations-first tabs** (§13): Dashboard · Orders · Menu · Profile.
- **State management**: Riverpod only (spec §31 — no mixed paradigms).
- **Networking**: every repository goes through `ApiClient`; errors surface
  as `ApiException` mapped from the platform error envelope.
- **Tokens**: stored only via `SessionStore` (platform keystore/keychain).
- **Deep links**: `https://partner.localwala.app/...` and
  `localwala-partner://...` resolve through GoRouter paths (Android
  intent-filter + iOS URL scheme configured).
- **API base URL**: defaults to `http://10.0.2.2:4000` (Android emulator →
  host). Override: `flutter run --dart-define=API_BASE_URL=...`.

## Commands

```bash
flutter pub get
flutter analyze
flutter test
```

Root alias: `npm run test:flutter`.
