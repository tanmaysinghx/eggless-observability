export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'TRACE';
export type Environment = 'production' | 'staging' | 'development';

export interface LogEntry {
  id: string;
  timestamp: string;      // e.g. "20:41:32.182"
  fullTimestamp: string;  // ISO string
  level: LogLevel;
  service: string;
  environment: Environment;
  message: string;
  traceId: string;
  requestId: string;
  userId?: string;
  host: string;
  metadata: Record<string, any>;
  stackTrace?: string;
  expanded?: boolean;
}

export interface LogFilter {
  searchQuery: string;
  services: string[];
  environments: Environment[];
  levels: LogLevel[];
  timeRange: string; // '15m' | '1h' | '6h' | '24h' | 'custom'
  traceId?: string;
  host?: string;
  userId?: string;
}

export interface LogStats {
  totalLogs: number;
  errorCount: number;
  warnCount: number;
  activeApplications: number;
  logsPerMin: number;
}

export interface ApplicationInfo {
  id: string;
  name: string;
  environment: Environment;
  lastLog: string;
  logsPerMin: number;
  errorsPerMin: number;
  errorCount: number;
  uptime: string;
  /** pending = registered but no logs received yet. */
  status: 'healthy' | 'warning' | 'critical' | 'pending';
  description?: string;
  createdAt?: string;
}

export interface NewApplication {
  name: string;
  environment: Environment;
  description?: string;
}

export interface ApplicationRegistration {
  application: ApplicationInfo;
  /** Ingestion key bound to the application; `token` is only returned here. */
  apiKey: ApiKey;
}

export interface AlertRule {
  id: string;
  name: string;
  application: string;
  query: string;
  condition: string;
  window: string;
  channel: string;
  enabled: boolean;
  lastTriggered?: string;
  status: 'ok' | 'triggered' | 'disabled';
}

/** POST /alerts/{id}/test */
export interface AlertTestResult {
  value: number;
  breached: boolean;
  webhookConfigured: boolean;
  webhookStatus?: number;
  webhookError?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  tokenPrefix: string;
  token?: string;
  created: string;
  lastUsed: string;
  status: 'active' | 'revoked';
  /** Set when the key may only send logs for this application. */
  application?: string;
}

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'log_count' | 'error_count' | 'error_rate' | 'logs_by_app' | 'logs_by_level' | 'top_errors';
  timeWindow: string;
  query?: string;
  data?: any;
}

export interface MetricsBucket {
  start: string;
  count: number;
  errors: number;
  warns: number;
}

export interface MetricsSummary {
  timeRange: string;
  from: string;
  to: string;
  totalLogs: number;
  errorCount: number;
  warnCount: number;
  logsPerMin: number;
  errorRate: number;
  activeServices: number;
  byLevel: Record<string, number>;
  timeseries: MetricsBucket[];
  byService: { service: string; count: number; errors: number; logsPerMin: number }[];
  topErrors: { message: string; service: string; count: number; lastSeen: string }[];
}

export interface SystemInfo {
  retentionDays: number;
  requireApiKey: boolean;
  alertEvaluationIntervalSeconds: number;
}
