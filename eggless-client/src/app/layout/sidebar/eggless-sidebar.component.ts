import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LogService } from '../../core/services/log.service';

@Component({
  selector: 'app-eggless-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside
      class="h-full bg-[#0f141d] border-r border-[#20293a] flex flex-col transition-all duration-200 ease-in-out select-none relative z-30"
      [ngClass]="isCollapsed ? 'w-16' : 'w-60'"
    >
      <!-- Top Brand Header -->
      <div class="h-16 px-3 flex items-center justify-between border-b border-[#20293a]/80">
        <a routerLink="/logs" class="flex items-center gap-2.5 overflow-hidden group">
          <div class="w-10 h-10 rounded-lg eggless-logo-box border p-1 flex items-center justify-center shrink-0 group-hover:border-[#f59e0b] transition-colors shadow-sm">
            <img src="eggless-logo.png" alt="Eggless" class="w-full h-full object-contain filter drop-shadow(0 0 2px rgba(245,158,11,0.3))" />
          </div>
          <span *ngIf="!isCollapsed" class="font-bold text-base tracking-tight text-[#f0f4f8] group-hover:text-white transition-colors">
            Eggless<span class="text-[#f59e0b] font-normal text-xs ml-1.5 px-1.5 py-0.5 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/20">LOGS</span>
          </span>
        </a>

        <button
          (click)="toggleCollapse.emit()"
          class="text-[#94a3b8] hover:text-[#f0f4f8] p-1.5 rounded hover:bg-[#1a2332] transition-colors focus:outline-none"
          [title]="isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'"
        >
          <svg class="w-4 h-4 transition-transform duration-200" [ngClass]="{'rotate-180': isCollapsed}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <!-- Navigation Items -->
      <div class="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        <!-- Main Nav Group -->
        <nav class="space-y-1">
          <a
            *ngFor="let item of navItems"
            [routerLink]="item.path"
            routerLinkActive="bg-[#1c273a] text-[#f59e0b] font-medium border-l-2 border-[#f59e0b]"
            [routerLinkActiveOptions]="{exact: item.exact}"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-xs text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#161e2c] transition-colors group relative"
            [title]="isCollapsed ? item.label : ''"
          >
            <ng-container [ngSwitch]="item.path">
              <svg *ngSwitchCase="'/overview'" class="w-4 h-4 shrink-0 opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
              <svg *ngSwitchCase="'/logs'" class="w-4 h-4 shrink-0 opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
              </svg>
              <svg *ngSwitchCase="'/applications'" class="w-4 h-4 shrink-0 opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
              <svg *ngSwitchCase="'/dashboards'" class="w-4 h-4 shrink-0 opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              <svg *ngSwitchCase="'/alerts'" class="w-4 h-4 shrink-0 opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
            </ng-container>

            <span *ngIf="!isCollapsed" class="truncate">{{ item.label }}</span>
            <span *ngIf="item.badge && !isCollapsed" class="ml-auto bg-[#f59e0b]/20 text-[#fbbf24] text-[10px] font-semibold px-1.5 py-0.2 rounded border border-[#f59e0b]/30">
              {{ item.badge }}
            </span>
          </a>
        </nav>

        <div class="border-t border-[#20293a]"></div>

        <!-- Applications Section -->
        <div>
          <div *ngIf="!isCollapsed" class="px-3 pb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
            <span>Applications</span>
            <span class="text-[9px] bg-[#161e2c] px-1 rounded border border-[#20293a] text-[#94a3b8]">{{ (apps$ | async)?.length || 0 }}</span>
          </div>

          <div class="space-y-0.5">
            <button
              *ngFor="let app of (apps$ | async)"
              (click)="selectApp(app.id)"
              [ngClass]="(selectedApp$ | async) === app.id ? 'bg-[#1c273a] text-[#f0f4f8] font-medium' : 'text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#161e2c]'"
              class="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs text-left transition-colors group"
              [title]="isCollapsed ? app.name + ' (' + app.status + ')' : ''"
            >
              <span
                class="w-2 h-2 rounded-full shrink-0"
                [ngClass]="{
                  'bg-[#10b981] shadow-sm shadow-[#10b981]/50': app.status === 'healthy',
                  'bg-[#f59e0b] shadow-sm shadow-[#f59e0b]/50': app.status === 'warning',
                  'bg-[#ef4444] shadow-sm shadow-[#ef4444]/50 animate-pulse': app.status === 'critical'
                }"
              ></span>
              <span *ngIf="!isCollapsed" class="truncate font-mono text-[11px]">{{ app.name }}</span>
            </button>
          </div>
        </div>

        <div class="border-t border-[#20293a]"></div>

        <!-- Settings & Admin Section -->
        <div class="space-y-0.5">
          <a
            routerLink="/settings"
            routerLinkActive="bg-[#1c273a] text-[#f59e0b] font-medium"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-xs text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#161e2c] transition-colors"
            [title]="isCollapsed ? 'Settings' : ''"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span *ngIf="!isCollapsed">Settings</span>
          </a>

          <a
            routerLink="/settings"
            [queryParams]="{tab: 'apikeys'}"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-xs text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#161e2c] transition-colors"
            [title]="isCollapsed ? 'API Keys' : ''"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span *ngIf="!isCollapsed">API Keys</span>
          </a>

          <a
            href="https://docs.eggless.io"
            target="_blank"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-xs text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#161e2c] transition-colors"
            [title]="isCollapsed ? 'Documentation' : ''"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span *ngIf="!isCollapsed">Documentation</span>
          </a>
        </div>
      </div>

      <!-- Sidebar Footer User / Version Info -->
      <div *ngIf="!isCollapsed" class="p-3 border-t border-[#20293a] bg-[#0b0e14]/50 flex items-center justify-between text-[11px] text-[#64748b]">
        <span class="font-mono">v2.4.0-prod</span>
        <span class="flex items-center gap-1 text-[#10b981]">
          <span class="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
          Connected
        </span>
      </div>
    </aside>
  `
})
export class EgglessSidebarComponent {
  @Input() isCollapsed = false;
  @Output() toggleCollapse = new EventEmitter<void>();

  private logService = inject(LogService);
  private router = inject(Router);

  apps$ = this.logService.applications$;
  selectedApp$ = this.logService.selectedApp$;

  navItems = [
    { label: 'Overview', path: '/overview', exact: true },
    { label: 'Logs', path: '/logs', exact: false, badge: 'HERO' },
    { label: 'Applications', path: '/applications', exact: false },
    { label: 'Dashboards', path: '/dashboards', exact: false },
    { label: 'Alerts', path: '/alerts', exact: false }
  ];

  selectApp(appId: string) {
    this.logService.setSelectedApp(appId);
    this.router.navigate(['/logs']);
  }
}
