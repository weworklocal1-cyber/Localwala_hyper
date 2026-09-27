import { serviceEnv, type ServiceEnv } from '@localwala/config';

export const SERVICE_NAME = 'local-services-service' as const;
export const SERVICE_PORT = 4126;

export const config: ServiceEnv = serviceEnv(SERVICE_NAME, SERVICE_PORT);
