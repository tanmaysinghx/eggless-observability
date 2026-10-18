package com.tanmaysinghx.eggless_server.controller;

import com.tanmaysinghx.eggless_server.dto.ApiResponse;
import com.tanmaysinghx.eggless_server.dto.LogEntryDto;
import com.tanmaysinghx.eggless_server.dto.LogStatsDto;
import com.tanmaysinghx.eggless_server.service.ApiKeyService;
import com.tanmaysinghx.eggless_server.service.ApplicationService;
import com.tanmaysinghx.eggless_server.service.LogService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/logs")
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequiredArgsConstructor
public class LogController {

    static final String API_KEY_HEADER = "X-API-Key";
    private static final int MAX_BATCH = 1000;

    private final LogService logService;
    private final ApiKeyService apiKeyService;
    private final ApplicationService applicationService;

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
        Optional<Caller> caller = caller(apiKey, authorization);
        if (caller.isEmpty()) return unauthorized();
        String rejected = caller.get().claim(List.of(payload));
        if (rejected != null) return forbidden(caller.get(), rejected);
        LogEntryDto saved = logService.ingestLog(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(saved, "Log ingested successfully"));
    }

    @PostMapping("/batch")
    public ResponseEntity<ApiResponse<List<LogEntryDto>>> ingestBatch(
            @RequestHeader(value = API_KEY_HEADER, required = false) String apiKey,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestBody List<LogEntryDto> payloads) {
        Optional<Caller> caller = caller(apiKey, authorization);
        if (caller.isEmpty()) return unauthorized();
        if (payloads.size() > MAX_BATCH) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(ApiResponse.error("Batch exceeds " + MAX_BATCH + " logs"));
        }
        String rejected = caller.get().claim(payloads);
        if (rejected != null) return forbidden(caller.get(), rejected);
        List<LogEntryDto> saved = logService.ingestBatch(payloads);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(saved, saved.size() + " logs ingested successfully"));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<LogStatsDto>> getStats() {
        LogStatsDto stats = logService.getStats();
        return ResponseEntity.ok(ApiResponse.ok(stats));
    }

    /**
     * Who is sending logs. {@code application} is set when the API key is bound to one application,
     * along with that application's registered environment.
     */
    record Caller(String application, String environment) {
        /**
         * Fills in the bound application (and its environment) on logs that leave them out. Returns
         * the first service name the key may not send for, or null when every log is allowed.
         */
        String claim(List<LogEntryDto> logs) {
            if (application == null) return null;
            for (LogEntryDto log : logs) {
                if (log.getService() == null || log.getService().isBlank()) log.setService(application);
                else if (!log.getService().equals(application)) return log.getService();
                if ((log.getEnvironment() == null || log.getEnvironment().isBlank()) && environment != null) {
                    log.setEnvironment(environment);
                }
            }
            return null;
        }
    }

    /**
     * Ingestion accepts an Eggless API key as X-API-Key or "Authorization: Bearer egg_sec_...".
     * Empty when the request must be rejected. A key that is sent is always checked, even when
     * keys are not required, so an application-bound key keeps its restriction.
     */
    private Optional<Caller> caller(String apiKey, String authorization) {
        String token = apiKey;
        if ((token == null || token.isBlank()) && authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            token = authorization.substring(7);
        }
        if (token == null || token.isBlank()) {
            return requireApiKey ? Optional.empty() : Optional.of(new Caller(null, null));
        }
        return apiKeyService.authenticate(token).map(k -> k.getApplication() == null ? new Caller(null, null)
                : new Caller(k.getApplication(), applicationService.environmentOf(k.getApplication()).orElse(null)));
    }

    private static <T> ResponseEntity<ApiResponse<T>> forbidden(Caller caller, String service) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(
                "This API key belongs to application '" + caller.application() + "' and cannot send logs for '" + service
                        + "'. Omit \"service\" or set it to '" + caller.application() + "'."));
    }

    private static <T> ResponseEntity<ApiResponse<T>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("A valid Eggless API key is required (X-API-Key header). Create one under Settings → API Keys."));
    }
}
