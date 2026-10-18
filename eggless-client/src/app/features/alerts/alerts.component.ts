import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogService } from '../../core/services/log.service';
import { AlertRule } from '../../core/models/log.model';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] p-6 gap-6 text-xs overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-[#f0f4f8] tracking-tight">Alert Rules & Incident Dispatch</h1>
          <p class="text-[#64748b] text-xs mt-0.5">Rules are evaluated against recent logs every few seconds (30s by default); webhook channels are notified when a rule fires</p>
        </div>

        <button
          (click)="showCreateModal = true"
          class="px-3.5 py-2 bg-[#f59e0b] hover:bg-[#d97706] text-[#0b0e14] font-bold rounded-md transition-colors text-xs shadow-md flex items-center gap-1.5"
        >
          + Create Alert Rule
        </button>
      </div>

      <!-- Alerts List Table -->
      <div class="bg-[#121722] border border-[#20293a] rounded-lg overflow-hidden shadow-xl">
        <table class="w-full text-left border-collapse">
          <thead class="bg-[#161e2c] text-[#64748b] uppercase font-semibold text-[10px] tracking-wider border-b border-[#20293a]">
            <tr>
              <th class="py-3 px-4">Rule Name</th>
              <th class="py-3 px-4">Application</th>
              <th class="py-3 px-4 font-mono">Query Expression</th>
              <th class="py-3 px-4 font-mono">Condition & Window</th>
              <th class="py-3 px-4">Notification Channel</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4">Enabled</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#1e2636] font-mono text-xs">
            <tr *ngFor="let rule of (alerts$ | async)" class="hover:bg-[#1a2332] transition-colors">
              <td class="py-3.5 px-4 font-bold text-[#f0f4f8] font-sans">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full" [ngClass]="rule.status === 'triggered' ? 'bg-[#ef4444] animate-pulse' : rule.enabled ? 'bg-[#10b981]' : 'bg-[#64748b]'"></span>
                  <span>{{ rule.name }}</span>
                </div>
              </td>

              <td class="py-3.5 px-4 text-[#f59e0b] font-semibold">{{ rule.application }}</td>

              <td class="py-3.5 px-4 text-[#34d399] font-mono text-[11px] bg-[#0b0e14]/50 rounded">{{ rule.query }}</td>

              <td class="py-3.5 px-4 text-[#e6edf3] font-sans">
                {{ rule.condition }} <span class="text-[#64748b]">/ {{ rule.window }}</span>
                <span *ngIf="rule.lastTriggered" class="block text-[10px] text-[#64748b]">Last fired {{ rule.lastTriggered }}</span>
              </td>

              <td class="py-3.5 px-4 text-[#94a3b8] font-sans max-w-[220px] truncate" [title]="rule.channel">{{ rule.channel }}</td>

              <td class="py-3.5 px-4 font-sans">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                  [ngClass]="{
                    'bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/40': rule.status === 'triggered',
                    'bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30': rule.status === 'ok',
                    'bg-[#161e2c] text-[#64748b] border border-[#20293a]': rule.status === 'disabled'
                  }"
                >
                  {{ rule.status }}
                </span>
              </td>

              <td class="py-3.5 px-4">
                <button
                  (click)="toggleRule(rule.id)"
                  class="w-9 h-5 rounded-full p-0.5 transition-colors relative"
                  [ngClass]="rule.enabled ? 'bg-[#10b981]' : 'bg-[#20293a]'"
                >
                  <div class="w-4 h-4 rounded-full bg-white transition-transform" [ngClass]="rule.enabled ? 'translate-x-4' : 'translate-x-0'"></div>
                </button>
              </td>

              <td class="py-3.5 px-4 text-right font-sans">
                <button (click)="deleteRule(rule.id)" class="text-[#64748b] hover:text-[#ef4444] p-1 font-bold">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Modal: Create Alert Rule -->
      <div *ngIf="showCreateModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div class="bg-[#151b26] border border-[#20293a] rounded-lg w-full max-w-lg p-6 text-xs space-y-4 shadow-2xl">
          <div class="flex items-center justify-between border-b border-[#20293a] pb-3">
            <h3 class="text-sm font-bold text-[#f0f4f8]">Create New Alert Rule</h3>
            <button (click)="showCreateModal = false" class="text-[#64748b] hover:text-[#f0f4f8] font-bold">✕</button>
          </div>

          <div class="space-y-3 font-sans">
            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Alert Rule Name</label>
              <input [(ngModel)]="newRule.name" type="text" placeholder="e.g. High Payment Errors" class="w-full bg-[#111622] text-[#f0f4f8] p-2 rounded border border-[#20293a]" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[#64748b] font-semibold mb-1">Target Application</label>
                <select [(ngModel)]="newRule.application" class="w-full bg-[#111622] text-[#f0f4f8] p-2 rounded border border-[#20293a] font-mono">
                  <option value="all">All applications</option>
                  <option *ngFor="let app of (apps$ | async)" [value]="app.name">{{ app.name }}</option>
                </select>
              </div>

              <div>
                <label class="block text-[#64748b] font-semibold mb-1">Evaluation Window</label>
                <select [(ngModel)]="newRule.window" class="w-full bg-[#111622] text-[#f0f4f8] p-2 rounded border border-[#20293a]">
                  <option value="1m">1 Minute</option>
                  <option value="5m">5 Minutes</option>
                  <option value="15m">15 Minutes</option>
                  <option value="1h">1 Hour</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Log Search Query</label>
              <input [(ngModel)]="newRule.query" type="text" placeholder='e.g. level:ERROR "timeout"' class="w-full bg-[#111622] text-[#f0f4f8] p-2 rounded border border-[#20293a] font-mono" />
            </div>

            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Trigger Threshold Condition</label>
              <input [(ngModel)]="newRule.condition" type="text" placeholder="e.g. ERROR > 50" class="w-full bg-[#111622] text-[#f0f4f8] p-2 rounded border border-[#20293a] font-mono" />
              <p class="text-[#64748b] text-[10px] mt-1">Metric, comparison, number: <span class="font-mono">count &gt; 100</span>, <span class="font-mono">ERROR &gt;= 10</span>, <span class="font-mono">error_rate &gt; 5%</span>. Counted over the window, among logs matching the query.</p>
            </div>

            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Notification Channel</label>
              <input [(ngModel)]="newRule.channel" type="text" placeholder="https://hooks.slack.com/services/... (leave empty for in-app only)" class="w-full bg-[#111622] text-[#f0f4f8] p-2 rounded border border-[#20293a] font-mono" />
              <p class="text-[#64748b] text-[10px] mt-1">A webhook URL (Slack, Discord, Mattermost or any JSON endpoint) is POSTed to when the rule triggers.</p>
            </div>
          </div>

          <div *ngIf="createError" class="p-2.5 rounded border border-[#ef4444]/40 bg-[#180e12] text-[#f87171]">{{ createError }}</div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-[#20293a]">
            <button (click)="showCreateModal = false" class="px-3 py-1.5 bg-[#161e2c] text-white rounded">Cancel</button>
            <button (click)="submitNewRule()" class="px-3.5 py-1.5 bg-[#f59e0b] text-[#0b0e14] font-bold rounded">Create Alert Rule</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AlertsComponent {
  private logService = inject(LogService);

  alerts$ = this.logService.alerts$;
  apps$ = this.logService.applications$;
  showCreateModal = false;
  createError: string | null = null;

  newRule = {
    name: '',
    application: 'all',
    query: 'level:ERROR',
    condition: 'ERROR > 50',
    window: '5m',
    channel: ''
  };

  toggleRule(id: string) {
    this.logService.toggleAlertRule(id);
  }

  deleteRule(id: string) {
    this.logService.deleteAlertRule(id);
  }

  submitNewRule() {
    this.createError = null;
    this.logService.addAlertRule({ ...this.newRule, enabled: true }).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.newRule = { ...this.newRule, name: '' };
      },
      error: (err: Error) => this.createError = err.message
    });
  }
}
