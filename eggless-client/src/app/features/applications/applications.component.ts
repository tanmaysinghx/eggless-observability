import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, combineLatest, of, timer } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { LogService } from '../../core/services/log.service';
import { ApplicationInfo, ApplicationRegistration, Environment, LogEntry, MetricsSummary } from '../../core/models/log.model';
import { AppSetupSnippetsComponent } from './app-setup.component';

@Component({
  selector: 'app-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, AppSetupSnippetsComponent],
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
          <button
            (click)="openRegister()"
            class="px-3.5 py-2 bg-[#f59e0b] hover:bg-[#d97706] text-[#0b0e14] font-bold rounded-md transition-colors text-xs shadow-md"
          >
            + Add Application
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div *ngIf="selectedApp === null && (apps$ | async)?.length === 0" class="bg-[#121722] border border-dashed border-[#20293a] rounded-lg p-10 text-center space-y-3">
        <div class="text-sm font-bold text-[#f0f4f8]">No applications yet</div>
        <p class="text-[#64748b] max-w-md mx-auto">Register an application to get an ingestion key and setup instructions. Applications also appear automatically when logs arrive with a new service name.</p>
        <button (click)="openRegister()" class="px-3.5 py-2 bg-[#f59e0b] hover:bg-[#d97706] text-[#0b0e14] font-bold rounded-md text-xs">+ Add Application</button>
      </div>

      <!-- Applications Overview Grid / Table -->
      <div *ngIf="selectedApp === null && (apps$ | async)?.length" class="bg-[#121722] border border-[#20293a] rounded-lg overflow-hidden shadow-xl">
        <table class="w-full text-left border-collapse">
          <thead class="bg-[#161e2c] text-[#64748b] uppercase font-semibold text-[10px] tracking-wider border-b border-[#20293a]">
            <tr>
              <th class="py-3 px-4">Application</th>
              <th class="py-3 px-4">Environment</th>
              <th class="py-3 px-4 font-mono">Last Log</th>
              <th class="py-3 px-4 font-mono">Logs / Min</th>
              <th class="py-3 px-4 font-mono">Errors (24h)</th>
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
                  class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide inline-flex items-center gap-1.5 whitespace-nowrap"
                  [ngClass]="{
                    'bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30': app.status === 'healthy',
                    'bg-[#f59e0b]/15 text-[#fbbf24] border border-[#f59e0b]/30': app.status === 'warning',
                    'bg-[#ef4444]/15 text-[#f87171] border border-[#ef4444]/30': app.status === 'critical',
                    'bg-[#64748b]/15 text-[#94a3b8] border border-[#64748b]/30': app.status === 'pending'
                  }"
                >
                  <span class="w-1.5 h-1.5 rounded-full" [ngClass]="statusDot(app.status)"></span>
                  {{ statusLabel(app.status) }}
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
              (click)="closeDetail()"
              class="p-1.5 rounded bg-[#161e2c] border border-[#20293a] text-[#94a3b8] hover:text-[#f0f4f8] transition-colors"
            >
              ← Back to Applications
            </button>
            <div>
              <h2 class="text-lg font-bold text-[#f59e0b] font-mono flex items-center gap-2">
                {{ selectedApp.name }}
                <span class="px-2 py-0.5 rounded border text-xs font-sans uppercase font-bold" [ngClass]="statusBadge(selectedApp.status)">
                  ● {{ statusLabel(selectedApp.status) }}
                </span>
                <span class="px-2 py-0.5 rounded text-[10px] bg-[#161e2c] border border-[#20293a] text-[#94a3b8] font-sans capitalize">{{ selectedApp.environment }}</span>
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
            <button
              (click)="openSetup()"
              [ngClass]="activeTab === 'setup' ? 'border-[#f59e0b] text-[#f59e0b] font-bold' : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'"
              class="pb-2 border-b-2 transition-colors"
            >
              Setup & Keys
            </button>
          </div>

          <!-- TAB: Recent Logs -->
          <div *ngIf="activeTab === 'logs'" class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="text-[#64748b] flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                Newest 50 logs from {{ selectedApp.name }}, refreshed every 5 seconds. Click a row for details.
              </div>
              <select [ngModel]="levelFilter$.value" (ngModelChange)="levelFilter$.next($event)" class="h-7 px-2 bg-[#161e2c] text-[#e6edf3] rounded border border-[#20293a]">
                <option value="all">All levels</option>
                <option *ngFor="let l of levels" [value]="l">{{ l }}</option>
              </select>
            </div>
            <div class="bg-[#0b0e14] border border-[#20293a] rounded font-mono text-[11px] max-h-[28rem] overflow-y-auto divide-y divide-[#161e2c]">
              <div *ngFor="let l of (recentLogs$ | async); trackBy: trackLog">
                <button (click)="toggleExpanded(l.id)" class="w-full text-left px-3 py-1.5 truncate hover:bg-[#121722]" [ngClass]="levelClass(l.level)">
                  <span class="text-[#64748b]">{{ l.fullTimestamp | date:'MMM d HH:mm:ss.SSS' }}</span> [{{ l.level }}] {{ l.message }}
                </button>
                <div *ngIf="expandedId === l.id" class="px-3 pb-3 pt-1 space-y-2 bg-[#121722] text-[#e6edf3]">
                  <div class="whitespace-pre-wrap break-words">{{ l.message }}</div>
                  <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-[10px] text-[#94a3b8] font-sans">
                    <div>Environment: <span class="font-mono text-[#e6edf3]">{{ l.environment }}</span></div>
                    <div>Host: <span class="font-mono text-[#e6edf3]">{{ l.host || '—' }}</span></div>
                    <div>Trace: <span class="font-mono text-[#e6edf3]">{{ l.traceId || '—' }}</span></div>
                    <div>Request: <span class="font-mono text-[#e6edf3]">{{ l.requestId || '—' }}</span></div>
                    <div>User: <span class="font-mono text-[#e6edf3]">{{ l.userId || '—' }}</span></div>
                    <div>Log ID: <span class="font-mono text-[#e6edf3]">{{ l.id }}</span></div>
                  </div>
                  <pre *ngIf="hasMetadata(l)" class="p-2 rounded bg-[#0b0e14] border border-[#20293a] overflow-x-auto">{{ l.metadata | json }}</pre>
                  <pre *ngIf="l.stackTrace" class="p-2 rounded bg-[#180e12] border border-[#ef4444]/30 text-[#f87171] overflow-x-auto whitespace-pre-wrap">{{ l.stackTrace }}</pre>
                </div>
              </div>
              <div *ngIf="(recentLogs$ | async)?.length === 0" class="p-3 text-[#64748b] font-sans">
                No logs yet. Open <button (click)="openSetup()" class="text-[#f59e0b] hover:underline">Setup & Keys</button> to connect {{ selectedApp.name }}.
              </div>
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

          <!-- TAB: Setup & Keys -->
          <div *ngIf="activeTab === 'setup'" class="space-y-5">
            <div class="space-y-2">
              <div class="font-bold text-[#f0f4f8]">Send logs from {{ selectedApp.name }}</div>
              <app-setup-snippets [name]="selectedApp.name" [environment]="selectedApp.environment" [token]="newKeyToken"></app-setup-snippets>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div class="font-bold text-[#f0f4f8]">Ingestion keys</div>
                <button (click)="createKey()" class="px-3 py-1 bg-[#1c273a] hover:bg-[#25334c] text-[#f59e0b] rounded border border-[#20293a]">+ New key</button>
              </div>
              <div *ngIf="newKeyToken" class="p-3 rounded border border-[#f59e0b]/40 bg-[#1a1712] space-y-1">
                <div class="text-[#fbbf24] font-semibold">Copy this key now. It won't be shown again.</div>
                <div class="font-mono text-[#f0f4f8] break-all select-all">{{ newKeyToken }}</div>
              </div>
              <table class="w-full text-left">
                <tbody class="divide-y divide-[#1e2636]">
                  <tr *ngFor="let k of (appKeys$ | async)">
                    <td class="py-2 font-mono text-[#e6edf3]">{{ k.tokenPrefix }}</td>
                    <td class="py-2 text-[#94a3b8]">Created {{ k.created }}</td>
                    <td class="py-2 text-[#94a3b8]">Last used {{ k.lastUsed }}</td>
                    <td class="py-2 text-right">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase" [ngClass]="k.status === 'active' ? 'bg-[#10b981]/15 text-[#34d399]' : 'bg-[#64748b]/15 text-[#94a3b8]'">{{ k.status }}</span>
                      <button *ngIf="k.status === 'active'" (click)="revokeKey(k.id)" class="ml-2 text-[#f87171] hover:underline">Revoke</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p class="text-[#64748b] text-[11px]">These keys can only send logs for {{ selectedApp.name }}. Keys created under Settings → API Keys can send for any application.</p>
            </div>

            <div class="pt-4 border-t border-[#20293a] flex items-center justify-between">
              <div>
                <div class="font-bold text-[#f87171]">Delete application</div>
                <div class="text-[#64748b] text-[11px]">Revokes its keys. Stored logs are kept until retention removes them; if it keeps sending logs with an unrestricted key, it will reappear.</div>
              </div>
              <button (click)="deleteApp()" class="px-3 py-1.5 rounded border border-[#ef4444]/40 text-[#f87171] hover:bg-[#ef4444]/10">Delete</button>
            </div>
            <div *ngIf="detailError" class="p-2.5 rounded border border-[#ef4444]/40 bg-[#180e12] text-[#f87171]">{{ detailError }}</div>
          </div>
        </div>
      </div>

      <!-- Modal: Add Application -->
      <div *ngIf="showRegister" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div class="bg-[#151b26] border border-[#20293a] rounded-lg w-full max-w-2xl p-6 text-xs space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between border-b border-[#20293a] pb-3">
            <h3 class="text-sm font-bold text-[#f0f4f8]">{{ registration ? 'Connect ' + registration.application.name : 'Add Application' }}</h3>
            <button (click)="closeRegister()" class="text-[#64748b] hover:text-[#f0f4f8] font-bold">✕</button>
          </div>

          <!-- Step 1: details -->
          <form *ngIf="!registration" (ngSubmit)="submitRegister()" class="space-y-3">
            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Name</label>
              <input [(ngModel)]="newApp.name" name="name" required autofocus placeholder="e.g. payment-api" class="w-full bg-[#111622] text-[#f0f4f8] p-2 rounded border border-[#20293a] font-mono" />
              <p class="text-[#64748b] text-[10px] mt-1">Lowercase letters, digits, '.', '_' and '-'. This is the "service" name your logs are filed under.</p>
            </div>
            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Environment</label>
              <select [(ngModel)]="newApp.environment" name="environment" class="w-full bg-[#111622] text-[#f0f4f8] p-2 rounded border border-[#20293a]">
                <option value="production">production</option>
                <option value="staging">staging</option>
                <option value="development">development</option>
              </select>
            </div>
            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Description <span class="font-normal">(optional)</span></label>
              <input [(ngModel)]="newApp.description" name="description" maxlength="255" placeholder="What does this service do?" class="w-full bg-[#111622] text-[#f0f4f8] p-2 rounded border border-[#20293a]" />
            </div>
            <div *ngIf="registerError" class="p-2.5 rounded border border-[#ef4444]/40 bg-[#180e12] text-[#f87171]">{{ registerError }}</div>
            <div class="flex items-center justify-end gap-2 pt-3 border-t border-[#20293a]">
              <button type="button" (click)="closeRegister()" class="px-3 py-1.5 bg-[#161e2c] text-white rounded">Cancel</button>
              <button type="submit" [disabled]="registering || !newApp.name.trim()" class="px-3.5 py-1.5 bg-[#f59e0b] text-[#0b0e14] font-bold rounded disabled:opacity-50">
                {{ registering ? 'Creating…' : 'Create & get API key' }}
              </button>
            </div>
          </form>

          <!-- Step 2: key + setup -->
          <div *ngIf="registration" class="space-y-4">
            <div class="p-3 rounded border border-[#f59e0b]/40 bg-[#1a1712] space-y-1">
              <div class="text-[#fbbf24] font-semibold">Ingestion key for {{ registration.application.name }}. Copy it now; it won't be shown again.</div>
              <div class="font-mono text-[#f0f4f8] break-all select-all">{{ registration.apiKey.token }}</div>
            </div>

            <app-setup-snippets [name]="registration.application.name" [environment]="registration.application.environment" [token]="registration.apiKey.token ?? null"></app-setup-snippets>

            <div class="flex items-center gap-3">
              <button (click)="sendTestLog()" [disabled]="testState === 'sending'" class="px-3 py-1.5 bg-[#1c273a] hover:bg-[#25334c] text-[#f59e0b] rounded border border-[#20293a] disabled:opacity-50">
                {{ testState === 'sending' ? 'Sending…' : 'Send a test log' }}
              </button>
              <span *ngIf="testState === 'sent'" class="text-[#34d399]">✓ Received. It's in the application's logs.</span>
              <span *ngIf="testError" class="text-[#f87171]">{{ testError }}</span>
            </div>

            <div class="flex items-center justify-end gap-2 pt-3 border-t border-[#20293a]">
              <button (click)="closeRegister()" class="px-3 py-1.5 bg-[#161e2c] text-white rounded">Done</button>
              <button (click)="openRegistered()" class="px-3.5 py-1.5 bg-[#f59e0b] text-[#0b0e14] font-bold rounded">Open {{ registration.application.name }} →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ApplicationsComponent {
  private logService = inject(LogService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  // Zoneless app: state set in HTTP callbacks needs an explicit markForCheck to render.
  private cdr = inject(ChangeDetectorRef);

  apps$ = this.logService.applications$;
  health$ = this.apps$.pipe(map(apps => ({ total: apps.length, healthy: apps.filter(a => a.status === 'healthy').length })));
  levels = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];

  selectedApp: ApplicationInfo | null = null;
  activeTab: 'logs' | 'errors' | 'setup' = 'logs';
  levelFilter$ = new BehaviorSubject<string>('all');
  recentLogs$: Observable<LogEntry[]> = of([]);
  appMetrics$: Observable<MetricsSummary | null> = of(null);
  appKeys$ = this.logService.apiKeys$.pipe(map(keys => keys.filter(k => k.application === this.selectedApp?.name)));
  expandedId: string | null = null;
  newKeyToken: string | null = null;
  detailError: string | null = null;

  showRegister = false;
  registering = false;
  registerError: string | null = null;
  newApp = { name: '', environment: 'production' as Environment, description: '' };
  registration: ApplicationRegistration | null = null;
  testState: 'idle' | 'sending' | 'sent' = 'idle';
  testError: string | null = null;

  constructor() {
    // Keep the open application's figures current, and close it if it was deleted.
    this.apps$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(apps => {
      if (!this.selectedApp) return;
      this.selectedApp = apps.find(a => a.id === this.selectedApp!.id) ?? null;
      this.cdr.markForCheck();
    });
  }

  openAppDetail(app: ApplicationInfo) {
    this.selectedApp = app;
    this.activeTab = 'logs';
    this.expandedId = null;
    this.newKeyToken = null;
    this.detailError = null;
    this.levelFilter$.next('all');
    this.recentLogs$ = combineLatest([timer(0, 5000), this.levelFilter$]).pipe(
      // Refresh the app's status and rates on the same beat as its logs.
      tap(() => this.logService.refreshApplications()),
      switchMap(([, level]) => this.logService.recentLogs(app.name, 50, level))
    );
    this.appMetrics$ = this.logService.metrics('24h', app.name);
  }

  closeDetail() {
    this.selectedApp = null;
    this.recentLogs$ = of([]);
    this.appMetrics$ = of(null);
  }

  toggleExpanded(id: string) {
    this.expandedId = this.expandedId === id ? null : id;
  }

  trackLog(_: number, log: LogEntry) {
    return log.id;
  }

  hasMetadata(log: LogEntry): boolean {
    return !!log.metadata && Object.keys(log.metadata).length > 0;
  }

  openSetup() {
    this.activeTab = 'setup';
    this.logService.refreshApiKeys();
  }

  createKey() {
    if (!this.selectedApp) return;
    this.detailError = null;
    this.logService.createApplicationKey(this.selectedApp.id).subscribe({
      next: key => this.update(() => this.newKeyToken = key.token ?? null),
      error: (err: Error) => this.update(() => this.detailError = err.message)
    });
  }

  revokeKey(id: string) {
    this.logService.revokeApiKey(id);
  }

  deleteApp() {
    const app = this.selectedApp;
    if (!app || !confirm(`Delete ${app.name}? Its ingestion keys will stop working immediately.`)) return;
    this.logService.deleteApplication(app.id).subscribe({
      next: () => this.update(() => this.closeDetail()),
      error: (err: Error) => this.update(() => this.detailError = err.message)
    });
  }

  openRegister() {
    this.showRegister = true;
    this.registration = null;
    this.registerError = null;
    this.testState = 'idle';
    this.testError = null;
    this.newApp = { name: '', environment: 'production', description: '' };
  }

  closeRegister() {
    this.showRegister = false;
    this.registration = null;
  }

  submitRegister() {
    this.registering = true;
    this.registerError = null;
    this.logService.registerApplication({
      name: this.newApp.name.trim(),
      environment: this.newApp.environment,
      description: this.newApp.description.trim() || undefined
    }).subscribe({
      next: reg => this.update(() => {
        this.registration = reg;
        this.registering = false;
      }),
      error: (err: Error) => this.update(() => {
        this.registerError = err.message;
        this.registering = false;
      })
    });
  }

  sendTestLog() {
    const reg = this.registration;
    if (!reg?.apiKey.token) return;
    this.testState = 'sending';
    this.testError = null;
    this.logService.sendTestLog(reg.apiKey.token, reg.application.environment).subscribe({
      next: () => this.update(() => this.testState = 'sent'),
      error: (err: Error) => this.update(() => {
        this.testState = 'idle';
        this.testError = err.message;
      })
    });
  }

  openRegistered() {
    const app = this.registration?.application;
    this.closeRegister();
    if (app) this.openAppDetail(app);
  }

  private update(change: () => void) {
    change();
    this.cdr.markForCheck();
  }

  statusLabel(status: string): string {
    return status === 'pending' ? 'waiting for logs' : status;
  }

  statusDot(status: string): string {
    switch (status) {
      case 'healthy': return 'bg-[#10b981]';
      case 'warning': return 'bg-[#f59e0b]';
      case 'pending': return 'bg-[#64748b]';
      default: return 'bg-[#ef4444]';
    }
  }

  statusBadge(status: string): string {
    switch (status) {
      case 'healthy': return 'bg-[#10b981]/15 text-[#34d399] border-[#10b981]/30';
      case 'warning': return 'bg-[#f59e0b]/15 text-[#fbbf24] border-[#f59e0b]/30';
      case 'pending': return 'bg-[#64748b]/15 text-[#94a3b8] border-[#64748b]/30';
      default: return 'bg-[#ef4444]/15 text-[#f87171] border-[#ef4444]/30';
    }
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
