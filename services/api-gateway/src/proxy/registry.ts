import { SERVICES, type ServiceName } from '@localwala/contracts';
import { envString } from '@localwala/config';

export interface DownstreamService {
  service: ServiceName;
  prefix: string;
  upstream: string;
}

const DEFAULT_PORTS: Record<string, number> = {
  'auth-service': 4101,
  'user-service': 4102,
  'geography-service': 4103,
  'config-service': 4104,
  'media-service': 4105,
  'notification-service': 4106,
  'search-service': 4107,
  'support-service': 4108,
  'catalog-service': 4109,
  'inventory-service': 4110,
  'cart-service': 4111,
  'order-service': 4112,
  'payment-service': 4113,
  'wallet-service': 4114,
  'promotion-service': 4115,
  'settlement-service': 4116,
  'referral-service': 4117,
  'delivery-service': 4118,
  'dispatch-engine': 4119,
  'driver-service': 4120,
  'tracking-service': 4121,
  'food-service': 4122,
  'store-service': 4123,
  'dairy-service': 4124,
  'zatka-service': 4125,
  'local-services-service': 4126,
  'realestate-service': 4127,
  'analytics-service': 4128,
  'audit-service': 4129,
};

function upstreamEnvName(service: ServiceName): string {
  return 'UPSTREAM_' + service.toUpperCase().replace(/-/g, '_');
}

function routePrefix(service: ServiceName): string {
  const trimmed = service.replace(/-service$/, '').replace(/-engine$/, '');
  return '/' + trimmed;
}

export function resolveDownstreams(): DownstreamService[] {
  return SERVICES.filter((service) => service !== 'api-gateway').map((service) => ({
    service,
    prefix: routePrefix(service),
    upstream: envString(upstreamEnvName(service), 'http://localhost:' + DEFAULT_PORTS[service]),
  }));
}
