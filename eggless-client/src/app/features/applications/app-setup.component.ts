import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type SnippetId = 'curl' | 'spring' | 'logback';

/** Copy-paste instructions for sending an application's logs to this Eggless server. */
@Component({
  selector: 'app-setup-snippets',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-2">
      <div class="flex items-center gap-1">
        <button
          *ngFor="let t of tabs"
          (click)="active = t.id"
          [ngClass]="active === t.id ? 'bg-[#1c273a] text-[#f59e0b] border-[#f59e0b]/40' : 'text-[#94a3b8] border-transparent hover:text-[#f0f4f8]'"
          class="px-2.5 py-1 rounded border text-[11px] font-medium"
        >
          {{ t.label }}
        </button>
      </div>

      <p class="text-[#64748b] text-[11px]">{{ hint() }}</p>

      <div class="relative">
        <pre class="bg-[#0b0e14] border border-[#20293a] rounded p-3 pr-16 font-mono text-[11px] text-[#e6edf3] overflow-x-auto whitespace-pre">{{ snippet() }}</pre>
        <button
          (click)="copy()"
          class="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#1c273a] border border-[#20293a] text-[10px] text-[#94a3b8] hover:text-[#f0f4f8]"
        >
          {{ copied ? 'Copied ✓' : 'Copy' }}
        </button>
      </div>
    </div>
  `
})
export class AppSetupSnippetsComponent {
  @Input({ required: true }) name!: string;
  @Input() environment = 'production';
  /** Raw key when it is known (right after creation); otherwise a placeholder is shown. */
  @Input() token: string | null = null;

  tabs: { id: SnippetId; label: string }[] = [
    { id: 'curl', label: 'HTTP / curl' },
    { id: 'spring', label: 'Spring Boot' },
    { id: 'logback', label: 'Logback' }
  ];
  active: SnippetId = 'curl';
  copied = false;

  private get server(): string {
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';
  }

  private get key(): string {
    return this.token ?? '<your API key>';
  }

  hint(): string {
    switch (this.active) {
      case 'curl': return 'Any language: POST JSON logs. Use /api/v1/logs/batch with an array to send up to 1000 at once. "service" can be left out; the key fills it in.';
      case 'spring': return 'Add the io.eggless:eggless-spring-boot-starter dependency, then this to application.yml.';
      default: return 'Plain Logback without Spring Boot: add the eggless-logback-appender dependency and this appender to logback.xml.';
    }
  }

  snippet(): string {
    switch (this.active) {
      case 'curl':
        return `curl -X POST "${this.server}/api/v1/logs" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${this.key}" \\
  -d '{
    "level": "INFO",
    "environment": "${this.environment}",
    "message": "Hello from ${this.name}",
    "traceId": "trc_123",
    "metadata": { "orderId": 42 }
  }'`;
      case 'spring':
        return `eggless:
  enabled: true
  server-url: ${this.server}
  api-key: ${this.key}
  service-name: ${this.name}
  environment: ${this.environment}`;
      default:
        return `<appender name="EGGLESS" class="io.eggless.sdk.logback.EgglessLogbackAppender">
    <serverUrl>${this.server}</serverUrl>
    <apiKey>${this.key}</apiKey>
    <serviceName>${this.name}</serviceName>
    <environment>${this.environment}</environment>
</appender>

<root level="INFO">
    <appender-ref ref="EGGLESS"/>
</root>`;
    }
  }

  copy() {
    navigator.clipboard?.writeText(this.snippet()).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 1500);
    });
  }
}
