import { serviceEnv, type ServiceEnv } from '@localwala/config';

export const SERVICE_NAME = 'api-gateway' as const;
export const SERVICE_PORT = 4000;

export const config: ServiceEnv = serviceEnv(SERVICE_NAME, SERVICE_PORT);
