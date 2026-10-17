import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type PortalConnectMode = 'connected' | 'environment' | 'pending' | 'not_connected';

export interface PortalConnectStatus {
  mode: PortalConnectMode;
  portalUrl: string | null;
  clientId: string | null;
  applicationId: string | null;
  connectedAt: string | null;
  pendingApprovalUrl: string | null;
  setupTokenFile: string;
}

/**
 * "Connect with Portal SSO". The browser only carries the operator to Portal's approval page and
 * back; credentials travel server-to-server and are never visible here.
 */
@Injectable({ providedIn: 'root' })
export class PortalConnectService {
  private http = inject(HttpClient);
  private base = '/api/portal-connect';

  status(): Promise<PortalConnectStatus> {
    return firstValueFrom(this.http.get<PortalConnectStatus>(`${this.base}/status`));
  }

  async start(portalUrl: string, setupToken: string): Promise<string> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ approvalUrl: string }>(`${this.base}/start`, {
          portalUrl,
          publicUrl: window.location.origin,
          setupToken
        })
      );
      return res.approvalUrl;
    } catch (err: any) {
      throw new Error(err?.error?.message || err?.message || 'Could not start the connection.');
    }
  }

  async disconnect(setupToken: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post<void>(`${this.base}/disconnect`, { setupToken }));
    } catch (err: any) {
      throw new Error(err?.error?.message || err?.message || 'Could not disconnect.');
    }
  }
}
