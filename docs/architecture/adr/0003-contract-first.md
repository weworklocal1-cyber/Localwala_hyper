# ADR-0003: Contract-First API and Versioned Event Schemas

- **Status:** Accepted
- **Date:** 2026-09-27
- **Task:** OC-0002

## Context

Section 29 and 30 of the specification require versioned event schemas, explicit
service boundaries, a standard error format, correlation IDs and idempotency
keys for mutations.

## Decision

- **TypeScript ESM + NodeNext** for every service; relative imports carry
  explicit `.js` extensions so compiled output matches source structure.
- **Synchronous contracts:** REST. Every service returns the same envelope:
  success `{ data, meta? }`, failure `{ error: { code, message, details?,
requestId? } }` produced by `@localwala/errors`.
- **Shared contracts** live in `packages/contracts` (roles, service names,
  health/readiness shapes, pagination, standard headers). Services must not
  redefine them.
- **Asynchronous contracts:** `packages/event-schemas` owns the event envelope
  (`eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`,
  `aggregateType`, `aggregateId`, `correlationId`, `payload`) and the closed set
  of event types with their versions. Unknown event types are rejected.
- `x-correlation-id` is accepted from the caller or generated at the edge and
  propagated through logs.
- Idempotency keys are carried on the `idempotency-key` header and are mandatory
  for order creation and payment operations (implemented by the owning services).

## Consequences

- Breaking changes require a new API/event version rather than an in-place edit.
- Consumers can validate envelopes before touching business payloads.
