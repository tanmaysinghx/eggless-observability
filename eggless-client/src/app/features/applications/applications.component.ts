import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LogService } from '../../core/services/log.service';
import { ApplicationInfo } from '../../core/models/log.model';

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
          <div class="px-3 py-1.5 rounded-md bg-[#161e2c] border border-[#20293a] text-[#34d399] font-mono text-xs flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
            6 / 6 Services Healthy
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
              <th class="py-3 px-4">Uptime</th>
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
                <div class="w-7 h-7 rounded bg-[#1c273a] flex items-center justify-center text-base border border-[#20293a]">
                  📦
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
              class="p-1.5 rounded bg-[#161e2c] border border-[#20293a] text-[#94a3b8] hover:text-white transition-colors"
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
            <div class="text-[#10b981] text-[10px] mt-1 font-mono">↑ 4.2% from previous hour</div>
          </div>

          <div class="p-4 bg-[#121722] border border-[#20293a] rounded-lg">
            <div class="text-[#64748b] text-[10px] font-bold uppercase">Errors (5m)</div>
            <div class="text-xl font-bold text-[#f87171] font-mono mt-1">{{ selectedApp.errorCount }} errors</div>
            <div class="text-[#f87171] text-[10px] mt-1 font-mono">Gateway timeout exceptions</div>
          </div>

          <div class="p-4 bg-[#121722] border border-[#20293a] rounded-lg">
            <div class="text-[#64748b] text-[10px] font-bold uppercase">Last Ingested Log</div>
            <div class="text-xl font-bold text-[#34d399] font-mono mt-1">{{ selectedApp.lastLog }}</div>
            <div class="text-[#64748b] text-[10px] mt-1 font-mono">Heartbeat OK</div>
          </div>

          <div class="p-4 bg-[#121722] border border-[#20293a] rounded-lg">
            <div class="text-[#64748b] text-[10px] font-bold uppercase">SLA Uptime</div>
            <div class="text-xl font-bold text-[#34d399] font-mono mt-1">{{ selectedApp.uptime }}</div>
            <div class="text-[#34d399] text-[10px] mt-1 font-mono">30-day window target 99.9%</div>
          </div>
        </div>

        <!-- Detail Tabs -->
        <div class="bg-[#121722] border border-[#20293a] rounded-lg p-4 space-y-4">
          <div class="flex items-center border-b border-[#20293a] gap-4">
            <button
              (click)="activeTab = 'logs'"
              [ngClass]="activeTab === 'logs' ? 'border-[#f59e0b] text-[#f59e0b] font-bold' : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'"
              class="py-2 border-b-2 text-xs transition-colors"
            >
              Logs Preview
            </button>
            <button
              (click)="activeTab = 'errors'"
              [ngClass]="activeTab === 'errors' ? 'border-[#f59e0b] text-[#f59e0b] font-bold' : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'"
              class="py-2 border-b-2 text-xs transition-colors"
            >
              Top Errors & Exceptions
            </button>
            <button
              (click)="activeTab = 'config'"
              [ngClass]="activeTab === 'config' ? 'border-[#f59e0b] text-[#f59e0b] font-bold' : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'"
              class="py-2 border-b-2 text-xs transition-colors"
            >
              Service Configuration
            </button>
          </div>

          <!-- TAB: Logs Preview -->
          <div *ngIf="activeTab === 'logs'" class="space-y-3">
            <div class="text-xs text-[#94a3b8]">Live log stream for {{ selectedApp.name }}:</div>
            <div class="p-3 bg-[#0b0e14] border border-[#20293a] rounded font-mono text-[11px] space-y-1 max-h-60 overflow-y-auto">
              <div class="text-[#34d399]">[INFO] Payment request received for order ORD-93821</div>
              <div class="text-[#34d399]">[INFO] Processing payment via Stripe Gateway</div>
              <div class="text-[#fbbf24]">[WARN] Payment gateway response slow: 1840ms latency</div>
              <div class="text-[#f87171]">[ERROR] GatewayTimeoutException: Stripe SDK timeout</div>
              <div class="text-[#34d399]">[INFO] Retrying payment with backup provider Adyen</div>
            </div>
          </div>

          <!-- TAB: Errors -->
          <div *ngIf="activeTab === 'errors'" class="space-y-3 font-mono text-xs">
            <div class="p-3 bg-[#180e12] border border-[#ef4444]/30 rounded text-[#f87171]">
              <div class="font-bold">GatewayTimeoutException (Stripe SDK)</div>
              <div class="text-[11px] text-[#94a3b8] mt-1">Occurred 18 times in last 15 minutes.</div>
              <pre class="mt-2 text-[10px] text-[#fca5a5] bg-[#0b0e14] p-2 rounded">StripeException: GatewayTimeoutException at PaymentClient.java:142</pre>
            </div>
          </div>

          <!-- TAB: Config -->
          <div *ngIf="activeTab === 'config'" class="space-y-3 text-xs">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[#64748b] font-semibold mb-1">Ingestion Log Level</label>
                <select class="w-full bg-[#161e2c] text-white p-2 rounded border border-[#20293a]">
                  <option>INFO (Default)</option>
                  <option>WARN</option>
                  <option>ERROR</option>
                  <option>DEBUG</option>
                </select>
              </div>
              <div>
                <label class="block text-[#64748b] font-semibold mb-1">Retention Window</label>
                <select class="w-full bg-[#161e2c] text-white p-2 rounded border border-[#20293a]">
                  <option>30 Days Hot Storage</option>
                  <option>90 Days Cold Archive</option>
                </select>
              </div>
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

  apps$ = this.logService.applications$;
  selectedApp: ApplicationInfo | null = null;
  activeTab: 'logs' | 'errors' | 'config' = 'logs';

  openAppDetail(app: ApplicationInfo) {
    this.selectedApp = app;
  }

  viewAppLogs(appName: string) {
    this.logService.setSelectedApp(appName);
    this.router.navigate(['/logs']);
  }
}
