import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogService } from '../../core/services/log.service';
import { LogEntry, LogLevel, Environment } from '../../core/models/log.model';
import { LogDetailDrawerComponent } from './components/log-detail-drawer.component';
import { LiveLogStreamComponent } from './components/live-log-stream.component';

@Component({
  selector: 'app-logs-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule, LogDetailDrawerComponent, LiveLogStreamComponent],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] p-4 gap-3 text-xs overflow-hidden">
      <!-- 1. Header Row -->
      <div class="flex items-center justify-between gap-4 shrink-0">
        <div class="flex items-center gap-3">
          <h2 class="text-base font-bold text-[#f0f4f8] tracking-tight">Logs Explorer</h2>

          <!-- Application Selector Dropdown -->
          <select
            [ngModel]="selectedApp$ | async"
            (ngModelChange)="onAppSelect($event)"
            class="h-7 px-2 bg-[#161e2c] text-[#e6edf3] text-xs rounded border border-[#20293a] focus:outline-none focus:border-[#f59e0b] font-medium font-mono cursor-pointer"
          >
            <option value="all">Applications: All (6)</option>
            <option value="payment-api">payment-api</option>
            <option value="order-service">order-service</option>
            <option value="auth-service">auth-service</option>
            <option value="frontend">frontend</option>
            <option value="notification-service">notification-service</option>
            <option value="db-proxy">db-proxy</option>
          </select>

          <!-- Environment Selector Dropdown -->
          <select
            [ngModel]="selectedEnv$ | async"
            (ngModelChange)="onEnvSelect($event)"
            class="h-7 px-2 bg-[#161e2c] text-[#e6edf3] text-xs rounded border border-[#20293a] focus:outline-none focus:border-[#f59e0b] font-medium cursor-pointer"
          >
            <option value="all">Environment: All</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </select>

          <!-- Live Status Badge Button -->
          <button
            (click)="toggleLiveTail()"
            [ngClass]="(liveTail$ | async) ? 'bg-[#10b981]/15 text-[#34d399] border-[#10b981]/40' : 'bg-[#1c273a] text-[#64748b] border-[#20293a]'"
            class="h-7 px-2.5 rounded border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span *ngIf="liveTail$ | async" class="pulsing-dot"></span>
            <span *ngIf="!(liveTail$ | async)" class="w-2 h-2 rounded-full bg-[#64748b]"></span>
            <span>{{ (liveTail$ | async) ? 'LIVE TAIL' : 'PAUSED' }}</span>
          </button>
        </div>

        <!-- Mode Toggle: Table View vs Terminal Live View -->
        <div class="flex items-center bg-[#111622] p-0.5 rounded border border-[#20293a]">
          <button
            (click)="viewMode = 'table'"
            [ngClass]="viewMode === 'table' ? 'bg-[#1c273a] text-[#f59e0b] font-semibold shadow' : 'text-[#94a3b8] hover:text-white'"
            class="px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1.5"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Table Explorer
          </button>
          <button
            (click)="viewMode = 'terminal'"
            [ngClass]="viewMode === 'terminal' ? 'bg-[#1c273a] text-[#f59e0b] font-semibold shadow' : 'text-[#94a3b8] hover:text-white'"
            class="px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1.5"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Live Terminal
          </button>
        </div>
      </div>

      <!-- 2. Search & Query Input Bar -->
      <div class="relative shrink-0">
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (ngModelChange)="onSearchChange($event)"
              placeholder='Search logs... Try "level:error", "service:payment-api", "database timeout", "userId:12345"'
              class="w-full h-9 pl-9 pr-24 bg-[#111622] text-[#f0f4f8] placeholder-[#64748b] text-xs rounded border border-[#20293a] focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] font-mono transition-all"
            />
            <svg class="w-4 h-4 text-[#64748b] absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>

            <!-- Query helper presets dropdown button -->
            <button
              (click)="showQueryPresets = !showQueryPresets"
              class="absolute right-2 top-1.5 px-2 py-0.5 bg-[#1a2332] hover:bg-[#25334c] text-[#94a3b8] hover:text-[#f59e0b] text-[11px] rounded border border-[#20293a] font-sans font-medium"
            >
              Presets ▼
            </button>
          </div>

          <!-- Time Range Selector -->
          <div class="flex items-center bg-[#111622] p-0.5 rounded border border-[#20293a] shrink-0">
            <button
              *ngFor="let range of timeRanges"
              (click)="selectedTimeRange = range"
              [ngClass]="selectedTimeRange === range ? 'bg-[#1c273a] text-[#f59e0b] font-medium' : 'text-[#64748b] hover:text-[#94a3b8]'"
              class="px-2 py-1 rounded text-[11px] transition-colors"
            >
              {{ range }}
            </button>
          </div>
        </div>

        <!-- Query Presets Dropdown Panel -->
        <div *ngIf="showQueryPresets" class="absolute top-11 left-0 z-30 w-96 bg-[#151b26] border border-[#20293a] rounded-md shadow-2xl p-2 font-mono text-xs">
          <div class="text-[10px] text-[#64748b] font-sans uppercase font-bold px-2 py-1">Quick Search Presets</div>
          <button (click)="applyPreset('level:error')" class="w-full text-left px-2 py-1.5 hover:bg-[#1c273a] rounded text-[#f87171]">level:error — Show only ERROR level logs</button>
          <button (click)="applyPreset('service:payment-api level:warn')" class="w-full text-left px-2 py-1.5 hover:bg-[#1c273a] rounded text-[#fbbf24]">service:payment-api level:warn — Slow payment gateway warnings</button>
          <button (click)="applyPreset('&quot;timeout&quot;')" class="w-full text-left px-2 py-1.5 hover:bg-[#1c273a] rounded text-[#e6edf3]">"timeout" — Search exact keyword timeout</button>
          <button (click)="applyPreset('userId:12345')" class="w-full text-left px-2 py-1.5 hover:bg-[#1c273a] rounded text-[#3b82f6]">userId:12345 — Inspect user 12345 session logs</button>
        </div>
      </div>

      <!-- 3. Removable Filter Chips Bar -->
      <div class="flex items-center gap-2 flex-wrap shrink-0">
        <span class="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Levels:</span>
        <button
          *ngFor="let level of ['ERROR', 'WARN', 'INFO', 'DEBUG']"
          (click)="toggleLevelFilter(level)"
          [ngClass]="isLevelActive(level) ? getLevelBadgeClass(level) : 'bg-[#111622] text-[#64748b] border-[#20293a] opacity-60 hover:opacity-100'"
          class="eggless-badge cursor-pointer transition-all border"
        >
          {{ level }}
        </button>

        <div class="h-3 w-px bg-[#20293a] mx-1"></div>

        <!-- Removable Service Filter Chips -->
        <span *ngIf="selectedApp$ | async as app" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30 font-mono text-[11px]">
          App: {{ app }}
          <button (click)="resetAppFilter()" class="hover:text-white font-bold ml-1">×</button>
        </span>
      </div>

      <!-- 4. Information-Dense Compact Statistics Cards -->
      <div *ngIf="stats$ | async as stats" class="grid grid-cols-4 gap-3 shrink-0">
        <div class="p-2.5 bg-[#121722] border border-[#20293a] rounded-md flex items-center justify-between">
          <div>
            <div class="text-[10px] text-[#64748b] font-semibold uppercase tracking-wider">Total Logs</div>
            <div class="text-base font-bold text-[#f0f4f8] font-mono mt-0.5">{{ stats.totalLogs | number }}</div>
          </div>
          <div class="w-7 h-7 rounded bg-[#1c273a] flex items-center justify-center text-[#f0f4f8]">📊</div>
        </div>

        <div class="p-2.5 bg-[#1a1215] border border-[#ef4444]/30 rounded-md flex items-center justify-between">
          <div>
            <div class="text-[10px] text-[#f87171] font-semibold uppercase tracking-wider">Errors</div>
            <div class="text-base font-bold text-[#f87171] font-mono mt-0.5">{{ stats.errorCount | number }}</div>
          </div>
          <div class="w-7 h-7 rounded bg-[#ef4444]/20 flex items-center justify-center text-[#f87171] font-mono font-bold">!</div>
        </div>

        <div class="p-2.5 bg-[#1a1712] border border-[#f59e0b]/30 rounded-md flex items-center justify-between">
          <div>
            <div class="text-[10px] text-[#fbbf24] font-semibold uppercase tracking-wider">Warnings</div>
            <div class="text-base font-bold text-[#fbbf24] font-mono mt-0.5">{{ stats.warnCount | number }}</div>
          </div>
          <div class="w-7 h-7 rounded bg-[#f59e0b]/20 flex items-center justify-center text-[#fbbf24] font-mono font-bold">⚠</div>
        </div>

        <div class="p-2.5 bg-[#121722] border border-[#20293a] rounded-md flex items-center justify-between">
          <div>
            <div class="text-[10px] text-[#64748b] font-semibold uppercase tracking-wider">Active Apps</div>
            <div class="text-base font-bold text-[#34d399] font-mono mt-0.5">{{ stats.activeApplications }} microservices</div>
          </div>
          <div class="w-7 h-7 rounded bg-[#10b981]/20 flex items-center justify-center text-[#34d399]">⚡</div>
        </div>
      </div>

      <!-- 5. Table Toolbar -->
      <div class="flex items-center justify-between gap-2 shrink-0 py-1 border-t border-b border-[#20293a]">
        <div class="flex items-center gap-2">
          <button
            (click)="refreshLogs()"
            class="px-2.5 py-1 bg-[#161e2c] hover:bg-[#1f293d] text-[#e6edf3] rounded border border-[#20293a] transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <svg class="w-3.5 h-3.5 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          <!-- Column Visibility Selector -->
          <div class="relative">
            <button
              (click)="showColumnPicker = !showColumnPicker"
              class="px-2.5 py-1 bg-[#161e2c] hover:bg-[#1f293d] text-[#94a3b8] hover:text-white rounded border border-[#20293a] transition-colors text-xs flex items-center gap-1"
            >
              Columns ({{ getVisibleColumnsCount() }}) ▼
            </button>

            <div *ngIf="showColumnPicker" class="absolute left-0 top-8 z-30 w-44 bg-[#151b26] border border-[#20293a] rounded shadow-xl p-2 font-sans text-xs space-y-1">
              <label *ngFor="let col of columns" class="flex items-center gap-2 text-[#94a3b8] hover:text-white cursor-pointer select-none">
                <input type="checkbox" [(ngModel)]="col.visible" class="accent-[#f59e0b]" />
                <span>{{ col.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            (click)="exportLogs('csv')"
            class="px-2.5 py-1 bg-[#161e2c] hover:bg-[#1f293d] text-[#3b82f6] rounded border border-[#20293a] transition-colors text-xs font-medium flex items-center gap-1"
          >
            Export CSV
          </button>
          <button
            (click)="exportLogs('json')"
            class="px-2.5 py-1 bg-[#161e2c] hover:bg-[#1f293d] text-[#f59e0b] rounded border border-[#20293a] transition-colors text-xs font-medium flex items-center gap-1"
          >
            Export JSON
          </button>
        </div>
      </div>

      <!-- 6. Log Explorer Main View (Table or Terminal) -->
      <div class="flex-1 min-h-0 relative">
        <!-- TABLE VIEW MODE -->
        <div *ngIf="viewMode === 'table'" class="h-full flex flex-col bg-[#121722] border border-[#20293a] rounded-md overflow-hidden">
          <div class="flex-1 overflow-auto">
            <table class="w-full text-left border-collapse">
              <thead class="bg-[#161e2c] text-[#64748b] uppercase font-semibold text-[10px] tracking-wider sticky top-0 z-10 border-b border-[#20293a]">
                <tr>
                  <th *ngIf="isColumnVisible('timestamp')" class="py-2 px-3 w-32 font-mono">Timestamp</th>
                  <th *ngIf="isColumnVisible('level')" class="py-2 px-3 w-20">Level</th>
                  <th *ngIf="isColumnVisible('service')" class="py-2 px-3 w-36 font-mono">Application</th>
                  <th *ngIf="isColumnVisible('message')" class="py-2 px-3">Message</th>
                  <th *ngIf="isColumnVisible('traceId')" class="py-2 px-3 w-32 font-mono">Trace ID</th>
                  <th *ngIf="isColumnVisible('environment')" class="py-2 px-3 w-28">Environment</th>
                  <th class="py-2 px-2 w-12 text-center">Actions</th>
                </tr>
              </thead>

              <tbody class="divide-y divide-[#1e2636] font-mono text-[11px]">
                <tr
                  *ngFor="let log of paginatedLogs"
                  (click)="openLogDetail(log)"
                  class="hover:bg-[#1a2332] cursor-pointer transition-colors group"
                  [ngClass]="selectedLog?.id === log.id ? 'bg-[#1f2b3e] border-l-2 border-[#f59e0b]' : ''"
                >
                  <td *ngIf="isColumnVisible('timestamp')" class="py-2 px-3 text-[#94a3b8] whitespace-nowrap">
                    {{ log.timestamp }}
                  </td>

                  <td *ngIf="isColumnVisible('level')" class="py-2 px-3">
                    <span [class]="getLevelBadgeClass(log.level)">{{ log.level }}</span>
                  </td>

                  <td *ngIf="isColumnVisible('service')" class="py-2 px-3 text-[#f59e0b] font-semibold truncate">
                    {{ log.service }}
                  </td>

                  <td *ngIf="isColumnVisible('message')" class="py-2 px-3">
                    <div
                      class="truncate max-w-xl font-mono text-[#f0f4f8] group-hover:text-white"
                      [ngClass]="{
                        'text-[#f87171]': log.level === 'ERROR',
                        'text-[#fbbf24]': log.level === 'WARN'
                      }"
                    >
                      {{ log.message }}
                    </div>
                  </td>

                  <td *ngIf="isColumnVisible('traceId')" class="py-2 px-3 text-[#3b82f6] truncate">
                    {{ log.traceId }}
                  </td>

                  <td *ngIf="isColumnVisible('environment')" class="py-2 px-3 text-[#64748b] capitalize font-sans">
                    {{ log.environment }}
                  </td>

                  <td class="py-2 px-2 text-center" (click)="$event.stopPropagation()">
                    <button
                      (click)="copyLogMessage(log)"
                      class="text-[#64748b] hover:text-[#f59e0b] p-1 rounded hover:bg-[#20293a]"
                      title="Copy Log Message"
                    >
                      📋
                    </button>
                  </td>
                </tr>

                <tr *ngIf="paginatedLogs.length === 0">
                  <td colspan="7" class="py-12 text-center text-[#64748b] font-sans">
                    No logs found matching search criteria.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar -->
          <div class="h-10 px-4 bg-[#161e2c] border-t border-[#20293a] flex items-center justify-between text-xs text-[#94a3b8] shrink-0 font-sans">
            <div>
              Showing <span class="font-semibold text-white font-mono">{{ getStartIndex() }}</span> -
              <span class="font-semibold text-white font-mono">{{ getEndIndex() }}</span> of
              <span class="font-semibold text-white font-mono">{{ totalFilteredLogs }}</span> logs
            </div>

            <div class="flex items-center gap-2">
              <button
                (click)="prevPage()"
                [disabled]="currentPage === 1"
                class="px-2.5 py-1 rounded bg-[#111622] border border-[#20293a] hover:bg-[#1c273a] disabled:opacity-40 font-medium"
              >
                Previous
              </button>
              <span class="font-mono text-xs text-white">Page {{ currentPage }} / {{ totalPages }}</span>
              <button
                (click)="nextPage()"
                [disabled]="currentPage >= totalPages"
                class="px-2.5 py-1 rounded bg-[#111622] border border-[#20293a] hover:bg-[#1c273a] disabled:opacity-40 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <!-- TERMINAL LIVE VIEW MODE -->
        <app-live-log-stream
          *ngIf="viewMode === 'terminal'"
          [logs]="(filteredLogs$ | async) || []"
          [isPaused]="!(liveTail$ | async)"
          (togglePause)="toggleLiveTail()"
          (clearBuffer)="refreshLogs()"
        ></app-live-log-stream>
      </div>

      <!-- Right-side Log Detail Drawer -->
      <app-log-detail-drawer
        [log]="selectedLog"
        (close)="selectedLog = null"
      ></app-log-detail-drawer>
    </div>
  `
})
export class LogsExplorerComponent implements OnInit {
  private logService = inject(LogService);

  filteredLogs$ = this.logService.filteredLogs$;
  stats$ = this.logService.stats$;
  liveTail$ = this.logService.liveTail$;
  selectedApp$ = this.logService.selectedApp$;
  selectedEnv$ = this.logService.selectedEnv$;

  viewMode: 'table' | 'terminal' = 'table';
  searchQuery = '';
  showQueryPresets = false;
  showColumnPicker = false;
  selectedLog: LogEntry | null = null;
  activeLevels: LogLevel[] = [];

  timeRanges = ['15m', '1h', '6h', '24h', 'Custom'];
  selectedTimeRange = '1h';

  currentPage = 1;
  pageSize = 50;
  totalFilteredLogs = 0;
  paginatedLogs: LogEntry[] = [];

  columns = [
    { key: 'timestamp', label: 'Timestamp', visible: true },
    { key: 'level', label: 'Level', visible: true },
    { key: 'service', label: 'Application', visible: true },
    { key: 'message', label: 'Message', visible: true },
    { key: 'traceId', label: 'Trace ID', visible: true },
    { key: 'environment', label: 'Environment', visible: true }
  ];

  ngOnInit() {
    this.filteredLogs$.subscribe(logs => {
      this.totalFilteredLogs = logs.length;
      this.updatePagination(logs);
    });
  }

  onSearchChange(q: string) {
    this.logService.setSearchQuery(q);
    this.currentPage = 1;
  }

  applyPreset(preset: string) {
    this.searchQuery = preset;
    this.logService.setSearchQuery(preset);
    this.showQueryPresets = false;
    this.currentPage = 1;
  }

  toggleLevelFilter(level: LogLevel | string) {
    this.logService.toggleLevelFilter(level as LogLevel);
    this.currentPage = 1;
  }

  isLevelActive(level: string): boolean {
    return this.activeLevels.includes(level as LogLevel);
  }

  onAppSelect(appId: string) {
    this.logService.setSelectedApp(appId);
    this.currentPage = 1;
  }

  onEnvSelect(env: any) {
    this.logService.setSelectedEnv(env);
    this.currentPage = 1;
  }

  resetAppFilter() {
    this.logService.setSelectedApp('all');
  }

  toggleLiveTail() {
    this.logService.toggleLiveTail();
  }

  openLogDetail(log: LogEntry) {
    this.selectedLog = log;
    this.logService.setSelectedLog(log);
  }

  refreshLogs() {
    this.logService.setSearchQuery(this.searchQuery);
  }

  copyLogMessage(log: LogEntry) {
    navigator.clipboard.writeText(log.message);
  }

  exportLogs(format: 'csv' | 'json') {
    this.filteredLogs$.subscribe(logs => {
      if (format === 'json') {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
        const anchor = document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", `eggless_logs_${Date.now()}.json`);
        anchor.click();
      } else {
        const headers = "Timestamp,Level,Service,Message,TraceID,Environment\n";
        const rows = logs.map(l => `"${l.timestamp}","${l.level}","${l.service}","${l.message.replace(/"/g, '""')}","${l.traceId}","${l.environment}"`).join("\n");
        const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
        const anchor = document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", `eggless_logs_${Date.now()}.csv`);
        anchor.click();
      }
    });
  }

  getLevelBadgeClass(level: string): string {
    switch (level) {
      case 'INFO': return 'eggless-badge badge-info';
      case 'WARN': return 'eggless-badge badge-warn';
      case 'ERROR': return 'eggless-badge badge-error';
      case 'DEBUG': return 'eggless-badge badge-debug';
      default: return 'eggless-badge badge-trace';
    }
  }

  isColumnVisible(key: string): boolean {
    const col = this.columns.find(c => c.key === key);
    return col ? col.visible : true;
  }

  getVisibleColumnsCount(): number {
    return this.columns.filter(c => c.visible).length;
  }

  private updatePagination(logs: LogEntry[]) {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedLogs = logs.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.totalFilteredLogs / this.pageSize) || 1;
  }

  getStartIndex(): number {
    return this.totalFilteredLogs === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalFilteredLogs);
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.filteredLogs$.subscribe(logs => this.updatePagination(logs));
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.filteredLogs$.subscribe(logs => this.updatePagination(logs));
    }
  }
}
