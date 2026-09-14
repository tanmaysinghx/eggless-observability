import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, combineLatest, interval, of } from 'rxjs';
import { map, catchError, retry, tap } from 'rxjs/operators';
import { LogEntry, LogFilter, LogStats, ApplicationInfo, AlertRule, ApiKey, Environment, LogLevel } from '../models/log.model';

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private apiBase = 'http://localhost:8080/api/v1';
  private wsBase = 'ws://localhost:8080/api/v1/logs/stream';
  
  private http = inject(HttpClient);

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
  
  private appsSubject = new BehaviorSubject<ApplicationInfo[]>([]);

  private ws: WebSocket | null = null;

  constructor() {
    this.startDataPolling();
    this.connectWebSocket();
  }

  private startDataPolling() {
    this.fetchLogs();
    this.fetchAlerts();
    this.fetchApiKeys();
    this.fetchApplications();

    interval(15000).subscribe(() => {
      this.fetchApplications();
      this.fetchAlerts();
    });
  }

  private fetchLogs() {
    this.http.get<any>(`${this.apiBase}/logs?limit=500`)
      .pipe(retry(3), catchError(() => of(null)))
      .subscribe(res => {
        if (res && res.data && res.data.logs) {
          this.logsSubject.next(res.data.logs);
        }
      });
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
            const current = this.logsSubject.value;
            this.logsSubject.next([newEntry, ...current.slice(0, 800)]);
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
            const traceMatch = log.traceId?.toLowerCase().includes(q) || false;
            const reqMatch = log.requestId?.toLowerCase().includes(q) || false;
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

  public addAlertRule(rule: Omit<AlertRule, 'id' | 'status'>) {
    this.http.post<any>(`${this.apiBase}/alerts`, rule)
      .subscribe(res => {
        if (res && res.success) {
          this.fetchAlerts();
        }
      });
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
