import { Injector, inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SsoService } from '../services/sso.service';

/** Sends the user back to sign-in when the management API reports the session is gone. */
export const sessionExpiredInterceptor: HttpInterceptorFn = (req, next) => {
  // Resolved lazily: SsoService's constructor issues HTTP calls (/api/auth/config) that pass through
  // here, so injecting it eagerly is a circular dependency (NG0200). That error was swallowed, left
  // Eggless "not configured", and sent every sign-in to /setup.
  const injector = inject(Injector);

  return next(req).pipe(
    catchError((err: unknown) => {
      // Ingestion calls (e.g. "send test log") answer 401 for a bad API key, not a lost session.
      const isIngest = req.method === 'POST' && req.headers.has('X-API-Key');
      if (err instanceof HttpErrorResponse && err.status === 401 && req.url.includes('/api/v1/') && !isIngest) {
        const ssoService = injector.get(SsoService);
        if (ssoService.currentUserValue) {
          ssoService.handleSessionExpired();
          const router = injector.get(Router);
          router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        }
      }
      return throwError(() => err);
    })
  );
};
