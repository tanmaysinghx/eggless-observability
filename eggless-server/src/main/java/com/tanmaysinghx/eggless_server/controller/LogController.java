package com.tanmaysinghx.eggless_server.controller;

import com.tanmaysinghx.eggless_server.dto.ApiResponse;
import com.tanmaysinghx.eggless_server.dto.LogEntryDto;
import com.tanmaysinghx.eggless_server.dto.LogStatsDto;
import com.tanmaysinghx.eggless_server.service.ApiKeyService;
import com.tanmaysinghx.eggless_server.service.LogService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/logs")
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequiredArgsConstructor
public class LogController {

    static final String API_KEY_HEADER = "X-API-Key";
    private static final int MAX_BATCH = 1000;

    private final LogService logService;
    private final ApiKeyService apiKeyService;

    @Value("${eggless.ingest.require-api-key:true}")
    private boolean requireApiKey;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLogs(
            @RequestParam(required = false) String service,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String environment,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String timeRange,
            @RequestParam(defaultValue = "500") int limit,
            @RequestParam(defaultValue = "0") int offset
    ) {
        Map<String, Object> result = logService.queryLogs(service, level, environment, search, timeRange, limit, offset);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PostMapping({"", "/ingest"})
    public ResponseEntity<ApiResponse<LogEntryDto>> ingestSingleLog(
            @RequestHeader(value = API_KEY_HEADER, required = false) String apiKey,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestBody LogEntryDto payload) {
        if (!authorized(apiKey, authorization)) return unauthorized();
        LogEntryDto saved = logService.ingestLog(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(saved, "Log ingested successfully"));
    }

    @PostMapping("/batch")
    public ResponseEntity<ApiResponse<List<LogEntryDto>>> ingestBatch(
            @RequestHeader(value = API_KEY_HEADER, required = false) String apiKey,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestBody List<LogEntryDto> payloads) {
        if (!authorized(apiKey, authorization)) return unauthorized();
        if (payloads.size() > MAX_BATCH) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(ApiResponse.error("Batch exceeds " + MAX_BATCH + " logs"));
        }
        List<LogEntryDto> saved = logService.ingestBatch(payloads);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(saved, saved.size() + " logs ingested successfully"));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<LogStatsDto>> getStats() {
        LogStatsDto stats = logService.getStats();
        return ResponseEntity.ok(ApiResponse.ok(stats));
    }

    /** Ingestion accepts an Eggless API key as X-API-Key or "Authorization: Bearer egg_sec_...". */
    private boolean authorized(String apiKey, String authorization) {
        if (!requireApiKey) return true;
        String token = apiKey;
        if ((token == null || token.isBlank()) && authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            token = authorization.substring(7);
        }
        return apiKeyService.validateToken(token);
    }

    private static <T> ResponseEntity<ApiResponse<T>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("A valid Eggless API key is required (X-API-Key header). Create one under Settings → API Keys."));
    }
}
