<div align="center">
  <img src="eggless-client/public/eggless-logo.png" width="120" alt="Eggless Logo" />
  <h1>🥚 Eggless — Open-Source SaaS Application Logs & Observability</h1>
  <p><b>High-Performance Go Backend & High-Density Developer Tool UI</b></p>

  [![Go Version](https://img.shields.io/badge/Go-1.22%2B-00ADD8?style=flat-square&logo=go)](https://go.dev)
  [![Angular](https://img.shields.io/badge/Angular-21.0-DD0031?style=flat-square&logo=angular)](https://angular.dev)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
</div>

---

## 🚀 Quickstart (Plug & Play)

### Option 1: Run Go Backend Standalone (No External DB Needed!)
```bash
cd eggless-server
go run main.go
```
The Go server automatically starts on `http://localhost:8080` with native REST APIs, Live Log Generator, and WebSockets!

### Option 2: Run with Docker Compose
```bash
docker compose up -d
```
Access the Angular UI at `http://localhost:4200` and Go API at `http://localhost:8080`.

---

## 📥 Instant Log Ingestion API Examples

Send logs to Eggless from any application, microservice, shell script, or CI/CD pipeline using a single `curl` request:

### 1. Ingest Single Log
```bash
curl -X POST http://localhost:8080/api/v1/logs/ingest \
  -H "X-API-Key: eg_live_8f3a9921008abf120199" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "payment-api",
    "level": "ERROR",
    "message": "Stripe Gateway HTTP 504 Gateway Timeout",
    "environment": "production",
    "traceId": "tr-99812a4b",
    "userId": "usr-12345",
    "metadata": {
      "errorCode": "STRIPE_TIMEOUT",
      "retryCount": 3,
      "amount": 149.99
    },
    "stackTrace": "StripeException: GatewayTimeoutException at PaymentClient.java:142\n  at com.eggless.payment.StripeService.charge(StripeService.java:88)"
  }'
```

### 2. Live WebSockets Stream
Connect to `ws://localhost:8080/api/v1/logs/stream` to receive real-time log tailing events.

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/health` | `GET` | Server health status & engine telemetry |
| `/api/v1/logs` | `GET` | Query logs with filters (`level`, `service`, `searchQuery`, `timeRange`) |
| `/api/v1/logs/ingest` | `POST` | Ingest single or batch log payload |
| `/api/v1/logs/stream` | `WS` | Real-time live log tailing WebSocket connection |
| `/api/v1/applications` | `GET` | Application health, uptime, and logs/min rates |
| `/api/v1/alerts` | `GET / POST` | Query & create automated alert rules |
| `/api/v1/alerts/toggle` | `PUT` | Enable/disable alert rules |
| `/api/v1/apikeys` | `GET / POST` | List & generate ingestion API keys |

---

## 📄 License
Released under the [MIT License](LICENSE).
