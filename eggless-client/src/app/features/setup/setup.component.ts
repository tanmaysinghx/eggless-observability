import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PortalConnectService, PortalConnectStatus } from '../../core/services/portal-connect.service';

/**
 * First-run / reconnect screen. Reachable without signing in, because before Eggless is connected
 * there is no one to sign in as; the setup token from the server is what authorises it.
 */
@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen w-full bg-slate-50 dark:bg-[#0b0e14] text-slate-800 dark:text-[#e6edf3] flex items-center justify-center p-4 font-sans">
      <div class="w-full max-w-md bg-white dark:bg-[#121722] border border-slate-200 dark:border-[#20293a] rounded-2xl p-7 shadow-xl space-y-5">
        <div class="text-center space-y-2">
          <div class="w-14 h-14 rounded-2xl eggless-logo-box border border-slate-200 dark:border-[#20293a] p-2 mx-auto flex items-center justify-center">
            <img src="eggless-logo.png" alt="Eggless Logo" class="w-full h-full object-contain" />
          </div>
          <h1 class="text-xl font-bold text-slate-900 dark:text-[#f0f4f8] tracking-tight">Connect with Portal SSO</h1>
          <p class="text-slate-500 dark:text-[#94a3b8] text-xs">
            One click. A Portal administrator approves, and Eggless receives its credentials directly. Nothing to copy.
          </p>
        </div>

        <!-- Outcome of the redirect back from Portal -->
        <div *ngIf="outcome === 'connected'" class="p-3 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300">
          Connected. Users can now sign in with Portal SSO.
        </div>
        <div *ngIf="outcome === 'denied' || outcome === 'error'" class="p-3 rounded-lg text-xs bg-rose-50 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300">
          {{ outcomeMessage || 'The connection did not complete.' }}
        </div>
        <div *ngIf="errorMessage()" class="p-3 rounded-lg text-xs bg-rose-50 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300">
          {{ errorMessage() }}
        </div>

        <div *ngIf="!status()" class="text-xs text-slate-400 text-center">Checking connection…</div>

        <!-- Managed by environment -->
        <div *ngIf="status()?.mode === 'environment'" class="space-y-3 text-xs">
          <div class="p-3 rounded-lg bg-slate-50 dark:bg-[#161e2c] border border-slate-200 dark:border-[#20293a]">
            Portal SSO is configured by environment variables (<span class="font-mono">PORTAL_*</span>) for
            <span class="font-mono">{{ status()?.portalUrl }}</span>. Remove <span class="font-mono">PORTAL_CLIENT_SECRET</span> and
            <span class="font-mono">PORTAL_API_KEY</span> to manage the connection here instead.
          </div>
          <a routerLink="/login" class="block w-full py-2.5 text-center bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-lg">Go to sign in</a>
        </div>

        <!-- Connected -->
        <div *ngIf="status()?.mode === 'connected'" class="space-y-3 text-xs">
          <div class="p-3 rounded-lg bg-slate-50 dark:bg-[#161e2c] border border-slate-200 dark:border-[#20293a] space-y-1">
            <div><span class="text-slate-500">Portal</span> <span class="font-mono float-right">{{ status()?.portalUrl }}</span></div>
            <div><span class="text-slate-500">Client ID</span> <span class="font-mono float-right">{{ status()?.clientId }}</span></div>
            <div><span class="text-slate-500">Connected</span> <span class="float-right">{{ status()?.connectedAt | date: 'medium' }}</span></div>
          </div>
          <a routerLink="/login" class="block w-full py-2.5 text-center bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-lg">Go to sign in</a>

          <details class="pt-2">
            <summary class="cursor-pointer text-slate-500">Reconnect or disconnect</summary>
            <div class="space-y-2 pt-3">
              <input [(ngModel)]="setupToken" name="setupTokenDisconnect" type="password" placeholder="Setup token"
                     class="w-full bg-slate-50 dark:bg-[#0b0e14] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] font-mono" />
              <div class="flex gap-2">
                <button (click)="onReconnect()" [disabled]="loading() || !setupToken"
                        class="flex-1 py-2 rounded-lg border border-slate-200 dark:border-[#20293a] font-semibold disabled:opacity-50">Reconnect</button>
                <button (click)="onDisconnect()" [disabled]="loading() || !setupToken"
                        class="flex-1 py-2 rounded-lg border border-rose-200 dark:border-rose-800/40 text-rose-600 font-semibold disabled:opacity-50">Disconnect</button>
              </div>
              <p class="text-[11px] text-slate-400">Disconnecting forgets the credentials here. The app stays registered in Portal until an admin removes it.</p>
            </div>
          </details>
        </div>

        <!-- Waiting for approval -->
        <div *ngIf="status()?.mode === 'pending'" class="space-y-3 text-xs">
          <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300">
            Waiting for a Portal administrator to approve. Send them the approval link; once they approve, Eggless connects automatically.
            If their browser cannot reach this Eggless, open the link yourself after approval and choose <b>Continue</b>.
          </div>
          <a [href]="status()?.pendingApprovalUrl" class="block w-full py-2.5 text-center bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-lg">Open approval page</a>
          <button (click)="copyApprovalLink()" class="w-full py-2 rounded-lg border border-slate-200 dark:border-[#20293a] font-semibold">
            {{ copied() ? 'Copied ✓' : 'Copy approval link' }}
          </button>
          <button (click)="startOver()" class="w-full text-slate-500 hover:underline">Start over</button>
        </div>

        <!-- Not connected: the one form -->
        <form *ngIf="status()?.mode === 'not_connected'" (submit)="onConnect($event)" class="space-y-3.5 text-xs">
          <div>
            <label class="block text-slate-600 dark:text-[#94a3b8] font-medium mb-1">Portal SSO address</label>
            <input [(ngModel)]="portalUrl" name="portalUrl" type="url" required placeholder="https://sso.example.com"
                   class="w-full bg-slate-50 dark:bg-[#0b0e14] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] focus:outline-none focus:border-amber-500 font-mono" />
          </div>
          <div>
            <label class="block text-slate-600 dark:text-[#94a3b8] font-medium mb-1">Setup token</label>
            <input [(ngModel)]="setupToken" name="setupToken" type="password" required autocomplete="off"
                   class="w-full bg-slate-50 dark:bg-[#0b0e14] p-2.5 rounded-lg border border-slate-200 dark:border-[#20293a] focus:outline-none focus:border-amber-500 font-mono" />
            <span class="text-[10px] text-slate-400 dark:text-[#64748b]">
              Printed in the Eggless server log at startup, and stored in <span class="font-mono break-all">{{ status()?.setupTokenFile }}</span>.
            </span>
          </div>
          <button type="submit" [disabled]="loading()"
                  class="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
            <span *ngIf="loading()" class="animate-spin w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full"></span>
            <span>{{ loading() ? 'Contacting Portal…' : 'Connect with Portal SSO' }}</span>
          </button>
          <p class="text-[11px] text-slate-400 dark:text-[#64748b]">
            You'll be taken to Portal to sign in. A Portal administrator approves which permissions Eggless gets.
          </p>
        </form>
      </div>
    </div>
  `
})
export class SetupComponent implements OnInit {
  private connect = inject(PortalConnectService);
  private route = inject(ActivatedRoute);

  // Signals, not plain fields: the app is zoneless, so values set after an await only reach the
  // view through a signal. Plain fields here left the page stuck on its header.
  readonly status = signal<PortalConnectStatus | null>(null);
  readonly loading = signal(false);
  readonly copied = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Set synchronously or bound with ngModel, so plain fields are fine.
  portalUrl = '';
  setupToken = '';
  outcome: string | null = null;
  outcomeMessage: string | null = null;

  async ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.outcome = params.get('status');
    this.outcomeMessage = params.get('message');
    await this.refresh();
  }

  async refresh() {
    try {
      const status = await this.connect.status();
      if (status.portalUrl && !this.portalUrl) {
        this.portalUrl = status.portalUrl;
      }
      this.status.set(status);
    } catch {
      this.errorMessage.set('Eggless server is unreachable.');
    }
  }

  async onConnect(e?: Event) {
    e?.preventDefault();
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      window.location.href = await this.connect.start(this.portalUrl.trim(), this.setupToken.trim());
    } catch (err: any) {
      this.errorMessage.set(err.message);
      this.loading.set(false);
    }
  }

  onReconnect() {
    this.onConnect();
  }

  /** Shows the connect form again; submitting replaces the pending request. */
  startOver() {
    this.status.update(s => (s ? { ...s, mode: 'not_connected', pendingApprovalUrl: null } : s));
  }

  async onDisconnect() {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      await this.connect.disconnect(this.setupToken.trim());
      this.setupToken = '';
      this.outcome = null;
      await this.refresh();
    } catch (err: any) {
      this.errorMessage.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  async copyApprovalLink() {
    const url = this.status()?.pendingApprovalUrl;
    if (url) {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
    }
  }
}
