package com.tanmaysinghx.eggless_server.controller;

import com.tanmaysinghx.eggless_server.dto.ApiResponse;
import com.tanmaysinghx.eggless_server.dto.MetricsSummaryDto;
import com.tanmaysinghx.eggless_server.service.MetricsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/metrics")
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequiredArgsConstructor
public class MetricsController {

    private final MetricsService metricsService;

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<MetricsSummaryDto>> summary(
            @RequestParam(defaultValue = "1h") String timeRange,
            @RequestParam(required = false) String service,
            @RequestParam(required = false) String environment
    ) {
        return ResponseEntity.ok(ApiResponse.ok(metricsService.summary(timeRange, service, environment)));
    }
}
