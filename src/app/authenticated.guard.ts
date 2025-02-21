import {inject, Injectable} from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  GuardResult,
  MaybeAsync,
  Router,
  RouterStateSnapshot
} from '@angular/router';
import {Auth} from '@angular/fire/auth';
import {environment} from './environments/environment.prod';

@Injectable({
  providedIn: 'root'
})
export class AuthenticatedGuard implements CanActivate {

  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): MaybeAsync<GuardResult> {

    if ( environment.authRequired && this.auth.currentUser === null ) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }
    return true;
  }

}
