import { Component, inject } from '@angular/core';
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

      <!-- Center: Global Search Input -->
      <div class="flex-1 max-w-xl mx-auto relative">
        <div class="relative flex items-center">
          <svg class="w-4 h-4 text-[#64748b] absolute left-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          <input
            type="text"
            [(ngModel)]="globalSearchQuery"
            (keyup.enter)="onGlobalSearch()"
            placeholder="Search logs, applications, fields... (level:error, service:payment-api)"
            class="w-full h-8 pl-9 pr-14 bg-[#0b0e14] text-[#e6edf3] placeholder-[#64748b] text-xs rounded-md border border-[#20293a] focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all font-mono"
          />

          <kbd class="absolute right-2 px-1.5 py-0.5 text-[10px] font-mono text-[#64748b] bg-[#161e2c] border border-[#20293a] rounded">
            Ctrl + /
          </kbd>
        </div>
      </div>

      <!-- Right: Controls & Environment & Theme & Portal SSO -->
      <div class="flex items-center gap-2.5">
        <!-- Environment Selector -->
        <div class="relative">
          <select
            [ngModel]="selectedEnv"
            (ngModelChange)="onEnvChange($event)"
            class="h-8 pl-2.5 pr-7 bg-[#161e2c] text-[#e6edf3] text-xs rounded-md border border-[#20293a] focus:outline-none focus:border-[#f59e0b] font-medium appearance-none cursor-pointer hover:border-[#334155] transition-colors"
          >
            <option value="all">🌐 All Environments</option>
            <option value="production">🟢 Production</option>
            <option value="staging">🟡 Staging</option>
            <option value="development">🔵 Development</option>
          </select>
          <svg class="w-3.5 h-3.5 text-[#64748b] absolute right-2 top-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div class="h-4 w-px bg-[#20293a]"></div>

        <!-- Theme Mode Toggle Button -->
        <button
          (click)="toggleTheme()"
          class="p-1.5 rounded-md text-[#94a3b8] hover:text-[#f59e0b] hover:bg-[#161e2c] transition-colors focus:outline-none flex items-center justify-center"
          [title]="(currentTheme$ | async) === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        >
          <span *ngIf="(currentTheme$ | async) === 'dark'" class="text-sm">🌙</span>
          <span *ngIf="(currentTheme$ | async) === 'light'" class="text-sm">☀️</span>
        </button>

        <!-- Notifications Bell -->
        <button
          (click)="showNotifications = !showNotifications; showHelp = false; showUserMenu = false"
          class="relative p-1.5 rounded-md text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#161e2c] transition-colors focus:outline-none"
          title="Notifications & Active Alerts"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#ef4444] ring-2 ring-[#111622]"></span>
        </button>

        <!-- Help Modal Toggle -->
        <button
          (click)="showHelp = !showHelp; showNotifications = false; showUserMenu = false"
          class="p-1.5 rounded-md text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#161e2c] transition-colors focus:outline-none"
          title="Documentation & Shortcuts"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        <!-- User Menu Avatar with Portal SSO Identity Badge -->
        <div class="relative" *ngIf="ssoUser$ | async as user">
          <button
            (click)="showUserMenu = !showUserMenu; showNotifications = false; showHelp = false"
            class="flex items-center gap-2 pl-1 pr-2 py-0.5 rounded-full bg-[#161e2c] hover:bg-[#1f293d] transition-colors focus:outline-none border border-[#f59e0b]/40"
          >
            <div class="w-6 h-6 rounded-full bg-gradient-to-tr from-[#f59e0b] to-[#3b82f6] text-white flex items-center justify-center text-[10px] font-bold">
              {{ user.avatar }}
            </div>
            <span class="text-xs text-[#e6edf3] font-semibold hidden sm:inline">{{ user.name }}</span>
            <span class="px-1.5 py-0.2 rounded bg-[#f59e0b]/20 text-[#f59e0b] text-[9px] font-mono font-bold uppercase hidden md:inline">
              SSO
            </span>
            <svg class="w-3 h-3 text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- User Dropdown Menu -->
          <div *ngIf="showUserMenu" class="absolute right-0 mt-2 w-64 bg-[#151b26] border border-[#20293a] rounded-md shadow-2xl py-1 text-xs text-[#e6edf3] z-50">
            <div class="px-3 py-2.5 border-b border-[#20293a] space-y-1">
              <div class="font-bold text-white flex items-center justify-between">
                <span>{{ user.name }}</span>
                <span class="text-[9px] bg-[#10b981]/20 text-[#34d399] px-1.5 py-0.2 rounded font-mono">PORTAL SSO</span>
              </div>
              <div class="text-[11px] text-[#94a3b8] font-mono truncate">{{ user.email }}</div>
              <div class="text-[10px] text-[#f59e0b] font-sans font-medium">{{ user.role }}</div>
              <div class="text-[9px] text-[#64748b] font-mono">Tenant: {{ user.tenant }}</div>
            </div>

            <a routerLink="/settings" class="block px-3 py-2 hover:bg-[#1c2433] hover:text-[#f59e0b]">Account & Ingestion API Keys</a>
            <a routerLink="/settings" [queryParams]="{tab: 'retention'}" class="block px-3 py-2 hover:bg-[#1c2433] hover:text-[#f59e0b]">Retention & Org Policies</a>

            <div class="border-t border-[#20293a]"></div>

            <button (click)="logout()" class="w-full text-left px-3 py-2 text-[#ef4444] hover:bg-[#1c2433] font-semibold flex items-center justify-between">
              <span>Sign Out (Portal SSO)</span>
              <span class="text-[10px] font-mono opacity-60">Revoke Session</span>
            </button>
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
        <div class="font-semibold text-white mb-2 flex items-center gap-1.5">
          <span class="text-[#f59e0b]">💡</span> Query Syntax Cheatsheet
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
}
