import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { LogService } from '../../core/services/log.service';
import { ApplicationInfo, LogEntry, MetricsSummary } from '../../core/models/log.model';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-applications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] p-6 gap-6 text-xs overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-[#f0f4f8] tracking-tight">Applications & Microservices</h1>
          <p class="text-[#64748b] text-xs mt-0.5">Monitored services emitting structured application logs and metrics</p>
        </div>

        <div class="flex items-center gap-3">
          <div *ngIf="health$ | async as h" class="px-3 py-1.5 rounded-md bg-[#161e2c] border border-[#20293a] font-mono text-xs flex items-center gap-2" [ngClass]="h.healthy === h.total ? 'text-[#34d399]' : 'text-[#fbbf24]'">
            <span class="w-2 h-2 rounded-full animate-pulse" [ngClass]="h.healthy === h.total ? 'bg-[#10b981]' : 'bg-[#f59e0b]'"></span>
            {{ h.healthy }} / {{ h.total }} Services Healthy
          </div>
        </div>
      </div>

      <!-- Applications Overview Grid / Table -->
      <div *ngIf="selectedApp === null" class="bg-[#121722] border border-[#20293a] rounded-lg overflow-hidden shadow-xl">
        <table class="w-full text-left border-collapse">
          <thead class="bg-[#161e2c] text-[#64748b] uppercase font-semibold text-[10px] tracking-wider border-b border-[#20293a]">
            <tr>
              <th class="py-3 px-4">Application</th>
              <th class="py-3 px-4">Environment</th>
              <th class="py-3 px-4 font-mono">Last Log</th>
              <th class="py-3 px-4 font-mono">Logs / Min</th>
              <th class="py-3 px-4 font-mono">Errors (5m)</th>
              <th class="py-3 px-4" title="Share of logs in the last 24h that were not ERROR/FATAL">24h Success</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#1e2636] font-mono text-xs">
            <tr
              *ngFor="let app of (apps$ | async)"
              (click)="openAppDetail(app)"
              class="hover:bg-[#1a2332] cursor-pointer transition-colors group"
            >
              <td class="py-3.5 px-4 font-bold text-[#f0f4f8] font-sans flex items-center gap-2">
                <div class="w-7 h-7 rounded bg-[#1c273a] flex items-center justify-center text-[#94a3b8] border border-[#20293a]">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                </div>
                <div>
                  <div class="text-[#f59e0b] group-hover:underline font-mono text-xs">{{ app.name }}</div>
                  <div class="text-[10px] text-[#64748b] font-sans font-normal truncate max-w-xs">{{ app.description }}</div>
                </div>
              </td>

              <td class="py-3.5 px-4 text-[#e6edf3] font-sans capitalize">
                <span class="px-2 py-0.5 rounded text-[10px] bg-[#161e2c] border border-[#20293a]">
                  {{ app.environment }}
                </span>
              </td>

              <td class="py-3.5 px-4 text-[#94a3b8]">{{ app.lastLog }}</td>

              <td class="py-3.5 px-4 text-[#f0f4f8] font-semibold">
                {{ app.logsPerMin | number }} <span class="text-[10px] text-[#64748b]">/min</span>
              </td>

              <td class="py-3.5 px-4">
                <span
                  class="font-semibold"
                  [ngClass]="app.errorCount > 0 ? 'text-[#f87171]' : 'text-[#64748b]'"
                >
                  {{ app.errorCount }}
                </span>
              </td>

              <td class="py-3.5 px-4 text-[#34d399] font-semibold">{{ app.uptime }}</td>

              <td class="py-3.5 px-4">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide inline-flex items-center gap-1.5"
                  [ngClass]="{
                    'bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30': app.status === 'healthy',
                    'bg-[#f59e0b]/15 text-[#fbbf24] border border-[#f59e0b]/30': app.status === 'warning',
                    'bg-[#ef4444]/15 text-[#f87171] border border-[#ef4444]/30': app.status === 'critical'
                  }"
                >
                  <span class="w-1.5 h-1.5 rounded-full" [ngClass]="app.status === 'healthy' ? 'bg-[#10b981]' : app.status === 'warning' ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'"></span>
                  {{ app.status }}
                </span>
              </td>

              <td class="py-3.5 px-4 text-right font-sans" (click)="$event.stopPropagation()">
                <button
                  (click)="viewAppLogs(app.name)"
                  class="px-3 py-1 bg-[#1c273a] hover:bg-[#25334c] text-[#f59e0b] rounded border border-[#20293a] text-xs transition-colors font-medium"
                >
                  View Logs →
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Application Detail Overview Screen (When an app is selected) -->
      <div *ngIf="selectedApp" class="space-y-6">
        <!-- Back Button & App Title Header -->
        <div class="flex items-center justify-between bg-[#121722] p-4 rounded-lg border border-[#20293a]">
          <div class="flex items-center gap-3">
            <button
              (click)="selectedApp = null"
              class="p-1.5 rounded bg-[#161e2c] border border-[#20293a] text-[#94a3b8] hover:text-[#f0f4f8] transition-colors"
            >
              ← Back to Applications
            </button>
            <div>
              <h2 class="text-lg font-bold text-[#f59e0b] font-mono flex items-center gap-2">
                {{ selectedApp.name }}
                <span class="px-2 py-0.5 rounded bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30 text-xs font-sans uppercase font-bold">
                  ● {{ selectedApp.status }}
                </span>
              </h2>
              <p class="text-[#64748b] text-xs font-sans mt-0.5">{{ selectedApp.description }}</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              (click)="viewAppLogs(selectedApp.name)"
              class="px-3 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-[#0b0e14] font-bold rounded-md transition-colors text-xs shadow"
            >
              Explore {{ selectedApp.name }} Logs →
            </button>
          </div>
        </div>

        <!-- Metrics Cards -->
        <div class="grid grid-cols-4 gap-4">
          <div class="p-4 bg-[#121722] border border-[#20293a] rounded-lg">
            <div class="text-[#64748b] text-[10px] font-bold uppercase">Logs Ingestion Rate</div>
            <div class="text-xl font-bold text-[#f0f4f8] font-mono mt-1">{{ selectedApp.logsPerMin | number }} / min</div>
            <div class="text-[#64748b] text-[10px] mt-1 font-mono">Average over the last 5 minutes</div>
          </div>

          <div class="p-4 bg-[#121722] border border-[#20293a] rounded-lg">
            <div class="text-[#64748b] text-[10px] font-bold uppercase">Errors (24h)</div>
            <div class="text-xl font-bold text-[#f87171] font-mono mt-1">{{ selectedApp.errorCount | number }} errors</div>
            <div class="text-[#f87171] text-[10px] mt-1 font-mono">{{ selectedApp.errorsPerMin | number }} / min right now</div>
          </div>

          <div class="p-4 bg-[#121722] border border-[#20293a] rounded-lg">
            <div class="text-[#64748b] text-[10px] font-bold uppercase">Last Ingested Log</div>
            <div class="text-xl font-bold text-[#34d399] font-mono mt-1">{{ selectedApp.lastLog }}</div>
            <div class="text-[10px] mt-1 font-mono" [ngClass]="selectedApp.status === 'healthy' ? 'text-[#34d399]' : 'text-[#fbbf24]'">Status: {{ selectedApp.status }}</div>
          </div>

          <div class="p-4 bg-[#121722] border border-[#20293a] rounded-lg">
            <div class="text-[#64748b] text-[10px] font-bold uppercase">24h Success Rate</div>
            <div class="text-xl font-bold text-[#34d399] font-mono mt-1">{{ selectedApp.uptime }}</div>
            <div class="text-[#34d399] text-[10px] mt-1 font-mono">Non-error share of logs, last 24h</div>
          </div>
        </div>

        <!-- Detail Tabs -->
        <div class="bg-[#121722] border border-[#20293a] rounded-lg p-4 space-y-4">
          <div class="flex items-center border-b border-[#20293a] gap-4">
            <button
              (click)="activeTab = 'logs'"
              [ngClass]="activeTab === 'logs' ? 'border-[#f59e0b] text-[#f59e0b] font-bold' : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'"
              class="pb-2 border-b-2 transition-colors"
            >
              Recent Logs
            </button>
            <button
              (click)="activeTab = 'errors'"
              [ngClass]="activeTab === 'errors' ? 'border-[#f59e0b] text-[#f59e0b] font-bold' : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'"
              class="pb-2 border-b-2 transition-colors"
            >
              Top Errors (24h)
            </button>
          </div>

          <!-- TAB: Recent Logs -->
          <div *ngIf="activeTab === 'logs'" class="space-y-2">
            <div class="text-[#64748b]">Latest logs from {{ selectedApp.name }}:</div>
            <div class="bg-[#0b0e14] border border-[#20293a] rounded p-3 font-mono text-[11px] space-y-1 max-h-72 overflow-y-auto">
              <div *ngFor="let l of (recentLogs$ | async)" class="truncate" [ngClass]="levelClass(l.level)">
                <span class="text-[#64748b]">{{ l.timestamp }}</span> [{{ l.level }}] {{ l.message }}
              </div>
              <div *ngIf="(recentLogs$ | async)?.length === 0" class="text-[#64748b] font-sans">No logs yet.</div>
            </div>
          </div>

          <!-- TAB: Errors -->
          <div *ngIf="activeTab === 'errors'" class="space-y-2">
            <ng-container *ngIf="appMetrics$ | async as m">
              <div *ngFor="let e of m.topErrors" class="p-3 bg-[#180e12] border border-[#ef4444]/30 rounded space-y-1">
                <div class="text-[#f87171] font-mono font-semibold break-words">{{ e.message }}</div>
                <div class="text-[#94a3b8]">Occurred {{ e.count | number }} times · last seen {{ e.lastSeen | date:'MMM d, HH:mm:ss' }}</div>
              </div>
              <div *ngIf="m.topErrors.length === 0" class="text-[#64748b]">No errors in the last 24 hours.</div>
            </ng-container>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ApplicationsComponent {
  private logService = inject(LogService);
  private router = inject(Router);

  apps$ = this.logService.applications$;
  health$ = this.apps$.pipe(map(apps => ({ total: apps.length, healthy: apps.filter(a => a.status === 'healthy').length })));
  selectedApp: ApplicationInfo | null = null;
  activeTab: 'logs' | 'errors' = 'logs';
  recentLogs$: Observable<LogEntry[]> = of([]);
  appMetrics$: Observable<MetricsSummary | null> = of(null);

  openAppDetail(app: ApplicationInfo) {
    this.selectedApp = app;
    this.activeTab = 'logs';
    this.recentLogs$ = this.logService.recentLogs(app.name, 25);
    this.appMetrics$ = this.logService.metrics('24h', app.name);
  }

  levelClass(level: string): string {
    switch (level) {
      case 'ERROR': case 'FATAL': return 'text-[#f87171]';
      case 'WARN': return 'text-[#fbbf24]';
      case 'DEBUG': return 'text-[#c084fc]';
      default: return 'text-[#e6edf3]';
    }
  }

  viewAppLogs(appName: string) {
    this.logService.setSelectedApp(appName);
    this.router.navigate(['/logs']);
  }
}
