import { serviceEnv, type ServiceEnv } from '@localwala/config';

export const SERVICE_NAME = 'store-service' as const;
export const SERVICE_PORT = 4123;

export const config: ServiceEnv = serviceEnv(SERVICE_NAME, SERVICE_PORT);
