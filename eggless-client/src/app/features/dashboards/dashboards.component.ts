import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { LogService } from '../../core/services/log.service';
import { MetricsSummary } from '../../core/models/log.model';

interface Bar {
  label: string;
  height: number;
  errorPct: number;
  count: number;
  errors: number;
}

const LEVEL_STYLES: Record<string, { text: string; bar: string }> = {
  INFO: { text: 'text-[#34d399]', bar: 'bg-[#10b981]' },
  WARN: { text: 'text-[#fbbf24]', bar: 'bg-[#f59e0b]' },
  ERROR: { text: 'text-[#f87171]', bar: 'bg-[#ef4444]' },
  FATAL: { text: 'text-[#f87171]', bar: 'bg-[#b91c1c]' },
  DEBUG: { text: 'text-[#c084fc]', bar: 'bg-[#8b5cf6]' },
  TRACE: { text: 'text-[#94a3b8]', bar: 'bg-[#64748b]' }
};

@Component({
  selector: 'app-dashboards',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] p-6 gap-6 text-xs overflow-y-auto">
      <!-- Top Bar Controls -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-[#f0f4f8] tracking-tight">Dashboards & Metrics</h1>
          <p class="text-[#64748b] text-xs mt-0.5">Log volume, error rates and top errors, computed from ingested logs</p>
        </div>

        <div class="flex items-center gap-3">
          <select [ngModel]="timeRange$.value" (ngModelChange)="timeRange$.next($event)" class="h-8 px-2 bg-[#161e2c] text-[#e6edf3] text-xs rounded border border-[#20293a]">
            <option *ngFor="let r of timeRanges" [value]="r.value">{{ r.label }}</option>
          </select>
        </div>
      </div>

      <div *ngIf="view$ | async as v; else loading" class="grid grid-cols-3 gap-4">
        <!-- Widget 1: Log Count Over Time -->
        <div class="col-span-2 bg-[#121722] border border-[#20293a] rounded-lg p-4 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="font-bold text-[#f0f4f8] text-sm">Log Count Over Time ({{ rangeLabel(v.m.timeRange) }})</span>
            <span class="text-[#34d399] font-mono text-xs">{{ v.m.totalLogs | number }} total logs · {{ v.m.logsPerMin | number:'1.0-1' }}/min</span>
          </div>

          <div class="h-40 w-full flex items-end gap-1.5 pt-4 pb-2 px-2 border-b border-[#20293a]">
            <div *ngFor="let bar of v.bars" class="flex-1 h-full flex flex-col justify-end group relative">
              <div class="w-full bg-[#1c273a] group-hover:bg-[#f59e0b] rounded-t transition-all flex flex-col justify-end overflow-hidden" [style.height.%]="bar.height">
                <div class="bg-[#ef4444]" [style.height.%]="bar.errorPct"></div>
              </div>
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-[#0b0e14] border border-[#20293a] px-2 py-1 rounded text-[10px] font-mono text-white whitespace-nowrap z-20">
                {{ bar.label }}: {{ bar.count | number }} logs ({{ bar.errors | number }} errors)
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between text-[10px] text-[#64748b] font-mono">
            <span *ngFor="let t of v.ticks">{{ t }}</span>
          </div>
        </div>

        <!-- Widget 2: Logs by Level -->
        <div class="bg-[#121722] border border-[#20293a] rounded-lg p-4 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="font-bold text-[#f0f4f8] text-sm">Logs by Level</span>
            <span class="text-[#64748b] text-[10px]">{{ v.m.errorRate | number:'1.0-1' }}% error rate</span>
          </div>

          <div class="space-y-3 py-2 font-mono">
            <div *ngFor="let l of v.levels">
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="font-semibold" [ngClass]="l.text">{{ l.level }} ({{ l.pct | number:'1.0-1' }}%)</span>
                <span class="text-[#94a3b8]">{{ l.count | number }}</span>
              </div>
              <div class="w-full bg-[#161e2c] h-2 rounded-full overflow-hidden">
                <div class="h-full" [ngClass]="l.bar" [style.width.%]="l.pct"></div>
              </div>
            </div>
            <div *ngIf="v.levels.length === 0" class="text-[#64748b] font-sans">No logs in this time range.</div>
          </div>
        </div>

        <!-- Widget 3: Logs by Application -->
        <div class="col-span-1 bg-[#121722] border border-[#20293a] rounded-lg p-4">
          <span class="font-bold text-[#f0f4f8] text-sm">Top Applications Volume</span>
          <div class="mt-4 space-y-2.5 font-mono">
            <button *ngFor="let app of v.m.byService" (click)="openLogs(app.service)" class="w-full flex items-center justify-between text-xs p-2 bg-[#161e2c] rounded border border-[#20293a] hover:border-[#f59e0b]/50">
              <span class="text-[#f59e0b] font-semibold truncate">{{ app.service }}</span>
              <span class="text-[#e6edf3] shrink-0">
                {{ app.logsPerMin | number:'1.0-1' }} / min
                <span *ngIf="app.errors > 0" class="text-[#f87171]"> · {{ app.errors | number }} err</span>
              </span>
            </button>
            <div *ngIf="v.m.byService.length === 0" class="text-[#64748b] font-sans">No applications sent logs in this time range.</div>
          </div>
        </div>

        <!-- Widget 4: Top Error Messages -->
        <div class="col-span-2 bg-[#121722] border border-[#20293a] rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="font-bold text-[#f0f4f8] text-sm">Top Error Messages & Exceptions</span>
            <span class="text-[#f87171] text-xs font-mono">{{ v.m.errorCount | number }} errors</span>
          </div>

          <div class="space-y-2 font-mono text-xs">
            <button *ngFor="let e of v.m.topErrors" (click)="openLogs(e.service, e.message)" class="w-full text-left p-2.5 bg-[#180e12] border border-[#ef4444]/30 rounded flex items-center justify-between gap-3 hover:border-[#ef4444]/60">
              <div class="truncate text-[#f87171] min-w-0">
                {{ e.message }}
                <span class="block text-[10px] text-[#64748b] font-sans">{{ e.service }} • last seen {{ e.lastSeen | date:'MMM d, HH:mm:ss' }}</span>
              </div>
              <span class="shrink-0 px-2 py-0.5 bg-[#ef4444]/20 text-[#f87171] rounded text-[10px] font-bold">{{ e.count | number }}×</span>
            </button>
            <div *ngIf="v.m.topErrors.length === 0" class="text-[#64748b] font-sans">No errors in this time range. 🎉</div>
          </div>
        </div>
      </div>

      <ng-template #loading>
        <div class="text-[#64748b]">Loading metrics…</div>
      </ng-template>
    </div>
  `
})
export class DashboardsComponent {
  private logService = inject(LogService);
  private router = inject(Router);

  timeRanges = [
    { value: '15m', label: 'Last 15 minutes' },
    { value: '1h', label: 'Last 1 hour' },
    { value: '6h', label: 'Last 6 hours' },
    { value: '24h', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' }
  ];

  timeRange$ = new BehaviorSubject<string>('1h');

  view$ = combineLatest([this.timeRange$, this.logService.selectedApp$, this.logService.selectedEnv$]).pipe(
    switchMap(([range, app, env]) => this.logService.metrics(range, app, env)),
    map(m => (m ? this.toView(m) : null))
  );

  rangeLabel(value: string): string {
    return this.timeRanges.find(r => r.value === value)?.label ?? value;
  }

  openLogs(service: string, message?: string) {
    this.logService.setSelectedApp(service);
    this.logService.setFilter({ timeRange: this.timeRange$.value, levels: message ? ['ERROR'] : [] });
    this.logService.setSearchQuery(message ? `message:"${message.replace(/"/g, '')}"` : '');
    this.router.navigate(['/logs']);
  }

  private toView(m: MetricsSummary) {
    const max = Math.max(1, ...m.timeseries.map(b => b.count));
    const longRange = ['24h', '7d'].includes(m.timeRange);
    const fmt = (iso: string) => {
      const d = new Date(iso);
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return longRange ? `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}` : time;
    };

    const bars: Bar[] = m.timeseries.map(b => ({
      label: fmt(b.start),
      height: b.count === 0 ? 2 : Math.max(4, (b.count / max) * 100),
      errorPct: b.count === 0 ? 0 : (b.errors / b.count) * 100,
      count: b.count,
      errors: b.errors
    }));

    const n = m.timeseries.length;
    const ticks = [0, 0.25, 0.5, 0.75].map(f => fmt(m.timeseries[Math.floor(f * n)]?.start ?? m.from));
    ticks.push('NOW');

    const levels = Object.entries(m.byLevel)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([level, count]) => ({
        level,
        count,
        pct: m.totalLogs === 0 ? 0 : (100 * count) / m.totalLogs,
        ...(LEVEL_STYLES[level] ?? LEVEL_STYLES['TRACE'])
      }));

    return { m, bars, ticks, levels };
  }
}
