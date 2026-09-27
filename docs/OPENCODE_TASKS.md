# OpenCode Task Registry — LocalWala

Single shared task registry for all agents (specification sections 36–37).
Update `STATUS` only after the acceptance criteria pass. Never mark a task DONE
because code compiles.

**Task record format:**

```
TASK-ID : OWNER : SERVICE : DEPENDENCIES : FILES TO TOUCH : API CONTRACTS : EVENTS :
DATABASE CHANGES : UI CHANGES : SECURITY IMPACT : TESTS REQUIRED : ACCEPTANCE CRITERIA :
BLOCKERS : STATUS
```

**Status values:** `TODO` · `IN_PROGRESS` · `BLOCKED` · `READY_FOR_REVIEW` · `DONE`

| ID      | Service / Area                             | Status  | Evidence / Blockers                                                                                                                                                                        |
| ------- | ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OC-0001 | Monorepo & conventions                     | DONE    | npm workspaces + TS project references; `npm run build` green                                                                                                                              |
| OC-0002 | Architecture decision records              | DONE    | `docs/architecture/adr/0001..0004`                                                                                                                                                         |
| OC-0003 | Shared TS/lint/format/test tooling         | DONE    | root `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json`, `vitest.config.mts`; `npm run lint` / `format:check` / `test` green                                                    |
| OC-0004 | Fastify service template                   | DONE    | `tools/scaffold.mjs` generates the section-6 structure for all 30 services; unit + HTTP tests pass per service                                                                             |
| OC-0005 | API Gateway skeleton                       | DONE    | `services/api-gateway` downstream registry, prefix proxy, `/_gateway/routes`; tests pass. Auth/rate-limit middleware NOT yet in scope of skeleton                                          |
| OC-0006 | Shared error/validation/logger packages    | DONE    | `packages/errors`, `packages/validation`, `packages/logger` with tests                                                                                                                     |
| OC-0007 | Event envelope & schema package            | DONE    | `packages/event-schemas` closed event set + envelope validation + tests                                                                                                                    |
| OC-0008 | Environment/config package                 | DONE    | `packages/config` with typed env readers + tests                                                                                                                                           |
| OC-0009 | Local infrastructure bootstrap             | BLOCKED | Compose file written (`infrastructure/docker/docker-compose.yml`), but Docker is not installed on this machine — stack has never been started                                              |
| OC-0010 | Observability baseline                     | TODO    | `infrastructure/observability/prometheus.yml` staged; no `/metrics`, tracing or structured-field instrumentation in services yet                                                           |
| OC-0011 | auth-service                               | DONE    | `services/auth-service/src/auth/` — JWT tokens (access/refresh), session lifecycle, login/refresh/logout, device binding, token rotation; staging repos (BLOCKED); unit + HTTP tests pass. |
| OC-0012 | OTP provider abstraction & staging adapter | DONE    | `services/auth-service/src/otp/` — interface, staging provider (BLOCKED), repository, rate limiter, service, routes, controller; unit + HTTP tests pass.                                   |
| OC-0013 | user-service & RBAC                        | TODO    | Depends on OC-0011                                                                                                                                                                         |
| OC-0014 | geography-service                          | TODO    | Requires GeoJSON boundary data                                                                                                                                                             |
| OC-0015 | config-service                             | TODO    |                                                                                                                                                                                            |
| OC-0016 | media/CDN abstraction                      | TODO    | Requires object-storage provider selection                                                                                                                                                 |
| OC-0017 | catalog-service                            | TODO    |                                                                                                                                                                                            |
| OC-0018 | inventory-service                          | TODO    | Concurrency tests required                                                                                                                                                                 |
| OC-0019 | cart-service                               | TODO    |                                                                                                                                                                                            |
| OC-0020 | order-service state machine                | TODO    | Idempotency + state-transition tests required                                                                                                                                              |
| OC-0021 | payment-service provider adapter           | TODO    | Requires gateway selection — BLOCKED until provider approved                                                                                                                               |
| OC-0022 | Webhook/idempotency/reconciliation         | TODO    | Webhook signature tests required                                                                                                                                                           |
| OC-0023 | Wallet/ledger                              | TODO    |                                                                                                                                                                                            |
| OC-0024 | Settlement/commission                      | TODO    | Versioned commission rules required                                                                                                                                                        |
| OC-0025 | notification-service                       | TODO    |                                                                                                                                                                                            |
| OC-0026 | delivery-service                           | TODO    |                                                                                                                                                                                            |
| OC-0027 | driver-service                             | TODO    |                                                                                                                                                                                            |
| OC-0028 | dispatch-engine                            | TODO    | Double-assignment test required                                                                                                                                                            |
| OC-0029 | tracking-service                           | TODO    | Redis path only, no Kafka GPS events                                                                                                                                                       |
| OC-0030 | Flutter design system                      | TODO    |                                                                                                                                                                                            |
| OC-0031 | Customer app shell                         | TODO    |                                                                                                                                                                                            |
| OC-0032 | Partner app shell                          | TODO    |                                                                                                                                                                                            |
| OC-0033 | Delivery app shell                         | TODO    |                                                                                                                                                                                            |
| OC-0034 | Admin shell                                | TODO    |                                                                                                                                                                                            |
| OC-0035 | Remote-config home renderer                | TODO    | Native components only, no remote code execution                                                                                                                                           |
| OC-0036 | Lottie header                              | TODO    |                                                                                                                                                                                            |
| OC-0037 | Native OTP UX                              | TODO    |                                                                                                                                                                                            |
| OC-0038 | Native payment UX                          | TODO    | Never trust a Flutter-only success callback                                                                                                                                                |
| OC-0039 | Food engine                                | TODO    |                                                                                                                                                                                            |
| OC-0040 | Restaurant operational UX                  | TODO    |                                                                                                                                                                                            |
| OC-0041 | Local Store + Organic                      | TODO    |                                                                                                                                                                                            |
| OC-0042 | Dairy subscriptions                        | TODO    |                                                                                                                                                                                            |
| OC-0043 | Zatka                                      | TODO    |                                                                                                                                                                                            |
| OC-0044 | Local Services                             | TODO    |                                                                                                                                                                                            |
| OC-0045 | Real Estate                                | TODO    |                                                                                                                                                                                            |
| OC-0046 | Support                                    | TODO    |                                                                                                                                                                                            |
| OC-0047 | Analytics                                  | TODO    |                                                                                                                                                                                            |
| OC-0048 | Production hardening                       | TODO    |                                                                                                                                                                                            |
| OC-0049 | Complete release checklist                 | TODO    | Section 39 checklist of the specification                                                                                                                                                  |

## Quality gates (every task)

1. `npm run build` — TypeScript project references compile.
2. `npm run lint` — ESLint clean.
3. `npm run format:check` — Prettier clean.
4. `npm test` — unit + HTTP tests green.
5. Task record updated with evidence (code path, tests, migration, docs).
