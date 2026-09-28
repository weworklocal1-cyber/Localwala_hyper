import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AdminShell } from './admin-shell';
import { ADMIN_NAV, ADMIN_SECTIONS } from '../core/nav/admin-nav';

describe('AdminShell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders every §33 section as a sidenav link', () => {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('.nav-link');
    expect(links.length).toBe(ADMIN_SECTIONS.length);
    expect(links.length).toBe(29);
    const labels = Array.from(links).map((link) => link.textContent?.trim());
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Audit logs');
    expect(labels).toContain('Zones/localities');
  });

  it('groups sections under the §33 navigation headings', () => {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    const groups = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.nav-group__label'),
    ).map((el) => el.textContent?.trim());
    expect(groups).toEqual(ADMIN_NAV.map((group) => group.group));
    expect(groups).toContain('Overview');
    expect(groups).toContain('Fulfillment');
    expect(groups).toContain('Operations');
  });

  it('renders brand and toolbar titles from strings', () => {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('LocalWala Admin');
    expect(compiled.querySelector('.toolbar__title')?.textContent).toContain(
      'Admin Control Center',
    );
  });

  it('contains a routed content outlet', () => {
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).toBeTruthy();
  });
});
