# LocalWala Admin Web App

Angular admin console for the LocalWala Control Center (spec §33) at `apps/admin_web`.

## Why Angular (ADR)

This is the admin surface, not a consumer app. Per spec §5 the platform ships
"4 Flutter applications and 2 web apps" — the admin web app is data-heavy:
29 control-center sections of tables, filters, forms, bulk operations, maps,
charts and RBAC-gated workflows. Angular was chosen over Flutter Web for this
app because:

- First-class desktop/tablet DOM ergonomics: dense tables, complex forms,
  keyboard navigation and browser-native accessibility come for free.
- Mature routing with route guards (`authGuard`), lazy-ready structure, and
  typed route data — the deep-link contract lives in `src/app/app.routes.ts`.
- Strict TypeScript, standalone components, signals and a vitest-backed test
  builder (`@angular/build:unit-test`) integrate into this repo's existing
  npm-workspaces + vitest gates.

Consumer, partner and delivery apps remain Flutter (spec §31).

## Structure

- `src/app/core/nav/admin-nav.ts` — single source of truth for the §33
  sections (8 groups / 29 sections); routes and sidenav render from it.
- `src/app/core/strings/app.strings.ts` — localization-ready copy for titles,
  section labels and empty states (no user-facing copy in components).
- `src/app/core/auth/session.service.ts` — access-token session storage.
- `src/app/core/http/api-client.service.ts` — `ApiService` repository
  abstraction over `HttpClient`, `ApiException` mapping of the platform error
  envelope `{error:{code,message,requestId}}`, and the `authInterceptor`.
- `src/app/layout/admin-shell.*` — sidenav + toolbar + `<router-outlet>`.
- `src/app/shared/placeholder-page.ts` — empty state rendered by every
  section route until its screen lands (spec §32 empty-state pattern).

## Session storage tradeoff

Tokens live in `localStorage` under `admin.access_token`. Spec §31 mandates
secure token storage for the Flutter apps; for the admin web console this is
an intentional interim decision: the console runs on a trusted network and is
behind server-side authn/authz (RBAC in api-gateway/services is authoritative).
Moving to `sessionStorage` + short-lived refresh rotation is tracked for when
the SSO/gateway flow (OC-0017/OC-0018) lands.

## Commands

```bash
npm run build:web   # production build (from repo root)
npm run test:web    # vitest suite (from repo root)
npm start           # dev server (from apps/admin_web)
```

## Design tokens

`src/styles.scss` mirrors the olive-green token set from
`packages/design-system` (spec §32). Keep in sync when either changes.
