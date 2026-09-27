#!/usr/bin/env node
/**
 * LocalWala service scaffold generator.
 *
 * Generates the standard Fastify service structure defined in
 * docs/LOCALWALA_IMPLEMENTATION_SPEC.md section 6 for every service in the
 * topology defined in section 4. Re-running this script overwrites generated
 * files (it never touches hand-written files such as src/domain or tests that
 * are not listed below).
 *
 * Usage: node tools/scaffold.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {{ name: string, port: number, desc: string, gateway?: boolean }[]} */
const SERVICES = [
  {
    name: 'api-gateway',
    port: 4000,
    desc: 'Edge gateway: routing, correlation and downstream proxying.',
    gateway: true,
  },
  {
    name: 'auth-service',
    port: 4101,
    desc: 'OTP request/verify, sessions, token rotation, provider abstraction.',
  },
  {
    name: 'user-service',
    port: 4102,
    desc: 'Customer, partner, employee and delivery-partner identity plus RBAC.',
  },
  {
    name: 'geography-service',
    port: 4103,
    desc: 'Country/State/City/Zone/Locality master, GeoJSON boundaries, serviceability.',
  },
  {
    name: 'config-service',
    port: 4104,
    desc: 'Versioned remote configuration, feature flags, home/banner/Lottie config.',
  },
  {
    name: 'media-service',
    port: 4105,
    desc: 'Upload validation, media metadata, CDN/asset delivery abstraction.',
  },
  {
    name: 'notification-service',
    port: 4106,
    desc: 'Push/SMS/Email/WhatsApp/In-app channel adapters, templates, preferences.',
  },
  {
    name: 'search-service',
    port: 4107,
    desc: 'Indexed discovery for restaurants, stores, products, services, properties.',
  },
  {
    name: 'support-service',
    port: 4108,
    desc: 'Bot-first support, agent queues, SLA, transfers, ticket audit.',
  },
  {
    name: 'catalog-service',
    port: 4109,
    desc: 'Categories, products, variants, modifiers, attributes, media, pricing.',
  },
  {
    name: 'inventory-service',
    port: 4110,
    desc: 'Physical/reserved/sellable stock with concurrency-safe reservation.',
  },
  {
    name: 'cart-service',
    port: 4111,
    desc: 'Cart items, pricing snapshot, coupons, address, checkout readiness.',
  },
  {
    name: 'order-service',
    port: 4112,
    desc: 'Order aggregate, immutable snapshots, state machine, idempotency.',
  },
  {
    name: 'payment-service',
    port: 4113,
    desc: 'Gateway adapters, server verification, webhooks, refunds, reconciliation.',
  },
  {
    name: 'wallet-service',
    port: 4114,
    desc: 'Wallet ledger, credit/debit, holds, withdrawal requests.',
  },
  {
    name: 'promotion-service',
    port: 4115,
    desc: 'Coupons, campaigns, offers, eligibility and usage limits.',
  },
  {
    name: 'settlement-service',
    port: 4116,
    desc: 'Commission rules, partner payouts, platform fees, reconciliation.',
  },
  {
    name: 'referral-service',
    port: 4117,
    desc: 'Referral codes, rewards, referral ledger entries.',
  },
  {
    name: 'delivery-service',
    port: 4118,
    desc: 'Delivery areas, slots, delivery lifecycle and proof of delivery.',
  },
  {
    name: 'dispatch-engine',
    port: 4119,
    desc: 'Candidate eligibility, scoring, offer/timeout, atomic assignment claim.',
  },
  {
    name: 'driver-service',
    port: 4120,
    desc: 'Driver onboarding, documents, vehicle, availability and service areas.',
  },
  {
    name: 'tracking-service',
    port: 4121,
    desc: 'High-frequency location updates and live tracking snapshots in Redis.',
  },
  {
    name: 'food-service',
    port: 4122,
    desc: 'Restaurant engine: menus, modifiers, prep time, kitchen flow, ratings.',
  },
  {
    name: 'store-service',
    port: 4123,
    desc: 'Local store engine: branches, catalogue links, Organic business type.',
  },
  {
    name: 'dairy-service',
    port: 4124,
    desc: 'Daily/alternate/weekly subscriptions, pause/skip/vacation, instances.',
  },
  {
    name: 'zatka-service',
    port: 4125,
    desc: 'Fresh meat cuts, options, slot capacity, reservation-backed preparation.',
  },
  {
    name: 'local-services-service',
    port: 4126,
    desc: 'Provider onboarding, booking, quotes, job lifecycle.',
  },
  {
    name: 'realestate-service',
    port: 4127,
    desc: 'Listings, leads, visits, holds, sale verification, commission lifecycle.',
  },
  {
    name: 'analytics-service',
    port: 4128,
    desc: 'Aggregations, operational dashboards, funnel and marketplace metrics.',
  },
  {
    name: 'audit-service',
    port: 4129,
    desc: 'Immutable audit trail for state transitions and administrative actions.',
  },
];

const PACKAGES = ['config', 'logger', 'errors', 'contracts', 'validation', 'event-schemas'];

function write(relPath, content) {
  const target = join(root, relPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
}

function keep(relPath) {
  write(relPath, '');
}

const pkgJson = (svc) => {
  const deps = {
    '@localwala/config': '*',
    '@localwala/contracts': '*',
    '@localwala/errors': '*',
    '@localwala/event-schemas': '*',
    '@localwala/logger': '*',
    '@localwala/validation': '*',
    fastify: '^5.2.0',
    zod: '^4.0.0',
  };
  if (svc.gateway) deps['@fastify/http-proxy'] = '^11.0.0';

  return (
    JSON.stringify(
      {
        name: '@localwala/' + svc.name,
        version: '0.1.0',
        private: true,
        type: 'module',
        description: svc.desc,
        main: './dist/src/index.js',
        types: './dist/src/index.d.ts',
        exports: {
          '.': { types: './dist/src/index.d.ts', default: './dist/src/index.js' },
        },
        scripts: {
          build: 'tsc -b',
          clean: 'tsc -b --clean',
          dev: 'tsx watch src/server.ts',
          start: 'node dist/src/server.js',
          test: 'vitest run',
        },
        dependencies: deps,
      },
      null,
      2,
    ) + '\n'
  );
};

const tsconfig = () =>
  JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      compilerOptions: { outDir: 'dist', rootDir: '.' },
      include: ['src', 'tests'],
      references: PACKAGES.map((pkg) => ({ path: '../../packages/' + pkg })),
    },
    null,
    2,
  ) + '\n';

const envExample = (svc) =>
  [
    'NODE_ENV=development',
    'HOST=0.0.0.0',
    'PORT=' + svc.port,
    'LOG_LEVEL=info',
    'SERVICE_VERSION=0.1.0',
    'KAFKA_BROKERS=localhost:9092',
    'REDIS_URL=redis://localhost:6379',
    '',
  ].join('\n');

const configFile = (svc) =>
  [
    "import { serviceEnv, type ServiceEnv } from '@localwala/config';",
    '',
    'export const SERVICE_NAME = ' + JSON.stringify(svc.name) + ' as const;',
    'export const SERVICE_PORT = ' + svc.port + ';',
    '',
    'export const config: ServiceEnv = serviceEnv(SERVICE_NAME, SERVICE_PORT);',
    '',
  ].join('\n');

const requestContextPlugin = `import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

export function registerRequestContext(app: FastifyInstance): void {
  app.addHook('onRequest', (request, reply, done) => {
    const incoming = request.headers['x-correlation-id'];
    request.correlationId =
      typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
        ? incoming
        : randomUUID();
    void reply.header('x-correlation-id', request.correlationId);
    done();
  });

  app.addHook('onResponse', (request, reply, done) => {
    request.log.info(
      {
        correlationId: request.correlationId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      'request completed',
    );
    done();
  });
}
`;

const healthService = `import type { HealthResponse, ReadinessCheck, ReadinessResponse } from '@localwala/contracts';
import { SERVICE_NAME } from '../config/index.js';

const STARTED_AT = Date.now();
const VERSION = process.env.SERVICE_VERSION ?? '0.1.0';

export function getHealth(): HealthResponse {
  return {
    status: 'ok',
    service: SERVICE_NAME,
    version: VERSION,
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    timestamp: new Date().toISOString(),
  };
}

export function getReadiness(checks: ReadinessCheck[] = []): ReadinessResponse {
  const all: ReadinessCheck[] = [{ name: 'process', status: 'up' }, ...checks];
  return {
    status: all.every((check) => check.status === 'up') ? 'ready' : 'not_ready',
    service: SERVICE_NAME,
    checks: all,
  };
}
`;

const healthController = `import type { FastifyReply, FastifyRequest } from 'fastify';
import type { HealthResponse, ReadinessResponse } from '@localwala/contracts';
import { getHealth, getReadiness } from '../services/health.service.js';

export async function healthController(): Promise<HealthResponse> {
  return getHealth();
}

export async function readyController(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<ReadinessResponse> {
  const readiness = getReadiness();
  reply.status(readiness.status === 'ready' ? 200 : 503);
  return readiness;
}
`;

const healthRoutes = `import type { FastifyInstance } from 'fastify';
import { healthController, readyController } from '../controllers/health.controller.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', healthController);
  app.get('/ready', readyController);
}
`;

const routesIndex = `export { healthRoutes } from './health.js';
`;

const errorsIndex = `export * from '@localwala/errors';
`;

const utilsIndex = `import { randomUUID } from 'node:crypto';

export function newId(prefix: string): string {
  return prefix + '_' + randomUUID().replace(/-/g, '');
}

export function nowIso(): string {
  return new Date().toISOString();
}
`;

const appFile = (svc) => `import Fastify, { LogController, type FastifyInstance } from 'fastify';
import { loggerOptions } from '@localwala/logger';
import { toErrorBody } from '@localwala/errors';
import { config } from './config/index.js';
import { registerRequestContext } from './plugins/request-context.js';
${svc.gateway ? "import { proxyRoutes } from './routes/proxy.js';\n" : ''}import { healthRoutes } from './routes/health.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: loggerOptions({
      serviceName: config.serviceName,
      level: config.logLevel,
    }),
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: true,
    bodyLimit: 1_048_576,
    ajv: { customOptions: { removeAdditional: false, allErrors: true } },
  });

  registerRequestContext(app);

  app.setErrorHandler((error, request, reply) => {
    const { statusCode, body } = toErrorBody(error);
    const payload = { ...body, requestId: request.id };
    if (statusCode >= 500) {
      request.log.error(
        { err: error, correlationId: request.correlationId, code: body.error.code },
        'request failed',
      );
    } else {
      request.log.warn(
        { correlationId: request.correlationId, code: body.error.code, statusCode },
        'request rejected',
      );
    }
    void reply.status(statusCode).send(payload);
  });

  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: request.id,
      },
    });
  });

  app.register(healthRoutes);
${svc.gateway ? '  app.register(proxyRoutes);\n' : ''}
  return app;
}
`;

const serverFile = `import { buildApp } from './app.js';
import { config } from './config/index.js';

const app = buildApp();

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, 'shutdown signal received');
  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'graceful shutdown failed');
    process.exit(1);
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

async function start(): Promise<void> {
  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error({ err: error }, 'service failed to start');
    process.exit(1);
  }
}

await start();
`;

const unitTest = (svc) => `import { describe, expect, it } from 'vitest';
import { getHealth, getReadiness } from '../../src/services/health.service.js';

describe('health service (${svc.name})', () => {
  it('reports ok with the service name', () => {
    const health = getHealth();
    expect(health.status).toBe('ok');
    expect(health.service).toBe('${svc.name}');
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports ready when every dependency check is up', () => {
    const ready = getReadiness();
    expect(ready.status).toBe('ready');
    expect(ready.checks.every((check) => check.status === 'up')).toBe(true);
  });

  it('reports not_ready when a dependency check is down', () => {
    const result = getReadiness([{ name: 'redis', status: 'down' }]);
    expect(result.status).toBe('not_ready');
  });
});
`;

const integrationTest = `import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('http surface', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves liveness', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
  });

  it('serves readiness', async () => {
    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ready');
  });

  it('returns the standard error envelope for unknown routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/definitely-missing' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('echoes the correlation id header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-correlation-id': 'corr-test-1' },
    });
    expect(response.headers['x-correlation-id']).toBe('corr-test-1');
  });
});
`;

const serviceReadme = (svc) => `# @localwala/${svc.name}

${svc.desc}

- **Port:** ${svc.port}
- **Base URL (local):** http://localhost:${svc.port}
- **Health:** \`GET /health\` · **Readiness:** \`GET /ready\`

## Structure

\`\`\`
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
\`\`\`

## Commands

\`\`\`bash
npm run dev   -w @localwala/${svc.name}
npm run build -w @localwala/${svc.name}
npm test      # from the repository root
\`\`\`
`;

const gatewayRegistry = `import { SERVICES, type ServiceName } from '@localwala/contracts';
import { envString } from '@localwala/config';

export interface DownstreamService {
  service: ServiceName;
  prefix: string;
  upstream: string;
}

const DEFAULT_PORTS: Record<string, number> = {
${SERVICES.filter((s) => s.name !== 'api-gateway')
  .map((s) => `  '${s.name}': ${s.port},`)
  .join('\n')}
};

function upstreamEnvName(service: ServiceName): string {
  return 'UPSTREAM_' + service.toUpperCase().replace(/-/g, '_');
}

function routePrefix(service: ServiceName): string {
  const trimmed = service.replace(/-service$/, '').replace(/-engine$/, '');
  return '/' + trimmed;
}

export function resolveDownstreams(): DownstreamService[] {
  return SERVICES.filter((service) => service !== 'api-gateway').map((service) => ({
    service,
    prefix: routePrefix(service),
    upstream: envString(upstreamEnvName(service), 'http://localhost:' + DEFAULT_PORTS[service]),
  }));
}
`;

const gatewayProxyRoutes = `import fastifyHttpProxy from '@fastify/http-proxy';
import type { FastifyInstance } from 'fastify';
import { resolveDownstreams } from '../proxy/registry.js';

export async function proxyRoutes(app: FastifyInstance): Promise<void> {
  const downstreams = resolveDownstreams();

  app.get('/_gateway/routes', async () => ({
    data: downstreams.map((entry) => ({
      service: entry.service,
      route: entry.prefix,
      upstream: entry.upstream,
    })),
  }));

  for (const downstream of downstreams) {
    await app.register(fastifyHttpProxy, {
      upstream: downstream.upstream,
      prefix: downstream.prefix,
      rewritePrefix: '/',
    });
  }
}
`;

const gatewayUnitTest = `import { describe, expect, it } from 'vitest';
import { resolveDownstreams } from '../../src/proxy/registry.js';

describe('gateway downstream registry', () => {
  const downstreams = resolveDownstreams();

  it('registers every service except the gateway itself', () => {
    expect(downstreams).toHaveLength(29);
    expect(downstreams.find((entry) => entry.service === 'api-gateway')).toBeUndefined();
  });

  it('assigns a unique route prefix to every downstream', () => {
    const prefixes = downstreams.map((entry) => entry.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('points at the documented local ports', () => {
    const auth = downstreams.find((entry) => entry.service === 'auth-service');
    expect(auth?.upstream).toBe('http://localhost:4101');
    expect(auth?.prefix).toBe('/auth');
  });
});
`;

function scaffoldService(svc) {
  const dir = 'services/' + svc.name;

  write(dir + '/package.json', pkgJson(svc));
  write(dir + '/tsconfig.json', tsconfig());
  write(dir + '/.env.example', envExample(svc));
  write(dir + '/README.md', serviceReadme(svc));

  write(dir + '/src/config/index.ts', configFile(svc));
  write(dir + '/src/app.ts', appFile(svc));
  write(dir + '/src/server.ts', serverFile);
  write(dir + '/src/plugins/request-context.ts', requestContextPlugin);
  write(dir + '/src/routes/health.ts', healthRoutes);
  write(dir + '/src/routes/index.ts', routesIndex);
  write(dir + '/src/controllers/health.controller.ts', healthController);
  write(dir + '/src/services/health.service.ts', healthService);
  write(dir + '/src/errors/index.ts', errorsIndex);
  write(dir + '/src/utils/index.ts', utilsIndex);

  keep(dir + '/src/repositories/.gitkeep');
  keep(dir + '/src/models/.gitkeep');
  keep(dir + '/src/schemas/.gitkeep');
  keep(dir + '/src/events/.gitkeep');
  keep(dir + '/src/jobs/.gitkeep');

  write(dir + '/tests/unit/health.service.test.ts', unitTest(svc));
  write(dir + '/tests/integration/http.test.ts', integrationTest);
  keep(dir + '/tests/e2e/.gitkeep');

  if (svc.gateway) {
    write(dir + '/src/proxy/registry.ts', gatewayRegistry);
    write(dir + '/src/routes/proxy.ts', gatewayProxyRoutes);
    write(dir + '/tests/unit/registry.test.ts', gatewayUnitTest);
  }
}

function scaffoldRootTsconfig() {
  const references = [
    ...PACKAGES.map((pkg) => ({ path: './packages/' + pkg })),
    ...SERVICES.map((svc) => ({ path: './services/' + svc.name })),
  ];
  write('tsconfig.json', JSON.stringify({ files: [], references }, null, 2) + '\n');
}

function scaffoldCompose() {
  const infra = `name: localwala

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: localwala
      POSTGRES_PASSWORD: localwala
      POSTGRES_DB: localwala
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U localwala"]
      interval: 5s
      timeout: 5s
      retries: 10

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  kafka:
    image: bitnami/kafka:3.7
    ports:
      - "9092:9092"
    environment:
      KAFKA_CFG_NODE_ID: "0"
      KAFKA_CFG_PROCESS_ROLES: controller,broker
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 0@kafka:9093
      KAFKA_CFG_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_CFG_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: "true"
      ALLOW_PLAINTEXT_LISTENER: "yes"
    volumes:
      - kafka_data:/bitnami/kafka
    healthcheck:
      test: ["CMD-SHELL", "kafka-topics.sh --bootstrap-server localhost:9092 --list"]
      interval: 10s
      timeout: 10s
      retries: 10

`;

  const apps = SERVICES.map((svc) => {
    const upstreams = svc.gateway
      ? SERVICES.filter((s) => s.name !== 'api-gateway')
          .map(
            (s) =>
              `      UPSTREAM_${s.name.toUpperCase().replace(/-/g, '_')}: http://${s.name}:${s.port}`,
          )
          .join('\n') + '\n'
      : '';

    return `  ${svc.name}:
    profiles: ["apps"]
    build:
      context: ../..
      dockerfile: infrastructure/docker/Dockerfile.service
      args:
        SERVICE: "@localwala/${svc.name}"
        SERVICE_DIR: ${svc.name}
    environment:
      NODE_ENV: production
      PORT: "${svc.port}"
      LOG_LEVEL: info
      SERVICE_VERSION: 0.1.0
      KAFKA_BROKERS: kafka:9092
      REDIS_URL: redis://redis:6379
${upstreams}    ports:
      - "${svc.port}:${svc.port}"
    depends_on:
      redis:
        condition: service_healthy
      kafka:
        condition: service_healthy
    restart: unless-stopped

`;
  }).join('');

  const volumes = `volumes:
  postgres_data:
  mongo_data:
  redis_data:
  kafka_data:
`;

  write('infrastructure/docker/docker-compose.yml', infra + apps + volumes);
}

function scaffoldServiceRegistry() {
  const rows = SERVICES.map((svc) => `| \`${svc.name}\` | ${svc.port} | ${svc.desc} |`).join('\n');

  write(
    'docs/architecture/service-registry.md',
    `# LocalWala Service Registry

Generated by \`tools/scaffold.mjs\`. Every service is an independently deployable
microservice with its own port, container and data ownership boundary.

| Service | Port | Responsibility |
| --- | --- | --- |
${rows}

## Rules

- One service owns each authoritative state. No other service writes its data.
- Synchronous access between services is through documented REST contracts.
- Asynchronous propagation is through versioned Kafka domain events.
- High-frequency GPS coordinates never travel through Kafka; they use Redis.
- The gateway routes \`/<service-prefix>/...\` to each upstream; prefixes are unique.
`,
  );
}

for (const svc of SERVICES) {
  scaffoldService(svc);
}
scaffoldRootTsconfig();
scaffoldCompose();
scaffoldServiceRegistry();

const prettierBin = join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
const prettier = spawnSync(
  process.execPath,
  [
    prettierBin,
    '--write',
    'services/**/*.{ts,json,md}',
    'tsconfig.json',
    'docs/architecture/service-registry.md',
    'infrastructure/docker/docker-compose.yml',
  ],
  { cwd: root, stdio: 'inherit' },
);

if (prettier.status !== 0) {
  console.warn('Prettier formatting step failed; run npm run format manually.');
}

console.log(
  'Scaffolded ' + SERVICES.length + ' services, root tsconfig, compose file and service registry.',
);
