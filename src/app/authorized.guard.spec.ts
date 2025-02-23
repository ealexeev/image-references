import { TestBed } from '@angular/core/testing';

import { AuthorizedGuard } from './authorized.guard';
import {Auth} from '@angular/fire/auth';

describe('AuthorizedGuard', () => {
  let guard: AuthorizedGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: {currentUser: null} },
      ]
    });
    guard = TestBed.inject(AuthorizedGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
