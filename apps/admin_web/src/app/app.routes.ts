import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { ADMIN_SECTIONS } from './core/nav/admin-nav';
import { AdminShell } from './layout/admin-shell';
import { PlaceholderPage } from './shared/placeholder-page';

/**
 * Route table (spec §31 core/routing pattern; §33 admin sections).
 *
 * Paths are the deep-link contract — add routes here, not via ad-hoc
 * navigation.
 */
export const routes: Routes = [
  {
    path: 'login',
    component: PlaceholderPage,
    data: { section: 'login' },
    title: 'Sign in · LocalWala Admin',
  },
  {
    path: '',
    component: AdminShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      ...ADMIN_SECTIONS.map((section) => ({
        path: section.path,
        component: PlaceholderPage,
        data: { section: section.path },
        title: `${section.label} · LocalWala Admin`,
      })),
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
