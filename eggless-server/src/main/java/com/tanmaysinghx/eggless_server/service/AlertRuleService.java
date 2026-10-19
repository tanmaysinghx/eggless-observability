package com.tanmaysinghx.eggless_server.service;

import com.tanmaysinghx.eggless_server.dto.AlertRuleDto;
import com.tanmaysinghx.eggless_server.entity.AlertRuleEntity;
import com.tanmaysinghx.eggless_server.query.AlertCondition;
import com.tanmaysinghx.eggless_server.query.LogQuery;
import com.tanmaysinghx.eggless_server.repository.AlertRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AlertRuleService {

    private final AlertRuleRepository alertRuleRepository;
    private final AlertEvaluator alertEvaluator;

    @Transactional(readOnly = true)
    public List<AlertRuleDto> getAllRules() {
        return alertRuleRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public AlertRuleDto createRule(AlertRuleDto dto) {
        AlertRuleEntity entity = AlertRuleEntity.builder()
                .id("alt_" + UUID.randomUUID().toString().substring(0, 8))
                .enabled(true)
                .status("ok")
                .createdAt(Instant.now())
                .build();
        apply(dto, entity);
        return toDto(alertRuleRepository.save(entity));
    }

    /** Replaces a rule's definition. Its state resets, so it fires again if still breached. */
    @Transactional
    public AlertRuleDto updateRule(String id, AlertRuleDto dto) {
        AlertRuleEntity entity = find(id);
        apply(dto, entity);
        entity.setStatus(entity.isEnabled() ? "ok" : "disabled");
        return toDto(alertRuleRepository.save(entity));
    }

    /** Measures the rule now and, if it has a webhook, sends a test message to it. Rule state is unchanged. */
    @Transactional(readOnly = true)
    public AlertEvaluator.TestResult testRule(String id) {
        return alertEvaluator.test(find(id), Instant.now());
    }

    private AlertRuleEntity find(String id) {
        return alertRuleRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Alert rule not found: " + id));
    }

    /** Validates the definition in {@code dto} and copies it onto {@code entity}. */
    private static void apply(AlertRuleDto dto, AlertRuleEntity entity) {
        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new IllegalArgumentException("Alert rule name is required");
        }
        String condition = dto.getCondition() != null ? dto.getCondition() : "error_count > 50";
        String window = dto.getWindow() != null ? dto.getWindow() : "5m";
        AlertCondition.parse(condition);
        if (LogQuery.parseWindow(window) == null) {
            throw new IllegalArgumentException("Window must look like 30s, 5m, 1h or 1d (got: " + window + ")");
        }
        entity.setName(dto.getName().trim());
        entity.setApplication(dto.getApplication() != null && !dto.getApplication().isBlank() ? dto.getApplication() : "all");
        entity.setQuery(dto.getQuery());
        entity.setCondition(condition);
        entity.setWindow(window);
        entity.setChannel(dto.getChannel() != null && !dto.getChannel().isBlank() ? dto.getChannel() : "In-app only");
    }

    @Transactional
    public AlertRuleDto toggleRule(String id) {
        AlertRuleEntity entity = find(id);
        entity.setEnabled(!entity.isEnabled());
        entity.setStatus(entity.isEnabled() ? "ok" : "disabled");
        return toDto(alertRuleRepository.save(entity));
    }

    @Transactional
    public void deleteRule(String id) {
        alertRuleRepository.deleteById(id);
    }

    public AlertRuleDto toDto(AlertRuleEntity entity) {
        return AlertRuleDto.builder()
                .id(entity.getId())
                .name(entity.getName())
                .application(entity.getApplication())
                .query(entity.getQuery())
                .condition(entity.getCondition())
                .window(entity.getWindow())
                .channel(entity.getChannel())
                .enabled(entity.isEnabled())
                .lastTriggered(entity.getLastTriggered())
                .status(entity.getStatus() != null ? entity.getStatus() : "ok")
                .build();
    }
}
