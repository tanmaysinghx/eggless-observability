package models

import "time"

type LogEntry struct {
	ID            string                 `json:"id"`
	Timestamp     string                 `json:"timestamp"`
	FullTimestamp string                 `json:"fullTimestamp"`
	Level         string                 `json:"level"`
	Service       string                 `json:"service"`
	Environment   string                 `json:"environment"`
	Message       string                 `json:"message"`
	TraceID       string                 `json:"traceId"`
	RequestID     string                 `json:"requestId"`
	UserID        string                 `json:"userId,omitempty"`
	Host          string                 `json:"host"`
	Metadata      map[string]interface{} `json:"metadata"`
	StackTrace    string                 `json:"stackTrace,omitempty"`
	CreatedAt     time.Time              `json:"-"`
}

type LogFilter struct {
	SearchQuery  string   `json:"searchQuery"`
	Services     []string `json:"services"`
	Environments []string `json:"environments"`
	Levels       []string `json:"levels"`
	TimeRange    string   `json:"timeRange"`
	Page         int      `json:"page"`
	Limit        int      `json:"limit"`
}

type LogStats struct {
	TotalLogs          int `json:"totalLogs"`
	ErrorCount         int `json:"errorCount"`
	WarnCount          int `json:"warnCount"`
	ActiveApplications int `json:"activeApplications"`
	LogsPerMin         int `json:"logsPerMin"`
}

type LogsQueryResponse struct {
	Logs       []LogEntry `json:"logs"`
	Total      int        `json:"total"`
	Page       int        `json:"page"`
	TotalPages int        `json:"totalPages"`
	Stats      LogStats   `json:"stats"`
}

type ApplicationInfo struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Environment  string `json:"environment"`
	LastLog      string `json:"lastLog"`
	LogsPerMin   int    `json:"logsPerMin"`
	ErrorsPerMin int    `json:"errorsPerMin"`
	ErrorCount   int    `json:"errorCount"`
	Uptime       string `json:"uptime"`
	Status       string `json:"status"` // "healthy" | "warning" | "critical"
	Description  string `json:"description"`
}

type AlertRule struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Application   string `json:"application"`
	Query         string `json:"query"`
	Condition     string `json:"condition"`
	Window        string `json:"window"`
	Channel       string `json:"channel"`
	Enabled       bool   `json:"enabled"`
	LastTriggered string `json:"lastTriggered,omitempty"`
	Status        string `json:"status"` // "ok" | "triggered" | "disabled"
}

type ApiKey struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	TokenPrefix string `json:"tokenPrefix"`
	Token       string `json:"token,omitempty"`
	Created     string `json:"created"`
	LastUsed    string `json:"lastUsed"`
	Status      string `json:"status"` // "active" | "revoked"
}

type IngestPayload struct {
	Service     string                 `json:"service"`
	Level       string                 `json:"level"`
	Message     string                 `json:"message"`
	Environment string                 `json:"environment,omitempty"`
	TraceID     string                 `json:"traceId,omitempty"`
	UserID      string                 `json:"userId,omitempty"`
	Host        string                 `json:"host,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	StackTrace  string                 `json:"stackTrace,omitempty"`
}

type IngestBatchPayload struct {
	Logs []IngestPayload `json:"logs"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}
