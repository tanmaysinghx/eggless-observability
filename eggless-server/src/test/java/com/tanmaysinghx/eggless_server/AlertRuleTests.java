package com.tanmaysinghx.eggless_server;

import com.tanmaysinghx.eggless_server.dto.AlertRuleDto;
import com.tanmaysinghx.eggless_server.service.AlertEvaluator;
import com.tanmaysinghx.eggless_server.service.AlertRuleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.NoSuchElementException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:alertrules;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "eggless.home=${java.io.tmpdir}/eggless-test-${random.uuid}",
        "eggless.alerts.evaluation-interval-ms=3600000"
})
class AlertRuleTests {

    @Autowired AlertRuleService alertRuleService;

    private static AlertRuleDto rule(String name, String condition, String window) {
        return AlertRuleDto.builder().name(name).application("all").query("level:ERROR")
                .condition(condition).window(window).build();
    }

    @Test
    void updateReplacesTheDefinitionAndValidatesIt() {
        AlertRuleDto created = alertRuleService.createRule(rule("Errors", "ERROR > 5", "5m"));

        AlertRuleDto updated = alertRuleService.updateRule(created.getId(), rule("Many errors", "error_rate > 10%", "15m"));

        assertThat(updated.getId()).isEqualTo(created.getId());
        assertThat(updated.getName()).isEqualTo("Many errors");
        assertThat(updated.getCondition()).isEqualTo("error_rate > 10%");
        assertThat(updated.getWindow()).isEqualTo("15m");
        assertThat(updated.getStatus()).isEqualTo("ok");
        assertThatThrownBy(() -> alertRuleService.updateRule(created.getId(), rule("Bad", "ERROR > 5", "soon")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> alertRuleService.updateRule("alt_missing", rule("X", "count > 1", "5m")))
                .isInstanceOf(NoSuchElementException.class);
    }

    @Test
    void testMeasuresWithoutAWebhook() {
        AlertRuleDto created = alertRuleService.createRule(rule("Quiet", "count > 1000000", "1m"));

        AlertEvaluator.TestResult result = alertRuleService.testRule(created.getId());

        assertThat(result.webhookConfigured()).isFalse();
        assertThat(result.breached()).isFalse();
    }
}
