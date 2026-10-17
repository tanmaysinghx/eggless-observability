import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { LogService } from '../../core/services/log.service';
import { ThemeService } from '../../core/services/theme.service';
import { SsoService } from '../../core/services/sso.service';
import { Environment } from '../../core/models/log.model';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-eggless-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <header class="h-14 bg-[#111622] border-b border-[#20293a] px-4 flex items-center justify-between gap-4 relative z-20 transition-colors">
      <!-- Left: Breadcrumb / Page Title -->
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs font-medium text-[#64748b]">Eggless</span>
        <span class="text-[#334155] text-xs">/</span>
        <h1 class="text-sm font-semibold text-[#f0f4f8] capitalize truncate tracking-tight">
          {{ currentTitle }}
        </h1>
        <span *ngIf="selectedApp !== 'all'" class="ml-2 px-2 py-0.5 rounded bg-[#1c273a] text-[#f59e0b] border border-[#f59e0b]/30 text-[11px] font-mono flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
          {{ selectedApp }}
          <button (click)="resetAppFilter()" class="hover:text-white ml-1">×</button>
        </span>
      </div>

      <!-- Right: Search Input & Controls & Theme & Portal SSO -->
      <div class="flex items-center gap-2.5">
        <!-- Global Search Input (Moved to right) -->
        <div class="relative w-64 sm:w-80 flex items-center">
          <svg class="w-4 h-4 text-[#64748b] absolute left-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          <input
            type="text"
            [(ngModel)]="globalSearchQuery"
            (keyup.enter)="onGlobalSearch()"
            placeholder="Search logs, apps... (Ctrl + /)"
            class="w-full h-8 pl-9 pr-14 bg-[#0b0e14] text-[#e6edf3] placeholder-[#64748b] text-xs rounded-md border border-[#20293a] focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all font-mono"
          />

          <kbd class="absolute right-2 px-1.5 py-0.5 text-[10px] font-mono text-[#64748b] bg-[#161e2c] border border-[#20293a] rounded">
            Ctrl + /
          </kbd>
        </div>

        <div class="h-4 w-px bg-[#20293a]"></div>

        <!-- Theme Mode Toggle Button -->
        <button
          (click)="toggleTheme()"
          class="p-1.5 rounded-md text-[#94a3b8] hover:text-[#f59e0b] hover:bg-[#161e2c] transition-colors focus:outline-none flex items-center justify-center"
          [title]="(currentTheme$ | async) === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        >
          <svg *ngIf="(currentTheme$ | async) === 'dark'" class="w-4 h-4 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg *ngIf="(currentTheme$ | async) === 'light'" class="w-4 h-4 text-[#475569]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>

        <!-- Notifications Bell -->
        <button
          (click)="showNotifications = !showNotifications; showHelp = false; showUserMenu = false; $event.stopPropagation()"
          class="relative p-1.5 rounded-md text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#161e2c] transition-colors focus:outline-none"
          title="Notifications & Active Alerts"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        </button>

        <!-- Help Modal Toggle -->
        <button
          (click)="showHelp = !showHelp; showNotifications = false; showUserMenu = false; $event.stopPropagation()"
          class="p-1.5 rounded-md text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#161e2c] transition-colors focus:outline-none"
          title="Documentation & Shortcuts"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        <!-- Elegant User Menu -->
        <div class="relative" *ngIf="ssoUser$ | async as user">
          <button
            (click)="showUserMenu = !showUserMenu; showNotifications = false; showHelp = false; $event.stopPropagation()"
            class="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-slate-200 dark:border-[#20293a] bg-white dark:bg-[#161e2c] hover:bg-slate-50 dark:hover:bg-[#1f293d] transition-all shadow-sm focus:outline-none"
          >
            <div class="w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center text-[10px] font-semibold tracking-wide shadow-sm">
              {{ user.avatar }}
            </div>
            <span class="text-xs font-medium text-slate-800 dark:text-[#f0f4f8] hidden sm:inline">{{ user.name }}</span>
            <svg class="w-3 h-3 text-slate-400 dark:text-[#64748b] transition-transform" [ngClass]="{'rotate-180': showUserMenu}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Elegant User Dropdown Menu -->
          <div
            *ngIf="showUserMenu"
            (click)="$event.stopPropagation()"
            class="absolute right-0 mt-2 w-72 bg-white dark:bg-[#151b26] border border-slate-200 dark:border-[#20293a] rounded-xl shadow-xl py-1 text-xs text-slate-700 dark:text-[#e6edf3] z-50 overflow-hidden"
          >
            <!-- User Header Card -->
            <div class="p-3.5 border-b border-slate-100 dark:border-[#20293a] bg-slate-50/60 dark:bg-[#111622]/40">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center text-xs font-semibold shrink-0 shadow-sm">
                  {{ user.avatar }}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="font-semibold text-xs text-slate-900 dark:text-white truncate">
                    {{ user.name }}
                  </div>
                  <div class="text-[11px] text-slate-500 dark:text-[#94a3b8] truncate font-mono">{{ user.email }}</div>
                </div>
              </div>

              <!-- Role & Tenant Meta Pill -->
              <div class="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-[#20293a] flex items-center justify-between text-[11px]">
                <span class="text-slate-600 dark:text-[#94a3b8] font-medium truncate max-w-[160px]">{{ user.role }}</span>
                <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1c273a] text-slate-500 dark:text-[#94a3b8] text-[10px] font-mono border border-slate-200 dark:border-[#20293a]">
                  {{ user.tenant }}
                </span>
              </div>
            </div>

            <!-- Navigation Links -->
            <div class="p-1 space-y-0.5">
              <a
                routerLink="/settings"
                [queryParams]="{tab: 'sso'}"
                (click)="showUserMenu = false"
                class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-[#e6edf3] hover:bg-slate-100 dark:hover:bg-[#1c2433] hover:text-[#d97706] dark:hover:text-[#f59e0b] transition-colors"
              >
                <svg class="w-4 h-4 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Portal SSO Identity</span>
              </a>

              <a
                routerLink="/settings"
                (click)="showUserMenu = false"
                class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-[#e6edf3] hover:bg-slate-100 dark:hover:bg-[#1c2433] hover:text-[#d97706] dark:hover:text-[#f59e0b] transition-colors"
              >
                <svg class="w-4 h-4 text-slate-400 dark:text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span>Account & API Keys</span>
              </a>

              <a
                routerLink="/settings"
                [queryParams]="{tab: 'retention'}"
                (click)="showUserMenu = false"
                class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-700 dark:text-[#e6edf3] hover:bg-slate-100 dark:hover:bg-[#1c2433] hover:text-[#d97706] dark:hover:text-[#f59e0b] transition-colors"
              >
                <svg class="w-4 h-4 text-slate-400 dark:text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Retention & Org Policies</span>
              </a>
            </div>

            <!-- Sign Out Action -->
            <div class="p-1 border-t border-slate-100 dark:border-[#20293a]">
              <button
                (click)="logout()"
                class="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
              >
                <svg class="w-4 h-4 text-rose-500 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Notifications Panel Dropdown -->
      <div *ngIf="showNotifications" class="absolute right-12 top-14 w-80 bg-[#151b26] border border-[#20293a] rounded-lg shadow-2xl z-50 text-xs">
        <div class="p-3 border-b border-[#20293a] flex items-center justify-between">
          <span class="font-semibold text-[#f0f4f8]">Active Alerts & Notifications</span>
          <span class="bg-[#ef4444]/20 text-[#f87171] text-[10px] px-1.5 py-0.5 rounded font-mono">1 TRIGGERED</span>
        </div>
        <div class="p-2 space-y-2 max-h-64 overflow-y-auto">
          <div class="p-2 rounded bg-[#ef4444]/10 border border-[#ef4444]/30">
            <div class="flex items-center justify-between text-[#f87171] font-semibold">
              <span>High Payment Errors</span>
              <span class="text-[10px]">10m ago</span>
            </div>
            <div class="text-[#94a3b8] text-[11px] mt-1">payment-api generated 183 errors in 5 min (threshold: >100).</div>
          </div>
          <div class="p-2 rounded bg-[#161e2c] border border-[#20293a]">
            <div class="flex items-center justify-between text-[#34d399] font-semibold">
              <span>DB Pool Normal</span>
              <span class="text-[10px]">1h ago</span>
            </div>
            <div class="text-[#94a3b8] text-[11px]">auth-service connection pool usage dropped below 80%.</div>
          </div>
        </div>
        <div class="p-2 border-t border-[#20293a] text-center">
          <a routerLink="/alerts" (click)="showNotifications = false" class="text-[#f59e0b] hover:underline text-[11px]">Manage Alert Rules →</a>
        </div>
      </div>

      <!-- Quick Help Overlay -->
      <div *ngIf="showHelp" class="absolute right-16 top-14 w-72 bg-[#151b26] border border-[#20293a] rounded-lg shadow-2xl z-50 p-4 text-xs text-[#e6edf3]">
        <div class="font-semibold text-[#f0f4f8] mb-2 flex items-center gap-1.5">
          <svg class="w-4 h-4 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Query Syntax Cheatsheet</span>
        </div>
        <div class="space-y-1.5 font-mono text-[11px] text-[#94a3b8]">
          <div><span class="text-[#f59e0b]">level:error</span> - Filter ERROR logs</div>
          <div><span class="text-[#f59e0b]">service:payment-api</span> - Service log view</div>
          <div><span class="text-[#f59e0b]">"timeout"</span> - Exact phrase match</div>
          <div><span class="text-[#f59e0b]">userId:12345</span> - Inspect user activity</div>
        </div>
        <div class="mt-3 pt-2 border-t border-[#20293a] text-[11px]">
          Press <kbd class="px-1 py-0.5 bg-[#161e2c] rounded border border-[#20293a] text-[#e6edf3]">Ctrl + /</kbd> anywhere to focus global search.
        </div>
      </div>
    </header>
  `
})
export class EgglessTopbarComponent {
  private logService = inject(LogService);
  private themeService = inject(ThemeService);
  private ssoService = inject(SsoService);
  private router = inject(Router);

  currentTheme$ = this.themeService.theme$;
  ssoUser$ = this.ssoService.currentUser$;

  currentTitle = 'Logs Explorer';
  globalSearchQuery = '';
  selectedApp = 'all';
  selectedEnv: Environment | 'all' = 'all';

  showNotifications = false;
  showHelp = false;
  showUserMenu = false;

  constructor() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const url = e.urlAfterRedirects;
      if (url.includes('/overview')) this.currentTitle = 'Overview';
      else if (url.includes('/logs')) this.currentTitle = 'Logs Explorer';
      else if (url.includes('/applications')) this.currentTitle = 'Applications';
      else if (url.includes('/dashboards')) this.currentTitle = 'Dashboards';
      else if (url.includes('/alerts')) this.currentTitle = 'Alert Rules';
      else if (url.includes('/settings')) this.currentTitle = 'Settings';
    });

    this.logService.selectedApp$.subscribe(app => this.selectedApp = app);
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  onGlobalSearch() {
    if (this.globalSearchQuery) {
      this.logService.setSearchQuery(this.globalSearchQuery);
      this.router.navigate(['/logs']);
    }
  }

  onEnvChange(env: Environment | 'all') {
    this.selectedEnv = env;
    this.logService.setSelectedEnv(env);
  }

  resetAppFilter() {
    this.logService.setSelectedApp('all');
  }

  logout() {
    this.ssoService.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.showUserMenu = false;
    this.showNotifications = false;
    this.showHelp = false;
  }
}
