import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { LogService } from '../../core/services/log.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] p-6 gap-6 text-xs overflow-y-auto">
      <!-- Header Banner -->
      <div class="p-5 bg-[#121722] border border-[#20293a] rounded-lg shadow-xl flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-xl eggless-logo-box border p-1.5 flex items-center justify-center shrink-0 shadow-lg">
            <img src="eggless-logo.png" alt="Eggless" class="w-full h-full object-contain" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-[#f0f4f8] tracking-tight flex items-center gap-2">
              Eggless Observability Overview
              <span class="px-2 py-0.5 rounded bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30 text-xs font-mono font-semibold">
                ● Live Monitoring
              </span>
            </h1>
            <p class="text-[#94a3b8] text-xs mt-1">Real-time log ingestion, error tracking, and microservices status dashboard</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <a
            routerLink="/logs"
            class="px-4 py-2 bg-[#f59e0b] hover:bg-[#d97706] text-[#0b0e14] font-bold rounded-md transition-all text-xs shadow-md shadow-[#f59e0b]/20 flex items-center gap-2"
          >
            Launch Log Explorer Hero →
          </a>
        </div>
      </div>

      <!-- KPI Summary Cards Grid -->
      <div *ngIf="stats$ | async as stats" class="grid grid-cols-4 gap-4">
        <div class="p-4 bg-[#121722] border border-[#20293a] rounded-lg">
          <div class="text-[#64748b] text-[10px] font-bold uppercase tracking-wider">Total Ingested Logs</div>
          <div class="text-2xl font-bold text-[#f0f4f8] font-mono mt-1">{{ stats.totalLogs | number }}</div>
          <div class="text-[#34d399] text-[10px] mt-1 font-mono">Streaming @ {{ stats.logsPerMin | number }}/min</div>
        </div>

        <div class="p-4 bg-[#1a1215] border border-[#ef4444]/30 rounded-lg">
          <div class="text-[#f87171] text-[10px] font-bold uppercase tracking-wider">System Errors</div>
          <div class="text-2xl font-bold text-[#f87171] font-mono mt-1">{{ stats.errorCount | number }}</div>
          <div class="text-[#f87171] text-[10px] mt-1 font-mono">1 active alert rule triggered</div>
        </div>

        <div class="p-4 bg-[#1a1712] border border-[#f59e0b]/30 rounded-lg">
          <div class="text-[#fbbf24] text-[10px] font-bold uppercase tracking-wider">System Warnings</div>
          <div class="text-2xl font-bold text-[#fbbf24] font-mono mt-1">{{ stats.warnCount | number }}</div>
          <div class="text-[#fbbf24] text-[10px] mt-1 font-mono">Slow gateway responses</div>
        </div>

        <div class="p-4 bg-[#121722] border border-[#20293a] rounded-lg">
          <div class="text-[#64748b] text-[10px] font-bold uppercase tracking-wider">Monitored Services</div>
          <div class="text-2xl font-bold text-[#34d399] font-mono mt-1">{{ stats.activeApplications }} microservices</div>
          <div class="text-[#34d399] text-[10px] mt-1 font-mono">All status checks green</div>
        </div>
      </div>

      <!-- Main Layout: Live Microservices Grid + Recent Error Stream -->
      <div class="grid grid-cols-3 gap-6">
        <!-- Monitored Microservices Status -->
        <div class="col-span-2 bg-[#121722] border border-[#20293a] rounded-lg p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-[#20293a] pb-3">
            <h2 class="font-bold text-[#f0f4f8] text-sm">Microservices Health & Telemetry</h2>
            <a routerLink="/applications" class="text-[#f59e0b] hover:underline text-xs font-mono">View All Applications →</a>
          </div>

          <div class="grid grid-cols-2 gap-3 font-mono">
            <div *ngFor="let app of (apps$ | async)" class="p-3 bg-[#161e2c] border border-[#20293a] rounded-md flex items-center justify-between hover:border-[#f59e0b]/50 transition-colors">
              <div>
                <div class="font-bold text-[#f0f4f8] flex items-center gap-2 text-xs">
                  <span class="w-2 h-2 rounded-full" [ngClass]="app.status === 'healthy' ? 'bg-[#10b981]' : app.status === 'warning' ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'"></span>
                  {{ app.name }}
                </div>
                <div class="text-[10px] text-[#64748b] font-sans mt-0.5">{{ app.logsPerMin | number }} logs/min</div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-sans font-bold" [ngClass]="app.status === 'healthy' ? 'bg-[#10b981]/15 text-[#34d399]' : 'bg-[#f59e0b]/15 text-[#fbbf24]'">
                {{ app.status }}
              </span>
            </div>
          </div>
        </div>

        <!-- Quick Access Shortcuts Panel -->
        <div class="bg-[#121722] border border-[#20293a] rounded-lg p-5 space-y-4 font-sans">
          <h2 class="font-bold text-[#f0f4f8] text-sm border-b border-[#20293a] pb-3">Quick Navigation</h2>

          <div class="space-y-2">
            <a routerLink="/logs" class="block p-3 bg-[#161e2c] hover:bg-[#1f293d] rounded-md border border-[#20293a] transition-colors">
              <div class="font-bold text-[#f59e0b]">⚡ Logs Explorer (Hero Feature)</div>
              <div class="text-[#94a3b8] text-[11px] mt-0.5">High-density log table, query filters, live tail stream, JSON drawer.</div>
            </a>

            <a routerLink="/dashboards" class="block p-3 bg-[#161e2c] hover:bg-[#1f293d] rounded-md border border-[#20293a] transition-colors">
              <div class="font-bold text-[#f0f4f8]">📊 Visual Dashboards</div>
              <div class="text-[#94a3b8] text-[11px] mt-0.5">Log volume charts, error rate percentage, and level distribution.</div>
            </a>

            <a routerLink="/alerts" class="block p-3 bg-[#161e2c] hover:bg-[#1f293d] rounded-md border border-[#20293a] transition-colors">
              <div class="font-bold text-[#f0f4f8]">🔔 Alert Rules & Triggers</div>
              <div class="text-[#94a3b8] text-[11px] mt-0.5">Manage automated log condition monitors and notifications.</div>
            </a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class OverviewComponent {
  private logService = inject(LogService);
  private router = inject(Router);

  stats$ = this.logService.stats$;
  apps$ = this.logService.applications$;
}
