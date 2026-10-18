package com.tanmaysinghx.eggless_server.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tanmaysinghx.eggless_server.dto.LogEntryDto;
import com.tanmaysinghx.eggless_server.dto.LogStatsDto;
import com.tanmaysinghx.eggless_server.entity.LogEntryEntity;
import com.tanmaysinghx.eggless_server.query.LogQuery;
import com.tanmaysinghx.eggless_server.repository.LogRepository;
import com.tanmaysinghx.eggless_server.websocket.LogStreamWebSocketHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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

    private static final Duration MAX_CLOCK_SKEW = Duration.ofMinutes(5);
    private static final DateTimeFormatter DISPLAY_TIME = DateTimeFormatter.ofPattern("HH:mm:ss.SSS").withZone(ZoneOffset.UTC);

    @Transactional
    public LogEntryDto ingestLog(LogEntryDto dto) {
        Instant now = Instant.now();
        Instant occurredAt = parseClientTimestamp(dto.getFullTimestamp(), now);
        // Ids are always server-assigned so a client cannot overwrite an existing log.
        String id = "log_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String timestamp = DISPLAY_TIME.format(occurredAt);

        String metadataJson = null;
        if (dto.getMetadata() != null && !dto.getMetadata().isEmpty()) {
            try {
                metadataJson = objectMapper.writeValueAsString(dto.getMetadata());
            } catch (JsonProcessingException ignored) {}
        }

        LogEntryEntity entity = LogEntryEntity.builder()
                .id(id)
                .timestamp(timestamp)
                .fullTimestamp(occurredAt)
                .level(clip(dto.getLevel() != null ? dto.getLevel().toUpperCase() : "INFO", 16))
                .service(clip(dto.getService() != null ? dto.getService() : "default-service", 64))
                .environment(clip(dto.getEnvironment() != null ? dto.getEnvironment() : "production", 32))
                .message(dto.getMessage() != null ? dto.getMessage() : "")
                .traceId(clip(dto.getTraceId(), 64))
                .requestId(clip(dto.getRequestId(), 64))
                .userId(clip(dto.getUserId(), 64))
                .host(clip(dto.getHost() != null ? dto.getHost() : "app-node-1", 64))
                .metadata(metadataJson)
                .stackTrace(dto.getStackTrace())
                .build();

        LogEntryEntity saved = logRepository.save(entity);
        LogEntryDto result = toDto(saved);

        // Update application health & metrics
        applicationService.recordLogActivity(saved.getService(), saved.getEnvironment(), saved.getFullTimestamp());

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
        Duration window = LogQuery.parseWindow(timeRange);
        LogQuery query = LogQuery.builder()
                .service(service)
                .level(level)
                .environment(environment)
                .search(search)
                .since(window != null ? Instant.now().minus(window) : null)
                .build();

        int pageSize = Math.min(Math.max(limit, 10), 1000);
        int pageNumber = Math.max(offset / pageSize, 0);
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(Sort.Direction.DESC, "fullTimestamp"));

        Page<LogEntryEntity> page = logRepository.findAll(query.toSpecification(), pageable);
        List<LogEntryDto> dtoList = page.getContent().stream().map(this::toDto).collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("logs", dtoList);
        response.put("total", page.getTotalElements());
        response.put("count", dtoList.size());
        return response;
    }

    @Transactional(readOnly = true)
    public LogStatsDto getStats() {
        long total = logRepository.count();
        long errors = logRepository.countByLevel("ERROR") + logRepository.countByLevel("FATAL");
        long warns = logRepository.countByLevel("WARN");
        long apps = logRepository.countDistinctServices();
        Instant now = Instant.now();
        long lastFiveMinutes = logRepository.count(LogQuery.builder().since(now.minus(Duration.ofMinutes(5))).until(now).build().toSpecification());

        return LogStatsDto.builder()
                .totalLogs(total)
                .errorCount(errors)
                .warnCount(warns)
                .activeApplications(apps)
                .logsPerMin(Math.round(lastFiveMinutes / 5.0))
                .build();
    }

    private static String clip(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    /** Uses the time the client says the log happened, unless it is missing, unparseable or in the future. */
    private static Instant parseClientTimestamp(String value, Instant now) {
        if (value == null || value.isBlank()) return now;
        try {
            Instant parsed = Instant.parse(value);
            return parsed.isAfter(now.plus(MAX_CLOCK_SKEW)) ? now : parsed;
        } catch (Exception e) {
            return now;
        }
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
