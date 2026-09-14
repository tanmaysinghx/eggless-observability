package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"strings"

	"golang.org/x/net/websocket"

	"eggless-server/handlers"
	"eggless-server/simulator"
	"eggless-server/storage"
)

//go:embed public/*
var publicFiles embed.FS

// corsMiddleware enables CORS for Angular frontend & external ingestion SDKs
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	store := storage.NewStore(50000)
	gen := simulator.NewGenerator(store)
	h := handlers.NewHandler(store)

	// Seed initial logs and start live stream generator
	gen.SeedInitialLogs()
	gen.StartLiveStream()

	mux := http.NewServeMux()

	// REST API Routes
	mux.HandleFunc("/api/v1/health", h.HealthHandler)
	mux.HandleFunc("/api/v1/logs", h.QueryLogsHandler)
	mux.HandleFunc("/api/v1/logs/ingest", h.IngestLogHandler)
	mux.HandleFunc("/api/v1/applications", h.GetApplicationsHandler)
	mux.HandleFunc("/api/v1/alerts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			h.CreateAlertHandler(w, r)
		} else {
			h.GetAlertsHandler(w, r)
		}
	})
	mux.HandleFunc("/api/v1/alerts/toggle", h.ToggleAlertHandler)
	mux.HandleFunc("/api/v1/alerts/delete", h.DeleteAlertHandler)
	mux.HandleFunc("/api/v1/apikeys", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			h.CreateApiKeyHandler(w, r)
		} else {
			h.GetApiKeysHandler(w, r)
		}
	})
	mux.HandleFunc("/api/v1/apikeys/revoke", h.RevokeApiKeyHandler)

	// WebSocket Live Tail Endpoint
	mux.Handle("/api/v1/logs/stream", websocket.Handler(h.WebSocketStreamHandler))

	// Serve Embedded Angular Frontend
	subFS, err := fs.Sub(publicFiles, "public")
	if err != nil {
		log.Fatalf("Failed to create sub filesystem: %v", err)
	}
	fileServer := http.FileServer(http.FS(subFS))

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// If requesting an API endpoint that isn't registered, return 404
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		
		// Check if the requested file exists in the embedded FS
		_, err := fs.Stat(subFS, strings.TrimPrefix(r.URL.Path, "/"))
		if err != nil {
			// File not found, serve index.html for Angular pushState routing
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	})

	port := "8080"
	serverAddr := ":" + port

	fmt.Println("=======================================================================")
	fmt.Println("              🥚 EGGLESS OBSERVABILITY GO BACKEND SERVER               ")
	fmt.Println("=======================================================================")
	fmt.Printf("🚀 HTTP Server listening on http://localhost:%s\n", port)
	fmt.Printf("⚡ Live Tail WebSocket on ws://localhost:%s/api/v1/logs/stream\n", port)
	fmt.Println("-----------------------------------------------------------------------")
	fmt.Println("📥 Ingestion Command Example:")
	fmt.Printf("   curl -X POST http://localhost:%s/api/v1/logs/ingest \\\n", port)
	fmt.Println("     -H \"X-API-Key: eg_live_8f3a9921008abf120199\" \\")
	fmt.Println("     -H \"Content-Type: application/json\" \\")
	fmt.Println("     -d '{\"service\":\"payment-api\", \"level\":\"ERROR\", \"message\":\"Stripe HTTP 504 Timeout\"}'")
	fmt.Println("=======================================================================")

	log.Fatal(http.ListenAndServe(serverAddr, corsMiddleware(mux)))
}
