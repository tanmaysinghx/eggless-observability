import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SsoService } from '../services/sso.service';

export const authGuard: CanActivateFn = (route, state) => {
  const ssoService = inject(SsoService);
  const router = inject(Router);

  if (ssoService.currentUserValue) {
    return true;
  }

  // Preserve target URL in queryParams for post-login redirect
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};
