import { TestBed } from '@angular/core/testing';

import { AuthenticatedGuard } from './authenticated.guard';
import {Router} from '@angular/router';
import {Auth} from '@angular/fire/auth';

describe('AuthenticatedGuard', () => {
  let guard: AuthenticatedGuard;
  const router = {
    navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true))
  }
  const auth = {
    currentUser: null
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: Auth, useValue: auth },
      ],
    });
    guard = TestBed.inject(AuthenticatedGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
