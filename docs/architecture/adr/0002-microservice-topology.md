# ADR-0002: Independently Deployable Microservices Topology

- **Status:** Accepted
- **Date:** 2026-09-27
- **Task:** OC-0002

## Context

The specification (section 4) defines a domain-oriented service topology and
requires that a capability never forks into a second, duplicate service.

## Decision

- Every service in the topology is its own deployable unit: own process, own
  container, own port, own health/readiness endpoints, own data ownership
  boundary.
- There is no shared runtime process and no service-to-service function calls —
  communication is REST (synchronous) or Kafka (asynchronous).
- `api-gateway` is the single edge entrypoint; it resolves downstreams from
  configuration (`UPSTREAM_<SERVICE>` environment variables) and proxies by
  unique route prefix.
- Ports are allocated in `docs/architecture/service-registry.md`
  (gateway 4000, services 4101–4129) and must not be reused.

## Consequences

- Independent deployment, scaling and rollback per domain.
- Cross-cutting work (config, contracts, error envelope) must be versioned in
  `packages/` and rolled out deliberately.
- Local development runs services individually
  (`node tools/service-dev.mjs <service>`) or all at once through Docker Compose
  with the `apps` profile.
