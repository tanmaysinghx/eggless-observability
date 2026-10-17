package com.tanmaysinghx.eggless_server.controller;

import com.tanmaysinghx.eggless_server.dto.AlertRuleDto;
import com.tanmaysinghx.eggless_server.dto.ApiResponse;
import com.tanmaysinghx.eggless_server.service.AlertRuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/alerts")
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequiredArgsConstructor
public class AlertController {

    private final AlertRuleService alertRuleService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AlertRuleDto>>> getAlerts() {
        List<AlertRuleDto> rules = alertRuleService.getAllRules();
        return ResponseEntity.ok(ApiResponse.ok(rules));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AlertRuleDto>> createAlert(@RequestBody AlertRuleDto ruleDto) {
        AlertRuleDto created = alertRuleService.createRule(ruleDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(created));
    }

    @PutMapping("/toggle")
    public ResponseEntity<ApiResponse<AlertRuleDto>> toggleAlert(@RequestParam String id) {
        AlertRuleDto updated = alertRuleService.toggleRule(id);
        return ResponseEntity.ok(ApiResponse.ok(updated));
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<Void>> deleteAlert(@RequestParam String id) {
        alertRuleService.deleteRule(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Alert deleted successfully"));
    }
}
