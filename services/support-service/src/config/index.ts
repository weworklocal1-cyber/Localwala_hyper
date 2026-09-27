import { serviceEnv, type ServiceEnv } from '@localwala/config';

export const SERVICE_NAME = 'support-service' as const;
export const SERVICE_PORT = 4108;

export const config: ServiceEnv = serviceEnv(SERVICE_NAME, SERVICE_PORT);
