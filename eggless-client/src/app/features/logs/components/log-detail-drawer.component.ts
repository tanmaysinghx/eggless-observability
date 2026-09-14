import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogEntry } from '../../../core/models/log.model';
import { LogService } from '../../../core/services/log.service';

@Component({
  selector: 'app-log-detail-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="log"
      class="fixed inset-y-0 right-0 w-[440px] max-w-full bg-[#141a24] border-l border-[#20293a] shadow-2xl z-40 flex flex-col font-sans transition-all duration-200"
    >
      <!-- Drawer Header -->
      <div class="h-14 px-4 border-b border-[#20293a] flex items-center justify-between bg-[#111622]">
        <div class="flex items-center gap-2">
          <span
            class="eggless-badge"
            [ngClass]="{
              'badge-info': log.level === 'INFO',
              'badge-warn': log.level === 'WARN',
              'badge-error': log.level === 'ERROR',
              'badge-debug': log.level === 'DEBUG'
            }"
          >
            {{ log.level }}
          </span>
          <span class="text-sm font-semibold text-[#f0f4f8]">Log Details</span>
        </div>

        <button
          (click)="close.emit()"
          class="p-1 rounded-md text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#1f293d] transition-colors"
          title="Close drawer (Esc)"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Drawer Content Body -->
      <div class="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        <!-- Message Box -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Log Message</span>
            <button (click)="copyText(log.message)" class="text-[#f59e0b] hover:underline text-[11px] font-mono">
              {{ copiedMessage ? 'Copied! ✓' : 'Copy Message' }}
            </button>
          </div>
          <div class="p-3 bg-[#0b0e14] border border-[#20293a] rounded-md text-[#f0f4f8] font-mono leading-relaxed select-all overflow-x-auto">
            {{ log.message }}
          </div>
        </div>

        <!-- Key Metadata Grid -->
        <div class="grid grid-cols-2 gap-3 p-3 bg-[#0f141d] border border-[#20293a] rounded-md font-mono">
          <div>
            <div class="text-[10px] text-[#64748b] uppercase font-sans">Timestamp</div>
            <div class="text-[#f0f4f8] font-medium mt-0.5">{{ log.timestamp }}</div>
            <div class="text-[10px] text-[#64748b] truncate">{{ log.fullTimestamp }}</div>
          </div>

          <div>
            <div class="text-[10px] text-[#64748b] uppercase font-sans">Application</div>
            <div class="text-[#f59e0b] font-semibold mt-0.5 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
              {{ log.service }}
            </div>
          </div>

          <div>
            <div class="text-[10px] text-[#64748b] uppercase font-sans">Environment</div>
            <div class="text-[#e6edf3] font-medium mt-0.5 capitalize">{{ log.environment }}</div>
          </div>

          <div>
            <div class="text-[10px] text-[#64748b] uppercase font-sans">Host</div>
            <div class="text-[#94a3b8] mt-0.5 truncate" [title]="log.host">{{ log.host }}</div>
          </div>

          <div>
            <div class="text-[10px] text-[#64748b] uppercase font-sans">Trace ID</div>
            <div class="text-[#3b82f6] mt-0.5 truncate cursor-pointer hover:underline" (click)="copyText(log.traceId)">
              {{ log.traceId }}
            </div>
          </div>

          <div>
            <div class="text-[10px] text-[#64748b] uppercase font-sans">Request ID</div>
            <div class="text-[#94a3b8] mt-0.5 truncate">{{ log.requestId }}</div>
          </div>
        </div>

        <!-- Formatted JSON Metadata -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Metadata (JSON)</span>
            <button (click)="copyText(formattedJson)" class="text-[#f59e0b] hover:underline text-[11px] font-mono">
              {{ copiedJson ? 'Copied! ✓' : 'Copy JSON' }}
            </button>
          </div>
          <pre class="p-3 bg-[#0b0e14] border border-[#20293a] rounded-md text-[#34d399] font-mono text-[11px] leading-snug overflow-x-auto select-all">{{ formattedJson }}</pre>
        </div>

        <!-- Stack Trace (If present) -->
        <div *ngIf="log.stackTrace">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[11px] font-semibold text-[#ef4444] uppercase tracking-wider flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Stack Trace
            </span>
            <button (click)="copyText(log.stackTrace)" class="text-[#ef4444] hover:underline text-[11px] font-mono">
              Copy Stack Trace
            </button>
          </div>
          <div class="p-3 bg-[#180e12] border border-[#ef4444]/30 rounded-md text-[#f87171] font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all">
            {{ log.stackTrace }}
          </div>
        </div>
      </div>

      <!-- Action Footer Toolbar -->
      <div class="p-3 border-t border-[#20293a] bg-[#111622] flex items-center justify-between gap-2">
        <button
          (click)="copyAllLogDetails()"
          class="flex-1 px-3 py-1.5 bg-[#1c273a] hover:bg-[#25334c] text-[#e6edf3] font-medium rounded-md text-xs transition-colors flex items-center justify-center gap-1.5 border border-[#20293a]"
        >
          <svg class="w-3.5 h-3.5 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Copy JSON
        </button>

        <button
          (click)="createAlertFromLog()"
          class="flex-1 px-3 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-[#0b0e14] font-semibold rounded-md text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-[#f59e0b]/20"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Create Alert
        </button>
      </div>
    </div>
  `
})
export class LogDetailDrawerComponent {
  @Input() log: LogEntry | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() createAlert = new EventEmitter<{ app: string; query: string }>();

  private logService = inject(LogService);

  copiedMessage = false;
  copiedJson = false;

  get formattedJson(): string {
    if (!this.log || !this.log.metadata) return '{}';
    return JSON.stringify(this.log.metadata, null, 2);
  }

  copyText(text: string | undefined) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    this.copiedMessage = true;
    setTimeout(() => this.copiedMessage = false, 2000);
  }

  copyAllLogDetails() {
    if (!this.log) return;
    navigator.clipboard.writeText(JSON.stringify(this.log, null, 2));
    this.copiedJson = true;
    setTimeout(() => this.copiedJson = false, 2000);
  }

  createAlertFromLog() {
    if (!this.log) return;
    const query = this.log.level === 'ERROR' ? `level:ERROR "${this.log.message.substring(0, 30)}"` : `service:${this.log.service}`;
    this.createAlert.emit({ app: this.log.service, query });
  }
}
