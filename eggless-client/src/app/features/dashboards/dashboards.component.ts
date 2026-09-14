import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogService } from '../../core/services/log.service';

@Component({
  selector: 'app-dashboards',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] p-6 gap-6 text-xs overflow-y-auto">
      <!-- Top Bar Controls -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-[#f0f4f8] tracking-tight">Dashboards & Metrics</h1>
          <p class="text-[#64748b] text-xs mt-0.5">Real-time log telemetry visualizer and service health dashboards</p>
        </div>

        <div class="flex items-center gap-3">
          <select class="h-8 px-2 bg-[#161e2c] text-[#e6edf3] text-xs rounded border border-[#20293a]">
            <option>Dashboard: Production System Health</option>
            <option>Dashboard: Payment Gateway SLA</option>
            <option>Dashboard: Auth & Security Audit</option>
          </select>

          <button
            (click)="showAddWidgetModal = true"
            class="px-3 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-[#0b0e14] font-bold rounded-md transition-colors text-xs flex items-center gap-1 shadow"
          >
            + Add Widget
          </button>
        </div>
      </div>

      <!-- Dashboard Grid Layout -->
      <div class="grid grid-cols-3 gap-4">
        <!-- Widget 1: Log Ingestion Rate Over Time (SVG Bar Graph) -->
        <div class="col-span-2 bg-[#121722] border border-[#20293a] rounded-lg p-4 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="font-bold text-[#f0f4f8] text-sm">Log Count Over Time (Last 1 Hour)</span>
            <span class="text-[#34d399] font-mono text-xs">12,482 total logs</span>
          </div>

          <!-- SVG Bar Chart Visualization -->
          <div class="h-40 w-full flex items-end gap-1.5 pt-4 pb-2 px-2 border-b border-[#20293a]">
            <div *ngFor="let bar of logVolumeBars" class="flex-1 bg-[#1c273a] hover:bg-[#f59e0b] rounded-t transition-all group relative flex flex-col justify-end" [style.height.%]="bar.height">
              <div class="bg-[#ef4444] rounded-t" [style.height.%]="bar.errorPct"></div>
              <!-- Tooltip -->
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-[#0b0e14] border border-[#20293a] px-2 py-1 rounded text-[10px] font-mono text-white whitespace-nowrap z-20">
                {{ bar.time }}: {{ bar.count }} logs ({{ bar.errors }} errors)
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between text-[10px] text-[#64748b] font-mono">
            <span>20:00</span>
            <span>20:15</span>
            <span>20:30</span>
            <span>20:45</span>
            <span>NOW</span>
          </div>
        </div>

        <!-- Widget 2: Logs by Level Breakdown (Donut Progress style) -->
        <div class="bg-[#121722] border border-[#20293a] rounded-lg p-4 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="font-bold text-[#f0f4f8] text-sm">Logs by Level</span>
            <span class="text-[#64748b] text-[10px]">Last 24h</span>
          </div>

          <div class="space-y-3 py-2 font-mono">
            <div>
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-[#34d399] font-semibold">INFO (78%)</span>
                <span class="text-[#94a3b8]">9,735</span>
              </div>
              <div class="w-full bg-[#161e2c] h-2 rounded-full overflow-hidden">
                <div class="bg-[#10b981] h-full w-[78%]"></div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-[#fbbf24] font-semibold">WARN (16%)</span>
                <span class="text-[#94a3b8]">1,997</span>
              </div>
              <div class="w-full bg-[#161e2c] h-2 rounded-full overflow-hidden">
                <div class="bg-[#f59e0b] h-full w-[16%]"></div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-[#f87171] font-semibold">ERROR (4.5%)</span>
                <span class="text-[#94a3b8]">561</span>
              </div>
              <div class="w-full bg-[#161e2c] h-2 rounded-full overflow-hidden">
                <div class="bg-[#ef4444] h-full w-[4.5%]"></div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-[#c084fc] font-semibold">DEBUG (1.5%)</span>
                <span class="text-[#94a3b8]">189</span>
              </div>
              <div class="w-full bg-[#161e2c] h-2 rounded-full overflow-hidden">
                <div class="bg-[#8b5cf6] h-full w-[1.5%]"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Widget 3: Logs by Application Breakdown -->
        <div class="col-span-1 bg-[#121722] border border-[#20293a] rounded-lg p-4">
          <span class="font-bold text-[#f0f4f8] text-sm">Top Applications Volume</span>
          <div class="mt-4 space-y-2.5 font-mono">
            <div *ngFor="let app of appBreakdown" class="flex items-center justify-between text-xs p-2 bg-[#161e2c] rounded border border-[#20293a]">
              <span class="text-[#f59e0b] font-semibold">{{ app.name }}</span>
              <span class="text-[#e6edf3]">{{ app.rate }} / min</span>
            </div>
          </div>
        </div>

        <!-- Widget 4: Top Error Messages List -->
        <div class="col-span-2 bg-[#121722] border border-[#20293a] rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="font-bold text-[#f0f4f8] text-sm">Top Error Messages & Exceptions</span>
            <span class="text-[#f87171] text-xs font-mono">183 active errors</span>
          </div>

          <div class="space-y-2 font-mono text-xs">
            <div class="p-2.5 bg-[#180e12] border border-[#ef4444]/30 rounded flex items-center justify-between">
              <div class="truncate max-w-lg text-[#f87171]">
                Payment failed: GatewayTimeoutException in Stripe SDK
                <span class="block text-[10px] text-[#64748b] font-sans">payment-api • 142 occurrences</span>
              </div>
              <span class="px-2 py-0.5 bg-[#ef4444]/20 text-[#f87171] rounded text-[10px] font-bold">HIGH</span>
            </div>

            <div class="p-2.5 bg-[#180e12] border border-[#ef4444]/30 rounded flex items-center justify-between">
              <div class="truncate max-w-lg text-[#f87171]">
                DB Connection pool exhausted: 50/50 connections in use
                <span class="block text-[10px] text-[#64748b] font-sans">auth-service • 88 occurrences</span>
              </div>
              <span class="px-2 py-0.5 bg-[#ef4444]/20 text-[#f87171] rounded text-[10px] font-bold">CRITICAL</span>
            </div>

            <div class="p-2.5 bg-[#180e12] border border-[#ef4444]/30 rounded flex items-center justify-between">
              <div class="truncate max-w-lg text-[#f87171]">
                Unhandled Promise Rejection: Failed to fetch /api/v1/metrics/live 502
                <span class="block text-[10px] text-[#64748b] font-sans">frontend • 42 occurrences</span>
              </div>
              <span class="px-2 py-0.5 bg-[#f59e0b]/20 text-[#fbbf24] rounded text-[10px] font-bold">MEDIUM</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal: Add Widget -->
      <div *ngIf="showAddWidgetModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div class="bg-[#151b26] border border-[#20293a] rounded-lg w-full max-w-md p-5 text-xs space-y-4">
          <div class="flex items-center justify-between border-b border-[#20293a] pb-3">
            <h3 class="text-sm font-bold text-white">Add Custom Dashboard Widget</h3>
            <button (click)="showAddWidgetModal = false" class="text-[#64748b] hover:text-white">✕</button>
          </div>

          <div>
            <label class="block text-[#64748b] font-semibold mb-1">Widget Title</label>
            <input type="text" placeholder="e.g. Stripe Errors Count" class="w-full bg-[#111622] text-white p-2 rounded border border-[#20293a]" />
          </div>

          <div>
            <label class="block text-[#64748b] font-semibold mb-1">Widget Metric Type</label>
            <select class="w-full bg-[#111622] text-white p-2 rounded border border-[#20293a]">
              <option>Log Count Over Time</option>
              <option>Error Count Over Time</option>
              <option>Logs by Application</option>
              <option>Logs by Level Distribution</option>
              <option>Top Error Messages List</option>
            </select>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#20293a]">
            <button (click)="showAddWidgetModal = false" class="px-3 py-1.5 bg-[#161e2c] text-white rounded">Cancel</button>
            <button (click)="showAddWidgetModal = false" class="px-3 py-1.5 bg-[#f59e0b] text-[#0b0e14] font-bold rounded">Add Widget</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardsComponent {
  private logService = inject(LogService);

  showAddWidgetModal = false;

  logVolumeBars = Array.from({ length: 30 }, (_, i) => ({
    time: `${20}:${String(i * 2).padStart(2, '0')}`,
    height: Math.floor(Math.random() * 70) + 30,
    errorPct: Math.floor(Math.random() * 25) + 5,
    count: Math.floor(Math.random() * 400) + 200,
    errors: Math.floor(Math.random() * 20) + 2
  }));

  appBreakdown = [
    { name: 'payment-api', rate: '1,243' },
    { name: 'order-service', rate: '824' },
    { name: 'auth-service', rate: '421' },
    { name: 'frontend', rate: '2,150' },
    { name: 'notification-service', rate: '180' }
  ];
}
