import { TestBed } from '@angular/core/testing';

import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionService);
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('round-trips and clears the access token', () => {
    expect(service.getToken()).toBeNull();
    expect(service.hasToken()).toBe(false);

    service.setToken('tok-1');
    expect(service.getToken()).toBe('tok-1');
    expect(service.hasToken()).toBe(true);

    service.clear();
    expect(service.getToken()).toBeNull();
    expect(service.hasToken()).toBe(false);
  });
});
