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
          <p class="text-[#64748b] text-xs mt-0.5">Automated condition monitors evaluating real-time log query streams</p>
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

              <td class="py-3.5 px-4 text-[#e6edf3] font-sans">{{ rule.condition }}</td>

              <td class="py-3.5 px-4 text-[#94a3b8] font-sans">{{ rule.channel }}</td>

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
            <h3 class="text-sm font-bold text-white">Create New Alert Rule</h3>
            <button (click)="showCreateModal = false" class="text-[#64748b] hover:text-white font-bold">✕</button>
          </div>

          <div class="space-y-3 font-sans">
            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Alert Rule Name</label>
              <input [(ngModel)]="newRule.name" type="text" placeholder="e.g. High Payment Errors" class="w-full bg-[#111622] text-white p-2 rounded border border-[#20293a]" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[#64748b] font-semibold mb-1">Target Application</label>
                <select [(ngModel)]="newRule.application" class="w-full bg-[#111622] text-white p-2 rounded border border-[#20293a] font-mono">
                  <option value="payment-api">payment-api</option>
                  <option value="order-service">order-service</option>
                  <option value="auth-service">auth-service</option>
                  <option value="frontend">frontend</option>
                  <option value="notification-service">notification-service</option>
                  <option value="db-proxy">db-proxy</option>
                </select>
              </div>

              <div>
                <label class="block text-[#64748b] font-semibold mb-1">Evaluation Window</label>
                <select [(ngModel)]="newRule.window" class="w-full bg-[#111622] text-white p-2 rounded border border-[#20293a]">
                  <option value="1m">1 Minute</option>
                  <option value="5m">5 Minutes</option>
                  <option value="15m">15 Minutes</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Log Search Query</label>
              <input [(ngModel)]="newRule.query" type="text" placeholder='e.g. level:ERROR "timeout"' class="w-full bg-[#111622] text-white p-2 rounded border border-[#20293a] font-mono" />
            </div>

            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Trigger Threshold Condition</label>
              <input [(ngModel)]="newRule.condition" type="text" placeholder="e.g. ERROR > 50 logs in 5 minutes" class="w-full bg-[#111622] text-white p-2 rounded border border-[#20293a]" />
            </div>

            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Notification Channel</label>
              <select [(ngModel)]="newRule.channel" class="w-full bg-[#111622] text-white p-2 rounded border border-[#20293a]">
                <option value="#alerts-payments (Slack)">#alerts-payments (Slack)</option>
                <option value="PagerDuty (On-Call)">PagerDuty (On-Call)</option>
                <option value="#security-ops">#security-ops</option>
                <option value="Webhook: https://hooks.company.com/logs">Custom Webhook</option>
              </select>
            </div>
          </div>

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
  showCreateModal = false;

  newRule = {
    name: 'Payment Failure Surge',
    application: 'payment-api',
    query: 'level:ERROR',
    condition: 'ERROR > 50 in 5 minutes',
    window: '5m',
    channel: '#alerts-payments (Slack)'
  };

  toggleRule(id: string) {
    this.logService.toggleAlertRule(id);
  }

  deleteRule(id: string) {
    this.logService.deleteAlertRule(id);
  }

  submitNewRule() {
    this.logService.addAlertRule({
      ...this.newRule,
      enabled: true
    });
    this.showCreateModal = false;
  }
}
