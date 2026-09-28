import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ADMIN_NAV } from '../core/nav/admin-nav';
import { APP_TITLE, TOOLBAR_TITLE } from '../core/strings/app.strings';

/**
 * Admin shell: sidenav grouped by §33 sections + toolbar + routed content.
 */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
})
export class AdminShell {
  readonly navGroups = ADMIN_NAV;
  readonly appTitle = APP_TITLE;
  readonly toolbarTitle = TOOLBAR_TITLE;
}
