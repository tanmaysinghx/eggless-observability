import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LogService } from '../../core/services/log.service';
import { SsoService, SsoUser, PortalSsoConfig } from '../../core/services/sso.service';
import { ApiKey } from '../../core/models/log.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-full flex flex-col bg-slate-50 dark:bg-[#0b0e14] p-6 gap-6 text-xs overflow-y-auto font-sans transition-colors">
      <!-- Header -->
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-[#f0f4f8] tracking-tight">Organization Settings & Single Sign-On</h1>
        <p class="text-slate-500 dark:text-[#64748b] text-xs mt-0.5">Manage Portal SSO integration, log ingestion tokens, retention limits, and organization members</p>
      </div>

      <!-- Settings Sub-Navigation Tabs -->
      <div class="flex items-center border-b border-slate-200 dark:border-[#20293a] gap-6 text-xs font-medium">
        <button
          *ngFor="let tab of tabs"
          (click)="activeTab = tab.id"
          [ngClass]="activeTab === tab.id ? 'border-amber-500 text-amber-600 dark:text-[#f59e0b] font-bold' : 'border-transparent text-slate-500 dark:text-[#64748b] hover:text-slate-900 dark:hover:text-[#94a3b8]'"
          class="pb-3 border-b-2 transition-colors flex items-center gap-1.5"
        >
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- TAB: Portal SSO -->
      <div *ngIf="activeTab === 'sso'" class="space-y-6 max-w-3xl">
        <div>
          <h2 class="text-sm font-bold text-slate-900 dark:text-[#f0f4f8]">Portal SSO (OAuth 2.1 & External Auth)</h2>
          <p class="text-slate-500 dark:text-[#64748b] text-xs mt-0.5">
            Connect Eggless Observability with your centralized Portal SSO identity provider for browser SSO and programmatic AI agent authentication.
          </p>
        </div>

        <!-- Connection Test Result Banner -->
        <div *ngIf="healthResult" class="p-3.5 rounded-xl border text-xs font-mono" [ngClass]="healthResult.ok ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400'">
          <div class="flex items-center justify-between">
            <span class="font-bold">{{ healthResult.ok ? '✓ Portal SSO Connection Verified' : '✕ Connection Error' }}</span>
            <button (click)="healthResult = null" class="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          <p class="mt-1 font-sans text-[11px]">{{ healthResult.message }}</p>
        </div>

        <!-- SSO Config Form Card -->
        <div class="bg-white dark:bg-[#121722] border border-slate-200 dark:border-[#20293a] rounded-xl p-5 space-y-4 shadow-sm">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#20293a]">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="font-semibold text-slate-900 dark:text-[#f0f4f8]">SSO Provider Parameters</span>
            </div>
            <button
              (click)="testSsoConnection()"
              [disabled]="testingHealth"
              class="px-3 py-1.5 bg-slate-100 dark:bg-[#1c273a] hover:bg-slate-200 dark:hover:bg-[#25334c] text-slate-700 dark:text-[#f0f4f8] font-semibold rounded-lg transition-colors text-xs flex items-center gap-1.5"
            >
              <span *ngIf="testingHealth" class="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>
              <span>Test Discovery Endpoint</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-600 dark:text-[#94a3b8] font-medium mb-1">Portal SSO Base URL</label>
              <input
                type="text"
                [(ngModel)]="portalConfig.baseUrl"
                placeholder="https://portal.tanmaysinghx.com"
                class="w-full bg-slate-50 dark:bg-[#0b0e14] text-slate-900 dark:text-[#f0f4f8] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] font-mono text-xs focus:outline-none focus:border-amber-500"
              />
              <span class="text-[10px] text-slate-400 dark:text-[#64748b]">Issuer root for OIDC discovery & token exchange</span>
            </div>

            <div>
              <label class="block text-slate-600 dark:text-[#94a3b8] font-medium mb-1">OAuth 2.1 Client ID</label>
              <input
                type="text"
                [(ngModel)]="portalConfig.clientId"
                placeholder="eggless-observability"
                class="w-full bg-slate-50 dark:bg-[#0b0e14] text-slate-900 dark:text-[#f0f4f8] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] font-mono text-xs focus:outline-none focus:border-amber-500"
              />
              <span class="text-[10px] text-slate-400 dark:text-[#64748b]">Public client identifier used for PKCE Authorization</span>
            </div>

            <div>
              <label class="block text-slate-600 dark:text-[#94a3b8] font-medium mb-1">Application ID (UUID)</label>
              <input
                type="text"
                [(ngModel)]="portalConfig.applicationId"
                placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
                class="w-full bg-slate-50 dark:bg-[#0b0e14] text-slate-900 dark:text-[#f0f4f8] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] font-mono text-xs focus:outline-none focus:border-amber-500"
              />
              <span class="text-[10px] text-slate-400 dark:text-[#64748b]">Used for External Auth API endpoints (/api/external/apps/&#123;id&#125;/*)</span>
            </div>

            <div>
              <label class="block text-slate-600 dark:text-[#94a3b8] font-medium mb-1">Redirect URI</label>
              <input
                type="text"
                [(ngModel)]="portalConfig.redirectUri"
                placeholder="http://localhost:4200/auth/callback"
                class="w-full bg-slate-50 dark:bg-[#0b0e14] text-slate-900 dark:text-[#f0f4f8] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] font-mono text-xs focus:outline-none focus:border-amber-500"
              />
              <span class="text-[10px] text-slate-400 dark:text-[#64748b]">Registered callback URL in Portal SSO Admin Console</span>
            </div>
          </div>

          <div class="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-[#20293a]">
            <span class="text-[11px] text-slate-400 dark:text-[#64748b]">
              Sensitive X-Portal-App-Key is managed securely on eggless-server
            </span>
            <button
              (click)="savePortalConfig()"
              class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg transition-colors text-xs"
            >
              {{ configSaved ? 'Saved! ✓' : 'Save SSO Settings' }}
            </button>
          </div>
        </div>

        <!-- Active SSO Session Card -->
        <div class="bg-white dark:bg-[#121722] border border-slate-200 dark:border-[#20293a] rounded-xl p-5 space-y-4 shadow-sm" *ngIf="currentUser$ | async as user">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#20293a]">
            <div>
              <span class="font-semibold text-slate-900 dark:text-[#f0f4f8]">Active Portal SSO Session</span>
              <p class="text-[11px] text-slate-500 dark:text-[#94a3b8]">Verified identity profile authenticated with Portal SSO</p>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-[#f59e0b] border border-amber-500/30">
              {{ user.ssoProvider }}
            </span>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span class="text-slate-400 dark:text-[#64748b] block text-[10px] uppercase font-mono">User</span>
              <span class="font-bold text-slate-900 dark:text-white">{{ user.name }}</span>
            </div>
            <div>
              <span class="text-slate-400 dark:text-[#64748b] block text-[10px] uppercase font-mono">Email</span>
              <span class="font-mono text-slate-700 dark:text-[#e6edf3]">{{ user.email }}</span>
            </div>
            <div>
              <span class="text-slate-400 dark:text-[#64748b] block text-[10px] uppercase font-mono">Roles</span>
              <div class="flex flex-wrap gap-1 mt-0.5">
                <span *ngFor="let r of user.roles" class="px-1.5 py-0.2 bg-slate-100 dark:bg-[#1c273a] text-slate-600 dark:text-[#94a3b8] rounded text-[10px] font-mono">
                  {{ r }}
                </span>
              </div>
            </div>
            <div>
              <span class="text-slate-400 dark:text-[#64748b] block text-[10px] uppercase font-mono">Expires At</span>
              <span class="font-mono text-slate-600 dark:text-[#94a3b8] text-[11px]">{{ user.expiresAt | date:'medium' }}</span>
            </div>
          </div>

          <div *ngIf="user.claims" class="pt-2">
            <span class="text-slate-400 dark:text-[#64748b] block text-[10px] uppercase font-mono mb-1">Decoded Token Claims</span>
            <pre class="p-3 bg-slate-100 dark:bg-[#0b0e14] border border-slate-200 dark:border-[#20293a] rounded-lg font-mono text-[10px] text-slate-700 dark:text-[#94a3b8] overflow-x-auto max-h-36">{{ user.claims | json }}</pre>
          </div>
        </div>
      </div>

      <!-- TAB: API Keys -->
      <div *ngIf="activeTab === 'apikeys'" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-bold text-slate-900 dark:text-[#f0f4f8]">Ingestion API Keys</h2>
            <p class="text-slate-500 dark:text-[#64748b] text-xs mt-0.5">API tokens used by Eggless SDKs, FluentBit, OpenTelemetry Collectors, and Vector agents to ingest log entries</p>
          </div>

          <button
            (click)="showCreateModal = true"
            class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-md transition-colors text-xs shadow flex items-center gap-1"
          >
            + Create API Key
          </button>
        </div>

        <!-- Newly Generated Token Reveal Banner -->
        <div *ngIf="createdKeyToken" class="p-4 bg-emerald-50 dark:bg-[#10b981]/15 border border-emerald-200 dark:border-[#10b981]/40 rounded-lg text-xs space-y-2 font-mono">
          <div class="flex items-center justify-between text-emerald-600 dark:text-[#34d399] font-bold">
            <span>✓ New Ingestion Key Created</span>
            <button (click)="createdKeyToken = null" class="text-slate-500 hover:text-slate-800">✕</button>
          </div>
          <p class="text-slate-700 dark:text-[#e6edf3] font-sans text-[11px]">Save this key in a secure location (e.g. Kubernetes Secrets / Vault). It will not be shown again.</p>
          <div class="p-2 bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-[#20293a] rounded flex items-center justify-between select-all text-emerald-600 dark:text-[#34d399] font-bold">
            <span>{{ createdKeyToken }}</span>
            <button (click)="copyToken(createdKeyToken)" class="px-2 py-0.5 bg-emerald-500 text-slate-950 rounded font-sans text-[10px] font-bold">
              {{ copied ? 'Copied! ✓' : 'Copy Key' }}
            </button>
          </div>
        </div>

        <!-- API Keys Table -->
        <div class="bg-white dark:bg-[#121722] border border-slate-200 dark:border-[#20293a] rounded-lg overflow-hidden shadow-sm">
          <table class="w-full text-left border-collapse font-mono">
            <thead class="bg-slate-50 dark:bg-[#161e2c] text-slate-500 dark:text-[#64748b] uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-[#20293a] font-sans">
              <tr>
                <th class="py-3 px-4">Key Name</th>
                <th class="py-3 px-4">Token Prefix</th>
                <th class="py-3 px-4">Created Date</th>
                <th class="py-3 px-4">Last Used</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-[#1e2636] text-xs">
              <tr *ngFor="let key of (apiKeys$ | async)" class="hover:bg-slate-50 dark:hover:bg-[#1a2332] transition-colors">
                <td class="py-3.5 px-4 font-bold text-slate-900 dark:text-[#f0f4f8] font-sans">
                  {{ key.name }}
                </td>

                <td class="py-3.5 px-4 text-blue-600 dark:text-[#3b82f6]">{{ key.tokenPrefix }}</td>

                <td class="py-3.5 px-4 text-slate-500 dark:text-[#94a3b8] font-sans">{{ key.created }}</td>

                <td class="py-3.5 px-4 text-slate-700 dark:text-[#e6edf3] font-sans">{{ key.lastUsed }}</td>

                <td class="py-3.5 px-4 font-sans">
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                    [ngClass]="key.status === 'active' ? 'bg-emerald-50 dark:bg-[#10b981]/15 text-emerald-600 dark:text-[#34d399] border border-emerald-200 dark:border-[#10b981]/30' : 'bg-rose-50 dark:bg-[#ef4444]/15 text-rose-600 dark:text-[#f87171] border border-rose-200 dark:border-[#ef4444]/30'"
                  >
                    {{ key.status }}
                  </span>
                </td>

                <td class="py-3.5 px-4 text-right font-sans">
                  <button
                    *ngIf="key.status === 'active'"
                    (click)="revokeKey(key.id)"
                    class="text-slate-400 hover:text-rose-600 dark:hover:text-[#ef4444] font-medium transition-colors"
                  >
                    Revoke Key
                  </button>
                  <span *ngIf="key.status === 'revoked'" class="text-slate-400 italic">Revoked</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB: General -->
      <div *ngIf="activeTab === 'general'" class="space-y-4 max-w-xl">
        <div class="bg-white dark:bg-[#121722] border border-slate-200 dark:border-[#20293a] rounded-lg p-4 space-y-3 font-sans shadow-sm">
          <h3 class="font-bold text-slate-900 dark:text-white text-sm">General Organization Info</h3>
          <div>
            <label class="block text-slate-500 dark:text-[#64748b] mb-1">Organization Name</label>
            <input type="text" value="Eggless Observability Platform" class="w-full bg-slate-50 dark:bg-[#111622] text-slate-900 dark:text-white p-2 rounded border border-slate-200 dark:border-[#20293a]" />
          </div>
          <div>
            <label class="block text-slate-500 dark:text-[#64748b] mb-1">Default Log Region</label>
            <input type="text" value="us-east-1 (N. Virginia)" disabled class="w-full bg-slate-50 dark:bg-[#111622] text-slate-400 dark:text-[#64748b] p-2 rounded border border-slate-200 dark:border-[#20293a]" />
          </div>
        </div>
      </div>

      <!-- TAB: Retention -->
      <div *ngIf="activeTab === 'retention'" class="space-y-4 max-w-xl">
        <div class="bg-white dark:bg-[#121722] border border-slate-200 dark:border-[#20293a] rounded-lg p-4 space-y-3 font-sans shadow-sm">
          <h3 class="font-bold text-slate-900 dark:text-white text-sm">Data Retention Policy</h3>
          <div>
            <label class="block text-slate-500 dark:text-[#64748b] mb-1">Hot Searchable Retention</label>
            <select class="w-full bg-slate-50 dark:bg-[#111622] text-slate-900 dark:text-white p-2 rounded border border-slate-200 dark:border-[#20293a]">
              <option>30 Days (Standard SaaS Plan)</option>
              <option>60 Days</option>
              <option>90 Days</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-500 dark:text-[#64748b] mb-1">Cold Archive Storage</label>
            <select class="w-full bg-slate-50 dark:bg-[#111622] text-slate-900 dark:text-white p-2 rounded border border-slate-200 dark:border-[#20293a]">
              <option>365 Days AWS S3 Bucket</option>
              <option>Indefinite Archive</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Modal: Create Key -->
      <div *ngIf="showCreateModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div class="bg-white dark:bg-[#151b26] border border-slate-200 dark:border-[#20293a] rounded-xl w-full max-w-md p-5 text-xs space-y-4 shadow-2xl">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-[#20293a] pb-3">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Create Ingestion API Key</h3>
            <button (click)="showCreateModal = false" class="text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold">✕</button>
          </div>

          <div class="space-y-3 font-sans">
            <div>
              <label class="block text-slate-600 dark:text-[#64748b] font-semibold mb-1">Key Name / Description</label>
              <input [(ngModel)]="newKeyName" type="text" placeholder="e.g. Production K8s Cluster Vector Agent" class="w-full bg-slate-50 dark:bg-[#111622] text-slate-900 dark:text-white p-2 rounded border border-slate-200 dark:border-[#20293a]" />
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[#20293a]">
            <button (click)="showCreateModal = false" class="px-3 py-1.5 bg-slate-100 dark:bg-[#161e2c] text-slate-700 dark:text-white rounded">Cancel</button>
            <button (click)="generateKey()" class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded">Generate Ingestion Key</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent implements OnInit {
  private logService = inject(LogService);
  private ssoService = inject(SsoService);
  private route = inject(ActivatedRoute);

  apiKeys$ = this.logService.apiKeys$;
  currentUser$ = this.ssoService.currentUser$;
  portalConfig: PortalSsoConfig = this.ssoService.getConfig();

  activeTab = 'sso';

  showCreateModal = false;
  newKeyName = 'K8s Cluster Log Agent Key';
  createdKeyToken: string | null = null;
  copied = false;
  configSaved = false;
  testingHealth = false;
  healthResult: { ok: boolean; message: string } | null = null;

  tabs = [
    { id: 'sso', label: 'Portal SSO' },
    { id: 'apikeys', label: 'API Keys' },
    { id: 'general', label: 'General' },
    { id: 'retention', label: 'Retention' }
  ];

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
    });
  }

  async testSsoConnection() {
    this.testingHealth = true;
    this.healthResult = null;
    this.healthResult = await this.ssoService.checkPortalSsoHealth();
    this.testingHealth = false;
  }

  savePortalConfig() {
    this.ssoService.updateConfig(this.portalConfig);
    this.configSaved = true;
    setTimeout(() => this.configSaved = false, 2500);
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
