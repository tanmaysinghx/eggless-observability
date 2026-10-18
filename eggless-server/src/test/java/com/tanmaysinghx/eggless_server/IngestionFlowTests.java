package com.tanmaysinghx.eggless_server;

import com.tanmaysinghx.eggless_server.controller.LogController;
import com.tanmaysinghx.eggless_server.dto.AlertRuleDto;
import com.tanmaysinghx.eggless_server.dto.LogEntryDto;
import com.tanmaysinghx.eggless_server.dto.MetricsSummaryDto;
import com.tanmaysinghx.eggless_server.repository.AlertRuleRepository;
import com.tanmaysinghx.eggless_server.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Ingest → query → metrics → alert, against an in-memory database. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:ingestflow;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "eggless.home=${java.io.tmpdir}/eggless-test-${random.uuid}",
        "eggless.alerts.evaluation-interval-ms=3600000"
})
class IngestionFlowTests {

    @Autowired LogController logController;
    @Autowired LogService logService;
    @Autowired ApiKeyService apiKeyService;
    @Autowired MetricsService metricsService;
    @Autowired ApplicationService applicationService;
    @Autowired AlertRuleService alertRuleService;
    @Autowired AlertEvaluator alertEvaluator;
    @Autowired AlertRuleRepository alertRuleRepository;

    private static LogEntryDto log(String service, String level, String message) {
        return LogEntryDto.builder().service(service).level(level).environment("production").message(message).build();
    }

    @Test
    void ingestionRequiresAValidApiKey() {
        assertThat(logController.ingestSingleLog(null, null, log("svc", "INFO", "hi")).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(logController.ingestSingleLog("egg_sec_wrong", null, log("svc", "INFO", "hi")).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);

        String token = apiKeyService.createKey("test").getToken();
        assertThat(logController.ingestSingleLog(token, null, log("svc", "INFO", "hi")).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        assertThat(logController.ingestBatch(null, "Bearer " + token, List.of(log("svc", "INFO", "a"))).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void queryMetricsApplicationsAndAlertsReflectIngestedLogs() {
        for (int i = 0; i < 9; i++) logService.ingestLog(log("checkout-api", "INFO", "order placed " + i));
        logService.ingestLog(log("checkout-api", "ERROR", "Stripe gateway timeout"));
        logService.ingestLog(log("checkout-api", "ERROR", "Stripe gateway timeout"));
        // An old log, sent with its own timestamp, falls outside the 1h window.
        LogEntryDto old = log("checkout-api", "ERROR", "ancient");
        old.setFullTimestamp(Instant.now().minusSeconds(7200).toString());
        logService.ingestLog(old);

        @SuppressWarnings("unchecked")
        List<LogEntryDto> errors = (List<LogEntryDto>) logService
                .queryLogs(null, null, null, "service:checkout-api AND level:ERROR \"gateway\"", "1h", 100, 0).get("logs");
        assertThat(errors).hasSize(2).allMatch(l -> l.getMessage().equals("Stripe gateway timeout"));

        MetricsSummaryDto m = metricsService.summary("1h", "checkout-api", null);
        assertThat(m.getTotalLogs()).isEqualTo(11);
        assertThat(m.getErrorCount()).isEqualTo(2);
        assertThat(m.getTimeseries()).hasSize(MetricsService.BUCKETS);
        assertThat(m.getTimeseries().stream().mapToLong(MetricsSummaryDto.Bucket::getCount).sum()).isEqualTo(11);
        assertThat(m.getTopErrors().getFirst().getMessage()).isEqualTo("Stripe gateway timeout");
        assertThat(m.getTopErrors().getFirst().getCount()).isEqualTo(2);

        assertThat(applicationService.getAllApplications())
                .filteredOn(a -> a.getName().equals("checkout-api"))
                .singleElement()
                .satisfies(a -> assertThat(a.getStatus()).isEqualTo("critical")); // 2 of 11 recent logs are errors

        AlertRuleDto rule = alertRuleService.createRule(AlertRuleDto.builder()
                .name("Stripe timeouts").application("checkout-api").query("gateway")
                .condition("ERROR >= 2 in 5 minutes").window("5m").channel("In-app only").build());
        AlertRuleDto quiet = alertRuleService.createRule(AlertRuleDto.builder()
                .name("Never").application("checkout-api").query("level:WARN")
                .condition("count > 0").window("5m").build());

        alertEvaluator.evaluateAll();

        assertThat(alertRuleRepository.findById(rule.getId()).orElseThrow().getStatus()).isEqualTo("triggered");
        assertThat(alertRuleRepository.findById(rule.getId()).orElseThrow().getLastTriggered()).isNotBlank();
        assertThat(alertRuleRepository.findById(quiet.getId()).orElseThrow().getStatus()).isEqualTo("ok");
    }

    @Test
    void ingestionCannotOverwriteAnExistingLog() {
        LogEntryDto first = logService.ingestLog(log("svc", "INFO", "original"));
        LogEntryDto attacker = log("svc", "INFO", "replaced");
        attacker.setId(first.getId());

        assertThat(logService.ingestLog(attacker).getId()).isNotEqualTo(first.getId());
        @SuppressWarnings("unchecked")
        List<LogEntryDto> found = (List<LogEntryDto>) logService.queryLogs(null, null, null, "original", null, 10, 0).get("logs");
        assertThat(found).extracting(LogEntryDto::getId).contains(first.getId());
    }

    @Test
    void invalidAlertRulesAreRejected() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> alertRuleService.createRule(AlertRuleDto.builder()
                        .name("bad").condition("lots of errors").window("5m").build()))
                .isInstanceOf(IllegalArgumentException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> alertRuleService.createRule(AlertRuleDto.builder()
                        .name("bad").condition("count > 1").window("soon").build()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
