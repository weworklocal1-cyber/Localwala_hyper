import { serviceEnv, type ServiceEnv } from '@localwala/config';

export const SERVICE_NAME = 'order-service' as const;
export const SERVICE_PORT = 4112;

export const config: ServiceEnv = serviceEnv(SERVICE_NAME, SERVICE_PORT);
