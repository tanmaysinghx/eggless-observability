package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"golang.org/x/net/websocket"

	"eggless-server/models"
	"eggless-server/storage"
)

type Handler struct {
	store *storage.Store
}

func NewHandler(store *storage.Store) *Handler {
	return &Handler{store: store}
}

// GET /api/v1/health
func (h *Handler) HealthHandler(w http.ResponseWriter, r *http.Request) {
	sendJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Eggless Go API Server is healthy and operational",
		Data: map[string]interface{}{
			"version":   "v2.4.0-prod",
			"status":    "connected",
			"engine":    "in-memory-ring-buffer",
			"ingestion": "ready",
		},
	})
}

// GET /api/v1/logs
func (h *Handler) QueryLogsHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	limit, _ := strconv.Atoi(q.Get("limit"))

	services := parseCSV(q.Get("services"))
	levels := parseCSV(q.Get("levels"))
	envs := parseCSV(q.Get("environments"))

	filter := models.LogFilter{
		SearchQuery:  q.Get("searchQuery"),
		Services:     services,
		Levels:       levels,
		Environments: envs,
		TimeRange:    q.Get("timeRange"),
		Page:         page,
		Limit:        limit,
	}

	appFilter := q.Get("app")
	envFilter := q.Get("env")

	response := h.store.QueryLogs(filter, appFilter, envFilter)
	sendJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data:    response,
	})
}

// POST /api/v1/logs/ingest
func (h *Handler) IngestLogHandler(w http.ResponseWriter, r *http.Request) {
	apiKey := r.Header.Get("X-API-Key")
	if apiKey == "" {
		apiKey = r.Header.Get("Authorization")
		apiKey = strings.TrimPrefix(apiKey, "Bearer ")
	}

	if !h.store.ValidateApiKey(apiKey) {
		sendJSON(w, http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Invalid or revoked X-API-Key header",
		})
		return
	}

	var payload models.IngestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		sendJSON(w, http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid JSON payload format",
		})
		return
	}

	if payload.Service == "" {
		payload.Service = "default-service"
	}
	if payload.Level == "" {
		payload.Level = "INFO"
	}
	if payload.Message == "" {
		sendJSON(w, http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Field 'message' is required",
		})
		return
	}

	entry := h.store.AddLog(models.LogEntry{
		Service:     payload.Service,
		Level:       strings.ToUpper(payload.Level),
		Message:     payload.Message,
		Environment: payload.Environment,
		TraceID:     payload.TraceID,
		UserID:      payload.UserID,
		Host:        payload.Host,
		Metadata:    payload.Metadata,
		StackTrace:  payload.StackTrace,
	})

	sendJSON(w, http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Log ingested successfully",
		Data:    entry,
	})
}

// GET /api/v1/applications
func (h *Handler) GetApplicationsHandler(w http.ResponseWriter, r *http.Request) {
	apps := h.store.GetApplications()
	sendJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data:    apps,
	})
}

// GET /api/v1/alerts
func (h *Handler) GetAlertsHandler(w http.ResponseWriter, r *http.Request) {
	alerts := h.store.GetAlerts()
	sendJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data:    alerts,
	})
}

// POST /api/v1/alerts
func (h *Handler) CreateAlertHandler(w http.ResponseWriter, r *http.Request) {
	var rule models.AlertRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		sendJSON(w, http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid alert rule JSON",
		})
		return
	}

	created := h.store.AddAlert(rule)
	sendJSON(w, http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Alert rule created",
		Data:    created,
	})
}

// PUT /api/v1/alerts/toggle
func (h *Handler) ToggleAlertHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		sendJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Message: "Missing id query param"})
		return
	}
	ok := h.store.ToggleAlert(id)
	sendJSON(w, http.StatusOK, models.APIResponse{Success: ok})
}

// DELETE /api/v1/alerts
func (h *Handler) DeleteAlertHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		sendJSON(w, http.StatusBadRequest, models.APIResponse{Success: false, Message: "Missing id query param"})
		return
	}
	ok := h.store.DeleteAlert(id)
	sendJSON(w, http.StatusOK, models.APIResponse{Success: ok})
}

// GET /api/v1/apikeys
func (h *Handler) GetApiKeysHandler(w http.ResponseWriter, r *http.Request) {
	keys := h.store.GetApiKeys()
	sendJSON(w, http.StatusOK, models.APIResponse{
		Success: true,
		Data:    keys,
	})
}

// POST /api/v1/apikeys
func (h *Handler) CreateApiKeyHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.Name == "" {
		body.Name = "New API Key"
	}

	key := h.store.CreateApiKey(body.Name)
	sendJSON(w, http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "API key generated successfully",
		Data:    key,
	})
}

// POST /api/v1/apikeys/revoke
func (h *Handler) RevokeApiKeyHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	ok := h.store.RevokeApiKey(id)
	sendJSON(w, http.StatusOK, models.APIResponse{Success: ok})
}

// WebSocket Live Stream Handler
func (h *Handler) WebSocketStreamHandler(ws *websocket.Conn) {
	ch := h.store.Subscribe()
	defer h.store.Unsubscribe(ch)

	for entry := range ch {
		data, err := json.Marshal(entry)
		if err != nil {
			break
		}
		if _, err := ws.Write(data); err != nil {
			break
		}
	}
}

func sendJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

func parseCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	res := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			res = append(res, trimmed)
		}
	}
	return res
}
