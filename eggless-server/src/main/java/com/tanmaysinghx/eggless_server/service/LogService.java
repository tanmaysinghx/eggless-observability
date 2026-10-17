package com.tanmaysinghx.eggless_server.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tanmaysinghx.eggless_server.dto.LogEntryDto;
import com.tanmaysinghx.eggless_server.dto.LogStatsDto;
import com.tanmaysinghx.eggless_server.entity.LogEntryEntity;
import com.tanmaysinghx.eggless_server.repository.LogRepository;
import com.tanmaysinghx.eggless_server.websocket.LogStreamWebSocketHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LogService {

    private final LogRepository logRepository;
    private final ApplicationService applicationService;
    private final LogStreamWebSocketHandler webSocketHandler;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public LogEntryDto ingestLog(LogEntryDto dto) {
        Instant now = Instant.now();
        String id = dto.getId() != null ? dto.getId() : "log_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String timestamp = dto.getTimestamp() != null ? dto.getTimestamp() : DateTimeFormatter.ofPattern("HH:mm:ss.SSS")
                .withZone(ZoneOffset.UTC)
                .format(now);

        String metadataJson = null;
        if (dto.getMetadata() != null && !dto.getMetadata().isEmpty()) {
            try {
                metadataJson = objectMapper.writeValueAsString(dto.getMetadata());
            } catch (JsonProcessingException ignored) {}
        }

        LogEntryEntity entity = LogEntryEntity.builder()
                .id(id)
                .timestamp(timestamp)
                .fullTimestamp(now)
                .level(dto.getLevel() != null ? dto.getLevel().toUpperCase() : "INFO")
                .service(dto.getService() != null ? dto.getService() : "default-service")
                .environment(dto.getEnvironment() != null ? dto.getEnvironment() : "production")
                .message(dto.getMessage() != null ? dto.getMessage() : "")
                .traceId(dto.getTraceId())
                .requestId(dto.getRequestId())
                .userId(dto.getUserId())
                .host(dto.getHost() != null ? dto.getHost() : "app-node-1")
                .metadata(metadataJson)
                .stackTrace(dto.getStackTrace())
                .build();

        LogEntryEntity saved = logRepository.save(entity);
        LogEntryDto result = toDto(saved);

        // Update application health & metrics
        applicationService.recordLogActivity(saved.getService(), saved.getEnvironment(), saved.getLevel());

        // Broadcast to live-tail WebSocket subscribers
        try {
            String json = objectMapper.writeValueAsString(result);
            webSocketHandler.broadcast(json);
        } catch (Exception e) {
            log.debug("WebSocket broadcast error: {}", e.getMessage());
        }

        return result;
    }

    @Transactional
    public List<LogEntryDto> ingestBatch(List<LogEntryDto> dtos) {
        return dtos.stream().map(this::ingestLog).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> queryLogs(
            String service,
            String level,
            String environment,
            String search,
            String timeRange,
            int limit,
            int offset
    ) {
        Instant since = null;
        if (timeRange != null && !timeRange.isBlank()) {
            since = switch (timeRange.toLowerCase()) {
                case "15m" -> Instant.now().minus(Duration.ofMinutes(15));
                case "1h" -> Instant.now().minus(Duration.ofHours(1));
                case "6h" -> Instant.now().minus(Duration.ofHours(6));
                case "24h" -> Instant.now().minus(Duration.ofHours(24));
                case "7d" -> Instant.now().minus(Duration.ofDays(7));
                default -> null;
            };
        }

        int pageSize = Math.min(Math.max(limit, 10), 1000);
        int pageNumber = Math.max(offset / pageSize, 0);
        Pageable pageable = PageRequest.of(pageNumber, pageSize);

        String svcParam = (service != null && !service.equalsIgnoreCase("all")) ? service : null;
        String lvlParam = (level != null && !level.equalsIgnoreCase("all")) ? level.toUpperCase() : null;
        String envParam = (environment != null && !environment.equalsIgnoreCase("all")) ? environment : null;
        String searchParam = (search != null && !search.isBlank()) ? search.trim() : null;

        List<LogEntryEntity> logs = logRepository.findLogsWithFilter(
                svcParam,
                lvlParam,
                envParam,
                searchParam,
                since,
                pageable
        );

        List<LogEntryDto> dtoList = logs.stream().map(this::toDto).collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("logs", dtoList);
        response.put("total", logRepository.count());
        response.put("count", dtoList.size());
        return response;
    }

    @Transactional(readOnly = true)
    public LogStatsDto getStats() {
        long total = logRepository.count();
        long errors = logRepository.countByLevel("ERROR") + logRepository.countByLevel("FATAL");
        long warns = logRepository.countByLevel("WARN");
        long apps = logRepository.countDistinctServices();

        return LogStatsDto.builder()
                .totalLogs(total)
                .errorCount(errors)
                .warnCount(warns)
                .activeApplications(Math.max(apps, 1))
                .logsPerMin(Math.round(total * 1.5))
                .build();
    }

    public LogEntryDto toDto(LogEntryEntity entity) {
        Map<String, Object> meta = null;
        if (entity.getMetadata() != null && !entity.getMetadata().isBlank()) {
            try {
                meta = objectMapper.readValue(entity.getMetadata(), new TypeReference<>() {});
            } catch (Exception ignored) {}
        }

        return LogEntryDto.builder()
                .id(entity.getId())
                .timestamp(entity.getTimestamp())
                .fullTimestamp(entity.getFullTimestamp() != null ? entity.getFullTimestamp().toString() : Instant.now().toString())
                .level(entity.getLevel())
                .service(entity.getService())
                .environment(entity.getEnvironment())
                .message(entity.getMessage())
                .traceId(entity.getTraceId())
                .requestId(entity.getRequestId())
                .userId(entity.getUserId())
                .host(entity.getHost())
                .metadata(meta != null ? meta : Collections.emptyMap())
                .stackTrace(entity.getStackTrace())
                .build();
    }
}
