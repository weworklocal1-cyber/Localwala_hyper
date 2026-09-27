# LocalWala Delivery Flutter App

Delivery-partner app shell (spec §5, §14, §31, task OC-0033).

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
    widgets/                # DeliveryShell (bottom nav) + placeholders
  features/                 # §14 surfaces: home (online/offers),
                            # deliveries, earnings, profile, documents,
                            # support, auth
```

## Conventions

- **Task-first tabs** (§14): Home · Deliveries · Earnings · Profile. One
  obvious primary action per screen (availability toggle and offer cards
  land with the dispatch feature work).
- **State management**: Riverpod only (spec §31 — no mixed paradigms).
- **Networking**: every repository goes through `ApiClient`; errors surface
  as `ApiException` mapped from the platform error envelope.
- **Tokens**: stored only via `SessionStore` (platform keystore/keychain).
- **Deep links**: `https://delivery.localwala.app/...` and
  `localwala-delivery://...` resolve through GoRouter paths.
- **API base URL**: defaults to `http://10.0.2.2:4000` (Android emulator →
  host). Override: `flutter run --dart-define=API_BASE_URL=...`.

## Commands

```bash
flutter pub get
flutter analyze
flutter test
```

Root alias: `npm run test:flutter`.
