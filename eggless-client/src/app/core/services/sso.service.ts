import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

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
}

const DEFAULT_PORTAL_CONFIG: PortalSsoConfig = {
  baseUrl: 'https://portal.tanmaysinghx.com',
  applicationId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  clientId: 'eggless-observability',
  redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'https://eggless.tanmaysinghx.com/auth/callback'
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

  constructor() {
    this.restoreSession();
    this.syncBackendConfig();
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

  public async initiatePortalSsoLogin(): Promise<void> {
    const verifier = this.generateRandomString(64);
    const state = this.generateRandomString(32);
    const challenge = await this.generateCodeChallenge(verifier);

    sessionStorage.setItem('portal_pkce_verifier', verifier);
    sessionStorage.setItem('portal_auth_state', state);

    const redirectUri = `${window.location.origin}/auth/callback`;
    const authUrl = new URL(`${this.config.baseUrl.replace(/\/+$/, '')}/oauth2/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    window.location.href = authUrl.toString();
  }

  public async handleOidcCallback(code: string, state: string): Promise<SsoUser> {
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

    const redirectUri = `${window.location.origin}/auth/callback`;
    let tokenData: any;

    // 1. Primary: Server-side token exchange (avoids browser CORS)
    try {
      tokenData = await firstValueFrom(
        this.http.post<any>(`${this.backendAuthUrl}/exchange`, {
          code: code,
          codeVerifier: verifier,
          redirectUri: redirectUri
        })
      );
    } catch (backendErr: any) {
      // 2. Fallback: Direct browser fetch
      const tokenUrl = `${this.config.baseUrl.replace(/\/+$/, '')}/oauth2/token`;
      const body = new URLSearchParams();
      body.set('grant_type', 'authorization_code');
      body.set('client_id', this.config.clientId);
      body.set('code', code);
      body.set('redirect_uri', redirectUri);
      body.set('code_verifier', verifier);

      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error_description || err.error || backendErr?.error?.error || `Token exchange failed: ${res.status}`);
      }
      tokenData = await res.json();
    }

    const idToken = tokenData.id_token;
    const accessToken = tokenData.access_token;
    const claims = idToken ? this.parseJwt(idToken) : {};
    let profileData: any = tokenData.userinfo || {};

    if (!profileData.email && accessToken) {
      try {
        const userinfoRes = await fetch(`${this.config.baseUrl.replace(/\/+$/, '')}/userinfo`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (userinfoRes.ok) {
          profileData = await userinfoRes.json();
        }
      } catch {
        // Fallback to claims
      }
    }

    const email = profileData.email || claims.email || claims.sub || 'user@portalsso.local';
    const name = profileData.name || profileData.firstName
      ? `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim()
      : (claims.name || email.split('@')[0]);

    const roles: string[] = profileData.roles || claims.roles || ['ROLE_USER'];

    const user: SsoUser = {
      id: profileData.sub || profileData.id || claims.sub || `usr_${Date.now()}`,
      name: name,
      email: email,
      role: roles.includes('ROLE_ADMIN') ? 'Administrator (ROLE_ADMIN)' : 'Observability Engineer',
      roles: roles,
      tenant: 'portal.tanmaysinghx.com',
      avatar: this.getInitials(name),
      ssoProvider: 'Portal SSO (OAuth 2.1 / OIDC PKCE)',
      idToken: idToken,
      accessToken: accessToken,
      expiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
      claims: claims
    };

    this.saveUserSession(user);
    return user;
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
      if (err.status === 0 || err.status === 404 || err.status === 503) {
        return this.directExternalLogin(email, pass);
      }
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

  private async directExternalLogin(email: string, pass: string): Promise<SsoUser> {
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/api/external/apps/${this.config.applicationId}/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass })
    });

    if (res.ok) {
      const data: PortalAuthResponse = await res.json();
      if (data.authenticated && data.user) {
        return this.mapPortalUserToSsoUser(data.user, 'Portal SSO External Auth API');
      }
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Unable to authenticate with Portal SSO External API');
  }

  // ==========================================
  // 3. UTILITIES & DEMO SESSION
  // ==========================================

  public async checkPortalSsoHealth(): Promise<{ ok: boolean; message: string }> {
    try {
      const url = `${this.config.baseUrl.replace(/\/+$/, '')}/.well-known/openid-configuration`;
      const res = await fetch(url, { method: 'GET', mode: 'cors' });
      if (res.ok) {
        return { ok: true, message: 'Portal SSO OIDC Provider reachable and ready.' };
      }
      return { ok: false, message: `Portal SSO returned status: ${res.status}` };
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

  private parseJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return {};
    }
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
