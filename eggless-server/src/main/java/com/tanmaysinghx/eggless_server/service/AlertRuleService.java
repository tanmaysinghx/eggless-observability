package com.tanmaysinghx.eggless_server.service;

import com.tanmaysinghx.eggless_server.dto.AlertRuleDto;
import com.tanmaysinghx.eggless_server.entity.AlertRuleEntity;
import com.tanmaysinghx.eggless_server.repository.AlertRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AlertRuleService {

    private final AlertRuleRepository alertRuleRepository;

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
                .name(dto.getName())
                .application(dto.getApplication() != null ? dto.getApplication() : "all")
                .query(dto.getQuery())
                .condition(dto.getCondition() != null ? dto.getCondition() : "error_count > 50")
                .window(dto.getWindow() != null ? dto.getWindow() : "5m")
                .channel(dto.getChannel() != null ? dto.getChannel() : "Slack #alerts")
                .enabled(true)
                .status("ok")
                .createdAt(Instant.now())
                .build();

        return toDto(alertRuleRepository.save(entity));
    }

    @Transactional
    public AlertRuleDto toggleRule(String id) {
        AlertRuleEntity entity = alertRuleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Alert rule not found: " + id));

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
