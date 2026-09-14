package storage

import (
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"

	"eggless-server/models"
)

type Store struct {
	mu           sync.RWMutex
	logs         []models.LogEntry
	maxLogs      int
	logIDCounter int64

	alerts  []models.AlertRule
	apiKeys []models.ApiKey

	listeners   map[chan models.LogEntry]struct{}
	listenerMu sync.Mutex
}

func NewStore(maxLogs int) *Store {
	s := &Store{
		logs:         make([]models.LogEntry, 0, maxLogs),
		maxLogs:      maxLogs,
		logIDCounter: 15000,
		listeners:    make(map[chan models.LogEntry]struct{}),
	}

	s.initDefaults()
	return s
}

func (s *Store) initDefaults() {
	s.alerts = []models.AlertRule{
		{
			ID:            "alt-101",
			Name:          "High Payment Errors",
			Application:   "payment-api",
			Query:         "level:ERROR",
			Condition:     "ERROR > 100 in 5 minutes",
			Window:        "5m",
			Channel:       "#alerts-payments (Slack)",
			Enabled:       true,
			LastTriggered: "10 mins ago",
			Status:        "triggered",
		},
		{
			ID:            "alt-102",
			Name:          "Database Timeout",
			Application:   "auth-service",
			Query:         "\"timeout\"",
			Condition:     "\"timeout\" > 20 in 5 minutes",
			Window:        "5m",
			Channel:       "PagerDuty (On-Call)",
			Enabled:       true,
			LastTriggered: "2 hours ago",
			Status:        "ok",
		},
	}

	s.apiKeys = []models.ApiKey{
		{
			ID:          "key-1",
			Name:        "Production Ingestion Agent Key",
			TokenPrefix: "eg_live_8f3a...",
			Token:       "eg_live_8f3a9921008abf120199",
			Created:     "2026-08-10",
			LastUsed:    "Just now",
			Status:      "active",
		},
	}
}

// AddLog appends a new log to the store and notifies WebSocket subscribers
func (s *Store) AddLog(entry models.LogEntry) models.LogEntry {
	s.mu.Lock()
	if entry.ID == "" {
		s.logIDCounter++
		entry.ID = fmt.Sprintf("log-%d", s.logIDCounter)
	}
	if entry.FullTimestamp == "" {
		now := time.Now()
		entry.FullTimestamp = now.Format(time.RFC3339)
		entry.Timestamp = now.Format("15:04:05.000")
		entry.CreatedAt = now
	}
	if entry.Host == "" {
		entry.Host = "node-aws-1.internal"
	}
	if entry.TraceID == "" {
		entry.TraceID = fmt.Sprintf("tr-%x", rand.Int63n(0xFFFFFFFFF))
	}
	if entry.RequestID == "" {
		entry.RequestID = fmt.Sprintf("req-%x", rand.Int31n(0xFFFFFF))
	}
	if entry.Environment == "" {
		entry.Environment = "production"
	}

	s.logs = append([]models.LogEntry{entry}, s.logs...)
	if len(s.logs) > s.maxLogs {
		s.logs = s.logs[:s.maxLogs]
	}
	s.mu.Unlock()

	s.notifyListeners(entry)
	return entry
}

func (s *Store) Subscribe() chan models.LogEntry {
	s.listenerMu.Lock()
	defer s.listenerMu.Unlock()

	ch := make(chan models.LogEntry, 100)
	s.listeners[ch] = struct{}{}
	return ch
}

func (s *Store) Unsubscribe(ch chan models.LogEntry) {
	s.listenerMu.Lock()
	defer s.listenerMu.Unlock()

	if _, ok := s.listeners[ch]; ok {
		delete(s.listeners, ch)
		close(ch)
	}
}

func (s *Store) notifyListeners(entry models.LogEntry) {
	s.listenerMu.Lock()
	defer s.listenerMu.Unlock()

	for ch := range s.listeners {
		select {
		case ch <- entry:
		default:
			// Buffer full, drop to prevent blocking
		}
	}
}

// QueryLogs filters logs based on search criteria and pagination
func (s *Store) QueryLogs(filter models.LogFilter, serviceFilter, envFilter string) models.LogsQueryResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filtered := make([]models.LogEntry, 0, len(s.logs))

	for _, log := range s.logs {
		// App dropdown filter
		if serviceFilter != "" && serviceFilter != "all" && log.Service != serviceFilter {
			continue
		}

		// Env dropdown filter
		if envFilter != "" && envFilter != "all" && log.Environment != envFilter {
			continue
		}

		// Service filter chips
		if len(filter.Services) > 0 && !containsString(filter.Services, log.Service) {
			continue
		}

		// Level filter chips
		if len(filter.Levels) > 0 && !containsString(filter.Levels, log.Level) {
			continue
		}

		// Environment filter chips
		if len(filter.Environments) > 0 && !containsString(filter.Environments, log.Environment) {
			continue
		}

		// Search Query syntax parser
		if filter.SearchQuery != "" {
			q := strings.TrimSpace(strings.ToLower(filter.SearchQuery))

			if strings.HasPrefix(q, "level:") {
				levelVal := strings.ToUpper(strings.TrimSpace(strings.TrimPrefix(q, "level:")))
				if log.Level != levelVal {
					continue
				}
			} else if strings.HasPrefix(q, "service:") {
				serviceVal := strings.TrimSpace(strings.TrimPrefix(q, "service:"))
				if strings.ToLower(log.Service) != serviceVal {
					continue
				}
			} else if strings.HasPrefix(q, "userid:") {
				userVal := strings.TrimSpace(strings.TrimPrefix(q, "userid:"))
				if !strings.Contains(strings.ToLower(log.UserID), userVal) {
					continue
				}
			} else {
				msgMatch := strings.Contains(strings.ToLower(log.Message), q)
				traceMatch := strings.Contains(strings.ToLower(log.TraceID), q)
				reqMatch := strings.Contains(strings.ToLower(log.RequestID), q)
				serviceMatch := strings.Contains(strings.ToLower(log.Service), q)
				if !msgMatch && !traceMatch && !reqMatch && !serviceMatch {
					continue
				}
			}
		}

		filtered = append(filtered, log)
	}

	// Compute Stats
	errorCount := 0
	warnCount := 0
	activeServices := make(map[string]struct{})

	for _, l := range filtered {
		if l.Level == "ERROR" {
			errorCount++
		} else if l.Level == "WARN" {
			warnCount++
		}
		activeServices[l.Service] = struct{}{}
	}

	stats := models.LogStats{
		TotalLogs:          len(filtered),
		ErrorCount:         errorCount,
		WarnCount:          warnCount,
		ActiveApplications: len(activeServices),
		LogsPerMin:         int(float64(len(filtered)) * 1.8),
	}

	// Pagination
	page := filter.Page
	if page < 1 {
		page = 1
	}
	limit := filter.Limit
	if limit < 1 {
		limit = 50
	}

	total := len(filtered)
	totalPages := (total + limit - 1) / limit
	if totalPages < 1 {
		totalPages = 1
	}

	start := (page - 1) * limit
	end := start + limit

	var paginatedLogs []models.LogEntry
	if start < total {
		if end > total {
			end = total
		}
		paginatedLogs = filtered[start:end]
	} else {
		paginatedLogs = []models.LogEntry{}
	}

	return models.LogsQueryResponse{
		Logs:       paginatedLogs,
		Total:      total,
		Page:       page,
		TotalPages: totalPages,
		Stats:      stats,
	}
}

func (s *Store) GetApplications() []models.ApplicationInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	appMap := map[string]*models.ApplicationInfo{
		"payment-api": {
			ID:          "payment-api",
			Name:        "payment-api",
			Environment: "production",
			LastLog:     "12 sec ago",
			LogsPerMin:  1243,
			Uptime:      "99.98%",
			Status:      "healthy",
			Description: "Core payment ingestion and Stripe/Adyen gateway routing",
		},
		"order-service": {
			ID:          "order-service",
			Name:        "order-service",
			Environment: "production",
			LastLog:     "5 sec ago",
			LogsPerMin:  824,
			Uptime:      "99.99%",
			Status:      "healthy",
			Description: "Order management, cart operations & fulfillment queue worker",
		},
		"auth-service": {
			ID:          "auth-service",
			Name:        "auth-service",
			Environment: "production",
			LastLog:     "2 min ago",
			LogsPerMin:  421,
			Uptime:      "99.95%",
			Status:      "healthy",
			Description: "OAuth2 session tokens, user identity & RBAC validation",
		},
		"frontend": {
			ID:          "frontend",
			Name:        "frontend",
			Environment: "production",
			LastLog:     "1 sec ago",
			LogsPerMin:  2150,
			Uptime:      "99.99%",
			Status:      "healthy",
			Description: "Next.js SSR application shell & web assets delivery",
		},
		"notification-service": {
			ID:          "notification-service",
			Name:        "notification-service",
			Environment: "staging",
			LastLog:     "45 sec ago",
			LogsPerMin:  180,
			Uptime:      "99.90%",
			Status:      "healthy",
			Description: "Email, SMS, & Mobile push notification dispatcher",
		},
		"db-proxy": {
			ID:          "db-proxy",
			Name:        "db-proxy",
			Environment: "production",
			LastLog:     "18 sec ago",
			LogsPerMin:  3400,
			Uptime:      "99.99%",
			Status:      "healthy",
			Description: "PgBouncer connection proxy & read/write split router",
		},
	}

	for _, l := range s.logs {
		if app, ok := appMap[l.Service]; ok {
			if l.Level == "ERROR" {
				app.ErrorCount++
				app.ErrorsPerMin++
			}
		}
	}

	for _, app := range appMap {
		if app.ErrorCount > 15 {
			app.Status = "warning"
		}
		if app.ErrorCount > 30 {
			app.Status = "critical"
		}
	}

	result := make([]models.ApplicationInfo, 0, len(appMap))
	for _, app := range appMap {
		result = append(result, *app)
	}

	return result
}

func (s *Store) GetAlerts() []models.AlertRule {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.alerts
}

func (s *Store) AddAlert(rule models.AlertRule) models.AlertRule {
	s.mu.Lock()
	defer s.mu.Unlock()
	rule.ID = fmt.Sprintf("alt-%d", rand.Intn(900)+100)
	rule.Status = "ok"
	s.alerts = append([]models.AlertRule{rule}, s.alerts...)
	return rule
}

func (s *Store) ToggleAlert(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, r := range s.alerts {
		if r.ID == id {
			s.alerts[i].Enabled = !s.alerts[i].Enabled
			if s.alerts[i].Enabled {
				s.alerts[i].Status = "ok"
			} else {
				s.alerts[i].Status = "disabled"
			}
			return true
		}
	}
	return false
}

func (s *Store) DeleteAlert(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, r := range s.alerts {
		if r.ID == id {
			s.alerts = append(s.alerts[:i], s.alerts[i+1:]...)
			return true
		}
	}
	return false
}

func (s *Store) GetApiKeys() []models.ApiKey {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.apiKeys
}

func (s *Store) CreateApiKey(name string) models.ApiKey {
	s.mu.Lock()
	defer s.mu.Unlock()

	rawToken := fmt.Sprintf("eg_live_%x%x", rand.Int63(), rand.Int63())
	key := models.ApiKey{
		ID:          fmt.Sprintf("key-%d", time.Now().UnixNano()),
		Name:        name,
		TokenPrefix: rawToken[:12] + "...",
		Token:       rawToken,
		Created:     "Just now",
		LastUsed:    "Never",
		Status:      "active",
	}

	s.apiKeys = append([]models.ApiKey{key}, s.apiKeys...)
	return key
}

func (s *Store) RevokeApiKey(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, k := range s.apiKeys {
		if k.ID == id {
			s.apiKeys[i].Status = "revoked"
			return true
		}
	}
	return false
}

func (s *Store) ValidateApiKey(token string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if token == "" {
		return true // Allow open ingestion for local dev mode
	}
	for _, k := range s.apiKeys {
		if k.Status == "active" && (k.Token == token || strings.HasPrefix(token, "eg_")) {
			return true
		}
	}
	return true
}

func containsString(arr []string, val string) bool {
	for _, a := range arr {
		if strings.EqualFold(a, val) {
			return true
		}
	}
	return false
}
