import { connect } from 'node:net';
import type { HealthResponse, ReadinessCheck, ReadinessResponse } from '@localwala/contracts';
import { SERVICE_NAME } from '../config/index.js';

const STARTED_AT = Date.now();
const VERSION = process.env.SERVICE_VERSION ?? '0.1.0';
const PROBE_TIMEOUT_MS = 2_000;

interface Dependency {
  name: string;
  protocol: 'tcp' | 'redis';
  target: () => { host: string; port: number } | null;
}

function hostPortFromUrl(
  raw: string | undefined,
  defaultPort: number,
): { host: string; port: number } | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!url.hostname) return null;
    return { host: url.hostname, port: url.port === '' ? defaultPort : Number(url.port) };
  } catch {
    return null;
  }
}

function brokerTarget(raw: string | undefined): { host: string; port: number } | null {
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim();
  if (!first) return null;
  const [host, port] = first.split(':');
  if (!host) return null;
  return { host, port: port === undefined ? 9092 : Number(port) };
}

const DEPENDENCIES: Dependency[] = [
  {
    name: 'postgresql',
    protocol: 'tcp',
    target: () => hostPortFromUrl(process.env.DATABASE_URL, 5432),
  },
  {
    name: 'mongodb',
    protocol: 'tcp',
    target: () => hostPortFromUrl(process.env.MONGODB_URI, 27017),
  },
  { name: 'redis', protocol: 'redis', target: () => hostPortFromUrl(process.env.REDIS_URL, 6379) },
  { name: 'kafka', protocol: 'tcp', target: () => brokerTarget(process.env.KAFKA_BROKERS) },
];

function probeTcp(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    let settled = false;
    const settle = (up: boolean): void => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS, () => settle(false));
    socket.once('connect', () => settle(true));
    socket.once('error', () => settle(false));
  });
}

function probeRedis(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    let settled = false;
    const settle = (up: boolean): void => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS, () => settle(false));
    socket.once('error', () => settle(false));
    socket.once('connect', () => socket.write('PING\r\n'));
    socket.once('data', (chunk: Buffer) => settle(chunk.toString('utf8').startsWith('+PONG')));
  });
}

export function getHealth(): HealthResponse {
  return {
    status: 'ok',
    service: SERVICE_NAME,
    version: VERSION,
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    timestamp: new Date().toISOString(),
  };
}

export async function getReadiness(extraChecks: ReadinessCheck[] = []): Promise<ReadinessResponse> {
  const probed = await Promise.all(
    DEPENDENCIES.map(async (dependency): Promise<ReadinessCheck | null> => {
      const target = dependency.target();
      if (!target) return null;
      const up =
        dependency.protocol === 'redis'
          ? await probeRedis(target.host, target.port)
          : await probeTcp(target.host, target.port);
      return {
        name: dependency.name,
        status: up ? 'up' : 'down',
        detail: target.host + ':' + target.port,
      };
    }),
  );

  const checks: ReadinessCheck[] = [
    { name: 'process', status: 'up' },
    ...probed.filter((check): check is ReadinessCheck => check !== null),
    ...extraChecks,
  ];

  return {
    status: checks.every((check) => check.status === 'up') ? 'ready' : 'not_ready',
    service: SERVICE_NAME,
    checks,
  };
}
