import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PlaceholderPage } from './placeholder-page';
import { SECTION_LABELS, SECTION_MESSAGES } from '../core/strings/app.strings';

describe('PlaceholderPage', () => {
  const mount = async (section: string) => {
    await TestBed.configureTestingModule({
      imports: [PlaceholderPage],
      providers: [provideRouter([{ path: 'page', component: PlaceholderPage, data: { section } }])],
    }).compileComponents();
    return RouterTestingHarness.create('/page');
  };

  it('renders the label and copy for the routed section', async () => {
    const harness = await mount('users');
    const element = harness.routeNativeElement!;
    expect(element.querySelector('h2')?.textContent?.trim()).toBe(SECTION_LABELS['users']);
    expect(element.textContent).toContain(SECTION_MESSAGES['users']);
  });

  it('falls back to generic copy for unknown sections', async () => {
    const harness = await mount('does-not-exist');
    const element = harness.routeNativeElement!;
    expect(element.querySelector('h2')?.textContent?.trim()).toBe('Admin');
    expect(element.textContent).toContain('This section will appear here.');
  });

  it('reads the section from route data', async () => {
    const harness = await mount('users');
    const element = harness.routeNativeElement!;
    expect(element.querySelector('.placeholder')).toBeTruthy();
    expect(element.textContent).toContain(SECTION_LABELS['users']);
  });
});
