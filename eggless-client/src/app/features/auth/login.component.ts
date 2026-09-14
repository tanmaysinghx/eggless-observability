import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SsoService } from '../../core/services/sso.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-screen w-screen bg-[#0b0e14] text-[#e6edf3] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <!-- Background Ambient Glow -->
      <div class="absolute -top-40 -left-40 w-96 h-96 bg-[#f59e0b]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-[#3b82f6]/10 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Main Login Container Card -->
      <div class="w-full max-w-md bg-[#121722] border border-[#20293a] rounded-xl p-8 shadow-2xl space-y-6 relative z-10">
        <!-- Brand Header -->
        <div class="text-center space-y-2">
          <div class="w-16 h-16 rounded-2xl eggless-logo-box border border-[#f59e0b]/40 p-2 mx-auto flex items-center justify-center shadow-xl shadow-[#f59e0b]/10">
            <img src="eggless-logo.png" alt="Eggless Logo" class="w-full h-full object-contain" />
          </div>

          <h1 class="text-xl font-bold text-white tracking-tight">Eggless Observability</h1>
          <p class="text-[#94a3b8] text-xs">Application Logs & Enterprise Observability Platform</p>
        </div>

        <!-- Portal SSO Identity Badge -->
        <div class="p-3 bg-[#161e2c] border border-[#f59e0b]/30 rounded-lg flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded bg-[#f59e0b]/20 text-[#f59e0b] flex items-center justify-center font-bold text-[10px]">
              SSO
            </div>
            <div>
              <div class="font-bold text-white">Portal SSO Provider</div>
              <div class="text-[10px] text-[#64748b] font-mono">OAuth 2.1 • OIDC PKCE Protocol</div>
            </div>
          </div>

          <span class="px-2 py-0.5 rounded bg-[#10b981]/15 text-[#34d399] text-[10px] font-mono font-semibold">
            ● READY
          </span>
        </div>

        <!-- Single Sign-On Primary Button -->
        <button
          (click)="onPortalSsoQuickLogin()"
          class="w-full py-3 bg-[#f59e0b] hover:bg-[#d97706] text-[#0b0e14] font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#f59e0b]/20 group"
        >
          <svg class="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          Sign In with Portal SSO →
        </button>

        <div class="flex items-center justify-between text-[10px] text-[#64748b] font-mono border-t border-[#20293a] pt-4">
          <span>Tenant: <span class="text-[#e6edf3]">acme-corp.portalsso.local</span></span>
          <span>Port: <span class="text-[#f59e0b]">8080</span></span>
        </div>

        <!-- Manual Credentials Option Accordion -->
        <div class="pt-2">
          <button (click)="showManualForm = !showManualForm" class="w-full text-center text-[#64748b] hover:text-[#94a3b8] text-[11px] underline">
            {{ showManualForm ? 'Hide credentials form' : 'Or sign in with specific Portal SSO account credentials' }}
          </button>

          <form *ngIf="showManualForm" (submit)="onManualSubmit($event)" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Portal SSO Email</label>
              <input [(ngModel)]="email" name="email" type="email" placeholder="admin@portalsso.local" class="w-full bg-[#0b0e14] text-white p-2.5 rounded border border-[#20293a] focus:border-[#f59e0b] font-mono" />
            </div>

            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Password</label>
              <input [(ngModel)]="password" name="password" type="password" placeholder="••••••••••••" class="w-full bg-[#0b0e14] text-white p-2.5 rounded border border-[#20293a] focus:border-[#f59e0b] font-mono" />
            </div>

            <button type="submit" class="w-full py-2 bg-[#1c273a] hover:bg-[#25334c] text-white font-semibold rounded border border-[#20293a] transition-colors">
              Authenticate Credentials
            </button>
          </form>
        </div>

        <!-- Footer Notice -->
        <div class="text-center text-[10px] text-[#64748b] font-sans">
          Protected by Portal SSO OAuth2 PKCE engine. All login activity is audited.
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private ssoService = inject(SsoService);
  private router = inject(Router);

  email = 'admin@portalsso.local';
  password = 'AdminPassword123!';
  showManualForm = false;

  onPortalSsoQuickLogin() {
    this.ssoService.loginWithDemoPortalSso('admin@portalsso.local', 'Alex Rivera');
    this.router.navigate(['/logs']);
  }

  async onManualSubmit(e: Event) {
    e.preventDefault();
    await this.ssoService.loginWithPortalSsoCredentials(this.email, this.password);
    this.router.navigate(['/logs']);
  }
}
