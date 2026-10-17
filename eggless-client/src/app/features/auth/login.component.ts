import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SsoService } from '../../core/services/sso.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen w-full bg-slate-50 dark:bg-[#0b0e14] text-slate-800 dark:text-[#e6edf3] flex items-center justify-center p-4 relative overflow-hidden font-sans transition-colors">
      <!-- Subtle Ambient Glow -->
      <div class="absolute -top-32 -left-32 w-80 h-80 bg-amber-500/10 dark:bg-[#f59e0b]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-32 -right-32 w-80 h-80 bg-blue-500/10 dark:bg-[#3b82f6]/10 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Main Container Card -->
      <div class="w-full max-w-md bg-white dark:bg-[#121722] border border-slate-200 dark:border-[#20293a] rounded-2xl p-7 shadow-xl space-y-6 relative z-10">
        <!-- Brand Header -->
        <div class="text-center space-y-2">
          <div class="w-14 h-14 rounded-2xl eggless-logo-box border border-slate-200 dark:border-[#20293a] p-2 mx-auto flex items-center justify-center shadow-sm">
            <img src="eggless-logo.png" alt="Eggless Logo" class="w-full h-full object-contain" />
          </div>

          <h1 class="text-xl font-bold text-slate-900 dark:text-[#f0f4f8] tracking-tight">Eggless Observability</h1>
          <p class="text-slate-500 dark:text-[#94a3b8] text-xs">High-throughput logs & distributed systems observability</p>
        </div>

        <!-- Portal SSO Identity / Connectivity Badge -->
        <div class="p-3 bg-slate-50 dark:bg-[#161e2c] border border-slate-200 dark:border-[#20293a] rounded-xl flex items-center justify-between text-xs">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-[#f59e0b] flex items-center justify-center font-bold text-[10px] tracking-wide">
              SSO
            </div>
            <div>
              <div class="font-semibold text-slate-800 dark:text-[#f0f4f8]">Portal SSO Provider</div>
              <div class="text-[10px] text-slate-400 dark:text-[#64748b] font-mono truncate max-w-[190px]">
                {{ portalConfig.baseUrl }}
              </div>
            </div>
          </div>

          <span
            class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1.5"
            [ngClass]="ssoOnline ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40' : 'bg-slate-100 dark:bg-[#1f293d] text-slate-500 dark:text-[#94a3b8]'"
          >
            <span class="w-1.5 h-1.5 rounded-full" [ngClass]="ssoOnline ? 'bg-emerald-500' : 'bg-slate-400'"></span>
            {{ ssoOnline ? 'ONLINE' : 'ACTIVE' }}
          </span>
        </div>

        <!-- Interactive Single Sign-On (Primary Action) -->
        <div class="space-y-3">
          <button
            (click)="onPortalSsoInteractiveLogin()"
            [disabled]="loading"
            class="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-lg transition-all text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 group disabled:opacity-50"
          >
            <svg class="w-4 h-4 text-slate-950 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            <span>Sign In with Portal SSO (OIDC PKCE)</span>
          </button>

          <p class="text-[11px] text-slate-400 dark:text-[#64748b] text-center">
            Standard OAuth 2.1 protocol with S256 code challenge
          </p>
        </div>

        <!-- Divider -->
        <div class="relative flex items-center justify-center">
          <div class="border-t border-slate-200 dark:border-[#20293a] w-full"></div>
          <span class="bg-white dark:bg-[#121722] px-3 text-[11px] text-slate-400 dark:text-[#64748b] absolute">
            or use External Auth REST API
          </span>
        </div>

        <!-- Mode Toggle Tabs (Login vs Register) -->
        <div class="flex items-center bg-slate-100 dark:bg-[#0b0e14] p-0.5 rounded-lg text-xs font-medium">
          <button
            (click)="authMode = 'login'; errorMessage = null"
            [ngClass]="authMode === 'login' ? 'bg-white dark:bg-[#1c273a] text-slate-900 dark:text-white shadow-sm font-semibold' : 'text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white'"
            class="flex-1 py-1.5 rounded-md transition-all text-center"
          >
            Account Login
          </button>
          <button
            (click)="authMode = 'register'; errorMessage = null"
            [ngClass]="authMode === 'register' ? 'bg-white dark:bg-[#1c273a] text-slate-900 dark:text-white shadow-sm font-semibold' : 'text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white'"
            class="flex-1 py-1.5 rounded-md transition-all text-center"
          >
            Register User
          </button>
        </div>

        <!-- Error Notification Banner -->
        <div *ngIf="errorMessage" class="p-3 bg-rose-50 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800/40 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <svg class="w-4 h-4 shrink-0 mt-0.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="flex-1 leading-snug">
            <span class="font-semibold">Authentication Error:</span> {{ errorMessage }}
          </div>
        </div>

        <!-- FORM: Direct Login -->
        <form *ngIf="authMode === 'login'" (submit)="onDirectLogin($event)" class="space-y-3.5 text-xs">
          <div>
            <label class="block text-slate-600 dark:text-[#94a3b8] font-medium mb-1">Portal Email</label>
            <input
              [(ngModel)]="email"
              name="email"
              type="email"
              required
              placeholder="user@example.com"
              class="w-full bg-slate-50 dark:bg-[#0b0e14] text-slate-900 dark:text-[#f0f4f8] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] focus:outline-none focus:border-amber-500 font-mono transition-colors"
            />
          </div>

          <div>
            <label class="block text-slate-600 dark:text-[#94a3b8] font-medium mb-1">Password</label>
            <input
              [(ngModel)]="password"
              name="password"
              type="password"
              required
              placeholder="••••••••••••"
              class="w-full bg-slate-50 dark:bg-[#0b0e14] text-slate-900 dark:text-[#f0f4f8] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] focus:outline-none focus:border-amber-500 font-mono transition-colors"
            />
          </div>

          <button
            type="submit"
            [disabled]="loading"
            class="w-full py-2.5 bg-slate-900 dark:bg-[#1c273a] hover:bg-slate-800 dark:hover:bg-[#25334c] text-white font-semibold rounded-lg border border-slate-200 dark:border-[#20293a] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span *ngIf="loading" class="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></span>
            <span>{{ loading ? 'Verifying Credentials...' : 'Sign In with Email' }}</span>
          </button>
        </form>

        <!-- FORM: Headless Registration -->
        <form *ngIf="authMode === 'register'" (submit)="onDirectRegister($event)" class="space-y-3.5 text-xs">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-600 dark:text-[#94a3b8] font-medium mb-1">First Name</label>
              <input
                [(ngModel)]="firstName"
                name="firstName"
                type="text"
                placeholder="Taylor"
                class="w-full bg-slate-50 dark:bg-[#0b0e14] text-slate-900 dark:text-[#f0f4f8] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label class="block text-slate-600 dark:text-[#94a3b8] font-medium mb-1">Last Name</label>
              <input
                [(ngModel)]="lastName"
                name="lastName"
                type="text"
                placeholder="Swift"
                class="w-full bg-slate-50 dark:bg-[#0b0e14] text-slate-900 dark:text-[#f0f4f8] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label class="block text-slate-600 dark:text-[#94a3b8] font-medium mb-1">Email</label>
            <input
              [(ngModel)]="email"
              name="email"
              type="email"
              required
              placeholder="new.user@example.com"
              class="w-full bg-slate-50 dark:bg-[#0b0e14] text-slate-900 dark:text-[#f0f4f8] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] focus:outline-none focus:border-amber-500 font-mono transition-colors"
            />
          </div>

          <div>
            <label class="block text-slate-600 dark:text-[#94a3b8] font-medium mb-1">Password</label>
            <input
              [(ngModel)]="password"
              name="password"
              type="password"
              required
              minlength="8"
              placeholder="Minimum 8 characters"
              class="w-full bg-slate-50 dark:bg-[#0b0e14] text-slate-900 dark:text-[#f0f4f8] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] focus:outline-none focus:border-amber-500 font-mono transition-colors"
            />
          </div>

          <button
            type="submit"
            [disabled]="loading"
            class="w-full py-2.5 bg-slate-900 dark:bg-[#1c273a] hover:bg-slate-800 dark:hover:bg-[#25334c] text-white font-semibold rounded-lg border border-slate-200 dark:border-[#20293a] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span *ngIf="loading" class="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></span>
            <span>{{ loading ? 'Creating Account in Portal...' : 'Register in Portal SSO' }}</span>
          </button>
        </form>

        <!-- Developer Demo Shortcut -->
        <div class="pt-2 border-t border-slate-100 dark:border-[#20293a] flex items-center justify-between text-[11px]">
          <span class="text-slate-400 dark:text-[#64748b]">Local developer?</span>
          <button
            (click)="onQuickDemoLogin()"
            class="text-amber-600 dark:text-amber-400 hover:underline font-medium"
          >
            Sign in as Demo Admin →
          </button>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  private ssoService = inject(SsoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  portalConfig = this.ssoService.getConfig();
  authMode: 'login' | 'register' = 'login';

  email = 'alex.rivera@tanmaysinghx.com';
  password = 'SecurePassword123!';
  firstName = 'Alex';
  lastName = 'Rivera';

  loading = false;
  errorMessage: string | null = null;
  ssoOnline = false;

  private returnUrl = '/logs';

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['returnUrl']) {
        this.returnUrl = params['returnUrl'];
      }
    });

    this.checkHealth();
  }

  async checkHealth() {
    const health = await this.ssoService.checkPortalSsoHealth();
    this.ssoOnline = health.ok;
  }

  async onPortalSsoInteractiveLogin() {
    this.loading = true;
    this.errorMessage = null;
    try {
      await this.ssoService.initiatePortalSsoLogin();
    } catch (err: any) {
      this.loading = false;
      this.errorMessage = err.message || 'Failed to initialize Portal SSO redirection.';
    }
  }

  async onDirectLogin(e: Event) {
    e.preventDefault();
    if (!this.email || !this.password) return;

    this.loading = true;
    this.errorMessage = null;

    try {
      await this.ssoService.loginWithCredentials(this.email, this.password);
      this.router.navigateByUrl(this.returnUrl);
    } catch (err: any) {
      this.errorMessage = err.message || 'Failed to authenticate credentials in Portal SSO.';
    } finally {
      this.loading = false;
    }
  }

  async onDirectRegister(e: Event) {
    e.preventDefault();
    if (!this.email || !this.password) return;

    this.loading = true;
    this.errorMessage = null;

    try {
      await this.ssoService.registerWithCredentials(this.email, this.password, this.firstName, this.lastName);
      this.router.navigateByUrl(this.returnUrl);
    } catch (err: any) {
      this.errorMessage = err.message || 'Portal SSO user registration failed.';
    } finally {
      this.loading = false;
    }
  }

  onQuickDemoLogin() {
    this.ssoService.loginWithDemoPortalSso();
    this.router.navigateByUrl(this.returnUrl);
  }
}
