import { serviceEnv, type ServiceEnv } from '@localwala/config';

export const SERVICE_NAME = 'delivery-service' as const;
export const SERVICE_PORT = 4118;

export const config: ServiceEnv = serviceEnv(SERVICE_NAME, SERVICE_PORT);
