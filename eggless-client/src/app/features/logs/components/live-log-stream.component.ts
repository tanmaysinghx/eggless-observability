import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogEntry } from '../../../core/models/log.model';

@Component({
  selector: 'app-live-log-stream',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col bg-[#070a0f] border border-[#20293a] rounded-lg font-mono overflow-hidden shadow-2xl">
      <!-- Terminal Header Bar -->
      <div class="h-10 px-4 bg-[#0e131d] border-b border-[#20293a] flex items-center justify-between text-xs select-none">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-[#ef4444]/80 inline-block"></span>
            <span class="w-3 h-3 rounded-full bg-[#f59e0b]/80 inline-block"></span>
            <span class="w-3 h-3 rounded-full bg-[#10b981]/80 inline-block"></span>
          </div>
          <span class="text-[#64748b] text-[11px] border-l border-[#20293a] pl-3">eggless-tail --follow --format=json</span>
        </div>

        <div class="flex items-center gap-3">
          <!-- Live Indicator Badge -->
          <div class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#10b981]/10 border border-[#10b981]/30 text-[#34d399] text-[10px] font-semibold">
            <span class="pulsing-dot"></span>
            <span>LIVE TAIL</span>
            <span class="text-[#64748b] font-normal ml-1">({{ logs.length }} lines)</span>
          </div>

          <!-- Controls -->
          <button
            (click)="togglePause.emit()"
            [ngClass]="isPaused ? 'bg-[#f59e0b]/20 text-[#fbbf24] border-[#f59e0b]/40' : 'bg-[#1c273a] text-[#e6edf3] border-[#20293a]'"
            class="px-2.5 py-1 rounded text-[11px] font-sans font-medium border hover:border-[#f59e0b] transition-colors flex items-center gap-1"
          >
            <span>{{ isPaused ? '▶ Resume Stream' : '⏸ Pause' }}</span>
          </button>

          <button
            (click)="autoScroll = !autoScroll"
            [ngClass]="autoScroll ? 'text-[#34d399]' : 'text-[#64748b]'"
            class="px-2 py-1 rounded bg-[#161e2c] border border-[#20293a] hover:text-white transition-colors text-[11px]"
            title="Auto-scroll on new logs"
          >
            Auto-scroll: {{ autoScroll ? 'ON' : 'OFF' }}
          </button>

          <button
            (click)="clearBuffer.emit()"
            class="px-2 py-1 rounded bg-[#161e2c] border border-[#20293a] text-[#94a3b8] hover:text-[#ef4444] transition-colors text-[11px]"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Terminal Output Screen -->
      <div #terminalContainer class="flex-1 overflow-y-auto p-4 space-y-1 text-xs select-text leading-relaxed">
        <div *ngIf="logs.length === 0" class="text-[#64748b] py-8 text-center italic">
          Waiting for live log stream... (Listening on websocket wss://stream.eggless.io/v1)
        </div>

        <div
          *ngFor="let log of logs"
          class="flex items-start gap-3 py-0.5 px-1 rounded hover:bg-[#121824] transition-colors font-mono group"
        >
          <span class="text-[#64748b] text-[11px] shrink-0 font-sans select-none">$</span>
          <span class="text-[#64748b] shrink-0 text-[11px]">{{ log.timestamp }}</span>

          <span
            class="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0"
            [ngClass]="{
              'text-[#34d399] bg-[#10b981]/10': log.level === 'INFO',
              'text-[#fbbf24] bg-[#f59e0b]/10': log.level === 'WARN',
              'text-[#f87171] bg-[#ef4444]/10': log.level === 'ERROR',
              'text-[#c084fc] bg-[#8b5cf6]/10': log.level === 'DEBUG'
            }"
          >
            {{ log.level }}
          </span>

          <span class="text-[#f59e0b] font-medium shrink-0">[{{ log.service }}]</span>

          <span
            class="flex-1 break-all"
            [ngClass]="{
              'text-[#f0f4f8]': log.level === 'INFO',
              'text-[#fef08a]': log.level === 'WARN',
              'text-[#fca5a5]': log.level === 'ERROR',
              'text-[#e9d5ff]': log.level === 'DEBUG'
            }"
          >
            {{ log.message }}
          </span>

          <span class="text-[#475569] text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {{ log.traceId }}
          </span>
        </div>
      </div>

      <!-- Terminal Footer Status Bar -->
      <div class="h-7 px-4 bg-[#0e131d] border-t border-[#20293a] flex items-center justify-between text-[11px] text-[#64748b]">
        <span>Status: <span class="text-[#34d399]">Streaming OK</span></span>
        <span>Rate: <span class="text-[#f59e0b] font-semibold">+24 logs/sec</span></span>
      </div>
    </div>
  `
})
export class LiveLogStreamComponent implements AfterViewChecked, OnChanges {
  @Input() logs: LogEntry[] = [];
  @Input() isPaused = false;
  @Output() togglePause = new EventEmitter<void>();
  @Output() clearBuffer = new EventEmitter<void>();

  @ViewChild('terminalContainer') private terminalContainer!: ElementRef;

  autoScroll = true;

  ngAfterViewChecked() {
    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['logs'] && this.autoScroll) {
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.terminalContainer) {
        this.terminalContainer.nativeElement.scrollTop = this.terminalContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }
}
