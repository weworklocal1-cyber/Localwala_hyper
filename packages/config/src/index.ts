export type NodeEnv = 'development' | 'test' | 'production';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function envString(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, received: ${raw}`);
  }
  return parsed;
}

export function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export function envList(name: string, fallback: string[] = []): string[] {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function nodeEnv(): NodeEnv {
  const raw = envString('NODE_ENV', 'development');
  if (raw === 'production' || raw === 'test') return raw;
  return 'development';
}

export interface ServiceEnv {
  serviceName: string;
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  logLevel: string;
  kafkaBrokers: string[];
  redisUrl: string;
  isProduction: boolean;
  isTest: boolean;
}

export function serviceEnv(serviceName: string, defaultPort: number): ServiceEnv {
  const env = nodeEnv();
  return {
    serviceName,
    nodeEnv: env,
    host: envString('HOST', '0.0.0.0'),
    port: envInt('PORT', defaultPort),
    logLevel: envString('LOG_LEVEL', env === 'test' ? 'silent' : 'info'),
    kafkaBrokers: envList('KAFKA_BROKERS', ['localhost:9092']),
    redisUrl: envString('REDIS_URL', 'redis://localhost:6379'),
    isProduction: env === 'production',
    isTest: env === 'test',
  };
}
