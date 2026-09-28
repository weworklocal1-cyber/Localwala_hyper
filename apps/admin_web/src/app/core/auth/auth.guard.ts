import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { SessionService } from './session.service';

/** Blocks admin sections until a session token exists (server-side RBAC is authoritative — spec §30). */
export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const session = inject<SessionService>(SessionService);
  if (session.hasToken()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login']);
};
