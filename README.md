# LocalWala

Enterprise hyperlocal platform — shared core (identity, geography, commerce,
fulfillment, finance) with vertical engines for Food, Local Store, Daily/Dairy,
Zatka, Local Services and Real Estate.

**Master specification:** [`docs/LOCALWALA_IMPLEMENTATION_SPEC.md`](docs/LOCALWALA_IMPLEMENTATION_SPEC.md)
**Task registry:** [`docs/OPENCODE_TASKS.md`](docs/OPENCODE_TASKS.md)

## Architecture

- **30 independently deployable microservices** (Fastify + TypeScript, ESM).
  See [`docs/architecture/service-registry.md`](docs/architecture/service-registry.md).
- **6 shared packages:** `config`, `logger`, `errors`, `contracts`,
  `validation`, `event-schemas`.
- **Edge:** `api-gateway` (port 4000) proxies to every upstream by unique route
  prefix, configured through `UPSTREAM_<SERVICE>` environment variables.
- **Data:** PostgreSQL (transactional/ledger), MongoDB (documents/geo), Redis
  (live state), Kafka (durable domain events). One service owns each
  authoritative state.

```
packages/        shared platform code (contracts, errors, validation, events, config, logger)
services/        30 services, each with src/, tests/, own port and own container
infrastructure/  docker-compose, Dockerfile.service, nginx, observability
docs/            specification, ADRs, task registry, service registry
tools/           scaffold generator and dev helpers
```

## Quickstart

```bash
npm install
npm run build        # tsc -b, ordered project references
npm run lint
npm run format:check
npm test

# run one service
node tools/service-dev.mjs auth-service
curl http://localhost:4101/health

# infrastructure (requires Docker)
docker compose -f infrastructure/docker/docker-compose.yml up -d

# all services (Docker)
docker compose -f infrastructure/docker/docker-compose.yml --profile apps up -d
```

## Conventions

- Structure of every service follows specification section 6
  (`server.ts`, `app.ts`, `config/`, `plugins/`, `routes/`, `controllers/`,
  `services/`, `repositories/`, `models/`, `schemas/`, `events/`, `jobs/`,
  `errors/`, `utils/`, `tests/`).
- Thin routes; business logic in services; persistence in repositories;
  validation in schemas.
- Standard error envelope `{ error: { code, message, details?, requestId? } }`.
- `x-correlation-id` on every request; structured JSON logs with `service`.
- Never mock a required capability: mark the integration boundary `BLOCKED`
  instead.

## Regenerating services

```bash
npm run scaffold
```

Regenerates the standard service structure, the root `tsconfig.json`, the
Compose file and the service registry. Hand-written domain code is not touched.
