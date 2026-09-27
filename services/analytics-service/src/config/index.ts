import { serviceEnv, type ServiceEnv } from '@localwala/config';

export const SERVICE_NAME = 'analytics-service' as const;
export const SERVICE_PORT = 4128;

export const config: ServiceEnv = serviceEnv(SERVICE_NAME, SERVICE_PORT);
