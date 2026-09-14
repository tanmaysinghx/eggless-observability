import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { LogEntry, LogFilter, LogStats, ApplicationInfo, AlertRule, ApiKey, Environment, LogLevel } from '../models/log.model';

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private apiBase = 'http://localhost:8080/api/v1';
  private wsBase = 'ws://localhost:8080/api/v1/logs/stream';

  private logsSubject = new BehaviorSubject<LogEntry[]>([]);
  public logs$: Observable<LogEntry[]> = this.logsSubject.asObservable();

  private filterSubject = new BehaviorSubject<LogFilter>({
    searchQuery: '',
    services: [],
    environments: [],
    levels: [],
    timeRange: '1h'
  });
  public filter$: Observable<LogFilter> = this.filterSubject.asObservable();

  private liveTailSubject = new BehaviorSubject<boolean>(true);
  public liveTail$: Observable<boolean> = this.liveTailSubject.asObservable();

  private selectedLogSubject = new BehaviorSubject<LogEntry | null>(null);
  public selectedLog$: Observable<LogEntry | null> = this.selectedLogSubject.asObservable();

  private selectedAppSubject = new BehaviorSubject<string>('all');
  public selectedApp$: Observable<string> = this.selectedAppSubject.asObservable();

  private selectedEnvSubject = new BehaviorSubject<Environment | 'all'>('all');
  public selectedEnv$: Observable<Environment | 'all'> = this.selectedEnvSubject.asObservable();

  private alertsSubject = new BehaviorSubject<AlertRule[]>([]);
  public alerts$: Observable<AlertRule[]> = this.alertsSubject.asObservable();

  private apiKeysSubject = new BehaviorSubject<ApiKey[]>([]);
  public apiKeys$: Observable<ApiKey[]> = this.apiKeysSubject.asObservable();

  private ws: WebSocket | null = null;
  private logIdCounter = 12500;

  constructor() {
    this.fetchFromGoBackend();
    this.connectWebSocket();
    this.startFallbackSimulator();
  }

  private async fetchFromGoBackend() {
    try {
      const res = await fetch(`${this.apiBase}/logs?limit=500`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.logs) {
          this.logsSubject.next(json.data.logs);
        }
      }
      this.fetchAlerts();
      this.fetchApiKeys();
    } catch (e) {
      // Backend starting or offline - fallback to initial generated data
      this.generateInitialLogs();
    }
  }

  private async fetchAlerts() {
    try {
      const res = await fetch(`${this.apiBase}/alerts`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) this.alertsSubject.next(json.data);
      }
    } catch (e) {
      this.alertsSubject.next([
        { id: 'alt-101', name: 'High Payment Errors', application: 'payment-api', query: 'level:ERROR', condition: 'ERROR > 100 in 5m', window: '5m', channel: '#alerts-payments', enabled: true, status: 'triggered' },
        { id: 'alt-102', name: 'Database Timeout', application: 'auth-service', query: '"timeout"', condition: '"timeout" > 20 in 5m', window: '5m', channel: 'PagerDuty', enabled: true, status: 'ok' }
      ]);
    }
  }

  private async fetchApiKeys() {
    try {
      const res = await fetch(`${this.apiBase}/apikeys`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) this.apiKeysSubject.next(json.data);
      }
    } catch (e) {
      this.apiKeysSubject.next([
        { id: 'key-1', name: 'Production Ingestion Agent Key', tokenPrefix: 'eg_live_8f3a...', created: '2026-08-10', lastUsed: '12 sec ago', status: 'active' }
      ]);
    }
  }

  private connectWebSocket() {
    try {
      this.ws = new WebSocket(this.wsBase);
      this.ws.onmessage = (event) => {
        if (!this.liveTailSubject.value) return;
        try {
          const newEntry: LogEntry = JSON.parse(event.data);
          const current = this.logsSubject.value;
          this.logsSubject.next([newEntry, ...current.slice(0, 800)]);
        } catch (e) {}
      };
    } catch (e) {}
  }

  private startFallbackSimulator() {
    interval(1200).subscribe(() => {
      if (this.liveTailSubject.value && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
        this.emitRandomLiveLog();
      }
    });
  }

  private generateInitialLogs() {
    const initialLogs: LogEntry[] = [];
    const now = new Date();
    const services = ['payment-api', 'order-service', 'auth-service', 'frontend', 'notification-service', 'db-proxy'];
    const envs: Environment[] = ['production', 'production', 'production', 'staging', 'development'];

    const templates = [
      { level: 'INFO' as LogLevel, service: 'payment-api', msg: 'Payment request received for order ORD-93821', meta: { userId: '12345', orderId: 'ORD-93821', amount: 149.99, currency: 'USD' } },
      { level: 'INFO' as LogLevel, service: 'payment-api', msg: 'Processing payment via Stripe Gateway', meta: { provider: 'stripe', idempotencyKey: 'ik_88a912c' } },
      { level: 'WARN' as LogLevel, service: 'payment-api', msg: 'Payment gateway response slow: 1840ms latency', meta: { latencyMs: 1840, thresholdMs: 1000, provider: 'stripe' } },
      { level: 'ERROR' as LogLevel, service: 'payment-api', msg: 'Payment failed: GatewayTimeoutException in Stripe SDK', stack: 'StripeException: GatewayTimeoutException at PaymentClient.java:142\n  at com.eggless.payment.StripeService.charge(StripeService.java:88)', meta: { errorCode: 'GATEWAY_TIMEOUT', httpStatus: 504, userId: '12345' } },
      { level: 'INFO' as LogLevel, service: 'order-service', msg: 'Order ORD-93821 created successfully', meta: { orderId: 'ORD-93821', itemsCount: 3, total: 149.99 } },
      { level: 'WARN' as LogLevel, service: 'auth-service', msg: 'Invalid refresh token presented from IP 192.168.1.104', meta: { ip: '192.168.1.104', attempt: 2 } },
      { level: 'ERROR' as LogLevel, service: 'auth-service', msg: 'DB Connection pool exhausted: 50/50 connections in use', stack: 'PoolExhaustedException: Connection pool idle connections = 0\n  at com.zaxxer.hikari.HikariPool.getConnection(HikariPool.java:213)', meta: { activeConnections: 50, maxConnections: 50 } }
    ];

    for (let i = 0; i < 400; i++) {
      const template = templates[i % templates.length];
      const timeOffsetMs = (400 - i) * 3500;
      const logTime = new Date(now.getTime() - timeOffsetMs);
      const timeStr = this.formatTimestamp(logTime);

      initialLogs.push({
        id: `log-${this.logIdCounter--}`,
        timestamp: timeStr,
        fullTimestamp: logTime.toISOString(),
        level: template.level,
        service: template.service,
        environment: envs[i % envs.length],
        message: template.msg,
        traceId: `tr-${Math.random().toString(36).substring(2, 10)}`,
        requestId: `req-${Math.random().toString(36).substring(2, 8)}`,
        userId: template.meta['userId'] ? String(template.meta['userId']) : `usr-${1000 + (i % 50)}`,
        host: `node-aws-${(i % 4) + 1}.internal`,
        metadata: template.meta,
        stackTrace: template.stack
      });
    }

    this.logsSubject.next(initialLogs);
  }

  private emitRandomLiveLog() {
    const current = this.logsSubject.value;
    const now = new Date();
    const timeStr = this.formatTimestamp(now);
    const services = ['payment-api', 'order-service', 'auth-service', 'frontend', 'notification-service', 'db-proxy'];
    const levels: LogLevel[] = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'DEBUG'];
    const chosenService = services[Math.floor(Math.random() * services.length)];
    const chosenLevel = levels[Math.floor(Math.random() * levels.length)];

    let msg = `Processing request on ${chosenService}`;
    let stack: string | undefined = undefined;
    let meta: Record<string, any> = { region: 'ap-south-1', nodeVersion: 'v20.11.0' };

    if (chosenLevel === 'ERROR') {
      msg = `${chosenService} error: Connection timeout while querying downstream database cluster`;
      stack = `TimeoutException: Connection timeout after 5000ms\n  at db.Client.connect(db.ts:98)\n  at ${chosenService}.Service.execute(service.ts:44)`;
      meta = { errorCode: 'DB_TIMEOUT', retryCount: 3 };
    } else if (chosenLevel === 'WARN') {
      msg = `${chosenService} memory usage high: 84% heap allocation`;
      meta = { heapUsedMb: 890, heapMaxMb: 1024 };
    } else {
      msg = `${chosenService} completed task #${Math.floor(Math.random() * 9000) + 1000} successfully`;
      meta = { durationMs: Math.floor(Math.random() * 120) + 12 };
    }

    const newEntry: LogEntry = {
      id: `log-${++this.logIdCounter}`,
      timestamp: timeStr,
      fullTimestamp: now.toISOString(),
      level: chosenLevel,
      service: chosenService,
      environment: 'production',
      message: msg,
      traceId: `tr-${Math.random().toString(36).substring(2, 10)}`,
      requestId: `req-${Math.random().toString(36).substring(2, 8)}`,
      userId: `usr-${Math.floor(Math.random() * 500) + 1000}`,
      host: `node-aws-${Math.floor(Math.random() * 4) + 1}.internal`,
      metadata: meta,
      stackTrace: stack
    };

    this.logsSubject.next([newEntry, ...current.slice(0, 800)]);
  }

  private formatTimestamp(d: Date): string {
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hours}:${mins}:${secs}.${ms}`;
  }

  // Filtered Logs Pipeline
  public filteredLogs$: Observable<LogEntry[]> = combineLatest([
    this.logs$,
    this.filter$,
    this.selectedApp$,
    this.selectedEnv$
  ]).pipe(
    map(([logs, filter, app, env]) => {
      return logs.filter(log => {
        if (app !== 'all' && log.service !== app) return false;
        if (filter.services.length > 0 && !filter.services.includes(log.service)) return false;
        if (env !== 'all' && log.environment !== env) return false;
        if (filter.environments.length > 0 && !filter.environments.includes(log.environment)) return false;
        if (filter.levels.length > 0 && !filter.levels.includes(log.level)) return false;

        if (filter.searchQuery && filter.searchQuery.trim() !== '') {
          const q = filter.searchQuery.toLowerCase().trim();
          if (q.startsWith('level:')) {
            const levelVal = q.replace('level:', '').trim().toUpperCase();
            if (log.level !== levelVal) return false;
          } else if (q.startsWith('service:')) {
            const serviceVal = q.replace('service:', '').trim();
            if (log.service.toLowerCase() !== serviceVal) return false;
          } else if (q.startsWith('userid:')) {
            const userVal = q.replace('userid:', '').trim();
            if (!log.userId?.toLowerCase().includes(userVal)) return false;
          } else {
            const msgMatch = log.message.toLowerCase().includes(q);
            const traceMatch = log.traceId.toLowerCase().includes(q);
            const reqMatch = log.requestId.toLowerCase().includes(q);
            const serviceMatch = log.service.toLowerCase().includes(q);
            if (!msgMatch && !traceMatch && !reqMatch && !serviceMatch) {
              return false;
            }
          }
        }
        return true;
      });
    })
  );

  public stats$: Observable<LogStats> = this.filteredLogs$.pipe(
    map(logs => {
      const errorCount = logs.filter(l => l.level === 'ERROR').length;
      const warnCount = logs.filter(l => l.level === 'WARN').length;
      const services = new Set(logs.map(l => l.service));
      return {
        totalLogs: logs.length,
        errorCount,
        warnCount,
        activeApplications: services.size,
        logsPerMin: Math.round(logs.length * 1.8)
      };
    })
  );

  public applications$: Observable<ApplicationInfo[]> = this.logs$.pipe(
    map(logs => {
      const appMap: Record<string, { total: number; errors: number }> = {
        'payment-api': { total: 0, errors: 0 },
        'order-service': { total: 0, errors: 0 },
        'auth-service': { total: 0, errors: 0 },
        'frontend': { total: 0, errors: 0 },
        'notification-service': { total: 0, errors: 0 },
        'db-proxy': { total: 0, errors: 0 }
      };

      logs.forEach(l => {
        if (appMap[l.service]) {
          appMap[l.service].total++;
          if (l.level === 'ERROR') appMap[l.service].errors++;
        }
      });

      return [
        { id: 'payment-api', name: 'payment-api', environment: 'production', lastLog: '12 sec ago', logsPerMin: 1243, errorsPerMin: appMap['payment-api'].errors, errorCount: appMap['payment-api'].errors, uptime: '99.98%', status: appMap['payment-api'].errors > 15 ? 'warning' : 'healthy', description: 'Core payment ingestion and Stripe/Adyen gateway routing' },
        { id: 'order-service', name: 'order-service', environment: 'production', lastLog: '5 sec ago', logsPerMin: 824, errorsPerMin: appMap['order-service'].errors, errorCount: appMap['order-service'].errors, uptime: '99.99%', status: 'healthy', description: 'Order management, cart operations & fulfillment queue worker' },
        { id: 'auth-service', name: 'auth-service', environment: 'production', lastLog: '2 min ago', logsPerMin: 421, errorsPerMin: appMap['auth-service'].errors, errorCount: appMap['auth-service'].errors, uptime: '99.95%', status: appMap['auth-service'].errors > 10 ? 'critical' : 'healthy', description: 'OAuth2 session tokens, user identity & RBAC validation' },
        { id: 'frontend', name: 'frontend', environment: 'production', lastLog: '1 sec ago', logsPerMin: 2150, errorsPerMin: appMap['frontend'].errors, errorCount: appMap['frontend'].errors, uptime: '99.99%', status: 'healthy', description: 'Next.js SSR application shell & web assets delivery' },
        { id: 'notification-service', name: 'notification-service', environment: 'staging', lastLog: '45 sec ago', logsPerMin: 180, errorsPerMin: appMap['notification-service'].errors, errorCount: appMap['notification-service'].errors, uptime: '99.90%', status: 'healthy', description: 'Email, SMS, & Mobile push notification dispatcher' },
        { id: 'db-proxy', name: 'db-proxy', environment: 'production', lastLog: '18 sec ago', logsPerMin: 3400, errorsPerMin: appMap['db-proxy'].errors, errorCount: appMap['db-proxy'].errors, uptime: '99.99%', status: 'healthy', description: 'PgBouncer connection proxy & read/write split router' }
      ];
    })
  );

  public setSearchQuery(query: string) {
    const current = this.filterSubject.value;
    this.filterSubject.next({ ...current, searchQuery: query });
  }

  public setFilter(filter: Partial<LogFilter>) {
    const current = this.filterSubject.value;
    this.filterSubject.next({ ...current, ...filter });
  }

  public toggleLevelFilter(level: LogLevel) {
    const current = this.filterSubject.value;
    const levels = current.levels.includes(level)
      ? current.levels.filter(l => l !== level)
      : [...current.levels, level];
    this.filterSubject.next({ ...current, levels });
  }

  public toggleLiveTail() {
    this.liveTailSubject.next(!this.liveTailSubject.value);
  }

  public setSelectedLog(log: LogEntry | null) {
    this.selectedLogSubject.next(log);
  }

  public setSelectedApp(appId: string) {
    this.selectedAppSubject.next(appId);
  }

  public setSelectedEnv(env: Environment | 'all') {
    this.selectedEnvSubject.next(env);
  }

  public async addAlertRule(rule: Omit<AlertRule, 'id' | 'status'>) {
    try {
      const res = await fetch(`${this.apiBase}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
      if (res.ok) {
        this.fetchAlerts();
        return;
      }
    } catch (e) {}

    const current = this.alertsSubject.value;
    this.alertsSubject.next([{ ...rule, id: `alt-${Math.floor(Math.random() * 900) + 100}`, status: 'ok' }, ...current]);
  }

  public async toggleAlertRule(id: string) {
    try {
      await fetch(`${this.apiBase}/alerts/toggle?id=${id}`, { method: 'PUT' });
    } catch (e) {}
    const current = this.alertsSubject.value;
    this.alertsSubject.next(current.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  public async deleteAlertRule(id: string) {
    try {
      await fetch(`${this.apiBase}/alerts/delete?id=${id}`, { method: 'DELETE' });
    } catch (e) {}
    this.alertsSubject.next(this.alertsSubject.value.filter(r => r.id !== id));
  }

  public createApiKey(name: string): ApiKey {
    const rawToken = `eg_live_${Math.random().toString(36).substring(2, 14)}${Math.random().toString(36).substring(2, 14)}`;
    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name,
      tokenPrefix: rawToken.substring(0, 12) + '...',
      token: rawToken,
      created: 'Just now',
      lastUsed: 'Never',
      status: 'active'
    };
    this.apiKeysSubject.next([newKey, ...this.apiKeysSubject.value]);

    fetch(`${this.apiBase}/apikeys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }).catch(() => {});

    return newKey;
  }

  public revokeApiKey(id: string) {
    fetch(`${this.apiBase}/apikeys/revoke?id=${id}`, { method: 'POST' }).catch(() => {});
    this.apiKeysSubject.next(this.apiKeysSubject.value.map(k => k.id === id ? { ...k, status: 'revoked' as const } : k));
  }
}
