/** Single source of shell UI copy (spec §32: localization-ready strings). */
import { ADMIN_NAV } from '../nav/admin-nav';

export const APP_TITLE = 'LocalWala Admin';
export const TOOLBAR_TITLE = 'Admin Control Center';

/** Placeholder copy per route section id (nav paths + login). */
export const SECTION_MESSAGES: Readonly<Record<string, string>> = {
  dashboard: 'Revenue, orders and operational metrics will appear here.',
  analytics: 'Platform analytics will appear here.',
  users: 'Customer accounts will appear here.',
  partners: 'Partner businesses will appear here.',
  'partner-staff': 'Partner staff and roles will appear here.',
  employees: 'Employees and field executives will appear here.',
  restaurants: 'Restaurant listings will appear here.',
  stores: 'Store listings will appear here.',
  dairy: 'Dairy subscriptions will appear here.',
  zatka: 'Zatka services will appear here.',
  services: 'Local services will appear here.',
  properties: 'Property listings will appear here.',
  orders: 'Order management will appear here.',
  payments: 'Payment transactions will appear here.',
  refunds: 'Refund workflows will appear here.',
  wallet: 'Wallet ledgers will appear here.',
  settlements: 'Settlement cycles will appear here.',
  delivery: 'Delivery operations will appear here.',
  drivers: 'Driver management will appear here.',
  geography: 'Service geography and GeoJSON will appear here.',
  zones: 'Zones and localities will appear here.',
  'home-builder': 'Home layout builder will appear here.',
  media: 'Lottie and media assets will appear here.',
  promotions: 'Promotions will appear here.',
  notifications: 'Notification campaigns will appear here.',
  support: 'Support inbox will appear here.',
  'feature-flags': 'Feature flags will appear here.',
  settings: 'System settings will appear here.',
  audit: 'Audit logs will appear here.',
  login: 'Administrator sign-in arrives with the auth feature.',
};

/** Labels for every nav section (single source with the sidenav). */
export const SECTION_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  ADMIN_NAV.flatMap((group) => group.items.map((item) => [item.path, item.label])),
);
