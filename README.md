<div align="center">
  <img src="eggless-client/public/eggless-logo.png" width="120" alt="Eggless Logo" />
  <h1>🥚 Eggless Observability</h1>
  <p><b>Free, Open-Source Application Telemetry & Log Observability Platform in a Single Executable JAR</b></p>

  [![Java / Spring Boot](https://img.shields.io/badge/Java-25-007396?style=flat-square&logo=openjdk)](https://openjdk.org)
  [![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.1-6DB33F?style=flat-square&logo=springboot)](https://spring.io)
  [![Angular](https://img.shields.io/badge/Angular-21.0-DD0031?style=flat-square&logo=angular)](https://angular.dev)
  [![H2 / PostgreSQL / MySQL](https://img.shields.io/badge/Databases-H2%20|%20Postgres%20|%20MySQL-blue?style=flat-square)](https://h2database.com)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
</div>

---

## 🌟 Overview

**Eggless Observability** is designed from the ground up for open-source developers and engineering teams who need a **free, beautiful, enterprise-grade observability platform** for their applications without the complexity of configuring Elasticsearch, ClickHouse, or external SaaS providers.

- **Single Executable JAR**: Frontend UI (Angular 21) and Backend (Spring Boot) packaged together into one runnable artifact (`eggless-observability.jar`).
- **Zero-Setup Embedded Database**: Boots out-of-the-box using an embedded, persistent **H2 database** stored in `~/.eggless/data/`.
- **Easy Shift to Your Own Database**: Switch to **PostgreSQL** or **MySQL** simply by passing environment variables.
- **Portal SSO Ready**: Out-of-the-box support for centralized OAuth 2.1 / OIDC PKCE single sign-on and External Auth REST API.
- **Real-Time Live Tail**: Instant WebSocket log streaming and search.
- **Multi-Language SDKs**: Native Java/Spring Boot starter, Logback appender, and REST ingestion.

---

## 🚀 Quickstart (Under 10 Seconds)

### 1. Run the Single Standalone JAR
```bash
java -jar eggless-observability.jar
```
That's it! Open your browser:
👉 **[http://localhost:8080](http://localhost:8080)**

The platform initializes the database in `~/.eggless/data/`, seeds sample application telemetry, starts the real-time log ingestion engine, and serves the Angular UI.

---

## 🗄️ Database Setup (From Embedded H2 to Your Choice)

### Option A: Default Embedded H2 (Persistent & Zero Setup)
No configuration required! Logs and settings automatically persist in:
```
~/.eggless/data/egglessdb.mv.db
```

### Option B: Shift to PostgreSQL
To point Eggless to an external PostgreSQL instance:
```bash
export DB_URL="jdbc:postgresql://localhost:5432/eggless"
export DB_USERNAME="postgres"
export DB_PASSWORD="your_password"

java -jar eggless-observability.jar
```

### Option C: Shift to MySQL
To point Eggless to an external MySQL instance:
```bash
export DB_URL="jdbc:mysql://localhost:3306/eggless"
export DB_USERNAME="root"
export DB_PASSWORD="your_password"

java -jar eggless-observability.jar
```

---

## 🐳 Docker & Docker Compose

Run with Docker Compose:
```bash
docker compose up -d
```
Access the console at **`http://localhost:8080`**. Data is persisted in a named volume (`eggless-data`).

---

## 🛠️ Building From Source

To compile the Angular frontend and Spring Boot server into the standalone executable JAR:

### On Linux / macOS:
```bash
./build.sh
```

### On Windows:
```cmd
build.bat
```

The resulting artifact is placed at:
```
./eggless-observability.jar
```

---

## 🔐 Portal SSO Integration

Eggless Observability integrates seamlessly with **Portal SSO** for both interactive browser single sign-on and programmatic agent authentication:

```bash
cp .env.example .env   # then fill in PORTAL_CLIENT_SECRET and PORTAL_API_KEY from the secret store
docker compose up -d   # or export the same variables and run: java -jar eggless-observability.jar
```

| Variable | Purpose |
|---|---|
| `PORTAL_URL` | Issuer, `https://portal.tanmaysinghx.com` |
| `PORTAL_CLIENT_ID` | `eggless-observability` |
| `PORTAL_REDIRECT_URI` | Must exactly match a registered URI (`https://eggless.tanmaysinghx.com/auth/callback`) |
| `PORTAL_SCOPES` | `openid profile email` |
| `PORTAL_CLIENT_SECRET` | Confidential client secret, used only by the server's token exchange |
| `PORTAL_API_KEY` | `X-Portal-App-Key` for the External Auth API, used only by the server |

- **Interactive SSO**: Sign in via OAuth 2.1 + PKCE (S256). The browser only runs the authorize step; the server exchanges the code with the client secret and verifies the ID token against Portal SSO's JWKS (RS256).
- **External Auth REST API**: Direct headless user login and registration (`/api/auth/login`, `/api/auth/register`).

---

## 🔌 Ingestion & SDKs

### Java & Spring Boot (`eggless-spring-boot-starter`)
Add dependency to `pom.xml`:
```xml
<dependency>
    <groupId>io.eggless</groupId>
    <artifactId>eggless-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

Add configuration to `application.yml`:
```yaml
eggless:
  enabled: true
  server-url: http://localhost:8080
  api-key: egg_sec_...
  service-name: order-service
  environment: production
```

### Direct HTTP REST Ingestion (Any Language / Collector)
```bash
curl -X POST "http://localhost:8080/api/v1/logs" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "billing-service",
    "level": "INFO",
    "environment": "production",
    "message": "Payment processed successfully for customer #4910",
    "traceId": "trc_9982a17f",
    "host": "k8s-pod-7a",
    "metadata": { "amount": 99.00, "currency": "USD" }
  }'
```

---

## 📄 License
Released under the [MIT License](LICENSE).
