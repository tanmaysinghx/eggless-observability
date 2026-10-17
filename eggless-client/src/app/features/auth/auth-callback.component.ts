import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SsoService } from '../../core/services/sso.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="h-screen w-screen bg-slate-50 dark:bg-[#0b0e14] text-slate-800 dark:text-[#e6edf3] flex items-center justify-center p-4">
      <div class="w-full max-w-md bg-white dark:bg-[#121722] border border-slate-200 dark:border-[#20293a] rounded-xl p-8 shadow-xl text-center space-y-6">
        <!-- Logo -->
        <div class="w-14 h-14 rounded-2xl eggless-logo-box border border-[#f59e0b]/40 p-2 mx-auto flex items-center justify-center shadow-lg shadow-[#f59e0b]/10">
          <img src="eggless-logo.png" alt="Eggless" class="w-full h-full object-contain" />
        </div>

        <!-- Processing State -->
        <div *ngIf="isProcessing" class="space-y-4">
          <div class="inline-block animate-spin w-8 h-8 border-2 border-[#f59e0b] border-t-transparent rounded-full"></div>
          <div>
            <h2 class="text-base font-semibold text-slate-900 dark:text-white">Connecting with Portal SSO</h2>
            <p class="text-xs text-slate-500 dark:text-[#94a3b8] mt-1 font-mono">
              Verifying OAuth 2.1 PKCE code challenge...
            </p>
          </div>
        </div>

        <!-- Success State -->
        <div *ngIf="isSuccess" class="space-y-3">
          <div class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Authenticated Successfully</h2>
          <p class="text-xs text-slate-500 dark:text-[#94a3b8]">Redirecting to Eggless Observability...</p>
        </div>

        <!-- Error State -->
        <div *ngIf="errorMessage" class="space-y-4 text-left">
          <div class="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-lg">
            <div class="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-xs mb-1">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Single Sign-On Failed</span>
            </div>
            <p class="text-[11px] text-rose-700 dark:text-rose-300 font-mono break-words">
              {{ errorMessage }}
            </p>
          </div>

          <div class="flex flex-col gap-2 pt-2">
            <a
              routerLink="/login"
              class="w-full py-2.5 bg-slate-900 dark:bg-[#1c273a] hover:bg-slate-800 dark:hover:bg-[#25334c] text-white text-xs font-semibold rounded-lg text-center transition-colors"
            >
              ← Back to Sign In
            </a>

            <button
              (click)="useDemoAccount()"
              class="w-full py-2 bg-transparent text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white text-xs underline"
            >
              Continue with Developer Demo Account instead
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AuthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ssoService = inject(SsoService);

  isProcessing = true;
  isSuccess = false;
  errorMessage: string | null = null;

  ngOnInit() {
    this.route.queryParams.subscribe(async (params) => {
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];
      const errorDesc = params['error_description'];

      if (error) {
        this.isProcessing = false;
        this.errorMessage = errorDesc ? `${error}: ${errorDesc}` : error;
        return;
      }

      if (!code || !state) {
        this.isProcessing = false;
        this.errorMessage = 'Missing authorization code or state parameter in callback redirect.';
        return;
      }

      try {
        await this.ssoService.handleOidcCallback(code, state);
        this.isProcessing = false;
        this.isSuccess = true;
        setTimeout(() => {
          this.router.navigate(['/logs']);
        }, 800);
      } catch (err: any) {
        this.isProcessing = false;
        this.errorMessage = err.message || 'Token exchange failed with Portal SSO server.';
      }
    });
  }

  useDemoAccount() {
    this.ssoService.loginWithDemoPortalSso();
    this.router.navigate(['/logs']);
  }
}
