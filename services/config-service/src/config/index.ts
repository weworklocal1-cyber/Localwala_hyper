import { serviceEnv, type ServiceEnv } from '@localwala/config';

export const SERVICE_NAME = 'config-service' as const;
export const SERVICE_PORT = 4104;

export const config: ServiceEnv = serviceEnv(SERVICE_NAME, SERVICE_PORT);
