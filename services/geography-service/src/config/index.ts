import { serviceEnv, type ServiceEnv } from '@localwala/config';

export const SERVICE_NAME = 'geography-service' as const;
export const SERVICE_PORT = 4103;

export const config: ServiceEnv = serviceEnv(SERVICE_NAME, SERVICE_PORT);
