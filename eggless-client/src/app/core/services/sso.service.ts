import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { PortalSSO, PortalUser as SsoSdkUser } from '@tanmaysinghx/portal-sso';

export interface PortalUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
}

export interface PortalAuthResponse {
  authenticated: boolean;
  mfaRequired: boolean;
  user: PortalUser | null;
  error?: string;
  message?: string;
}

export interface SsoUser {
  id: string;
  name: string;
  email: string;
  role: string;
  roles: string[];
  tenant: string;
  avatar: string;
  ssoProvider: string;
  idToken?: string;
  accessToken?: string;
  expiresAt?: string;
  claims?: {
    sub?: string;
    iss?: string;
    aud?: string;
    roles?: string[];
    auth_time?: number;
    [key: string]: any;
  };
}

export interface PortalSsoConfig {
  baseUrl: string;
  applicationId: string;
  clientId: string;
  redirectUri: string;
  scopes: string;
}

// Fallbacks only; the backend's /api/auth/config (driven by PORTAL_* env vars) is authoritative.
const DEFAULT_PORTAL_CONFIG: PortalSsoConfig = {
  baseUrl: 'https://portal.tanmaysinghx.com',
  applicationId: '5de93ba7-0673-4fba-8e9b-a1bdb8466f03',
  clientId: 'eggless-observability',
  redirectUri: 'https://eggless.tanmaysinghx.com/auth/callback',
  scopes: 'openid profile email'
};

@Injectable({
  providedIn: 'root'
})
export class SsoService {
  private http = inject(HttpClient);

  private get backendAuthUrl(): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/auth`;
    }
    return '/api/auth';
  }

  private config: PortalSsoConfig = this.loadConfig();

  private currentUserSubject = new BehaviorSubject<SsoUser | null>(null);
  public currentUser$: Observable<SsoUser | null> = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$: Observable<boolean> = this.isAuthenticatedSubject.asObservable();

  private configReady: Promise<void>;

  constructor() {
    this.restoreSession();
    this.configReady = this.syncBackendConfig();
  }

  public get currentUserValue(): SsoUser | null {
    return this.currentUserSubject.value;
  }

  public getConfig(): PortalSsoConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<PortalSsoConfig>) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('eggless_portal_config', JSON.stringify(this.config));
  }

  private loadConfig(): PortalSsoConfig {
    try {
      const saved = localStorage.getItem('eggless_portal_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Discard legacy localhost configs when running on real domains
        if (parsed.baseUrl && !parsed.baseUrl.includes('localhost')) {
          return { ...DEFAULT_PORTAL_CONFIG, ...parsed };
        }
      }
    } catch (e) {
      // Fallback
    }
    return { ...DEFAULT_PORTAL_CONFIG };
  }

  private async syncBackendConfig() {
    try {
      const res = await firstValueFrom(this.http.get<any>(`${this.backendAuthUrl}/config`));
      if (res && res.baseUrl) {
        this.config.baseUrl = res.baseUrl;
        if (res.applicationId) this.config.applicationId = res.applicationId;
        if (res.clientId) this.config.clientId = res.clientId;
        if (res.redirectUri) this.config.redirectUri = res.redirectUri;
        if (res.scopes) this.config.scopes = res.scopes;
        localStorage.setItem('eggless_portal_config', JSON.stringify(this.config));
      }
    } catch {
      // Backend unreachable or offline; fallback to default
    }
  }

  private restoreSession() {
    const savedUser = localStorage.getItem('eggless_sso_user');
    if (savedUser) {
      try {
        const parsed: SsoUser = JSON.parse(savedUser);
        if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
          this.logout();
        } else {
          this.currentUserSubject.next(parsed);
          this.isAuthenticatedSubject.next(true);
        }
      } catch (e) {
        localStorage.removeItem('eggless_sso_user');
      }
    }
  }

  // ==========================================
  // 1. OAUTH 2.1 / OIDC PKCE BROWSER FLOW
  // ==========================================
  // The browser only runs the PKCE authorize step. The code is always exchanged by the
  // backend (/api/auth/exchange), which holds the client secret and verifies the ID token.

  /**
   * Seamless Okta-style popup login window with zero page-reloads.
   * Powered by @tanmaysinghx/portal-sso SDK, using its pre-registered popup callback.
   */
  public async loginWithPopup(): Promise<SsoUser> {
    await this.configReady;
    const ssoClient = new PortalSSO({
      portalUrl: this.config.baseUrl.replace(/\/+$/, ''),
      clientId: this.config.clientId,
      scope: this.config.scopes
    });

    let ssoUser: SsoUser | null = null;
    (ssoClient as any).exchangeCodeForTokens = async (code: string, codeVerifier: string, redirectUri: string) => {
      const tokenData = await this.exchangeViaBackend(code, codeVerifier, redirectUri);
      ssoUser = this.mapVerifiedTokens(tokenData, 'Portal SSO (Popup OAuth 2.1)');
      return {
        user: { id: ssoUser.id, email: ssoUser.email, name: ssoUser.name, roles: ssoUser.roles, rawClaims: ssoUser.claims },
        accessToken: ssoUser.accessToken || '',
        idToken: ssoUser.idToken || '',
        expiresAt: new Date(ssoUser.expiresAt!).getTime()
      };
    };

    await ssoClient.loginWithPopup();
    this.saveUserSession(ssoUser!);
    return ssoUser!;
  }

  public async initiatePortalSsoLogin(): Promise<void> {
    await this.configReady;
    const verifier = this.generateRandomString(64);
    const state = this.generateRandomString(32);
    const challenge = await this.generateCodeChallenge(verifier);

    sessionStorage.setItem('portal_pkce_verifier', verifier);
    sessionStorage.setItem('portal_auth_state', state);

    const authUrl = new URL(`${this.config.baseUrl.replace(/\/+$/, '')}/oauth2/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
    authUrl.searchParams.set('scope', this.config.scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    window.location.href = authUrl.toString();
  }

  public async handleOidcCallback(code: string, state: string): Promise<SsoUser> {
    await this.configReady;
    const savedState = sessionStorage.getItem('portal_auth_state');
    const verifier = sessionStorage.getItem('portal_pkce_verifier');

    if (!savedState || savedState !== state) {
      throw new Error('OAuth state validation failed: possible CSRF attempt or session expired.');
    }

    if (!verifier) {
      throw new Error('Missing PKCE code verifier in session storage.');
    }

    sessionStorage.removeItem('portal_auth_state');
    sessionStorage.removeItem('portal_pkce_verifier');

    const tokenData = await this.exchangeViaBackend(code, verifier, this.config.redirectUri);
    const user = this.mapVerifiedTokens(tokenData, 'Portal SSO (OAuth 2.1 / OIDC PKCE)');
    this.saveUserSession(user);
    return user;
  }

  private async exchangeViaBackend(code: string, codeVerifier: string, redirectUri: string): Promise<any> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.backendAuthUrl}/exchange`, { code, codeVerifier, redirectUri })
      );
    } catch (err: any) {
      throw new Error(err?.error?.error || err?.message || 'Token exchange failed with Portal SSO.');
    }
  }

  /** Maps the backend's signature-verified claims to the app's user model. */
  private mapVerifiedTokens(tokenData: any, provider: string): SsoUser {
    const claims = tokenData.claims || {};
    const email = claims.email || claims.sub;
    const name = claims.name
      || [claims.given_name || claims.firstName, claims.family_name || claims.lastName].filter(Boolean).join(' ')
      || claims.preferred_username
      || email.split('@')[0];
    const roles: string[] = claims.roles?.length ? claims.roles : ['ROLE_USER'];

    return {
      id: claims.sub,
      name: name,
      email: email,
      role: roles.includes('ROLE_ADMIN') ? 'Administrator (ROLE_ADMIN)' : 'Observability Engineer',
      roles: roles,
      tenant: new URL(this.config.baseUrl).hostname,
      avatar: this.getInitials(name),
      ssoProvider: provider,
      idToken: tokenData.id_token,
      accessToken: tokenData.access_token,
      expiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
      claims: claims
    };
  }

  // ==========================================
  // 2. EXTERNAL AUTH API (CREDENTIALS / AGENT)
  // ==========================================

  public async loginWithCredentials(email: string, pass: string): Promise<SsoUser> {
    try {
      const resp = await firstValueFrom(
        this.http.post<PortalAuthResponse>(`${this.backendAuthUrl}/login`, {
          email: email,
          password: pass
        })
      );

      if (resp && resp.authenticated && resp.user) {
        return this.mapPortalUserToSsoUser(resp.user, 'Portal SSO External Auth API');
      }
      throw new Error(resp?.message || 'Invalid credentials in Portal SSO');
    } catch (err: any) {
      throw new Error(err?.error?.message || err.message || 'Authentication failed');
    }
  }

  public async registerWithCredentials(
    email: string,
    pass: string,
    firstName?: string,
    lastName?: string
  ): Promise<SsoUser> {
    try {
      const resp = await firstValueFrom(
        this.http.post<PortalAuthResponse>(`${this.backendAuthUrl}/register`, {
          email: email,
          password: pass,
          firstName: firstName,
          lastName: lastName
        })
      );

      if (resp && resp.authenticated && resp.user) {
        return this.mapPortalUserToSsoUser(resp.user, 'Portal SSO Headless Registration');
      }
      throw new Error(resp?.message || 'Registration failed');
    } catch (err: any) {
      throw new Error(err?.error?.message || err.message || 'Registration failed');
    }
  }

  // ==========================================
  // 3. UTILITIES & DEMO SESSION
  // ==========================================

  public async checkPortalSsoHealth(): Promise<{ ok: boolean; message: string }> {
    try {
      return await firstValueFrom(this.http.get<{ ok: boolean; message: string }>(`${this.backendAuthUrl}/health`));
    } catch (e: any) {
      return { ok: false, message: e.message || 'Could not connect to Portal SSO server' };
    }
  }

  public loginWithDemoPortalSso(email = 'admin@portalsso.local', name = 'Alex Rivera'): SsoUser {
    const ssoUser: SsoUser = {
      id: 'usr_sso_demo_9921',
      name: name,
      email: email,
      role: 'Staff Observability Engineer (ROLE_ADMIN)',
      roles: ['ROLE_ADMIN', 'ROLE_OBSERVABILITY_ENG', 'ROLE_USER'],
      tenant: 'portal.tanmaysinghx.com',
      avatar: this.getInitials(name),
      ssoProvider: 'Portal SSO v4.1 (Simulated OIDC PKCE)',
      idToken: `eyJhbGciOiJSUzI1NiIsImtpZCI6InBvcnRhbC1zc28tazEifQ.${btoa(JSON.stringify({
        sub: email,
        iss: this.config.baseUrl,
        aud: this.config.clientId,
        roles: ['ROLE_ADMIN', 'ROLE_OBSERVABILITY_ENG', 'ROLE_USER'],
        auth_time: Math.floor(Date.now() / 1000)
      }))}.signature_valid`,
      accessToken: 'sso_at_portal_token_demo_990182',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      claims: {
        sub: email,
        iss: this.config.baseUrl,
        aud: this.config.clientId,
        roles: ['ROLE_ADMIN', 'ROLE_OBSERVABILITY_ENG', 'ROLE_USER'],
        auth_time: Math.floor(Date.now() / 1000)
      }
    };

    this.saveUserSession(ssoUser);
    return ssoUser;
  }

  public logout() {
    localStorage.removeItem('eggless_sso_user');
    sessionStorage.removeItem('portal_auth_state');
    sessionStorage.removeItem('portal_pkce_verifier');
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  private saveUserSession(user: SsoUser) {
    localStorage.setItem('eggless_sso_user', JSON.stringify(user));
    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
  }

  private mapPortalUserToSsoUser(pUser: PortalUser, provider: string): SsoUser {
    const fullName = [pUser.firstName, pUser.lastName].filter(Boolean).join(' ') || pUser.email.split('@')[0];
    const roles = pUser.roles && pUser.roles.length > 0 ? pUser.roles : ['ROLE_USER'];

    const user: SsoUser = {
      id: pUser.id,
      name: fullName,
      email: pUser.email,
      role: roles.includes('ROLE_ADMIN') ? 'Administrator (ROLE_ADMIN)' : 'Observability Engineer',
      roles: roles,
      tenant: 'portal.tanmaysinghx.com',
      avatar: this.getInitials(fullName),
      ssoProvider: provider,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      claims: {
        sub: pUser.id,
        email: pUser.email,
        roles: roles
      }
    };

    this.saveUserSession(user);
    return user;
  }

  private getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || 'U').toUpperCase();
  }

  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const values = new Uint32Array(length);
    window.crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      result += charset[values[i] % charset.length];
    }
    return result;
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(digest);
  }

  private base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
