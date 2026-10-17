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
        String[] levels = {"INFO", "INFO", "INFO", "WARN", "ERROR"};
        String[] envs = {"production", "production", "staging"};

        List<String> messages = List.of(
                "OIDC PKCE authorization token exchanged successfully for sub=usr_99812",
                "HTTP GET /api/v1/orders completed in 14ms (status=200)",
                "HikariCP connection pool latency spike: acquisition took 42ms",
                "Payment settlement transaction tx_99182 authorized for $142.50",
                "Redis cache hit for key session:user:99812 (ttl=3540s)",
                "Failed credit card authorization: card declined by issuing bank (PRTL-402)",
                "Dispatched batch of 48 webhook notifications to subscribed endpoints",
                "Ingress routing SSL handshake completed with TLSv1.3",
                "Slow query detected on orders_archive: execution took 128ms",
                "Portal SSO user authenticated via External Auth API: admin@portalsso.local"
        );

        for (int i = 0; i < 40; i++) {
            String svc = services[i % services.length];
            String lvl = levels[i % levels.length];
            String env = envs[i % envs.length];
            String msg = messages.get(i % messages.size());

            logService.ingestLog(LogEntryDto.builder()
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
