# @localwala/config-service

Versioned remote configuration, feature flags, home/banner/Lottie config.

- **Port:** 4104
- **Base URL (local):** http://localhost:4104
- **Health:** `GET /health` · **Readiness:** `GET /ready`

## Structure

```
src/
  server.ts        process entrypoint + graceful shutdown
  app.ts           Fastify instance, error envelope, route registration
  config/          service environment
  plugins/         request correlation context
  routes/          thin route definitions
  controllers/     request/response mapping
  services/        business logic
  repositories/    persistence (owner of this service's data)
  models/          domain models
  schemas/         validation schemas
  events/          published/consumed domain events
  jobs/            background workers
  errors/          re-exported platform error contract
  utils/           shared helpers
tests/
  unit/            business logic tests
  integration/     HTTP and adapter tests
  e2e/             cross-service journeys
```

## Commands

```bash
npm run dev   -w @localwala/config-service
npm run build -w @localwala/config-service
npm test      # from the repository root
```
