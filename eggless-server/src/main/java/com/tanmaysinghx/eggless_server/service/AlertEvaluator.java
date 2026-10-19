package com.tanmaysinghx.eggless_server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tanmaysinghx.eggless_server.entity.AlertRuleEntity;
import com.tanmaysinghx.eggless_server.query.AlertCondition;
import com.tanmaysinghx.eggless_server.query.LogQuery;
import com.tanmaysinghx.eggless_server.repository.AlertRuleRepository;
import com.tanmaysinghx.eggless_server.repository.LogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Periodically evaluates enabled alert rules against recent logs. A rule moves to "triggered" when
 * its condition is breached over its window and back to "ok" when it recovers. If the rule's channel
 * contains an http(s) URL, a JSON message is POSTed to it on each transition into "triggered".
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AlertEvaluator {

    private static final Pattern URL = Pattern.compile("https?://\\S+");
    private static final Duration DEFAULT_WINDOW = Duration.ofMinutes(5);
    private static final DateTimeFormatter TRIGGERED_FORMAT = DateTimeFormatter.ofPattern("MMM dd, HH:mm:ss 'UTC'")
            .withZone(ZoneOffset.UTC);

    private final AlertRuleRepository alertRuleRepository;
    private final LogRepository logRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @Scheduled(fixedDelayString = "${eggless.alerts.evaluation-interval-ms:30000}", initialDelay = 10000)
    @Transactional
    public void evaluateAll() {
        Instant now = Instant.now();
        for (AlertRuleEntity rule : alertRuleRepository.findAll()) {
            if (!rule.isEnabled()) continue;
            try {
                evaluate(rule, now);
            } catch (IllegalArgumentException e) {
                log.warn("Skipping alert rule '{}' ({}): {}", rule.getName(), rule.getId(), e.getMessage());
            }
        }
    }

    /** Outcome of a manual rule test: the current value and whether a webhook accepted the test message. */
    public record TestResult(double value, boolean breached, boolean webhookConfigured, Integer webhookStatus, String webhookError) {}

    /** Measures the rule now and sends a test message to its webhook, if it has one. Does not change the rule. */
    public TestResult test(AlertRuleEntity rule, Instant now) {
        AlertCondition condition = AlertCondition.parse(rule.getCondition());
        Duration window = Optional.ofNullable(LogQuery.parseWindow(rule.getWindow())).orElse(DEFAULT_WINDOW);
        double value = measure(rule, condition, now.minus(window), now);
        boolean breached = condition.breached(value);
        String text = String.format("🥚 Eggless test message for alert \"%s\": %s is currently %.1f over %s (%s)",
                rule.getName(), condition.metric(), value, rule.getWindow(), breached ? "would fire" : "not firing");
        Optional<HttpRequest> request = webhookRequest(rule, text, value);
        if (request.isEmpty()) return new TestResult(value, breached, false, null, null);
        try {
            int status = httpClient.send(request.get(), HttpResponse.BodyHandlers.discarding()).statusCode();
            return new TestResult(value, breached, true, status, status >= 300 ? "Webhook returned HTTP " + status : null);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new TestResult(value, breached, true, null, "Interrupted");
        } catch (Exception e) {
            return new TestResult(value, breached, true, null, e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
        }
    }

    void evaluate(AlertRuleEntity rule, Instant now) {
        AlertCondition condition = AlertCondition.parse(rule.getCondition());
        Duration window = Optional.ofNullable(LogQuery.parseWindow(rule.getWindow())).orElse(DEFAULT_WINDOW);
        double value = measure(rule, condition, now.minus(window), now);
        boolean breached = condition.breached(value);

        String previous = rule.getStatus();
        if (breached && !"triggered".equals(previous)) {
            rule.setStatus("triggered");
            rule.setLastTriggered(TRIGGERED_FORMAT.format(now));
            log.info("Alert '{}' triggered: {} = {} over {}", rule.getName(), condition.metric(), value, rule.getWindow());
            notifyChannel(rule, value);
        } else if (!breached && "triggered".equals(previous)) {
            rule.setStatus("ok");
            log.info("Alert '{}' recovered: {} = {}", rule.getName(), condition.metric(), value);
        }
        alertRuleRepository.save(rule);
    }

    private double measure(AlertRuleEntity rule, AlertCondition condition, Instant from, Instant to) {
        LogQuery.Builder base = LogQuery.builder()
                .service(rule.getApplication())
                .search(rule.getQuery())
                .since(from)
                .until(to);
        return switch (condition.metric()) {
            case "errors" -> countWithLevels(base, List.of("ERROR", "FATAL"));
            case "error_rate" -> {
                long total = logRepository.count(base.build().toSpecification());
                yield total == 0 ? 0 : 100.0 * countWithLevels(base, List.of("ERROR", "FATAL")) / total;
            }
            default -> condition.level() == null
                    ? logRepository.count(base.build().toSpecification())
                    : countWithLevels(base, List.of(condition.level()));
        };
    }

    /** Counts logs matching the rule query that also have one of the given levels. */
    private long countWithLevels(LogQuery.Builder base, List<String> levels) {
        LogQuery q = base.build();
        List<String> effective = q.levels().isEmpty() ? levels
                : q.levels().stream().filter(levels::contains).toList();
        if (effective.isEmpty()) return 0;
        LogQuery narrowed = new LogQuery(effective, q.service(), q.environment(), q.host(), q.traceId(),
                q.requestId(), q.userId(), q.messageContains(), q.freeText(), q.since(), q.until());
        return logRepository.count(narrowed.toSpecification());
    }

    private void notifyChannel(AlertRuleEntity rule, double value) {
        String text = String.format("🥚 Eggless alert \"%s\" triggered: %s (value %.1f over %s, application %s)",
                rule.getName(), rule.getCondition(), value, rule.getWindow(), rule.getApplication());
        try {
            Optional<HttpRequest> request = webhookRequest(rule, text, value);
            if (request.isEmpty()) return;
            httpClient.sendAsync(request.get(), HttpResponse.BodyHandlers.discarding())
                    .whenComplete((res, err) -> {
                        if (err != null) log.warn("Alert webhook for '{}' failed: {}", rule.getName(), err.getMessage());
                        else if (res.statusCode() >= 300) log.warn("Alert webhook for '{}' returned HTTP {}", rule.getName(), res.statusCode());
                    });
        } catch (Exception e) {
            log.warn("Alert webhook for '{}' could not be sent: {}", rule.getName(), e.getMessage());
        }
    }

    /** The webhook POST for the rule's channel, or empty when the channel has no http(s) URL. */
    private Optional<HttpRequest> webhookRequest(AlertRuleEntity rule, String text, double value) {
        Matcher m = URL.matcher(rule.getChannel() == null ? "" : rule.getChannel());
        if (!m.find()) return Optional.empty();
        try {
            // "text" is read by Slack/Mattermost/Google Chat, "content" by Discord.
            String body = objectMapper.writeValueAsString(Map.of(
                    "text", text, "content", text,
                    "alert", Map.of("id", rule.getId(), "name", rule.getName(), "condition", rule.getCondition(),
                            "value", value, "window", rule.getWindow(), "application", rule.getApplication())));
            return Optional.of(HttpRequest.newBuilder(URI.create(m.group()))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build());
        } catch (Exception e) {
            throw new IllegalArgumentException("Webhook URL is not valid: " + e.getMessage(), e);
        }
    }
}
