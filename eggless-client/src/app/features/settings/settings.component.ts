import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LogService } from '../../core/services/log.service';
import { ApiKey } from '../../core/models/log.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] p-6 gap-6 text-xs overflow-y-auto">
      <!-- Header -->
      <div>
        <h1 class="text-xl font-bold text-[#f0f4f8] tracking-tight">Organization Settings & Ingestion API Keys</h1>
        <p class="text-[#64748b] text-xs mt-0.5">Manage log ingestion tokens, retention limits, organization members, and API access</p>
      </div>

      <!-- Settings Sub-Navigation Tabs -->
      <div class="flex items-center border-b border-[#20293a] gap-6 text-xs font-medium">
        <button
          *ngFor="let tab of tabs"
          (click)="activeTab = tab.id"
          [ngClass]="activeTab === tab.id ? 'border-[#f59e0b] text-[#f59e0b] font-bold' : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'"
          class="pb-3 border-b-2 transition-colors flex items-center gap-1.5"
        >
          <span>{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- TAB: API Keys -->
      <div *ngIf="activeTab === 'apikeys'" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-bold text-[#f0f4f8]">Ingestion API Keys</h2>
            <p class="text-[#64748b] text-xs mt-0.5">API tokens used by Eggless SDKs, FluentBit, OpenTelemetry Collectors, and Vector agents to ingest log entries</p>
          </div>

          <button
            (click)="showCreateModal = true"
            class="px-3 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-[#0b0e14] font-bold rounded-md transition-colors text-xs shadow flex items-center gap-1"
          >
            + Create API Key
          </button>
        </div>

        <!-- Newly Generated Token Reveal Banner -->
        <div *ngIf="createdKeyToken" class="p-4 bg-[#10b981]/15 border border-[#10b981]/40 rounded-lg text-xs space-y-2 font-mono">
          <div class="flex items-center justify-between text-[#34d399] font-bold">
            <span>✓ New Ingestion Key Created</span>
            <button (click)="createdKeyToken = null" class="text-white">✕</button>
          </div>
          <p class="text-[#e6edf3] font-sans text-[11px]">Save this key in a secure location (e.g. Kubernetes Secrets / Vault). It will not be shown again.</p>
          <div class="p-2 bg-[#0b0e14] border border-[#20293a] rounded flex items-center justify-between select-all text-[#34d399] font-bold">
            <span>{{ createdKeyToken }}</span>
            <button (click)="copyToken(createdKeyToken)" class="px-2 py-0.5 bg-[#10b981] text-[#0b0e14] rounded font-sans text-[10px] font-bold">
              {{ copied ? 'Copied! ✓' : 'Copy Key' }}
            </button>
          </div>
        </div>

        <!-- API Keys Table -->
        <div class="bg-[#121722] border border-[#20293a] rounded-lg overflow-hidden shadow-xl">
          <table class="w-full text-left border-collapse font-mono">
            <thead class="bg-[#161e2c] text-[#64748b] uppercase font-semibold text-[10px] tracking-wider border-b border-[#20293a] font-sans">
              <tr>
                <th class="py-3 px-4">Key Name</th>
                <th class="py-3 px-4">Token Prefix</th>
                <th class="py-3 px-4">Created Date</th>
                <th class="py-3 px-4">Last Used</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#1e2636] text-xs">
              <tr *ngFor="let key of (apiKeys$ | async)" class="hover:bg-[#1a2332] transition-colors">
                <td class="py-3.5 px-4 font-bold text-[#f0f4f8] font-sans">
                  {{ key.name }}
                </td>

                <td class="py-3.5 px-4 text-[#3b82f6]">{{ key.tokenPrefix }}</td>

                <td class="py-3.5 px-4 text-[#94a3b8] font-sans">{{ key.created }}</td>

                <td class="py-3.5 px-4 text-[#e6edf3] font-sans">{{ key.lastUsed }}</td>

                <td class="py-3.5 px-4 font-sans">
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                    [ngClass]="key.status === 'active' ? 'bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30' : 'bg-[#ef4444]/15 text-[#f87171] border border-[#ef4444]/30'"
                  >
                    {{ key.status }}
                  </span>
                </td>

                <td class="py-3.5 px-4 text-right font-sans">
                  <button
                    *ngIf="key.status === 'active'"
                    (click)="revokeKey(key.id)"
                    class="text-[#64748b] hover:text-[#ef4444] font-medium"
                  >
                    Revoke Key
                  </button>
                  <span *ngIf="key.status === 'revoked'" class="text-[#64748b] italic">Revoked</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB: General -->
      <div *ngIf="activeTab === 'general'" class="space-y-4 max-w-xl">
        <div class="bg-[#121722] border border-[#20293a] rounded-lg p-4 space-y-3 font-sans">
          <h3 class="font-bold text-white text-sm">General Organization Info</h3>
          <div>
            <label class="block text-[#64748b] mb-1">Organization Name</label>
            <input type="text" value="Acme Corp Engineering" class="w-full bg-[#111622] text-white p-2 rounded border border-[#20293a]" />
          </div>
          <div>
            <label class="block text-[#64748b] mb-1">Default Log Region</label>
            <input type="text" value="us-east-1 (N. Virginia)" disabled class="w-full bg-[#111622] text-[#64748b] p-2 rounded border border-[#20293a]" />
          </div>
        </div>
      </div>

      <!-- TAB: Retention -->
      <div *ngIf="activeTab === 'retention'" class="space-y-4 max-w-xl">
        <div class="bg-[#121722] border border-[#20293a] rounded-lg p-4 space-y-3 font-sans">
          <h3 class="font-bold text-white text-sm">Data Retention Policy</h3>
          <div>
            <label class="block text-[#64748b] mb-1">Hot Searchable Retention</label>
            <select class="w-full bg-[#111622] text-white p-2 rounded border border-[#20293a]">
              <option>30 Days (Standard SaaS Plan)</option>
              <option>60 Days</option>
              <option>90 Days</option>
            </select>
          </div>
          <div>
            <label class="block text-[#64748b] mb-1">Cold Archive Storage</label>
            <select class="w-full bg-[#111622] text-white p-2 rounded border border-[#20293a]">
              <option>365 Days AWS S3 Bucket</option>
              <option>Indefinite Archive</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Modal: Create Key -->
      <div *ngIf="showCreateModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div class="bg-[#151b26] border border-[#20293a] rounded-lg w-full max-w-md p-5 text-xs space-y-4 shadow-2xl">
          <div class="flex items-center justify-between border-b border-[#20293a] pb-3">
            <h3 class="text-sm font-bold text-white">Create Ingestion API Key</h3>
            <button (click)="showCreateModal = false" class="text-[#64748b] hover:text-white font-bold">✕</button>
          </div>

          <div class="space-y-3 font-sans">
            <div>
              <label class="block text-[#64748b] font-semibold mb-1">Key Name / Description</label>
              <input [(ngModel)]="newKeyName" type="text" placeholder="e.g. Production K8s Cluster Vector Agent" class="w-full bg-[#111622] text-white p-2 rounded border border-[#20293a]" />
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-[#20293a]">
            <button (click)="showCreateModal = false" class="px-3 py-1.5 bg-[#161e2c] text-white rounded">Cancel</button>
            <button (click)="generateKey()" class="px-3.5 py-1.5 bg-[#f59e0b] text-[#0b0e14] font-bold rounded">Generate Ingestion Key</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent {
  private logService = inject(LogService);
  private route = inject(ActivatedRoute);

  apiKeys$ = this.logService.apiKeys$;
  activeTab = 'apikeys';

  showCreateModal = false;
  newKeyName = 'K8s Cluster Log Agent Key';
  createdKeyToken: string | null = null;
  copied = false;

  tabs = [
    { id: 'apikeys', label: 'API Keys', icon: '🔑' },
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'retention', label: 'Retention', icon: '💾' },
    { id: 'members', label: 'Members', icon: '👥' }
  ];

  constructor() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
    });
  }

  generateKey() {
    if (this.newKeyName) {
      this.logService.createApiKey(this.newKeyName).subscribe({
        next: (keyObj) => {
          this.createdKeyToken = keyObj.token || null;
          this.showCreateModal = false;
        },
        error: () => {
          console.error('Failed to create API key');
        }
      });
    }
  }

  revokeKey(id: string) {
    this.logService.revokeApiKey(id);
  }

  copyToken(token: string) {
    navigator.clipboard.writeText(token);
    this.copied = true;
    setTimeout(() => this.copied = false, 2000);
  }
}
