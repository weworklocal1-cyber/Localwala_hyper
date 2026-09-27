# LocalWala Customer Flutter App

Customer-facing app shell (spec §5, §31, task OC-0031).

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
    widgets/                # CustomerShell (bottom nav) + placeholders
  features/                 # one directory per §31 feature (home, food, …)
```

## Conventions

- **State management**: Riverpod only (spec §31 — no mixed paradigms).
- **Networking**: every repository goes through `ApiClient`
  (`apiClientProvider`); errors surface as `ApiException` mapped from the
  platform error envelope — never parse raw Dio errors in features.
- **Tokens**: stored only via `SessionStore` (platform keystore/keychain).
  Never log or persist tokens elsewhere.
- **Deep links**: `https://localwala.app/...` and `localwala://...` resolve
  through the same GoRouter paths (Android intent-filter + iOS URL scheme
  configured). Add routes in `core/routing/app_router.dart` only.
- **API base URL**: defaults to `http://10.0.2.2:4000` (Android emulator →
  host). Override: `flutter run --dart-define=API_BASE_URL=http://10.0.0.5:4000`.

## Commands

```bash
flutter pub get
flutter analyze
flutter test
```

Root alias: `npm run test:flutter`.
