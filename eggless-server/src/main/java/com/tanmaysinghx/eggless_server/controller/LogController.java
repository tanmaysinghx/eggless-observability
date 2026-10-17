package com.tanmaysinghx.eggless_server.controller;

import com.tanmaysinghx.eggless_server.dto.ApiResponse;
import com.tanmaysinghx.eggless_server.dto.LogEntryDto;
import com.tanmaysinghx.eggless_server.dto.LogStatsDto;
import com.tanmaysinghx.eggless_server.service.LogService;
import lombok.RequiredArgsConstructor;
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

    private final LogService logService;

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

    @PostMapping
    public ResponseEntity<ApiResponse<LogEntryDto>> ingestSingleLog(@RequestBody LogEntryDto payload) {
        LogEntryDto saved = logService.ingestLog(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(saved, "Log ingested successfully"));
    }

    @PostMapping("/batch")
    public ResponseEntity<ApiResponse<List<LogEntryDto>>> ingestBatch(@RequestBody List<LogEntryDto> payloads) {
        List<LogEntryDto> saved = logService.ingestBatch(payloads);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(saved, saved.size() + " logs ingested successfully"));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<LogStatsDto>> getStats() {
        LogStatsDto stats = logService.getStats();
        return ResponseEntity.ok(ApiResponse.ok(stats));
    }
}
