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
  status: 'healthy' | 'warning' | 'critical';
  description?: string;
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

export interface ApiKey {
  id: string;
  name: string;
  tokenPrefix: string;
  token?: string;
  created: string;
  lastUsed: string;
  status: 'active' | 'revoked';
}

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'log_count' | 'error_count' | 'error_rate' | 'logs_by_app' | 'logs_by_level' | 'top_errors';
  timeWindow: string;
  query?: string;
  data?: any;
}
