package com.tanmaysinghx.eggless_server.service;

import com.tanmaysinghx.eggless_server.dto.AlertRuleDto;
import com.tanmaysinghx.eggless_server.dto.LogEntryDto;
import com.tanmaysinghx.eggless_server.entity.ApplicationEntity;
import com.tanmaysinghx.eggless_server.repository.ApplicationRepository;
import com.tanmaysinghx.eggless_server.repository.LogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Initializes the database on first boot with sample telemetry and configurations.
 * Ensures open-source developers get an immediate, interactive dashboard experience out-of-the-box.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final LogRepository logRepository;
    private final ApplicationRepository applicationRepository;
    private final LogService logService;
    private final AlertRuleService alertRuleService;
    private final ApiKeyService apiKeyService;

    @Override
    public void run(String... args) {
        if (logRepository.count() > 0) {
            log.info("Database already initialized with existing observability records.");
            return;
        }

        log.info("Fresh database detected. Initializing sample applications, alert rules, and telemetry...");

        // 1. Seed Applications
        List<ApplicationEntity> apps = List.of(
                ApplicationEntity.builder()
                        .id("app_auth_01")
                        .name("auth-service")
                        .environment("production")
                        .lastLog("Just now")
                        .logsPerMin(342)
                        .errorsPerMin(2)
                        .errorCount(14)
                        .uptime("99.98%")
                        .status("healthy")
                        .description("Authentication and Portal SSO token verification service")
                        .lastSeen(Instant.now())
                        .build(),
                ApplicationEntity.builder()
                        .id("app_pay_02")
                        .name("payment-api")
                        .environment("production")
                        .lastLog("Just now")
                        .logsPerMin(189)
                        .errorsPerMin(5)
                        .errorCount(28)
                        .uptime("99.85%")
                        .status("warning")
                        .description("Payment gateway and settlement processor")
                        .lastSeen(Instant.now())
                        .build(),
                ApplicationEntity.builder()
                        .id("app_order_03")
                        .name("order-service")
                        .environment("production")
                        .lastLog("1m ago")
                        .logsPerMin(512)
                        .errorsPerMin(0)
                        .errorCount(3)
                        .uptime("99.99%")
                        .status("healthy")
                        .description("E-commerce cart, inventory, and order fulfillment engine")
                        .lastSeen(Instant.now())
                        .build(),
                ApplicationEntity.builder()
                        .id("app_notify_04")
                        .name("notification-worker")
                        .environment("staging")
                        .lastLog("2m ago")
                        .logsPerMin(94)
                        .errorsPerMin(0)
                        .errorCount(0)
                        .uptime("100.00%")
                        .status("healthy")
                        .description("Background dispatch worker for emails, webhooks, and push alerts")
                        .lastSeen(Instant.now())
                        .build()
        );
        applicationRepository.saveAll(apps);

        // 2. Seed Default API Key
        apiKeyService.createKey("Production Kubernetes Log Collector");

        // 3. Seed Alert Rules
        alertRuleService.createRule(AlertRuleDto.builder()
                .name("High Payment Failure Rate")
                .application("payment-api")
                .query("level:ERROR AND service:payment-api")
                .condition("error_rate > 5%")
                .window("5m")
                .channel("Slack #alerts-prod")
                .build());

        alertRuleService.createRule(AlertRuleDto.builder()
                .name("Auth Token Validation Burst")
                .application("auth-service")
                .query("level:WARN AND message:'invalid token'")
                .condition("count > 100")
                .window("15m")
                .channel("PagerDuty P1")
                .build());

        // 4. Seed Realistic Initial Logs
        String[] services = {"auth-service", "payment-api", "order-service", "notification-worker"};
        String[] envs = {"production", "production", "staging"};

        // [level, message]; roughly 4% errors and 12% warnings, like a healthy fleet with a few problems.
        List<String[]> events = List.of(
                new String[]{"INFO", "OIDC PKCE authorization token exchanged successfully for sub=usr_99812"},
                new String[]{"INFO", "HTTP GET /api/v1/orders completed in 14ms (status=200)"},
                new String[]{"INFO", "Payment settlement transaction tx_99182 authorized for $142.50"},
                new String[]{"DEBUG", "Redis cache hit for key session:user:99812 (ttl=3540s)"},
                new String[]{"INFO", "Dispatched batch of 48 webhook notifications to subscribed endpoints"},
                new String[]{"INFO", "Ingress routing SSL handshake completed with TLSv1.3"},
                new String[]{"WARN", "HikariCP connection pool latency spike: acquisition took 42ms"},
                new String[]{"INFO", "Portal SSO user authenticated via External Auth API: admin@portalsso.local"},
                new String[]{"INFO", "HTTP POST /api/v1/cart completed in 22ms (status=201)"},
                new String[]{"WARN", "Slow query detected on orders_archive: execution took 128ms"},
                new String[]{"INFO", "Health check passed: db=UP redis=UP queue=UP"},
                new String[]{"INFO", "HTTP GET /api/v1/products completed in 9ms (status=200)"},
                new String[]{"INFO", "Background job inventory-sync finished in 1.4s"},
                new String[]{"INFO", "HTTP GET /api/v1/users/me completed in 6ms (status=200)"},
                new String[]{"WARN", "Retrying upstream call to shipping-rates (attempt 2/3)"},
                new String[]{"INFO", "Session refreshed for usr_1043"},
                new String[]{"INFO", "HTTP GET /api/v1/orders/ORD-93821 completed in 11ms (status=200)"},
                new String[]{"INFO", "Email receipt queued for order ORD-93821"},
                new String[]{"INFO", "HTTP PUT /api/v1/profile completed in 18ms (status=200)"},
                new String[]{"INFO", "Feature flag cache reloaded (42 flags)"},
                new String[]{"INFO", "HTTP GET /api/v1/orders completed in 15ms (status=200)"},
                new String[]{"INFO", "Webhook delivered to https://hooks.example.com/orders (200)"},
                new String[]{"ERROR", "Failed credit card authorization: card declined by issuing bank (PRTL-402)"},
                new String[]{"INFO", "HTTP GET /api/v1/catalog completed in 12ms (status=200)"},
                new String[]{"INFO", "Metrics flushed to collector (512 points)"}
        );

        // Spread over the last hour, oldest first, so charts and alert windows have data on first boot.
        int seedCount = 360;
        Instant now = Instant.now();
        for (int i = 0; i < seedCount; i++) {
            String svc = services[i % services.length];
            String[] event = events.get((i * 7) % events.size());
            String lvl = event[0];
            String env = envs[i % envs.length];
            String msg = event[1];

            logService.ingestLog(LogEntryDto.builder()
                    .fullTimestamp(now.minusSeconds((long) (seedCount - i) * 10).toString())
                    .service(svc)
                    .level(lvl)
                    .environment(env)
                    .message(msg)
                    .traceId("trc_" + UUID.randomUUID().toString().substring(0, 12))
                    .requestId("req_" + UUID.randomUUID().toString().substring(0, 8))
                    .userId(i % 3 == 0 ? "usr_" + (1000 + i) : null)
                    .host("node-us-east-" + (1 + (i % 3)))
                    .metadata(Map.of("tenant", "acme-corp", "attempt", i + 1, "region", "us-east-1"))
                    .stackTrace("ERROR".equals(lvl) ? "java.lang.RuntimeException: Operation timed out at io.eggless.Service.execute(Service.java:84)" : null)
                    .build());
        }

        log.info("Observability platform initialized successfully with initial seed data.");
    }
}
