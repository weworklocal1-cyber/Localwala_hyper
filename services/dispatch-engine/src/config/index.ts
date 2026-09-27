import { serviceEnv, type ServiceEnv } from '@localwala/config';

export const SERVICE_NAME = 'dispatch-engine' as const;
export const SERVICE_PORT = 4119;

export const config: ServiceEnv = serviceEnv(SERVICE_NAME, SERVICE_PORT);
