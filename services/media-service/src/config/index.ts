import { serviceEnv, type ServiceEnv } from '@localwala/config';

export const SERVICE_NAME = 'media-service' as const;
export const SERVICE_PORT = 4105;

export const config: ServiceEnv = serviceEnv(SERVICE_NAME, SERVICE_PORT);
