import fastifyHttpProxy from '@fastify/http-proxy';
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
