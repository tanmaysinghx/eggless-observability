<div align="center">
  <img src="eggless-client/public/eggless-logo.png" width="120" alt="Eggless Logo" />
  <h1>🥚 Eggless — Open-Source SaaS Application Logs & Observability</h1>
  <p><b>High-Performance Go Backend, High-Density Developer UI & Plug-and-Play Multi-Language SDKs</b></p>

  [![Go Version](https://img.shields.io/badge/Go-1.22%2B-00ADD8?style=flat-square&logo=go)](https://go.dev)
  [![Java / Spring Boot](https://img.shields.io/badge/Java-17%2F25-007396?style=flat-square&logo=openjdk)](https://openjdk.org)
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

## 🔌 SDKs & Framework Integrations

Eggless Observability provides native SDKs and log appenders for popular tech stacks:

### ☕ 1. Java & Spring Boot (`eggless-sdk-java`)

Add the dependency to your `pom.xml`:
```xml
<dependency>
    <groupId>io.eggless</groupId>
    <artifactId>eggless-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

Add configuration in `application.yml`:
```yaml
eggless:
  enabled: true
  server-url: http://localhost:8080
  api-key: egg_live_998877665544332211
  service-name: order-service
  environment: production
```

Logback XML integration (`logback-spring.xml`):
```xml
<appender name="EGGLESS" class="io.eggless.sdk.logback.EgglessLogbackAppender">
    <serverUrl>http://localhost:8080</serverUrl>
    <apiKey>egg_live_998877665544332211</apiKey>
    <serviceName>order-service</serviceName>
</appender>
```
*Features*: Automatic MDC `traceId` propagation, Servlet Filter HTTP status/duration recording, and `@RestControllerAdvice` exception stack trace capture.

---

### 🐹 2. Go Apps (`log/slog` & `zap`)

```go
package main

import (
    "log/slog"
    "net/http"
    "bytes"
)

func main() {
    // Ship logs via HTTP JSON to Eggless Ingestion API
    body := []byte(`{"service":"payment-api","level":"INFO","message":"Payment completed","traceId":"tr-9921"}`)
    http.Post("http://localhost:8080/api/v1/logs/ingest", "application/json", bytes.NewBuffer(body))
}
```

---

### 🟢 3. Node.js & TypeScript (`Winston` / `Pino` / `Express`)

```javascript
const winston = require('winston');
const http = require('http');

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console()
  ]
});

// Post log event to Eggless Server
function logToEggless(level, message, metadata) {
  const req = http.request('http://localhost:8080/api/v1/logs/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'egg_live_...' }
  });
  req.write(JSON.stringify({ service: 'auth-service', level, message, metadata }));
  req.end();
}
```

---

### 🦀 4. Rust (`tracing` Crate)

```rust
// Axum / Actix-web tracing layer
let payload = serde_json::json!({
    "service": "auth-service",
    "level": "INFO",
    "message": "User authenticated successfully",
    "traceId": "tr-rust-001"
});
```

---

### 🐳 5. Universal Vector / Docker / FluentBit / OpenTelemetry (OTLP)
For zero code changes, direct container logs from Docker or Vector forwarders to `http://localhost:8080/api/v1/logs/ingest`.

---

## 📥 Instant Log Ingestion API Examples

Send logs to Eggless from any application, microservice, shell script, or CI/CD pipeline using a single `curl` request:

### Ingest Single Log
```bash
curl -X POST http://localhost:8080/api/v1/logs/ingest \
  -H "X-API-Key: egg_live_998877665544332211" \
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
