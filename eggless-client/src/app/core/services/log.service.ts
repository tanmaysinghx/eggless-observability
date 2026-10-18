import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, combineLatest, interval, of, throwError, timer } from 'rxjs';
import { map, catchError, debounceTime, distinctUntilChanged, retry, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { LogEntry, LogFilter, LogStats, ApplicationInfo, AlertRule, ApiKey, Environment, LogLevel, MetricsSummary, SystemInfo } from '../models/log.model';
import { matchesQuery, parseQuery } from './log-query';

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private get apiBase(): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/v1`;
    }
    return 'http://localhost:8080/api/v1';
  }

  private get wsBase(): string {
    if (typeof window !== 'undefined') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}/api/v1/logs/stream`;
    }
    return 'ws://localhost:8080/api/v1/logs/stream';
  }
  
  private http = inject(HttpClient);

  private logsSubject = new BehaviorSubject<LogEntry[]>([]);
  public logs$: Observable<LogEntry[]> = this.logsSubject.asObservable();

  /** Number of stored logs matching the current filter (the table holds at most the newest 500). */
  private totalMatchingSubject = new BehaviorSubject<number>(0);
  public totalMatching$: Observable<number> = this.totalMatchingSubject.asObservable();

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
  
  private appsSubject = new BehaviorSubject<ApplicationInfo[]>([]);

  private ws: WebSocket | null = null;

  constructor() {
    this.startDataPolling();
    this.connectWebSocket();
  }

  private startDataPolling() {
    // Re-query the server whenever any filter changes; the server applies the search syntax.
    combineLatest([this.filter$, this.selectedApp$, this.selectedEnv$]).pipe(
      debounceTime(250),
      map(([filter, app, env]) => this.buildQueryParams(filter, app, env)),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      switchMap(params => this.http.get<any>(`${this.apiBase}/logs`, { params }).pipe(
        retry(2),
        catchError(() => of(null))
      ))
    ).subscribe(res => {
      if (res && res.data && res.data.logs) {
        this.logsSubject.next(res.data.logs);
        this.totalMatchingSubject.next(res.data.total ?? res.data.logs.length);
      }
    });

    this.fetchAlerts();
    this.fetchApiKeys();
    this.fetchApplications();

    interval(15000).subscribe(() => {
      this.fetchApplications();
      this.fetchAlerts();
    });
  }

  private buildQueryParams(filter: LogFilter, app: string, env: Environment | 'all'): Record<string, string> {
    // Level chips become level: terms, which the server ORs together.
    const levelTerms = filter.levels.map(l => `level:${l}`).join(' ');
    const search = [filter.searchQuery.trim(), levelTerms].filter(Boolean).join(' ');
    const params: Record<string, string> = { limit: '500', timeRange: filter.timeRange };
    const service = app !== 'all' ? app : filter.services[0];
    if (service) params['service'] = service;
    if (env !== 'all') params['environment'] = env;
    if (search) params['search'] = search;
    return params;
  }

  /** Re-runs the current query, e.g. after the user presses refresh. */
  public refresh() {
    this.filterSubject.next({ ...this.filterSubject.value });
  }

  private fetchAlerts() {
    this.http.get<any>(`${this.apiBase}/alerts`)
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        if (res && res.data) {
          this.alertsSubject.next(res.data);
        }
      });
  }

  private fetchApiKeys() {
    this.http.get<any>(`${this.apiBase}/apikeys`)
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        if (res && res.data) {
          this.apiKeysSubject.next(res.data);
        }
      });
  }
  
  private fetchApplications() {
    this.http.get<any>(`${this.apiBase}/applications`)
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        if (res && res.data) {
          this.appsSubject.next(res.data);
        }
      });
  }

  private connectWebSocket() {
    const connect = () => {
      try {
        this.ws = new WebSocket(this.wsBase);
        this.ws.onmessage = (event) => {
          if (!this.liveTailSubject.value) return;
          try {
            const newEntry: LogEntry = JSON.parse(event.data);
            if (!this.matchesCurrentFilter(newEntry)) return;
            const current = this.logsSubject.value;
            this.logsSubject.next([newEntry, ...current.slice(0, 800)]);
            this.totalMatchingSubject.next(this.totalMatchingSubject.value + 1);
          } catch (e) {}
        };
        this.ws.onclose = () => {
          setTimeout(connect, 3000);
        };
      } catch (e) {
        setTimeout(connect, 5000);
      }
    };
    connect();
  }

  /** Live-tail entries are added only if they would have matched the server query. */
  private matchesCurrentFilter(log: LogEntry): boolean {
    const filter = this.filterSubject.value;
    const app = this.selectedAppSubject.value;
    const env = this.selectedEnvSubject.value;
    if (app !== 'all' && log.service !== app) return false;
    if (filter.services.length > 0 && !filter.services.includes(log.service)) return false;
    if (env !== 'all' && log.environment !== env) return false;
    if (filter.levels.length > 0 && !filter.levels.includes(log.level)) return false;
    return matchesQuery(log, parseQuery(filter.searchQuery));
  }

  /** Logs matching the current filters (already filtered by the server). */
  public filteredLogs$: Observable<LogEntry[]> = this.logs$;

  /** The newest logs of one application, independent of the explorer filters. */
  public recentLogs(service: string, limit = 25): Observable<LogEntry[]> {
    return this.http.get<any>(`${this.apiBase}/logs`, { params: { service, limit: String(limit) } }).pipe(
      map(res => (res && res.data ? res.data.logs as LogEntry[] : [])),
      catchError(() => of([]))
    );
  }

  /** Server-side aggregates for a time range, refreshed every 15s while subscribed. */
  public metrics(timeRange: string, service?: string, environment?: string): Observable<MetricsSummary | null> {
    const params: Record<string, string> = { timeRange };
    if (service && service !== 'all') params['service'] = service;
    if (environment && environment !== 'all') params['environment'] = environment;
    return timer(0, 15000).pipe(
      switchMap(() => this.http.get<any>(`${this.apiBase}/metrics/summary`, { params }).pipe(
        map(res => (res && res.data ? res.data as MetricsSummary : null)),
        catchError(() => of(null))
      ))
    );
  }

  public stats$: Observable<LogStats> = combineLatest([this.filter$, this.selectedApp$, this.selectedEnv$]).pipe(
    debounceTime(250),
    switchMap(([filter, app, env]) => this.metrics(filter.timeRange, app, env)),
    map(m => ({
      totalLogs: m?.totalLogs ?? 0,
      errorCount: m?.errorCount ?? 0,
      warnCount: m?.warnCount ?? 0,
      activeApplications: m?.activeServices ?? 0,
      logsPerMin: Math.round(m?.logsPerMin ?? 0)
    })),
    startWith({ totalLogs: 0, errorCount: 0, warnCount: 0, activeApplications: 0, logsPerMin: 0 }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  public systemInfo$: Observable<SystemInfo | null> = this.http.get<any>(`${this.apiBase}/system/info`).pipe(
    map(res => (res && res.data ? res.data as SystemInfo : null)),
    catchError(() => of(null)),
    shareReplay(1)
  );

  public applications$: Observable<ApplicationInfo[]> = this.appsSubject.asObservable();

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

  /** Creates a rule; errors carry the server's validation message. */
  public addAlertRule(rule: Omit<AlertRule, 'id' | 'status'>): Observable<AlertRule> {
    return this.http.post<any>(`${this.apiBase}/alerts`, rule).pipe(
      map(res => {
        this.fetchAlerts();
        return res.data as AlertRule;
      }),
      catchError(err => throwError(() => new Error(err?.error?.error || 'Failed to create alert rule')))
    );
  }

  public toggleAlertRule(id: string) {
    this.http.put(`${this.apiBase}/alerts/toggle?id=${id}`, {})
      .subscribe(() => {
        this.fetchAlerts();
      });
  }

  public deleteAlertRule(id: string) {
    this.http.delete(`${this.apiBase}/alerts?id=${id}`)
      .subscribe(() => {
        this.fetchAlerts();
      });
  }

  public createApiKey(name: string): Observable<ApiKey> {
    return this.http.post<any>(`${this.apiBase}/apikeys`, { name }).pipe(
      map(res => {
        if (res && res.success && res.data) {
          this.fetchApiKeys();
          return res.data;
        }
        throw new Error('Failed to create API key');
      })
    );
  }

  public revokeApiKey(id: string) {
    this.http.post(`${this.apiBase}/apikeys/revoke?id=${id}`, {})
      .subscribe(() => {
        this.fetchApiKeys();
      });
  }
}
