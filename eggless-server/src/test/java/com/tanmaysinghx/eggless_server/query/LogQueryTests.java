package com.tanmaysinghx.eggless_server.query;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LogQueryTests {

    @Test
    void parsesKeyValueTermsJoinedByAnd() {
        LogQuery q = LogQuery.builder().search("level:WARN AND service:auth-service AND message:'invalid token'").build();

        assertThat(q.levels()).containsExactly("WARN");
        assertThat(q.service()).isEqualTo("auth-service");
        assertThat(q.messageContains()).containsExactly("invalid token");
        assertThat(q.freeText()).isEmpty();
    }

    @Test
    void keepsFreeTextAndUnknownKeys() {
        LogQuery q = LogQuery.builder().search("level:error \"gateway timeout\" http://x/y").build();

        assertThat(q.levels()).containsExactly("ERROR");
        assertThat(q.freeText()).containsExactly("gateway timeout", "http://x/y");
    }

    @Test
    void ignoresAllAsAFilterValue() {
        LogQuery q = LogQuery.builder().service("all").environment("all").level("all").build();

        assertThat(q.service()).isNull();
        assertThat(q.environment()).isNull();
        assertThat(q.levels()).isEmpty();
    }

    @Test
    void parsesWindows() {
        assertThat(LogQuery.parseWindow("15m")).isEqualTo(Duration.ofMinutes(15));
        assertThat(LogQuery.parseWindow("24h")).isEqualTo(Duration.ofHours(24));
        assertThat(LogQuery.parseWindow("7d")).isEqualTo(Duration.ofDays(7));
        assertThat(LogQuery.parseWindow("Custom")).isNull();
        assertThat(LogQuery.parseWindow(null)).isNull();
    }

    @Test
    void parsesAlertConditions() {
        assertThat(AlertCondition.parse("ERROR > 50 logs in 5 minutes"))
                .isEqualTo(new AlertCondition("count", "ERROR", ">", 50));
        assertThat(AlertCondition.parse("error_rate > 5%"))
                .isEqualTo(new AlertCondition("error_rate", null, ">", 5));
        assertThat(AlertCondition.parse("count >= 100"))
                .isEqualTo(new AlertCondition("count", null, ">=", 100));
        assertThat(AlertCondition.parse("errors = 0").breached(0)).isTrue();

        for (String bad : List.of("", "lots of errors", "latency > 5")) {
            assertThatThrownBy(() -> AlertCondition.parse(bad)).isInstanceOf(IllegalArgumentException.class);
        }
    }
}
