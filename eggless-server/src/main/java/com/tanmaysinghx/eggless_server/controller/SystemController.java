package com.tanmaysinghx.eggless_server.controller;

import com.tanmaysinghx.eggless_server.dto.ApiResponse;
import com.tanmaysinghx.eggless_server.service.RetentionService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Read-only view of server-side settings that are configured through environment variables. */
@RestController
@RequestMapping("/api/v1/system")
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequiredArgsConstructor
public class SystemController {

    private final RetentionService retentionService;

    @Value("${eggless.ingest.require-api-key:true}")
    private boolean requireApiKey;

    @Value("${eggless.alerts.evaluation-interval-ms:30000}")
    private long alertIntervalMs;

    @GetMapping("/info")
    public ResponseEntity<ApiResponse<Map<String, Object>>> info() {
        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "retentionDays", retentionService.getRetentionDays(),
                "requireApiKey", requireApiKey,
                "alertEvaluationIntervalSeconds", alertIntervalMs / 1000
        )));
    }
}
