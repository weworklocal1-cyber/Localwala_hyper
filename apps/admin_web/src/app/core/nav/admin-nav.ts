/** Navigation model for the admin sidenav (spec §33: Admin Control Center). */

export interface NavItem {
  readonly path: string;
  readonly label: string;
}

export interface NavGroup {
  readonly group: string;
  readonly items: readonly NavItem[];
}

export const ADMIN_NAV: readonly NavGroup[] = [
  {
    group: 'Overview',
    items: [
      { path: 'dashboard', label: 'Dashboard' },
      { path: 'analytics', label: 'Analytics' },
    ],
  },
  {
    group: 'People',
    items: [
      { path: 'users', label: 'Users' },
      { path: 'partners', label: 'Partners' },
      { path: 'partner-staff', label: 'Partner staff' },
      { path: 'employees', label: 'Employees/executives' },
    ],
  },
  {
    group: 'Catalog',
    items: [
      { path: 'restaurants', label: 'Restaurants' },
      { path: 'stores', label: 'Stores' },
      { path: 'dairy', label: 'Dairy' },
      { path: 'zatka', label: 'Zatka' },
      { path: 'services', label: 'Services' },
      { path: 'properties', label: 'Properties' },
    ],
  },
  {
    group: 'Commerce',
    items: [
      { path: 'orders', label: 'Orders' },
      { path: 'payments', label: 'Payments' },
      { path: 'refunds', label: 'Refunds' },
      { path: 'wallet', label: 'Wallet' },
      { path: 'settlements', label: 'Settlements' },
    ],
  },
  {
    group: 'Fulfillment',
    items: [
      { path: 'delivery', label: 'Delivery' },
      { path: 'drivers', label: 'Drivers' },
    ],
  },
  {
    group: 'Location',
    items: [
      { path: 'geography', label: 'Geography' },
      { path: 'zones', label: 'Zones/localities' },
    ],
  },
  {
    group: 'Content',
    items: [
      { path: 'home-builder', label: 'Home builder' },
      { path: 'media', label: 'Lottie/media' },
      { path: 'promotions', label: 'Promotions' },
      { path: 'notifications', label: 'Notifications' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { path: 'support', label: 'Support' },
      { path: 'feature-flags', label: 'Feature flags' },
      { path: 'settings', label: 'System settings' },
      { path: 'audit', label: 'Audit logs' },
    ],
  },
];

/** Flat list of every admin section path. */
export const ADMIN_SECTIONS: readonly NavItem[] = ADMIN_NAV.flatMap((group) => group.items);
