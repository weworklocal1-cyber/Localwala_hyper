# ADR-0001: Monorepo with npm Workspaces

- **Status:** Accepted
- **Date:** 2026-09-27
- **Task:** OC-0001

## Context

LocalWala spans 30 backend services, 4 Flutter applications and 2 web
applications that must share contracts, validation, errors, logging and design
tokens. The implementation is executed by multiple AI agents in parallel.

## Decision

- Single repository (`localwala`) using npm workspaces: `packages/*` and
  `services/*`.
- TypeScript project references with `tsc -b` for ordered, incremental builds.
- Shared tooling at the repository root: TypeScript, ESLint (flat config),
  Prettier, Vitest.
- Shared platform code lives in `packages/` and is published to services as
  workspace dependencies. No service copies shared code.

## Consequences

- One install, one build, one quality gate for the whole platform.
- Contract changes are visible to every consumer in the same pull request.
- Services stay independently deployable: each has its own `package.json`,
  `tsconfig.json`, Docker image and port.
