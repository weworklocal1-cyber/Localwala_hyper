import { Injectable } from '@angular/core';

/**
 * Admin session token storage (spec §31 secure-storage requirement targets
 * Flutter apps; a browser admin panel uses `localStorage` — documented in
 * the README with the short-session/refresh tradeoff).
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private static readonly ACCESS_TOKEN_KEY = 'admin.access_token';

  getToken(): string | null {
    return localStorage.getItem(SessionService.ACCESS_TOKEN_KEY);
  }

  hasToken(): boolean {
    return (this.getToken() ?? '').length > 0;
  }

  setToken(token: string): void {
    localStorage.setItem(SessionService.ACCESS_TOKEN_KEY, token);
  }

  clear(): void {
    localStorage.removeItem(SessionService.ACCESS_TOKEN_KEY);
  }
}
