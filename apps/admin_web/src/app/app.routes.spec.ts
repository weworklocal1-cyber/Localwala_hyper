import { routes } from './app.routes';
import { ADMIN_SECTIONS } from './core/nav/admin-nav';
import { AdminShell } from './layout/admin-shell';
import { PlaceholderPage } from './shared/placeholder-page';

describe('routes', () => {
  const shell = routes.find((route) => route.path === '');
  const children = shell?.children ?? [];

  it('redirects the empty path to the dashboard', () => {
    const exact = children.find((route) => route.path === '');
    expect(exact?.pathMatch).toBe('full');
    expect(exact?.redirectTo).toBe('dashboard');
  });

  it('defines a placeholder route for every admin section', () => {
    for (const section of ADMIN_SECTIONS) {
      const route = children.find((candidate) => candidate.path === section.path);
      expect(route, `missing route for ${section.path}`).toBeTruthy();
      expect(route?.component).toBe(PlaceholderPage);
      expect(route?.data?.['section']).toBe(section.path);
    }
    expect(children.filter((route) => route.component === PlaceholderPage)).toHaveLength(
      ADMIN_SECTIONS.length,
    );
  });

  it('guards the shell and exposes a public login route', () => {
    expect(shell?.component).toBe(AdminShell);
    expect(shell?.canActivate?.length).toBeGreaterThan(0);
    const login = routes.find((route) => route.path === 'login');
    expect(login?.component).toBe(PlaceholderPage);
    expect(login?.canActivate).toBeUndefined();
  });

  it('catches unknown paths', () => {
    const fallback = routes.find((route) => route.path === '**');
    expect(fallback?.redirectTo).toBe('dashboard');
  });
});
