package simulator

import (
	"fmt"
	"math/rand"
	"time"

	"eggless-server/models"
	"eggless-server/storage"
)

type Generator struct {
	store *storage.Store
}

func NewGenerator(store *storage.Store) *Generator {
	return &Generator{store: store}
}

func (g *Generator) SeedInitialLogs() {
	services := []string{"payment-api", "order-service", "auth-service", "frontend", "notification-service", "db-proxy"}
	envs := []string{"production", "production", "production", "staging", "development"}
	now := time.Now()

	templates := []struct {
		Level   string
		Service string
		Msg     string
		Stack   string
		Meta    map[string]interface{}
	}{
		{
			Level:   "INFO",
			Service: "payment-api",
			Msg:     "Payment request received for order ORD-93821",
			Meta:    map[string]interface{}{"userId": "12345", "orderId": "ORD-93821", "amount": 149.99, "currency": "USD"},
		},
		{
			Level:   "WARN",
			Service: "payment-api",
			Msg:     "Payment gateway response slow: 1840ms latency",
			Meta:    map[string]interface{}{"latencyMs": 1840, "thresholdMs": 1000, "provider": "stripe"},
		},
		{
			Level:   "ERROR",
			Service: "payment-api",
			Msg:     "Payment failed: GatewayTimeoutException in Stripe SDK",
			Stack:   "StripeException: GatewayTimeoutException at PaymentClient.java:142\n  at com.eggless.payment.StripeService.charge(StripeService.java:88)\n  at com.eggless.payment.PaymentController.process(PaymentController.java:45)",
			Meta:    map[string]interface{}{"errorCode": "GATEWAY_TIMEOUT", "httpStatus": 504, "userId": "12345"},
		},
		{
			Level:   "INFO",
			Service: "order-service",
			Msg:     "Order ORD-93821 created successfully",
			Meta:    map[string]interface{}{"orderId": "ORD-93821", "itemsCount": 3, "total": 149.99},
		},
		{
			Level:   "WARN",
			Service: "order-service",
			Msg:     "Low inventory warning for SKU-9012 (Remaining: 4 units)",
			Meta:    map[string]interface{}{"sku": "SKU-9012", "remaining": 4},
		},
		{
			Level:   "ERROR",
			Service: "auth-service",
			Msg:     "DB Connection pool exhausted: 50/50 connections in use",
			Stack:   "PoolExhaustedException: Connection pool idle connections = 0\n  at com.zaxxer.hikari.HikariPool.getConnection(HikariPool.java:213)",
			Meta:    map[string]interface{}{"activeConnections": 50, "maxConnections": 50, "poolName": "AuthHikariPool"},
		},
		{
			Level:   "INFO",
			Service: "frontend",
			Msg:     "Client route change to /logs/explorer",
			Meta:    map[string]interface{}{"path": "/logs/explorer", "userAgent": "Mozilla/5.0 Chrome/128.0"},
		},
	}

	for i := 0; i < 500; i++ {
		t := templates[i%len(templates)]
		timeOffsetMs := time.Duration(500-i) * (3500 * time.Millisecond)
		logTime := now.Add(-timeOffsetMs)

		g.store.AddLog(models.LogEntry{
			Timestamp:     logTime.Format("15:04:05.000"),
			FullTimestamp: logTime.Format(time.RFC3339),
			Level:         t.Level,
			Service:       t.Service,
			Environment:   envs[i%len(envs)],
			Message:       t.Msg,
			TraceID:       fmt.Sprintf("tr-%x", rand.Int63n(0xFFFFFFFFF)),
			RequestID:     fmt.Sprintf("req-%x", rand.Int31n(0xFFFFFF)),
			UserID:        fmt.Sprintf("usr-%d", 1000+(i%50)),
			Host:          fmt.Sprintf("node-aws-%d.internal", (i%4)+1),
			Metadata:      t.Meta,
			StackTrace:    t.Stack,
			CreatedAt:     logTime,
		})
	}
	_ = services
}

func (g *Generator) StartLiveStream() {
	ticker := time.NewTicker(1200 * time.Millisecond)
	go func() {
		services := []string{"payment-api", "order-service", "auth-service", "frontend", "notification-service", "db-proxy"}
		levels := []string{"INFO", "INFO", "INFO", "WARN", "ERROR", "DEBUG"}

		for range ticker.C {
			now := time.Now()
			svc := services[rand.Intn(len(services))]
			lvl := levels[rand.Intn(len(levels))]

			msg := fmt.Sprintf("%s completed task #%d successfully", svc, rand.Intn(9000)+1000)
			var stack string
			meta := map[string]interface{}{"region": "us-east-1", "nodeVersion": "v20.11.0"}

			if lvl == "ERROR" {
				msg = fmt.Sprintf("%s error: Connection timeout while querying downstream database cluster", svc)
				stack = fmt.Sprintf("TimeoutException: Connection timeout after 5000ms\n  at db.Client.connect(db.go:98)\n  at %s.Service.execute(service.go:44)", svc)
				meta["errorCode"] = "DB_TIMEOUT"
				meta["retryCount"] = 3
			} else if lvl == "WARN" {
				msg = fmt.Sprintf("%s memory usage high: 84%% heap allocation", svc)
				meta["heapUsedMb"] = 890
				meta["heapMaxMb"] = 1024
			} else {
				meta["durationMs"] = rand.Intn(120) + 12
			}

			g.store.AddLog(models.LogEntry{
				Timestamp:     now.Format("15:04:05.000"),
				FullTimestamp: now.Format(time.RFC3339),
				Level:         lvl,
				Service:       svc,
				Environment:   "production",
				Message:       msg,
				TraceID:       fmt.Sprintf("tr-%x", rand.Int63n(0xFFFFFFFFF)),
				RequestID:     fmt.Sprintf("req-%x", rand.Int31n(0xFFFFFF)),
				UserID:        fmt.Sprintf("usr-%d", rand.Intn(500)+1000),
				Host:          fmt.Sprintf("node-aws-%d.internal", rand.Intn(4)+1),
				Metadata:      meta,
				StackTrace:    stack,
				CreatedAt:     now,
			})
		}
	}()
}
