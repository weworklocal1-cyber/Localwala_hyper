# ADR-0004: Data Ownership and Store Selection (Proposed)

- **Status:** Proposed — must be frozen during Phase 0 before any service
  creates a migration.
- **Date:** 2026-09-27
- **Task:** OC-0002

## Context

One service owns each authoritative state (specification section 36). The
platform needs both relational guarantees (ledgers, orders, payments) and
document flexibility (catalog, media, configuration, geo boundaries).

## Decision (proposed)

| Store      | Used by                                                                                                                       | Reason                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| PostgreSQL | auth, user, order, payment, wallet, settlement, referral, promotion, delivery, dispatch, driver, dairy (subscriptions), audit | Transactions, immutable ledger entries, idempotency keys, constraint-enforced state machines |
| MongoDB    | geography, config, media, catalog, search, food, store, zatka, local-services, realestate, support, analytics                 | Document models, GeoJSON boundaries, flexible schemas                                        |
| Redis      | tracking, dispatch, cart, auth (rate limits/OTP), all services (cache)                                                        | Live operational state, TTL-based OTP/rate limits, high-frequency GPS snapshots              |
| Kafka      | all services (event bus)                                                                                                      | Durable domain events between services                                                       |

Rules:

- No service reads another service's database directly. Cross-service reads go
  through that service's API or a published event.
- Financial ledgers are append-only; reversals are new entries.
- High-frequency GPS coordinates go to Redis only, never to Kafka
  (specification section 29).

## Consequences

- Requires both PostgreSQL and MongoDB in the Compose stack (already defined in
  `infrastructure/docker/docker-compose.yml`).
- Each service must record its migrations in its own repository folder before
  marking its implementation task DONE.
