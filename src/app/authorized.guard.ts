import {inject, Injectable} from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, GuardResult, MaybeAsync, RouterStateSnapshot } from '@angular/router';
import {Auth} from '@angular/fire/auth';
import {environment} from './environments/environment.prod';

@Injectable({
  providedIn: 'root'
})
export class AuthorizedGuard implements CanActivate {

  private auth: Auth = inject(Auth);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): MaybeAsync<GuardResult> {

    if ( environment.authRequired ) {
      if ( this.auth.currentUser === null ) {
        return false;
      }
      if ( environment.authorizedUids.length === 0 ) {
        return false;
      }
      if ( environment.authorizedUids.filter((uid: string)=> uid === this.auth.currentUser?.uid).length === 0 ) {
        // Need to redirect to a 403-like page.
        return false;
      }
    }
    return true;
  }

}
