import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SECTION_LABELS, SECTION_MESSAGES } from '../core/strings/app.strings';

/**
 * Shared empty state for every admin section until its screen lands
 * (spec §32: empty/error states; copy passed via route data).
 */
@Component({
  selector: 'app-placeholder-page',
  template: `
    <section class="placeholder">
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
    </section>
  `,
  styles: `
    .placeholder {
      padding: var(--lw-spacing-lg);
      max-width: var(--lw-max-content);
    }
    h2 {
      margin: 0 0 var(--lw-spacing-sm);
      font-size: var(--lw-title);
      color: var(--lw-on-surface);
    }
    p {
      margin: 0;
      color: var(--lw-on-surface-variant);
    }
  `,
})
export class PlaceholderPage {
  private readonly route = inject(ActivatedRoute);

  readonly section = this.route.snapshot.data['section'] as string | undefined;
  readonly title = SECTION_LABELS[this.section ?? ''] ?? 'Admin';
  readonly message = SECTION_MESSAGES[this.section ?? ''] ?? 'This section will appear here.';
}
